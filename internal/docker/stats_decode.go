package docker

import (
	"encoding/json"
	"io"

	"github.com/docker/docker/api/types"
)

func decodeStats(r io.Reader, v *types.StatsJSON) error {
	dec := json.NewDecoder(r)
	return dec.Decode(v)
}
