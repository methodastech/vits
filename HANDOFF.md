# Vit's Noodles, trade demo: developer handoff

Static site. No build step, no framework, no package manager. Everything in this folder is what
ships.

## Running it

It must be served over HTTP. `js/pack3d.js` is an ES module and the 3D model is fetched, so opening
`index.html` from the file system will fail on CORS.

```
cd <this folder>
npx -y serve .
```

Any static server does: `python3 -m http.server`, nginx, Netlify, S3 + CloudFront, a PHP host's
public folder. There is nothing to compile.

One caveat if you use `python3 -m http.server` locally: it does not answer byte-range requests, so
`assets/bowl-turn.mp4` will log a request error in the console. Real hosts answer ranges and it goes
away. `npx serve` handles ranges.

## What is in here

| Path | What it is |
|---|---|
| `index.html` | The site. One page, nine scenes |
| `3d.html`, `about.html`, `products.html`, `resources.html` | Secondary pages |
| `audit.html`, `competitors.html`, `plan.html`, `compare.html` | The Brand Method deck, reached from the black admin bar at the top |
| `css/site.css` | One stylesheet, everything |
| `js/motion.js` | Scroll: Lenis + GSAP ScrollTrigger. Pins, parallax planes, the cork wall, the range rail, the cook captions, the form |
| `js/pack3d.js` | Three.js. ONE canvas, ONE pack, carried through every scene |
| `js/*` others | The vendored libraries and the small helpers they need |
| `content.json` | Every string on the page |
| `admin/` | Decap CMS. `admin/config.yml` is the field map |
| `assets/` | Images, video, the packaging artwork, the ramen model |
| `noodle.glb` | The noodle block geometry, 1.8 MB |
| `tools/` | The QA harness, see the last section |

## The one thing to understand before editing

There is a single fixed WebGL canvas, `#stage3d`, and a single pack inside it. It is not one 3D
scene per section: the same pack flies from the hero, through the anatomy close-up, down the cork
wall, into the range dock, and pours itself into the bowl.

`js/motion.js` measures the page every frame and writes what it found to `window.__ph`:

```js
window.__ph = {
  heroOn, hero,          // the hero's progress
  travelOn, travel,      // the flight down the page
  rangeOn, range,        // the SKU rail
  cookOn, cook,          // the pour
  heroBox, labelBox,     // where the empty slots ARE on the page, in NDC
  dockBox, dockLive,
  handoff, marks, ...
}
```

`js/pack3d.js` reads `window.__ph` and puts the pack there. It never reads the DOM for layout and
`motion.js` never touches Three.js. That boundary is the whole architecture: if the pack is in the
wrong place, the bug is either in the box `motion.js` published or in how `pack3d.js` mapped it, and
you can tell which in one line by logging `window.__ph`.

The reverse channel is `window.__packBox`, `window.__bowlBox` and `window.__packAlpha`: where the
pack actually landed on screen and how strongly it is drawn. The drag pad, the hero tag and the QA
harness all read those rather than guessing from position and scale, because the drawn silhouette
runs past the nominal box.

## Editing copy

Three places have to agree, or the string will not appear:

1. the element carries `data-c="path.to.key"` in the HTML,
2. the key exists in `content.json`,
3. the field is declared in `admin/config.yml`.

Miss the third and the client cannot edit it in the CMS. Miss the second and the element keeps its
hard-coded fallback, which is easy to miss in review because the page still looks right.

## Cache tokens

`index.html` loads its assets with a version query:

```html
<link rel="stylesheet" href="css/site.css?v=241">
<script src="js/motion.js?v=150"></script>
... import('./js/pack3d.js?v=424')
```

Bump the number whenever you change that file. Without it you will chase a bug that was fixed twenty
minutes ago and is still cached.

## Breakpoints

| Band | Layout |
|---|---|
| up to 760 | Phone. Single column, the pack rides the board's own lane, the cook captions share one slot |
| 761 to 1000 | Stacked tablet. Copy above the dock, its own board spread and parallax unit |
| 1001 and up | The wide layout. Two columns, the pack in the right one |

Two things are pointer-based rather than width-based on purpose: the parallax opt-outs
(`data-plx-m`, `data-plx-t`) and the parallax clamp, so an iPad in landscape at 1024 does not get
handed the desktop treatment.

## The parallax planes

Any element with `data-plx="<speed>"` drifts. Positive travels down, negative up. `data-plx-m` is
its share on a phone, `data-plx-t` its share on a tablet, both `0` to `1`. A plane carrying copy is
clamped to the room it has between itself and its section's edges, so it can never climb into its
neighbour. A backdrop with no text in it, or anything inside a pinned `.stage`, is not clamped.

`window.__plxPlan` lists what every plane was actually given after the share, the band's unit and
the clamp. Read it in the console rather than inferring travel from a screenshot.

## The QA harness

`tools/` is how this build was checked. It drives a real headed Chrome on the real GPU, walks the
whole page and measures rather than judging by eye.

```
node tools/full-check.js http://127.0.0.1:3000/ 1440 900 0.7
node tools/void-scan.js  http://127.0.0.1:3000/ 390 844 0.4
```

`full-check` returns, per width: the action checklist, the tallest band of frame with nothing in it
and where, whether the pack covers any copy and which element, whether the published pack box jumps
between stops, horizontal overflow, bytes transferred and console errors. `void-scan` is the empty
band scan on its own, at a finer step.

They need `playwright-core` and a Chrome for Testing binary. Install it and point the `exe` constant
at the top of each file at your own copy:

```
npm i playwright-core && npx playwright install chromium
```

`tools/site-check.js` needs nothing: it is the in-page checklist and runs in the browser console.

## Open, and known

| Item | State |
|---|---|
| Page weight | 16 to 18 MB over a full scroll. `noodle.glb` is 1.8 MB and wants Draco or quantisation in a build step; `assets/bowl-turn.mp4` is 2.5 MB; the ramen base colour is 641 KB and the pack face photograph 627 KB. First paint is 5 to 7 MB, the rest arrives as the reader scrolls |
| The enquiry form | Validates and shows its states, but posts nowhere. The endpoint hook is `data-endpoint` on the form in `index.html`; wire it to whatever the client uses |
| The figures | 202m servings, 5000+ businesses, 30+ countries and 70% are the client's own numbers as supplied in September 2026. Confirm before launch |
| Fonts | Anton and Archivo, loaded from the page. Check the licence for the client's domain |
| `assets/classic_ramen/license.txt` | The third-party ramen model's licence. It travels with the model |

## Verified state

Measured on a real GPU over a full scroll, nine widths: 360, 390, 430, 768, 800, 1024, 1280, 1440,
1920. Every one passes 24 of 24 on the action checklist with zero pack teleports, zero horizontal
overflow and a clean console. Tallest empty band 204 to 324px except 1920, whose three are the
range's full-bleed photograph and the cork wall arriving and closing on its batten.
