# Telegram Mini App — setup

The bot ships with an HTML/JS frontend (`/webapp/`) that mirrors the
"📋 Проверить дело" flow inside Telegram's Mini App container. This doc
walks through the one-time setup needed to publish it.

## 0. Build is automatic

`update.sh` already calls `npm run build`, which now also runs
`npm run build:webapp` (Vite). After `git pull`, the static files end
up in `webapp/dist/` and are served by the bot's HTTP server at the
URL prefix `/webapp/` (port 3000 by default).

So `dist/` is built for you — you only need to expose port 3000 over
HTTPS to Telegram.

## 1. Expose the bot over HTTPS via Cloudflare Tunnel (free, no domain)

Cloudflare Tunnel proxies your local port 3000 through Cloudflare's
edge with a free `*.trycloudflare.com` HTTPS hostname — no domain, no
DNS work, no Let's Encrypt cert rotation.

```bash
# On the server (Ubuntu)
sudo curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(. /etc/os-release && echo $VERSION_CODENAME) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt-get update && sudo apt-get install -y cloudflared
```

### Quick start (single command, ad-hoc URL)

```bash
cloudflared tunnel --url http://localhost:3000
```

Output looks like:

```
INF +--------------------------------------------------------------+
INF |  https://abc-123-def-456.trycloudflare.com                   |
INF +--------------------------------------------------------------+
```

That hostname is the public HTTPS URL. Mini App URL becomes
`https://abc-123-def-456.trycloudflare.com/webapp` — copy it.

> Ad-hoc URLs change every time cloudflared restarts. Fine for testing;
> for production use a named tunnel (see below).

### Persistent named tunnel (stable hostname)

```bash
sudo cloudflared tunnel login                # opens browser, signs in
sudo cloudflared tunnel create ariza         # creates a tunnel
sudo cloudflared tunnel route dns ariza ariza.yourdomain.com
```

Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: ariza
credentials-file: /root/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: ariza.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

Run as a systemd service so it survives reboots:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Public URL: `https://ariza.yourdomain.com/webapp`.

## 2. Configure the bot

Add the URL to `/var/www/ariza/.env`:

```
WEBAPP_URL=https://abc-123-def-456.trycloudflare.com/webapp
```

Restart so the new env var is loaded:

```bash
sudo systemctl restart ariza-bot
```

The "🌐 Open in Mini App" button now appears in the main reply
keyboard. Without `WEBAPP_URL` it's hidden silently — useful for hosts
that haven't deployed the tunnel yet.

## 3. (Optional) BotFather menu button

`@BotFather` → `/mybots` → pick your bot → `Bot Settings` →
`Menu Button` → set the URL to the same `WEBAPP_URL`. This makes the
Mini App also openable via the persistent ⊕ menu button in the bot
chat header, not just the reply keyboard button.

## 4. Smoke test

```bash
# Backend health
curl https://abc-123.trycloudflare.com/health

# API
curl https://abc-123.trycloudflare.com/api/court-types | jq

# Static SPA
curl -sI https://abc-123.trycloudflare.com/webapp/ | head
```

If all three respond, open the bot in Telegram, tap the new
"🌐 Open in Mini App" button — the React app should launch full-screen.

## Local development

```bash
# Terminal 1: bot (HTTP server on :3000)
npm run dev

# Terminal 2: Vite dev server (HMR, proxies /api/* to :3000)
npm run dev:webapp
# → http://localhost:5173/webapp
```

For previewing inside Telegram during dev, point cloudflared at port
5173 instead of 3000.
