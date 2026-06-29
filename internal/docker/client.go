package docker

import (
	"context"
	"fmt"

	"github.com/docker/docker/client"
)

// NewClient creates a read-only Docker API client. The application only uses
// list, inspect, stats, and logs operations — no lifecycle mutations.
func NewClient() (*client.Client, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("docker client: %w", err)
	}

	ctx := context.Background()
	if _, err := cli.Ping(ctx); err != nil {
		cli.Close()
		return nil, fmt.Errorf("docker daemon unreachable: %w", err)
	}

	return cli, nil
}
