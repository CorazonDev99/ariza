# Telegram Mini App — setup

The bot ships with an HTML/JS frontend (`/webapp/`) that mirrors the
"📋 Проверить дело" flow inside Telegram's Mini App container. This doc
walks through the one-time setup needed to publish it.

## 0. Build is automatic

`update.sh` already calls `npm run build`, which now also runs
`npm run build:webapp` (Vite). After `git pull`, the static files end
up in `webapp/dist/` and are served by the bot's HTTP server at
the URL prefix `/webapp/` (port 3000 by default).

So `dist/` is built for you — you only need to expose port 3000 over
HTTPS to Telegram.

---

## Pick your hosting path

| Option                 | Persistent URL? | Needs domain? | When to use                  |
|------------------------|-----------------|---------------|------------------------------|
| **A — Named tunnel**   | ✅ yes          | ✅ yes        | Production, real users       |
| **B — Quick tunnel**   | ❌ rotates      | ❌ no         | Just trying it out, dev/test |

Either way is fully free.

---

## Option A — Named tunnel (recommended for production)

**Prerequisites:**

1. You own a domain (any registrar).
2. Its nameservers are pointed at Cloudflare.
   Check with `dig NS yourdomain.com` — output must include
   `*.ns.cloudflare.com`. If not, follow the [Cloudflare full setup
   guide](https://developers.cloudflare.com/dns/zone-setups/full-setup/)
   to move DNS to Cloudflare. The domain itself can stay at your
   current registrar; only the NS records change. Takes ~10 minutes.

**One-shot installer:**

```bash
sudo bash /var/www/ariza/deploy/setup-cloudflared.sh ariza.yourdomain.com
```

What it does (idempotent — safe to re-run):

1. Installs `cloudflared` if missing.
2. Runs `cloudflared tunnel login` — prints a URL. Open it in your
   **local** browser, sign in, pick the zone for your hostname,
   approve. The script continues automatically once you're done.
3. Creates a named tunnel called `ariza` (or reuses an existing one).
4. Routes `ariza.yourdomain.com` → that tunnel via Cloudflare DNS.
5. Writes `/etc/cloudflared/config.yml`.
6. Installs `cloudflared.service` and enables it (auto-start on boot).
7. Sets `WEBAPP_URL` in `/var/www/ariza/.env`.
8. Restarts `ariza-bot.service` so it picks up the new env var.

After it finishes:

```bash
# Smoke test
curl -I https://ariza.yourdomain.com/health
curl https://ariza.yourdomain.com/api/court-types | head -c 200

# Open in browser
https://ariza.yourdomain.com/webapp
```

In Telegram the "🌐 Open in Mini App" reply-keyboard button now shows up.

Logs / debugging:

```bash
journalctl -u cloudflared -f
journalctl -u ariza-bot -f
systemctl status cloudflared
```

---

## Option B — Quick tunnel (no domain)

URL looks like `https://random-name.trycloudflare.com` and changes
every time the cloudflared service restarts (including server reboot).
Useful for testing — re-run the script when the URL changes and the
bot picks up the new one automatically.

```bash
sudo bash /var/www/ariza/deploy/setup-quick-tunnel.sh
```

What it does:

1. Installs `cloudflared` if missing.
2. Installs `cloudflared-quick.service`, enables it, starts it.
3. Tails the journal for ~30 s to find the assigned
   `*.trycloudflare.com` URL.
4. Writes that URL (with `/webapp` suffix) into `.env` as `WEBAPP_URL`.
5. Restarts `ariza-bot`.

To rotate the URL manually (e.g. after the random name expires or
gets blacklisted somewhere) just re-run the same command.

---

## BotFather menu button (optional)

`@BotFather` → `/mybots` → pick your bot → `Bot Settings` →
`Menu Button` → URL = same `WEBAPP_URL`. This makes the Mini App
also openable via the persistent ⊕ menu button in the bot's chat
header, not only the reply-keyboard button.

---

## Local development

```bash
# Terminal 1: bot (HTTP server on :3000)
npm run dev

# Terminal 2: Vite dev server with HMR (proxies /api/* to :3000)
npm run dev:webapp
# → http://localhost:5173/webapp
```

For previewing inside Telegram during dev, point cloudflared at port
5173 instead of 3000.
