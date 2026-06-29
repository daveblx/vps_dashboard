package docker

import (
	"encoding/json"
	"io"

	"github.com/docker/docker/api/types/container"
)

func decodeStats(r io.Reader, v *container.StatsResponse) error {
	dec := json.NewDecoder(r)
	return dec.Decode(v)
}
