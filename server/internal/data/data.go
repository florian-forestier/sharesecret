package data

import (
	"crypto/rand"
	"sharesecret/internal/structures"
	"sync"
)

var SK = ""

// Secrets is accessed concurrently by HTTP handlers: always hold Mu.
var Secrets = map[string]structures.Secret{}
var Mu sync.Mutex

func init() {
	buf := make([]byte, 32)
	// then we can call rand.Read.
	_, _ = rand.Read(buf)

	SK = string(buf)
}
