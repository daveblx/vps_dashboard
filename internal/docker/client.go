package docker

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const defaultDockerSocket = "/var/run/docker.sock"

type Client struct {
	httpClient *http.Client
	baseURL    string
}

type containerSummary struct {
	ID      string            `json:"Id"`
	Names   []string          `json:"Names"`
	Image   string            `json:"Image"`
	State   string            `json:"State"`
	Status  string            `json:"Status"`
	Created int64             `json:"Created"`
	Labels  map[string]string `json:"Labels"`
}

type containerInspect struct {
	State struct {
		Status    string `json:"Status"`
		StartedAt string `json:"StartedAt"`
	} `json:"State"`
}

type StatsResponse struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage  uint64   `json:"total_usage"`
			PercpuUsage []uint64 `json:"percpu_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs  uint32 `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Limit uint64 `json:"limit"`
	} `json:"memory_stats"`
}

// NewClient creates a read-only Docker API client. The application only uses
// list, inspect, stats, and logs operations; no lifecycle mutations.
func NewClient() (*Client, error) {
	cli, err := newClientFromEnv()
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := cli.Ping(ctx); err != nil {
		cli.Close()
		return nil, fmt.Errorf("docker daemon unreachable: %w", err)
	}

	return cli, nil
}

func newClientFromEnv() (*Client, error) {
	dockerHost := os.Getenv("DOCKER_HOST")
	if dockerHost == "" {
		return newUnixClient(defaultDockerSocket), nil
	}

	u, err := url.Parse(dockerHost)
	if err != nil {
		return nil, fmt.Errorf("parse DOCKER_HOST: %w", err)
	}

	switch u.Scheme {
	case "unix":
		return newUnixClient(u.Path), nil
	case "tcp", "http", "https":
		scheme := u.Scheme
		if scheme == "tcp" {
			scheme = "http"
		}
		httpClient := &http.Client{Timeout: 0}
		if scheme == "https" || os.Getenv("DOCKER_TLS_VERIFY") != "" {
			scheme = "https"
			transport, err := tlsTransportFromEnv()
			if err != nil {
				return nil, err
			}
			httpClient.Transport = transport
		}
		return &Client{
			httpClient: httpClient,
			baseURL:    scheme + "://" + u.Host,
		}, nil
	case "npipe":
		return nil, fmt.Errorf("DOCKER_HOST scheme %q is not supported", u.Scheme)
	default:
		return nil, fmt.Errorf("unsupported DOCKER_HOST scheme %q", u.Scheme)
	}
}

func tlsTransportFromEnv() (*http.Transport, error) {
	certPath := os.Getenv("DOCKER_CERT_PATH")
	if certPath == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("resolve Docker cert path: %w", err)
		}
		certPath = filepath.Join(home, ".docker")
	}

	tlsConfig := &tls.Config{MinVersion: tls.VersionTLS12}

	caPath := filepath.Join(certPath, "ca.pem")
	if caPEM, err := os.ReadFile(caPath); err == nil {
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(caPEM) {
			return nil, fmt.Errorf("parse Docker CA certificate %s", caPath)
		}
		tlsConfig.RootCAs = pool
	} else if os.Getenv("DOCKER_TLS_VERIFY") != "" {
		return nil, fmt.Errorf("read Docker CA certificate %s: %w", caPath, err)
	}

	certPathPEM := filepath.Join(certPath, "cert.pem")
	keyPathPEM := filepath.Join(certPath, "key.pem")
	if _, certErr := os.Stat(certPathPEM); certErr == nil {
		cert, err := tls.LoadX509KeyPair(certPathPEM, keyPathPEM)
		if err != nil {
			return nil, fmt.Errorf("load Docker client certificate: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	} else if os.Getenv("DOCKER_TLS_VERIFY") != "" {
		return nil, fmt.Errorf("read Docker client certificate %s: %w", certPathPEM, certErr)
	}

	return &http.Transport{TLSClientConfig: tlsConfig}, nil
}

func newUnixClient(socketPath string) *Client {
	if socketPath == "" {
		socketPath = defaultDockerSocket
	}
	socketPath = filepath.Clean(socketPath)

	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", socketPath)
		},
	}

	return &Client{
		httpClient: &http.Client{Transport: transport},
		baseURL:    "http://docker",
	}
}

func (c *Client) Close() error {
	if c == nil || c.httpClient == nil {
		return nil
	}
	if transport, ok := c.httpClient.Transport.(*http.Transport); ok {
		transport.CloseIdleConnections()
	}
	return nil
}

func (c *Client) Ping(ctx context.Context) error {
	resp, err := c.do(ctx, http.MethodGet, "/_ping", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return responseError(resp)
	}
	return nil
}

func (c *Client) ContainerList(ctx context.Context) ([]containerSummary, error) {
	values := url.Values{}
	values.Set("all", "false")

	var containers []containerSummary
	if err := c.getJSON(ctx, "/containers/json?"+values.Encode(), &containers); err != nil {
		return nil, err
	}
	return containers, nil
}

func (c *Client) ContainerInspect(ctx context.Context, id string) (containerInspect, error) {
	var inspect containerInspect
	err := c.getJSON(ctx, "/containers/"+url.PathEscape(id)+"/json", &inspect)
	return inspect, err
}

func (c *Client) ContainerStatsOneShot(ctx context.Context, id string) (io.ReadCloser, error) {
	values := url.Values{}
	values.Set("stream", "false")

	resp, err := c.do(ctx, http.MethodGet, "/containers/"+url.PathEscape(id)+"/stats?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		return nil, responseError(resp)
	}
	return resp.Body, nil
}

func (c *Client) ContainerLogs(ctx context.Context, id, tail string, follow bool) (io.ReadCloser, error) {
	values := url.Values{}
	values.Set("stdout", "true")
	values.Set("stderr", "true")
	values.Set("follow", fmt.Sprintf("%t", follow))
	values.Set("tail", tail)
	values.Set("timestamps", "true")

	resp, err := c.do(ctx, http.MethodGet, "/containers/"+url.PathEscape(id)+"/logs?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		return nil, responseError(resp)
	}
	return resp.Body, nil
}

func (c *Client) getJSON(ctx context.Context, path string, v any) error {
	resp, err := c.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return responseError(resp)
	}
	return json.NewDecoder(resp.Body).Decode(v)
}

func (c *Client) do(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	if c == nil || c.httpClient == nil {
		return nil, fmt.Errorf("docker client unavailable")
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	return c.httpClient.Do(req)
}

func responseError(resp *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	message := strings.TrimSpace(string(body))
	if message == "" {
		return fmt.Errorf("docker API returned %s", resp.Status)
	}
	return fmt.Errorf("docker API returned %s: %s", resp.Status, message)
}
