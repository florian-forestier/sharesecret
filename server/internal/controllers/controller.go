package controllers

import (
	"encoding/json"
	"net/http"
	"sharesecret/internal/services"
	"sharesecret/internal/structures"
)

// GetSecret reads (and destroys) a secret. It is a POST so that the password verifier
// travels in the body and never ends up in a URL (proxy logs, browser history…).
func GetSecret(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Hash     string  `json:"hash"`
		Password *string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Hash == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	secret, err := services.GetSecret(req.Hash, req.Password)
	if err != nil && err.Error() != "not found" {
		w.WriteHeader(http.StatusInternalServerError)
		return
	} else if err != nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	st := struct {
		Content string `json:"content"`
	}{
		Content: secret,
	}

	v, _ := json.Marshal(st)
	_, _ = w.Write(v)
}

func IsPasswordProtected(w http.ResponseWriter, r *http.Request) {
	hash := r.URL.Query().Get("hash")
	if hash == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	isProtected := services.IsPasswordProtected(hash)
	w.Header().Set("Content-Type", "application/json")
	st := struct {
		IsProtected bool `json:"protected"`
	}{
		IsProtected: isProtected,
	}
	v, _ := json.Marshal(st)
	_, _ = w.Write(v)

}

func PostSecret(w http.ResponseWriter, r *http.Request) {
	var data structures.Secret
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil || data.Content == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	hash, err := services.CreateSecret(data)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	res := struct {
		Hash string `json:"hash"`
	}{
		Hash: hash,
	}

	// Headers must be set before WriteHeader, otherwise they are silently dropped.
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	v, _ := json.Marshal(res)
	_, _ = w.Write(v)
}
