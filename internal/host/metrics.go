package host

import (
	"context"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

type NetworkStats struct {
	BytesSentPerSec   uint64 `json:"bytesSentPerSec"`
	BytesRecvPerSec   uint64 `json:"bytesRecvPerSec"`
	TotalBytesSent    uint64 `json:"totalBytesSent"`
	TotalBytesRecv    uint64 `json:"totalBytesRecv"`
}

type DiskStats struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	Free        uint64  `json:"free"`
	UsedPercent float64 `json:"usedPercent"`
}

type Metrics struct {
	Timestamp   int64        `json:"timestamp"`
	CPUPercent  float64      `json:"cpuPercent"`
	MemoryUsed  uint64       `json:"memoryUsed"`
	MemoryTotal uint64       `json:"memoryTotal"`
	MemoryPercent float64    `json:"memoryPercent"`
	Disk        DiskStats    `json:"disk"`
	Network     NetworkStats `json:"network"`
}

type Collector struct {
	mu          sync.RWMutex
	latest      Metrics
	prevNetSent uint64
	prevNetRecv uint64
	prevTime    time.Time
	hasPrevNet  bool
}

func NewCollector() *Collector {
	return &Collector{}
}

func (c *Collector) Latest() Metrics {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.latest
}

func (c *Collector) Collect(ctx context.Context) (Metrics, error) {
	cpuPercents, err := cpu.PercentWithContext(ctx, 0, false)
	if err != nil {
		return Metrics{}, err
	}

	memInfo, err := mem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return Metrics{}, err
	}

	diskInfo, err := disk.UsageWithContext(ctx, "/")
	if err != nil {
		return Metrics{}, err
	}

	netIO, err := net.IOCountersWithContext(ctx, false)
	if err != nil {
		return Metrics{}, err
	}

	var totalSent, totalRecv uint64
	for _, n := range netIO {
		totalSent += n.BytesSent
		totalRecv += n.BytesRecv
	}

	cpuPercent := 0.0
	if len(cpuPercents) > 0 {
		cpuPercent = cpuPercents[0]
	}

	netStats := NetworkStats{
		TotalBytesSent: totalSent,
		TotalBytesRecv: totalRecv,
	}

	now := time.Now()

	c.mu.Lock()
	if c.hasPrevNet {
		elapsed := now.Sub(c.prevTime).Seconds()
		if elapsed > 0 {
			if totalSent >= c.prevNetSent {
				netStats.BytesSentPerSec = uint64(float64(totalSent-c.prevNetSent) / elapsed)
			}
			if totalRecv >= c.prevNetRecv {
				netStats.BytesRecvPerSec = uint64(float64(totalRecv-c.prevNetRecv) / elapsed)
			}
		}
	}
	c.prevNetSent = totalSent
	c.prevNetRecv = totalRecv
	c.prevTime = now
	c.hasPrevNet = true

	m := Metrics{
		Timestamp:     time.Now().UnixMilli(),
		CPUPercent:    cpuPercent,
		MemoryUsed:    memInfo.Used,
		MemoryTotal:   memInfo.Total,
		MemoryPercent: memInfo.UsedPercent,
		Disk: DiskStats{
			Total:       diskInfo.Total,
			Used:        diskInfo.Used,
			Free:        diskInfo.Free,
			UsedPercent: diskInfo.UsedPercent,
		},
		Network: netStats,
	}
	c.latest = m
	c.mu.Unlock()

	return m, nil
}

func (c *Collector) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_, _ = c.Collect(ctx)
		}
	}
}
