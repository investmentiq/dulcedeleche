# MGL Sözlük API

Read-only Cloudflare Worker bridge for the MartianGalactic Labs Sözlük Okuru experiment.

It reproduces the anonymous mobile-client authentication flow already used by the standalone Sözlük Okuru project, but keeps that protocol on the server side so the GitHub Pages frontend never receives session tokens.

## Deploy

```bash
npx wrangler login
npx wrangler deploy
```

Wrangler will print a `https://...workers.dev` URL. Use that URL as the frontend API base.

## Routes

- `GET /v1/health`
- `GET /v1/feed?kind=popular&page=1`
- `GET /v1/feed?kind=today&page=1`
- `GET /v1/feed?kind=debe&page=1`
- `GET /v1/search?q=...&page=1`
- `GET /v1/topic?id=123&page=1`
- `GET /v1/entry?id=123`
- `GET /v1/user?nick=...`

CORS is restricted to the MGL site and local development origins. This is unofficial and read-only; upstream API changes may break it.
