package main

import (
	"errors"
	"io/fs"
	"net/http"
	"os"
	stdpath "path"
	"sharesecret/internal/controllers"
	"strings"

	"github.com/go-chi/chi/v5"
)

func main() {

	r := chi.NewRouter()
	r.Get("/api/secret", controllers.GetSecret)
	r.Post("/api/secret", controllers.PostSecret)
	r.Get("/api/is-protected", controllers.IsPasswordProtected)

	dir := os.Getenv("STATIC_DIR")
	if dir == "" {
		dir = "/static"
	}
	filesDir := http.Dir(dir)
	FileServer(r, "/", filesDir)

	http.ListenAndServe(":8080", r)
}

func FileServer(r chi.Router, path string, root http.FileSystem) {
	if strings.ContainsAny(path, "{}*") {
		panic("FileServer does not permit any URL parameters.")
	}

	if path != "/" && path[len(path)-1] != '/' {
		r.Get(path, http.RedirectHandler(path+"/", 301).ServeHTTP)
		path += "/"
	}
	path += "*"

	r.Get(path, func(w http.ResponseWriter, r *http.Request) {
		rctx := chi.RouteContext(r.Context())
		pathPrefix := strings.TrimSuffix(rctx.RoutePattern(), "/*")

		upath := stdpath.Clean("/" + strings.TrimPrefix(r.URL.Path, pathPrefix))
		if f, err := root.Open(upath); err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				r.URL.RawPath = ""
				if hf, herr := root.Open(upath + ".html"); upath != "/" && herr == nil {
					// Prerendered page: /secrets -> secrets.html
					hf.Close()
					serveHTML(w, r, root, upath+".html")
					return
				}
				// SPA fallback: serve index.html (200 OK).
				r.URL.Path = pathPrefix + "/"
			}
		} else {
			f.Close()
		}

		http.StripPrefix(pathPrefix, http.FileServer(root)).ServeHTTP(w, r)
	})

}

// serveHTML writes the given file from root with a 200 status, without the
// redirects http.FileServer would apply to paths ending in ".html".
func serveHTML(w http.ResponseWriter, r *http.Request, root http.FileSystem, name string) {
	f, err := root.Open(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil || st.IsDir() {
		http.NotFound(w, r)
		return
	}
	http.ServeContent(w, r, name, st.ModTime(), f)
}
