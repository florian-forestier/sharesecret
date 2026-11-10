# Sharesecret

A deadly simple ephemeral share secret server.

## How it works?

- You create a secret, optionally secured with a password ;
- The secret is encrypted **in your browser** (AES-256-GCM), with a random key that is put in the link's fragment (`#...`) ;
- You'll get a link to this secret ;
- You share this link to your buddy ;
- Your buddy reads the secret, which is decrypted in their browser, and immediately destroyed from the server.

The server never sees the content, the key, or the password: URL fragments are never sent by browsers.

Everything is directly stored in RAM (no sqlite, external database, Valkey or anything else).

## Security details

- A random 256-bit key is generated for each secret and lives only in the link fragment.
- If a password is set, it is stretched with PBKDF2-SHA256 (600,000 iterations, salted with the
  fragment key). The AES key is derived with HKDF from both the fragment key and the stretched
  password: the link alone is not enough to decrypt the secret.
- The server stores a password verifier (also HKDF-derived from both values) so it can refuse to
  hand out (and thus destroy) the secret to someone who doesn't know the password. It cannot be
  used to brute-force the password without the link.
- The ciphertext is additionally encrypted in RAM, using a random key generated at each server startup.
- Limitation: as with any web-based end-to-end encryption, you trust the server to serve unmodified
  JavaScript.

## How to run it?

### Option A - From DockerHub

`docker run -p 8080:8080 a1hex/sharesecret:latest`

That's it!

### Option B - From the sources

1. Clone this repo
2. Run `docker build -t sharesecret .`
3. Run `docker run -p 8080:8080 sharesecret`

That's it!