# Vit's trade demo: state of the build, 12 Sep 2026

Every number here was measured on this machine's GPU in a real Chrome window (headed Chrome for
Testing), not in the preview pane and not from a single screenshot. One command per width:

```
node tools/full-check.js http://127.0.0.1:8765/ <w> <h> 0.7
```

It loads the page, waits for the 3D layer, runs the action checklist, then wheel-walks the whole
page and at every stop measures: the tallest band of frame with nothing in it, whether the pack
covers any text, whether the published pack box jumps between stops, horizontal overflow, and the
bytes transferred. Console errors are collected for the whole run.

## Result by width

### First pass, earlier on 12 Sep

| Width | Checklist | Tallest empty band | Bands over 280px | Pack over text | Teleports | Overflow | Console | Weight |
|---|---|---|---|---|---|---|---|---|
| 360 x 780 | 24 / 24 | 264px | 0 | none | 0 | none | clean | 17.6 MB |
| 390 x 844 | 24 / 24 | 276px | 0 | board only (0.95) | 0 | none | clean | 16.4 MB |
| 430 x 932 | 24 / 24 | 300px | 2 | board only (0.95) | 0 | none | clean | 17.1 MB |
| 800 x 900 | 24 / 24 | 414px | 4 | range meta (0.37) | 0 | none | clean | 16.4 MB |
| 1440 x 900 | 24 / 24 | 402px | 2 | none | 0 | none | clean | 17.4 MB |
| 1920 x 1080 | 24 / 24 | 384px | 4 | callout beat (0.37) | 0 | none | clean | 17.3 MB |

### Second pass, after the seam, the wall and the stacked range were fixed

| Width | Checklist | Tallest empty band | Bands over 280px | Pack over text | Teleports | Overflow | Console | Weight |
|---|---|---|---|---|---|---|---|---|
| 360 x 844 | 24 / 24 | 234px | 0 | none | 0 | none | clean | 17.3 MB |
| 390 x 844 | 24 / 24 | 246px | 0 | none | 0 | none | clean | 16.4 MB |
| 430 x 844 | 24 / 24 | 246px | 0 | none | 0 | none | clean | 16.4 MB |
| 800 x 900 | 24 / 24 | 252px | 0 | none | 0 | none | clean | 16.4 MB |
| 1440 x 900 | 24 / 24 | 258px | 0 | none | 0 | none | clean | 18.6 MB |
| 1920 x 1080 | 24 / 24 | 366px | 3 | anatomy hint, 0.37, bounding box only | 0 | none | clean | 17.4 MB |

The empty-band column fell at every width. Five of the six now carry no band over 280px anywhere on
the page. The three at 1920 were each opened and looked at: the range at 17.03 is a full-bleed
photographic world with the copy left and the pack right, which the scanner cannot count as ink; the
story at 3.73 is the moment the cork wall arrives, between the pack's foot and the first batten; the
story at 10.73 is the wall closing on the "51 years, one recipe" batten, which lands across the
frame. The pack-over-text reading at 1920 is the anatomy hint's BOUNDING BOX overlapping the pack's
bounding box; on screen the line sits clear below the pack.

Both tools were corrected in this pass as well. Each counted ink from a tag list, so a `div` or an
`a` carrying its own line of copy read as empty frame: the footer's five link columns scored a 336px
void and the range's eyebrow made its own frame read empty at the top. Anything with a direct text
node counts now, plus the media tags. full-check also names what it found: `worstVoids` gives the
stop, the band's top and the section, and `packOverText` names the element, its class and its first
words. That named output cleared the last three readings from the first run of this pass: the 360
pair at 16.65 and 16.94 does not reproduce (two clean runs plus a probe parked on those exact
stops), and neither does the 1440 342px band.

Static integrity: every file referenced by index.html, the stylesheet, both scripts and content.json
exists on disk; content.json parses; cache tokens are site.css 240, motion.js 141, pack3d.js 414.

## What the remaining numbers mean

| Reading | Verdict |
|---|---|
| Pack over text on the board, 0.95 at 390 and 430 | ACCEPTED, Bazil's instruction on 12 Sep: "I like this paper all over the place, it's ok for Vit's to pass through it". The board reserves no lane any more |
| Bands of 280 to 414px at 800, 1440, 1920 | Breathing room between scenes, not holes. The scanner counts a full-bleed colour field as empty, so a red or cork screen with one heading reads high |
| Range meta at 0.37 (800), callout beat at 0.37 (1920) | A third of one small label, during a transition. Watched at both widths; it does not read as a collision |
| Weight 16 to 17.6 MB over a full scroll | THE ONE OPEN ITEM, see below |

