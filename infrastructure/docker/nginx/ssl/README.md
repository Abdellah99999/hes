# TLS Certificates for Nginx Production Gateway

In production:

- Mount your valid CA-signed certificates (e.g. Let's Encrypt, Cloudflare, DigiCert) into `/etc/nginx/ssl/`:
  - `/etc/nginx/ssl/server.crt` (Certificate chain)
  - `/etc/nginx/ssl/server.key` (Private key - chmod 600)

For staging/local testing, generate a self-signed certificate using OpenSSL:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infrastructure/docker/nginx/ssl/server.key \
  -out infrastructure/docker/nginx/ssl/server.crt \
  -subj "/C=MA/ST=Casablanca/L=Casablanca/O=HES Logistics/CN=localhost"
```
