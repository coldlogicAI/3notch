# 3notch.dev — landing site

Static landing page for **3Notch**, deployed on **Cloudflare Pages**.

- **Stack:** vanilla HTML + CSS + a few SVGs. No framework, no build step.
- **Host:** Cloudflare Pages (free tier).
- **Domain:** `3notch.dev` (apex) + `www.3notch.dev` (redirect to apex).
- **Source:** the public 3Notch repository under `site/`.
- **Complete static tree:** under 1MB, including documentation and social images.

```
site/
├── public/             ← deploy this folder
│   ├── index.html
│   ├── 404.html
│   ├── docs/           ← static documentation and continuation guide
│   ├── favicon.svg
│   ├── favicon-32.png
│   ├── apple-touch-icon.png
│   ├── og-image.png    ← 1200×630 social preview
│   ├── og-image.svg    ← source for the OG image
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── _headers        ← security + cache headers
│   └── _redirects      ← apex redirect + shortlinks (/github, /docs, /npm)
├── wrangler.toml       ← Cloudflare Pages config
├── package.json        ← deploy + dev scripts
├── .gitignore
└── README.md           ← this file
```

---

## Local preview

```bash
cd site
npm run dev
# → http://localhost:4321
```

This uses `npx serve` (no install needed). Open the URL, edit `public/index.html`, refresh.

---

## Deploy to Cloudflare Pages

### One-time setup

1. **Create a Cloudflare account** at https://dash.cloudflare.com (free).
2. **Install Wrangler** (or skip — the deploy script uses `npx`):
   ```bash
   npm install -g wrangler
   ```
3. **Authenticate** the first time you deploy:
   ```bash
   npx wrangler login
   ```
   This opens a browser tab — approve and you're done.

### Ship it

From `site/`:

```bash
npm run deploy
```

That runs:

```bash
npx wrangler@latest pages deploy public --project-name=3notch
```

First deploy will prompt you to **create the Pages project** (`3notch`) — say yes. After that, every `npm run deploy` pushes to production.

You'll get back a `*.pages.dev` URL like `https://3notch.pages.dev` — confirm the site looks right there before pointing the apex domain at it.

### Preview deploys

For a non-production deploy (useful for testing changes before the apex switches over):

```bash
npm run deploy:preview
```

This deploys to a `preview.<project>.pages.dev` branch.

---

## Point 3notch.dev at the site

You own the domain — these steps assume it's already registered. The cleanest path is **Option A** (full Cloudflare DNS); **Option B** keeps your existing registrar's DNS.

### Option A — Move DNS to Cloudflare (recommended)

1. In Cloudflare dashboard → **Websites** → **Add a site** → enter `3notch.dev`.
2. Cloudflare scans your current DNS. Approve / clean up the records.
3. Cloudflare gives you two nameservers like `nia.ns.cloudflare.com` / `dan.ns.cloudflare.com`.
4. At your registrar (Namecheap, Porkbun, GoDaddy, etc.), **replace the nameservers** with the two Cloudflare gave you. Save.
5. DNS propagation takes 5 min – 24 hr. You'll get an email when Cloudflare picks it up.

Once that's active:

6. **Pages dashboard** → your `3notch` project → **Custom domains** → **Set up a custom domain**.
7. Add `3notch.dev` — Cloudflare wires the DNS automatically.
8. Add `www.3notch.dev` the same way. The `_redirects` file in this repo will 301-redirect `www → apex`.

### Option B — Keep DNS at your registrar

1. **Pages dashboard** → your project → **Custom domains** → **Set up a custom domain** → add `3notch.dev`.
2. Cloudflare shows the DNS records you need to add at your registrar — typically:
   - **A** `@` → `192.0.2.1` (or the IPs Pages shows you)
   - **CNAME** `www` → `3notch.pages.dev`
   - **CNAME** `@` → `3notch.pages.dev` (only if your registrar supports CNAME flattening; otherwise use the A records Cloudflare gives you)
3. Wait for DNS to propagate.
4. Cloudflare auto-issues a TLS cert. Site is live on HTTPS within ~5 min of DNS resolving.

---

## Verifying the deploy

After it's live at `https://3notch.dev`:

| Check | How |
| --- | --- |
| Site loads on HTTPS | `curl -I https://3notch.dev` → expect `HTTP/2 200` |
| Fonts loaded | View source, confirm Geist + Geist Mono from Google Fonts |
| OG preview | Paste the URL into a Slack/Discord channel or [OpenGraph.xyz](https://www.opengraph.xyz/) — should show the red-accent card |
| Security headers | `curl -I https://3notch.dev` → expect `strict-transport-security`, `x-content-type-options`, etc. |
| Apex/www redirect | `curl -I https://www.3notch.dev` → expect `301` → `https://3notch.dev/` |
| Shortlinks | `curl -I https://3notch.dev/github` → `302` → GitHub repo |
| 404 page | Visit `https://3notch.dev/nope` — should show the "trail goes cold" page |

---

## Editing the site

The landing page is `public/index.html`. Its CSS and small copy/reveal script are inline. Documentation pages live under `public/docs/` and share `public/docs-style.css`.

Common edits:

- **Change the headline / subhead:** search for `Mark your<br>trail` in `index.html`.
- **Update the agent setup prompt:** search for `Install @3notch/cli` and keep the three prompt copies aligned.
- **Update the install command:** search for `npm install -g @3notch/cli` and its matching `data-copy=` attribute.
- **Swap GitHub links:** find/replace `https://github.com/coldlogicAI/3notch` in the static source, redirects, and social image source.
- **Update the OG image:** edit `public/og-image.svg`, then regenerate the PNG:
  ```bash
  cd site/public
  qlmanage -t -s 1200 -o . og-image.svg && \
    sips -s format png -z 630 1200 og-image.svg.png --out og-image.png && \
    rm og-image.svg.png
  ```

---

## Open follow-ups

A few optional housekeeping items remain:

- [ ] Consider a [`/.well-known/security.txt`](https://securitytxt.org/) once the project has a security contact.
- [ ] A `humans.txt` if you want to credit contributors.

---

## Brand reference

The landing and docs styles contain the canonical color tokens, type stack, and three-line mark used by this static site. Keep new pages aligned with those existing primitives.

Single accent: **Mark red** (`#E04E2C`). Never introduce a second.
