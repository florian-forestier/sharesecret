package controllers

import (
	"encoding/json"
	"io"
	"net/http"
	"sharesecret/internal/services"
	"sharesecret/internal/structures"
)

func GetSecret(w http.ResponseWriter, r *http.Request) {
	hash := r.URL.Query().Get("hash")
	if hash == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	var password *string

	pwd := r.URL.Query().Get("password")
	if pwd != "" && len(pwd) != 64 {
		w.WriteHeader(http.StatusBadRequest)
		return
	} else if pwd == "" {
		password = nil
	} else {
		password = &pwd
	}

	secret, err := services.GetSecret(hash, password)
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
	body, _ := io.ReadAll(r.Body)
	var data structures.Secret
	_ = json.Unmarshal(body, &data)

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

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	v, _ := json.Marshal(res)
	_, _ = w.Write(v)
}
