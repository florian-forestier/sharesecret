package data

import (
	"crypto/rand"
	"sharesecret/internal/structures"
)

var SK = ""

var Secrets = map[string]structures.Secret{}

func init() {
	buf := make([]byte, 32)
	// then we can call rand.Read.
	_, _ = rand.Read(buf)

	SK = string(buf)
}
