package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"sharesecret/internal/data"
	"sharesecret/internal/structures"
)

func CreateSecret(secret structures.Secret) (string, error) {
	salted := secret.Content + data.SK
	hash := sha256.New()

	hash.Write([]byte(salted))
	d := hex.EncodeToString(hash.Sum(nil))

	if secret.Password != nil {
		sk, err := crypt(*secret.Password)
		if err != nil {
			return "", err
		}
		secret.Password = &sk
	}

	content, err := crypt(secret.Content)
	if err != nil {
		return "", err
	}
	secret.Content = content

	data.Secrets[d] = secret
	return d, nil
}

func IsPasswordProtected(hash string) bool {
	return data.Secrets[hash].Password != nil
}

func GetSecret(hash string, password *string) (string, error) {
	if sc, ok := data.Secrets[hash]; !ok {
		return "", errors.New("not found")
	} else {
		if sc.Password != nil {
			if password == nil {
				return "", errors.New("not found")
			}
			if pw, err := decrypt(*sc.Password); err != nil || pw != *password {
				return "", errors.New("not found")
			}
		}
		dc, e := decrypt(sc.Content)
		if e != nil {
			return "", e
		}
		DeleteSecret(hash)
		return dc, nil
	}
}

func DeleteSecret(hash string) {
	delete(data.Secrets, hash)
}

func crypt(text string) (string, error) {
	block, err := aes.NewCipher([]byte(data.SK))
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(text), nil)
	return string(ciphertext), nil
}

func decrypt(text string) (string, error) {
	block, err := aes.NewCipher([]byte(data.SK))
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(text) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, actualCipherText := text[:nonceSize], text[nonceSize:]
	plainText, err := gcm.Open(nil, []byte(nonce), []byte(actualCipherText), nil)
	if err != nil {
		return "", err
	}

	return string(plainText), nil
}
