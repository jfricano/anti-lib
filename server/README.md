# Cover store

A small file server that keeps a copy of every cover the anti-library uses, so the page doesn't depend on outside image hosts and phones download a small thumbnail instead of a full-size original. It follows the same shape as Personal Treasury's private service on Railway: one service built from this repository with a Dockerfile, plain Node with no dependencies, allowed by Node to write only to its volume, one copy on a persistent volume at `/data`, and secrets only in Railway. Unlike Treasury it holds nothing private, so there are no accounts and no encryption.

It runs with Railway's Serverless setting, so it sleeps when nobody is visiting and costs very little. The server never makes outgoing requests (which would keep it awake): all downloading is done by the "Store covers" workflow, which uploads the files.

## What it serves

| Path | What |
| --- | --- |
| `GET /c/<code>.webp` | A cover's thumbnail, 256px wide. What the page shows. |
| `GET /o/<code>.<ext>` | The original file the thumbnail was cut from. |
| `GET /files.json` | The names stored so far, so the workflow uploads only what's missing. |
| `GET /healthz` | `{"status":"ok"}`, for Railway's health check and for the page to wake the store early. |
| `PUT /c/…`, `PUT /o/…` | Uploads, only with `Authorization: Bearer <STORE_WRITE_KEY>`. |

`<code>` is `shortKey(source link)` from `scripts/short-key.mjs`. Files are served with a one-year "never changes" cache header, so returning visitors don't wake the store at all.

## Setting it up on Railway

1. New project, then **Deploy from GitHub repo**, and pick `jfricano/anti-lib`.
2. In the service's **Settings**, set **Root Directory** to `server` (Railway then builds `server/Dockerfile`), and **Watch Paths** to `server/**` so list changes don't redeploy it.
3. Right-click the service and **Attach volume**, mounted at `/data`.
4. In **Variables**, add `STORE_WRITE_KEY` with a random value of at least 32 characters (`openssl rand -base64 32`). Railway supplies `PORT`.
5. In **Settings**, set the health check path to `/healthz`, turn on **Serverless**, and under **Networking** generate a domain (or add `covers.jasonfricano.com` as a custom domain with the CNAME Railway shows).
6. In GitHub, anti-lib **Settings → Secrets and variables → Actions**, add `STORE_URL` (the domain from step 5, with `https://`) and `STORE_WRITE_KEY` (the same value as step 4).
7. Run **Actions → Store covers → Run workflow** once. The first run copies every cover; later runs follow each data rebuild and only copy new ones.

## Running it locally

```sh
STORE_DIR=/tmp/covers STORE_WRITE_KEY=$(openssl rand -hex 16) PORT=8080 node server/server.mjs
```
