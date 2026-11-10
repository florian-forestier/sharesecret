package structures

type Secret struct {
	Password *string `json:"password"`
	Content  string  `json:"content"`
}
