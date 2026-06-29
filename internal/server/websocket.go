package server

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/davidblachnitzky/oled-dashboard/internal/docker"
	"github.com/davidblachnitzky/oled-dashboard/internal/host"
	"github.com/gorilla/websocket"
)

type MetricsFrame struct {
	Type       string                  `json:"type"`
	Timestamp  int64                   `json:"timestamp"`
	Host       host.Metrics            `json:"host"`
	Containers []docker.ContainerStats `json:"containers"`
}

type Hub struct {
	clients    map[*Client]struct{}
	register   chan *Client
	unregister chan *Client
	broadcast  chan []byte
	mu         sync.RWMutex
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]struct{}),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte, 16),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = struct{}{}
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					go func(c *Client) {
						h.unregister <- c
					}(client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Broadcast(frame MetricsFrame) {
	data, err := json.Marshal(frame)
	if err != nil {
		slog.Error("marshal metrics frame", "error", err)
		return
	}
	select {
	case h.broadcast <- data:
	default:
		slog.Warn("broadcast channel full, dropping frame")
	}
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("websocket upgrade failed", "error", err)
		return
	}

	client := &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 8),
	}
	h.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			break
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

type MetricsBroadcaster struct {
	hub           *Hub
	hostCollector *host.Collector
	dockerMonitor *docker.Monitor
	interval      time.Duration
}

func NewMetricsBroadcaster(hub *Hub, hostCollector *host.Collector, dockerMonitor *docker.Monitor, interval time.Duration) *MetricsBroadcaster {
	return &MetricsBroadcaster{
		hub:           hub,
		hostCollector: hostCollector,
		dockerMonitor: dockerMonitor,
		interval:      interval,
	}
}

func (b *MetricsBroadcaster) Run(ctx context.Context) {
	ticker := time.NewTicker(b.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			b.broadcastOnce(ctx)
		}
	}
}

func (b *MetricsBroadcaster) broadcastOnce(ctx context.Context) {
	hostMetrics, err := b.hostCollector.Collect(ctx)
	if err != nil {
		slog.Error("collect host metrics", "error", err)
		return
	}

	containerStats, err := b.dockerMonitor.CollectStats(ctx)
	if err != nil {
		slog.Error("collect container stats", "error", err)
		containerStats = []docker.ContainerStats{}
	}

	b.hub.Broadcast(MetricsFrame{
		Type:       "metrics",
		Timestamp:  time.Now().UnixMilli(),
		Host:       hostMetrics,
		Containers: containerStats,
	})
}
