package docker

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
)

type ContainerInfo struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Status    string            `json:"status"`
	State     string            `json:"state"`
	Uptime    string            `json:"uptime"`
	StartedAt time.Time         `json:"startedAt"`
	PublicURL string            `json:"publicUrl"`
	Labels    map[string]string `json:"labels,omitempty"`
}

type ContainerStats struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	CPUPercent  float64 `json:"cpuPercent"`
	MemoryUsage uint64  `json:"memoryUsage"`
	MemoryLimit uint64  `json:"memoryLimit"`
	MemoryPercent float64 `json:"memoryPercent"`
}

type Monitor struct {
	client *client.Client
}

func NewMonitor(cli *client.Client) *Monitor {
	return &Monitor{client: cli}
}

func (m *Monitor) ListContainers(ctx context.Context) ([]ContainerInfo, error) {
	if m.client == nil {
		return []ContainerInfo{}, nil
	}
	containers, err := m.client.ContainerList(ctx, container.ListOptions{All: false})
	if err != nil {
		return nil, fmt.Errorf("list containers: %w", err)
	}

	result := make([]ContainerInfo, 0, len(containers))
	for _, c := range containers {
		info := ContainerInfo{
			ID:        c.ID[:12],
			Name:      trimContainerName(c.Names),
			Status:    c.Status,
			State:     c.State,
			PublicURL: ParseTraefikURL(c.Labels),
			Labels:    c.Labels,
		}

		if c.Created > 0 {
			started := time.Unix(c.Created, 0)
			info.StartedAt = started
			info.Uptime = formatUptime(time.Since(started))
		}

		inspect, err := m.client.ContainerInspect(ctx, c.ID)
		if err == nil && inspect.State.StartedAt != "" {
			if started, parseErr := time.Parse(time.RFC3339Nano, inspect.State.StartedAt); parseErr == nil {
				info.StartedAt = started
				info.Uptime = formatUptime(time.Since(started))
				info.State = inspect.State.Status
			}
		}

		result = append(result, info)
	}
	return result, nil
}

func (m *Monitor) CollectStats(ctx context.Context) ([]ContainerStats, error) {
	if m.client == nil {
		return []ContainerStats{}, nil
	}
	containers, err := m.client.ContainerList(ctx, container.ListOptions{All: false})
	if err != nil {
		return nil, fmt.Errorf("list containers: %w", err)
	}

	result := make([]ContainerStats, 0, len(containers))
	for _, c := range containers {
		stats, err := m.client.ContainerStatsOneShot(ctx, c.ID)
		if err != nil {
			continue
		}

		var v types.StatsJSON
		if err := decodeStats(stats.Body, &v); err != nil {
			stats.Body.Close()
			continue
		}
		stats.Body.Close()

		cpuPct := calculateCPUPercent(&v)
		memUsage := v.MemoryStats.Usage
		memLimit := v.MemoryStats.Limit
		memPct := 0.0
		if memLimit > 0 {
			memPct = float64(memUsage) / float64(memLimit) * 100
		}

		result = append(result, ContainerStats{
			ID:            c.ID[:12],
			Name:          trimContainerName(c.Names),
			CPUPercent:    cpuPct,
			MemoryUsage:   memUsage,
			MemoryLimit:   memLimit,
			MemoryPercent: memPct,
		})
	}
	return result, nil
}

func (m *Monitor) StreamLogs(ctx context.Context, containerID string, tail string, follow bool) (io.ReadCloser, error) {
	if m.client == nil {
		return nil, fmt.Errorf("docker client unavailable")
	}
	opts := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     follow,
		Tail:       tail,
		Timestamps: true,
	}
	return m.client.ContainerLogs(ctx, containerID, opts)
}

func trimContainerName(names []string) string {
	if len(names) == 0 {
		return ""
	}
	name := names[0]
	return strings.TrimPrefix(name, "/")
}

func formatUptime(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	if d < 24*time.Hour {
		h := int(d.Hours())
		m := int(d.Minutes()) % 60
		return fmt.Sprintf("%dh %dm", h, m)
	}
	days := int(d.Hours()) / 24
	h := int(d.Hours()) % 24
	return fmt.Sprintf("%dd %dh", days, h)
}

func calculateCPUPercent(v *types.StatsJSON) float64 {
	cpuDelta := float64(v.CPUStats.CPUUsage.TotalUsage - v.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(v.CPUStats.SystemUsage - v.PreCPUStats.SystemUsage)
	if systemDelta <= 0 || cpuDelta <= 0 {
		return 0
	}

	onlineCPUs := v.CPUStats.OnlineCPUs
	if onlineCPUs == 0 {
		onlineCPUs = uint32(len(v.CPUStats.CPUUsage.PercpuUsage))
	}
	if onlineCPUs == 0 {
		onlineCPUs = 1
	}

	return (cpuDelta / systemDelta) * float64(onlineCPUs) * 100
}
