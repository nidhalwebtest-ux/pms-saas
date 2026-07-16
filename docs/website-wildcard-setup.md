# Organization Websites — Wildcard Domain & Env Setup (manual, one-time)

The public booking sites resolve at `{slug}.binaya.app`. This requires a wildcard
domain on the Vercel project plus a DNS record. Do this once.

## 1. Add the wildcard domain in Vercel

Vercel Dashboard → the PMS project → **Settings → Domains**:

1. Add `binaya.app` (apex) and `www.binaya.app` if not already present.
2. Add `*.binaya.app` (wildcard).
   - A wildcard domain on Vercel requires the domain's **nameservers to point to
     Vercel**, OR a wildcard CNAME if you keep DNS elsewhere (see step 2).
3. Assign all three to the **Production** environment (same project — no new project).

CLI equivalent:
```bash
vercel domains add binaya.app
vercel domains add "*.binaya.app"
```

## 2. DNS records (at your DNS provider)

If DNS is managed **at Vercel** (nameservers delegated): nothing more to do — the
wildcard is served automatically.

If DNS is managed **elsewhere**, add:

| Type  | Name            | Value                     |
|-------|-----------------|---------------------------|
| A     | `@`             | `76.76.21.21`             |
| CNAME | `www`           | `cname.vercel-dns.com.`   |
| CNAME | `*`             | `cname.vercel-dns.com.`   |

The `*` CNAME is what makes every `{slug}.binaya.app` reach this app. TLS for
wildcard subdomains is issued automatically by Vercel.

## 3. Environment variables (Vercel → Settings → Environment Variables)

Rate limiting on the public availability/booking endpoints uses Upstash Redis.
Provision a free database via **Vercel Marketplace → Upstash** (or upstash.com),
then set (Production + Preview):

| Variable                   | Source                          |
|----------------------------|---------------------------------|
| `UPSTASH_REDIS_REST_URL`   | Upstash database REST URL        |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash database REST token      |

If these are **absent**, rate limiting fails open (all requests allowed) — fine
for local dev, not recommended for production.

## 4. Local development

No hosts-file edits needed — Chrome/Safari resolve `*.localhost` automatically.

```bash
npm run dev
# seed a published demo site for an existing org:
PRISMA_USE_DIRECT_URL=1 npx tsx scripts/seed-website.ts demo
# then open:
open http://demo.localhost:3000
```

## Notes
- Reserved subdomains (never tenant sites): `www, app, api, admin, mail, blog,
  help, dev, static, assets, cdn, status, docs, support, binaya, auth, login,
  dashboard, onboarding, account, billing, internal, office`
  (see `lib/public-site/subdomain.ts`).
- Custom per-org domains are intentionally **out of scope for V1** (paid add-on later).
