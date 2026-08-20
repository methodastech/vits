# Editing the site content

All copy and imagery live in one file, `content.json`. Nothing else needs
touching to change words on the site.

There are two ways in.

---

## 1. The admin UI (for the client)

`https://<the-site>/admin/`

**This does not work yet.** The editor is built and branded, but its backend is
`git-gateway`, which needs a host that provides identity. Until the three steps
below are done, `/admin/` shows a "Login with Netlify Identity" button that
cannot succeed — locally or anywhere else.

### To turn it on

1. **Deploy to Netlify** from the GitHub repo (`methodastech/vits`). Build
   command: none. Publish directory: the repo root.
2. In the Netlify site: **Identity → Enable Identity**, then
   **Identity → Services → Git Gateway → Enable**.
3. **Identity → Invite users**, and send the client an invite. They set a
   password from the email and can then sign in at `/admin/`.

Optional but worth doing: under Identity → Registration, set it to
**Invite only**, otherwise anyone can register themselves an editor account.

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
