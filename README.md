# Prime Kent Dev Hub — Nexora Nemesis Pairing (website)

A website where people create an account (Google, email or phone), link their WhatsApp number to your bot,
and manage their linked numbers. **Frontend + API run on Vercel, accounts + settings live in Supabase,
and the WhatsApp sessions stay on your bot (Pterodactyl panel).**

```
Browser ──► Vercel (pages + /api functions) ──► your bot on Pterodactyl (/hub/* API, secret-protected)
   │                    │
   └── Supabase Auth ◄──┘   (login, profiles table)
```
The browser never talks to the bot directly and never sees the secret.

## Pages
| Page | What it does |
|---|---|
| `/` | Landing + **Sign in / Create account** (Google · Email+password · Email link · Phone code) |
| `/pair` | Enter number → pairing code → live status, your linked numbers, slots used |
| `/account` | **Profile** · **Numbers** · **Settings** (name, default country code, accent colour, calm mode, change password, sign out everywhere, unlink all, delete account) |

## 1) Supabase (≈5 min)
1. Create a project at supabase.com.
2. **SQL Editor** → paste `supabase/schema.sql` → Run.
3. **Project Settings → API**: copy *Project URL* and the *anon public* key into `public/js/config.js`.
4. **Authentication → Providers**
   - **Email**: on (also turn on "Confirm email" if you want verified emails).
   - **Google**: create OAuth credentials in Google Cloud (type *Web application*), add Supabase's callback URL shown on that page as an authorised redirect URI, paste Client ID + Secret.
   - **Phone**: needs an SMS provider (Twilio / MessageBird / Vonage / Textlocal) — fill it in there. If you don't want phone login, set `METHODS.phone` to `false` in `config.js`.
5. **Authentication → URL Configuration**: *Site URL* = your Vercel URL; add `https://YOUR-SITE/**` to *Redirect URLs*.

## 2) The bot (Pterodactyl)
Add to the bot's `.env` (Build 27+ of the bot, this zip includes it):
```
WEB_PORT=<the port of your allocation>      # Network tab of the server. Many panels already set PORT/SERVER_PORT.
WEB_API_SECRET=<a long random text, 40+ characters>
WEB_PUBLIC=off                              # optional: hide the bot's own simple page, keep only the secret API
```
Restart the bot. You should see `[web] pairing website on port ...`.
Test from any computer: `http://YOUR-IP:PORT/health` → `{"ok":true}`.

**Can I use the panel's port?** Yes. In Pterodactyl → your server → **Network**, the *primary allocation* (IP:port) is the port the bot may listen on.
Use that port as `WEB_PORT`. Make sure the node's firewall allows it. Then `BOT_API_URL=http://IP:PORT` on Vercel.
Plain `http://` works server-to-server, but the secret then travels unencrypted. Better: put a free **Cloudflare Tunnel** or a domain with
SSL in front of the port and use an `https://` URL (set `WEB_TRUST_PROXY=1` on the bot if you do).

## 3) Vercel
1. Push this folder to GitHub (or `vercel` CLI) and import it. Framework preset: **Other**. No build command.
2. **Settings → Environment Variables**:
   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Supabase project URL |
   | `SUPABASE_ANON_KEY` | the anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (only used by "Delete my account" — keep it secret, never in config.js) |
   | `BOT_API_URL` | `http://IP:PORT` (or your https URL) |
   | `BOT_API_SECRET` | exactly the same text as `WEB_API_SECRET` in the bot |
   | `ADMIN_EMAILS` | (Build 29) your own sign-in email(s), comma separated. Only these can open the Admin page. |
3. Deploy. Open your Vercel URL, create an account, pair a number.

## Build 29 update steps
1. Supabase → SQL Editor → paste the whole `supabase/schema.sql` again → Run (safe to re-run; adds invites, news and help requests).
2. Vercel → add `ADMIN_EMAILS`, then Redeploy.
3. Upload the Build 29 bot zip over the old bot files and restart (keep `.env` and `data/`).
New: Numbers tab (Control, Status, Reconnect, live status), Share tab (invite link, share card, install app), Help tab, News, `/commands` explorer, `/admin`.

## Safety notes
- Asking for a code makes WhatsApp notify that number. The bot limits requests (per user, per number, per hour) and every request needs a signed-in account.
- Every person only sees/removes their own numbers (the bot derives the owner from the verified Supabase user id + your secret).
- The pairing limit is the same as Telegram: 10 numbers per person (`MAX_SESSIONS_PER_USER`).
- Never put the service_role key or `BOT_API_SECRET` in `public/`.

## Files
`public/` pages, styles, scripts · `api/` Vercel functions · `supabase/schema.sql` · `vercel.json`
