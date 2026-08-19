# Pack model pipeline

Meshy exports are unusable as-is: ~2M triangles and, on the textured
exports, ~21MB of embedded JPEGs. `glb-optimise.js` makes them shippable.

    node tools/glb-optimise.js <input.glb> <output.glb> [grid] [texPx]
    node tools/glb-optimise.js ~/Downloads/meshy-tomato.glb assets/pack-tomato.glb 56 1024

What it does, and why:

- **Decimates by vertex clustering**, snapping vertices to a grid and averaging
  each cell. `grid` controls the reduction: higher = more detail, more triangles.
- **Clusters on position AND uv together.** This is the important part. Clustering
  on position alone merges vertices that sit either side of a UV seam, which drags
  the texture across the seam and smears the artwork. Including a coarse UV cell
  in the key keeps the two sides apart.
- **Re-encodes the base colour texture** at `texPx` and drops the metallicRoughness
  and normal maps. At the size these packs are shown on the page those two cost
  megabytes and buy almost nothing.

`fbx-extract.js` is a minimal FBX 7400 binary reader, kept for the untextured
exports. Note that untextured Meshy output has NO UVs at all, so artwork cannot
be applied to it without generating a projection first.

Results so far:

| pack   | in       | out        | size            |
|--------|----------|------------|-----------------|
| tomato | 90.7 MB  | 0.78 MB    | 20,660 tris     |
| penang | ~88 MB   | 1.13 MB    | 30,300 tris     |