### Third pass, the tablet band

Bazil on an iPad: "bit ipad view looks bad no parallax", "empty and titles are everywhere, not
correctly done", "don't just appear, come from the top scrolling".

| Width | Checklist | Tallest empty band | Bands over 280px | Pack over text | Teleports | Overflow | Console | Weight |
|---|---|---|---|---|---|---|---|---|
| 360 x 844 | 24 / 24 | 246px | 0 | none | 0 | none | clean | 16.4 MB |
| 390 x 844 | 24 / 24 | 240px | 0 | none | 0 | none | clean | 16.4 MB |
| 430 x 932 | 24 / 24 | 270px | 0 | none | 0 | none | clean | 16.4 MB |
| 768 x 1024 | 24 / 24 | 324px | 2 | none | 0 | none | clean | 17.1 MB |
| 800 x 900 | 24 / 24 | 252px | 0 | none | 0 | none | clean | 17.1 MB |
| 1024 x 768 | 24 / 24 | 204px | 0 | none | 0 | none | clean | 18.0 MB |
| 1280 x 800 | 24 / 24 | 216px | 0 | none | 0 | none | clean | 18.0 MB |
| 1440 x 900 | 24 / 24 | 264px | 0 | none | 0 | none | clean | 18.0 MB |
| 1920 x 1080 | 24 / 24 | 366px | 3 | hint's bounding box | 0 | none | clean | 17.4 MB |

The two at 768 are both a section arriving: the trade's tail between its quote and its button, and
the range's photographic field above the first specimen's copy. The three at 1920 are unchanged from
the second pass.

| Fault | Where it showed, and the measurement |
|---|---|
| The cork wall read empty on a tablet | Board item offsets are `--u` in vw and `--v` in vh, so the collage's shape follows the FRAME's aspect, not the composition's. A unit is 14.4px across and 9 down at 1440x900 but 7.7 across and 10.2 down at 768x1024, which stretched every pile into a thin tall column against the edges and left the middle bare. The 761 to 1000 band spreads across (1.62vw), compresses down (0.70vh), grows its cards, pulls the piles in off the edges, and drops the wall's pitch from 6.3 to 5.2 screens per unit, which closes a 968px gap between piles on a 1024 frame to about 140 |
| No parallax on a tablet | Two causes. `data-plx-m` is a PHONE compensation and a real iPad reports `pointer:coarse`, so the four planes carrying `m="0"` were switched off outright. And the unit: a tablet scrolls further per section, so 26px per unit left the proof rail at 15px of travel and the lede at 13, under the roughly 40 the eye needs to read a plane as moving. The band has its own unit (34), its own share attribute (`data-plx-t`) and the same clamp, which no longer cuts a backdrop with no text in it or anything inside a pinned stage: the hero photograph travelled 81px, the clamp took it to 26, it is 204 now |
| Two planes carried speeds from the old percent system | `.heroPoster` at -22 and `.lblPoster` at -20 were written when desktop used yPercent. In pixel mode they planned 1320 and 1200px of travel. Retuned to -3 and -2.8 |
| The hero pack stood on its own lede at 768x1024 | `innerHeight` is over 900 there, so the tall-screen fill of 1.10 applied to a narrow stacked hero: the drawn pack came out 598px tall, box [63,390,674,988], against a lede starting at 924. The stacked band fills 0.84 |
| The pack APPEARED in the anatomy instead of arriving | The stacked hand-off was a hard switch: it rode the hero slot until that slot's bottom was 0.37 of a frame above the top edge, then CUT to the label slot at mid frame, an 1100px jump between two stops at 768x1024. One expression now: it rides the hero slot, holds at the top edge once that slot has gone, then travels DOWN into the label slot as that slot climbs |
| The descent covered the hero's own figures | It crosses the proof rows on the way to the red field, which is the collision the 10 Sep audit measured, and it came back at 1024x768 where the slots stack but the layout is still the wide one (cov 0.49 on the lede). It reads as DEPTH instead: while travelling and still over the cream it is small and faint, and it comes forward to full size and strength as it crosses into the red. The recede saturates by a third of the way, because a linear ramp still had it at 0.62 halfway, solid enough to swallow "1980, halal certified" |
| The audit counted a ghost as a collision | The published box is the box whatever the pack's strength. pack3d publishes `__packAlpha` with it and full-check ignores coverage below half strength |

## Fixed in the second pass, 12 Sep

