package host

import (
	"sync"
	"time"
)

// Sample is a single point of host metrics history.
// Network values are bytes/sec; cpu/mem/disk are percentages (0-100).
type Sample struct {
	Timestamp int64   `json:"t"`
	CPU       float64 `json:"cpu"`
	Memory    float64 `json:"mem"`
	Disk      float64 `json:"disk"`
	NetUp     float64 `json:"netUp"`
	NetDown   float64 `json:"netDown"`
}

// History is a bounded, time-ordered ring buffer of metric samples.
// It retains up to retain duration of data and is safe for concurrent use.
type History struct {
	mu      sync.RWMutex
	samples []Sample
	retain  time.Duration
	maxLen  int
}

func NewHistory(retain time.Duration, maxLen int) *History {
	if retain <= 0 {
		retain = 24 * time.Hour
	}
	if maxLen <= 0 {
		maxLen = 50000
	}
	return &History{
		samples: make([]Sample, 0, 1024),
		retain:  retain,
		maxLen:  maxLen,
	}
}

// Record appends a sample derived from the given metrics snapshot and
// trims any data older than the retention window.
func (h *History) Record(m Metrics) {
	s := Sample{
		Timestamp: m.Timestamp,
		CPU:       m.CPUPercent,
		Memory:    m.MemoryPercent,
		Disk:      m.Disk.UsedPercent,
		NetUp:     float64(m.Network.BytesSentPerSec),
		NetDown:   float64(m.Network.BytesRecvPerSec),
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	h.samples = append(h.samples, s)

	cutoff := time.Now().Add(-h.retain).UnixMilli()
	// Drop samples older than the retention window.
	idx := 0
	for idx < len(h.samples) && h.samples[idx].Timestamp < cutoff {
		idx++
	}
	if idx > 0 {
		h.samples = h.samples[idx:]
	}
	// Hard cap to bound memory regardless of sampling cadence.
	if len(h.samples) > h.maxLen {
		h.samples = h.samples[len(h.samples)-h.maxLen:]
	}
}

// Range returns samples within the last rangeDur, downsampled to at most
// maxPoints buckets by averaging. Buckets are returned in chronological order.
func (h *History) Range(rangeDur time.Duration, maxPoints int) []Sample {
	if maxPoints < 1 {
		maxPoints = 1
	}

	cutoff := time.Now().Add(-rangeDur).UnixMilli()

	h.mu.RLock()
	src := make([]Sample, 0, len(h.samples))
	for _, s := range h.samples {
		if s.Timestamp >= cutoff {
			src = append(src, s)
		}
	}
	h.mu.RUnlock()

	if len(src) <= maxPoints {
		return src
	}

	// Bucket by even time slices across the requested window so the chart
	// time axis stays proportional even when data is sparse.
	start := src[0].Timestamp
	end := src[len(src)-1].Timestamp
	span := end - start
	if span <= 0 {
		return src[len(src)-1:]
	}

	bucketDur := span / int64(maxPoints)
	if bucketDur < 1 {
		bucketDur = 1
	}

	out := make([]Sample, 0, maxPoints)
	var (
		acc      Sample
		count    int
		curIndex int64 = -1
	)

	flush := func() {
		if count == 0 {
			return
		}
		n := float64(count)
		out = append(out, Sample{
			Timestamp: acc.Timestamp / int64(count),
			CPU:       acc.CPU / n,
			Memory:    acc.Memory / n,
			Disk:      acc.Disk / n,
			NetUp:     acc.NetUp / n,
			NetDown:   acc.NetDown / n,
		})
	}

	for _, s := range src {
		idx := (s.Timestamp - start) / bucketDur
		if idx != curIndex {
			flush()
			acc = Sample{}
			count = 0
			curIndex = idx
		}
		acc.Timestamp += s.Timestamp
		acc.CPU += s.CPU
		acc.Memory += s.Memory
		acc.Disk += s.Disk
		acc.NetUp += s.NetUp
		acc.NetDown += s.NetDown
		count++
	}
	flush()

	return out
}
