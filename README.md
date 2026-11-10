# Sharesecret

A deadly simple ephemeral share secret server.

## How it works?

- You create a secret, optionally secured with a password (in this case, the password is hashed before being sent to the server) ;
- You'll get a link to this secret ;
- You share this link to your buddy ;
- Your buddy reads the secret, and is immediately destroyed from the server.

Everything is directly stored in RAM (no sqlite, external database, Valkey or anything else).

Secrets are symmetrically cyphered in RAM, using a random key generated at each server startup.

## How to run it?

### Option A - From DockerHub

`docker run -p 8080:8080 a1hex/sharesecret:latest`

That's it!

### Option B - From the sources

1. Clone this repo
2. Run `docker build -t sharesecret .`
3. Run `docker run -p 8080:8080 sharesecret`

That's it!