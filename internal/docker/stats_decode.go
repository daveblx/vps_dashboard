package docker

import (
	"encoding/json"
	"io"
)

func decodeStats(r io.Reader, v *StatsResponse) error {
	dec := json.NewDecoder(r)
	return dec.Decode(v)
}
