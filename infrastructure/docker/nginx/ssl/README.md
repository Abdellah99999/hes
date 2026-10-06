# TLS / SSL Certificates Configuration & Production Provisioning Guide

## 1. Local & Staging Environment (Self-Signed Demo)

For local testing or pre-production staging, generate a self-signed ECDSA or RSA 2048/4096 certificate:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infrastructure/docker/nginx/ssl/server.key \
  -out infrastructure/docker/nginx/ssl/server.crt \
  -subj "/C=MA/ST=Casablanca/L=Casablanca/O=HES Logistics Platform/CN=localhost"
```

Permissions hardening:

```bash
chmod 600 infrastructure/docker/nginx/ssl/server.key
chmod 644 infrastructure/docker/nginx/ssl/server.crt
```

---

## 2. Production Environment: Automated Let's Encrypt / Certbot

### Option A: Certbot Webroot Challenge (Recommended with Nginx)

1. Add ACME challenge block in `nginx.prod.conf` under port 80:

```nginx
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

2. Issue the production multi-domain certificate:

```bash
docker run -it --rm --name certbot \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  -v "/var/www/certbot:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d app.hes.ma -d api.hes.ma -d admin.hes.ma \
  --email security@hes.ma \
  --agree-tos --no-eff-email
```

3. Mount Let's Encrypt live directory into Nginx volume:

```yaml
volumes:
  - /etc/letsencrypt/live/app.hes.ma/fullchain.pem:/etc/nginx/ssl/server.crt:ro
  - /etc/letsencrypt/live/app.hes.ma/privkey.pem:/etc/nginx/ssl/server.key:ro
```

4. Automated Renewal Cron Job (`/etc/cron.d/certbot-renew`):

```cron
0 3 * * * certbot renew --post-hook "docker exec hes_gateway_prod nginx -s reload"
```

---

## 3. Production Option B: Cloudflare Origin CA or AWS ACM

If running behind Cloudflare CDN or AWS Application Load Balancer:

- **Cloudflare**: Generate a 15-year Origin Certificate in Cloudflare Dashboard and set SSL mode to "Full (Strict)".
- **AWS ALB**: Terminate TLS at ALB with an ACM certificate (Free automated renewal), forwarding traffic via internal HTTPS or HTTP to container targets.

---

## 4. Verified Security Headers

The production Nginx gateway enforces:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS - 2 years)
- `X-Frame-Options: SAMEORIGIN` (Clickjacking prevention)
- `X-Content-Type-Options: nosniff` (MIME sniffing prevention)
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy: default-src 'self' ...`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(), geolocation=(self)`