| Fault | Where it showed, and the measurement |
|---|---|
| Dead frame at the range to cook seam, on DESKTOP | The bowl's pre-rise across the seam was written for phones only. At 1440 the identical fault was still there: 396px of empty cream under "3 minutes to sedap" while the range had let go and the cook had not taken hold. The seam carries the bowl at every width now, and the cook's own rise picks up from it |
| The first cook caption drawn behind the bowl | The desktop beat was 0.22 and the bowl's rise ends at 0.26, so "open the pack" was painted under the dish. The beats moved to 0.29 / 0.42 / 0.57 / 0.74 / 0.91, and the caption strip sits at 5vh above 1000 so its box clears the foot of the settled bowl |
| The cork wall opened on bare cork at every width above 760 | The start lift existed only under 760. Measured: 414px of bare cork at 800, where the first batten landed at y 875 of a 900 frame, 306px at 1440 and 282px at 1920. Every width lifts now, fading over the board's own progress the way the phone's does: 0.88 of a frame for 761 to 1000, 0.55 above it. 0.45 left 1440 short and 0.62 opened a band at 1920 |
| The wall's last screen was bare cork | The closing batten sat at t 1.135, a full frame below the last photo pile, so the wall ended on 600px of cork with only the scroll hint on it, shot at 800 and at 1440. It is at 1.05 now, which lands it in frame at the section's end at every width |
| The stacked range printed its copy ON the pack | 761 to 1000 ran the DESKTOP copy rail, 70vh per pack unit, which drives the arriving block downward. Stacked, that is straight into the dock: measured at 800x900 the active block carried a 150px downward translate and the pack's box sat across "Mi Kering Tomato" and its lede. The stacked branch now covers the whole stacked band, not just the phone |
| The stacked range's copy column had no height at all | A min-height of 0 was set in that band to close a pale gap, but the copy blocks are absolute inside that column, so it collapsed and every headline overlaid the stage. It keeps 250px now and the stage takes 42vh, capped at 380px |
| The story heading drifted on phones and sat hard under the red band | The heading and its lede take no phone parallax, so the heading tracks the scroll 1:1: measured 860, 691, 522, 354 across four stops at 390x844, exactly the scroll delta. The intro takes 84px of air above it |

## Fixed in the first pass, 12 Sep

| Fault | Where it showed |
|---|---|
| Published pack box followed a pack parked a whole frame off screen | 761 to 1000 only, where the SKU rail runs sideways. Measured at 800: the box sat at x -988 for a full screen while the pack on screen sat at 588. The drag pad and every audit read that box, so all of them were following the wrong pack. Now picked by distance from the middle of the frame in both axes |
| Turn section cropped to a detail with illegible copy | 761 to 900 still ran the desktop 150%-wide zoom. The stacked treatment (contained video, copy above) now covers that band |
| Dead frame at the range to cook seam | Was phone-only; the whole stacked band gets the arriving bowl now |
| Widest SKU rendered wider than the frame | Every SKU is normalised to the mini pack's height, so the carbonara zip pack drew 845px in an 800px frame. The stacked band takes a smaller dock fill |
| Pale band above the stacked range pack | Its slot rule sat above the plain .specStage rule in the sheet and lost the cascade. Re-declared at the end |
| Checklist rows N1 and M1 still asserted the nav tabs Bazil removed | Rewritten to assert Home, the gated 3D Packs and the enquiry pill |

## Open, and not a defect I can close alone

| Item | Note |
|---|---|
| Page weight | 16 to 17.6 MB across a full scroll. The heaviest are noodle.glb (1.9 MB), bowl-turn.mp4 (2.5 MB), the ramen base colour (641 KB), the pack face photograph (627 KB) and the two gusset photographs (311 and 316 KB). The pack faces are drawn into canvases at fixed coordinates, so shrinking them needs a re-fit pass, and noodle.glb needs Draco or quantisation in a build step (gltf-transform via npx failed on this machine). First paint is 5 to 7 MB; the rest arrives as the reader scrolls |
| Finale visual, story flow, section separation, reel pack per flavour | Bazil's older asks, not started |
| Live form endpoint, and the 202m / 5000+ / 70% figures | Need the client |

## The harness

| Tool | What it does |
|---|---|
| tools/full-check.js | One pass at one width: checklist, voids, overlaps, teleports, overflow, weight, errors |
| tools/void-scan.js | Empty-band scan only, with the section each band falls in |
| tools/phone-walk-gpu.js | A still every N screens, named by the screen it landed on |
| tools/phone-probe.js | One stop: a still plus anything reaching past the frame |
| tools/cook-probe.js | The cook entry, frame by frame |
| tools/site-check.js | The action checklist, asserted in the page |
