# Editing the site content

All copy and imagery live in three files, one per prototype: `content.json`
(Prototype 1), `content2.json` (Prototype 2) and `content3.json` (Prototype 3).
Each is its own entry in the admin UI, so editing one prototype cannot disturb
another. Nothing else needs touching to change words on the site.

For local editing without any of the setup below: run `npx decap-server` from
the repo root (it listens on :8081), serve the site, and open `/admin/` — no
login, saves write straight to disk.

There are two ways in.

---

## 1. The admin UI (for the client)

`https://<the-site>/admin/`

**Editors sign in with a GitHub account** that has write access to
`methodastech/vits`. The backend is `github`, which routes the OAuth handshake
through Netlify's gateway — that part needs a one-time setup:

### To turn it on

1. **Create a GitHub OAuth app** (GitHub → Settings → Developer settings →
   OAuth Apps → New, under the account or org that owns the repo):
   - Homepage URL: `https://vitsnoodle.netlify.app`
   - Authorization callback URL: `https://api.netlify.com/auth/done`
2. In the Netlify site: **Site configuration → Access & security → OAuth →
   Install provider → GitHub**, and paste the app's Client ID and secret.
3. **Give each editor write access to the repo** (GitHub → repo → Settings →
   Collaborators). Their saves in `/admin/` become commits under their name.

(The original plan was `git-gateway` + Netlify Identity, but Identity is closed
to new sites — `/.netlify/identity` 404s on a fresh deploy.)

### Using it

The editor opens on **Website content → Prototype — all content**. Sections are
collapsible: Brand, Navigation, Hero, Pack, Story, Credentials, Trade, Range,
Cook, Reel, Finale, Footer.

Change a field, press **Publish**. Decap commits the edit straight to `main` on
GitHub, Netlify sees the commit and redeploys, and the change is live in a
minute or so. There is no separate database — the git history *is* the edit
history, so any change can be traced or reverted.

Images work the same way: the image widget uploads into `assets/` and rewrites
the path in `content.json`.

---

## 2. Editing `content.json` directly (for us)

Faster during development, and works with no deployment at all. Edit the file,
reload the page. `content.js` fetches it on load and fills anything carrying a
`data-c` attribute.

---

## What the CMS reaches, and what it does not

**Covered** — 162 fields: all page copy, headings, product names and meta,
form labels, footer, and every flat image including the pack shots and section
backgrounds.

**Not covered:**

- **The scanned 3D packs.** Their artwork is pixels baked into the `.glb`
  files. There is no text layer to edit. Changing it means new pack art, a new
  Meshy scan, and a rebuild through `tools/`.
- **`RANGE_SKUS`** in `index3.html` — the per-SKU title, kicker, sub, weight
  and count label used by the coded packs are still hardcoded in the script.
- **The price map** in `index3.html`.
- Layout, motion and 3D lighting, which are code.

### The one switch worth knowing about

`Pack → Use scanned 3D packs`

- **On** (default): photoreal scanned packs. Their artwork is fixed.
- **Off**: the packs are drawn in code from the `Pack` fields instead, so
  everything printed on the 3D pack becomes editable here — at the cost of
  looking illustrated rather than photographed.

This is why editing the `Pack` fields appears to do nothing on prototype 3
while the switch is on: the fields are working, but a scan is drawn over the
top. On prototypes 1 and 2 they take effect directly.
