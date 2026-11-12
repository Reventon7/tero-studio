# Doctor character source and rig

The character uses actual anatomical mesh data from MakeHuman Community, not cylinder limbs or a generated human image. All downloaded source assets are CC0 data; MakeHuman's AGPL application code is neither downloaded nor embedded.

Primary licensing sources:

- [MakeHuman bundled-data and output licensing](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.md)
- [CC0 asset license](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.ASSETS.md)
- [Official system asset pack: per-asset CC0 declarations](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)

Source data lives in `assets/clinical/source/`; `source-audit.json` records pinned base-mesh URLs, ZIP entry URLs, exact byte counts and SHA256 hashes. Only selected ZIP entries were fetched through HTTP range requests; the full 281 MB system pack was not downloaded.

| Source | Use |
| --- | --- |
| hm08 `base.obj` | 13,380 anatomical body vertices; only the `body` face group is rendered. Joint/helper faces are omitted. |
| Default skeleton / skin weights | 163 bones, including spine, pelvis, neck, head, shoulders, elbows, wrists/fingers, hips, knees and feet |
| Caucasian male young/old targets | 0.82 / 0.18 weighted anatomical morph; adult appearance, without claiming a calibrated exact age |
| `high-poly` eyes and brown-eye texture | Fitted eyes using the official barycentric proxy map |
| System `short04` | Actual short-hair mesh, proxy fitting data and alpha texture |
| System `male_casualsuit04` | Actual loose short-sleeve top and trouser mesh, recoloured navy by the renderer; an adapted professional outfit, not a manufacturer medical-uniform model |
| Middle-aged light-skinned male diffuse | Natural facial/hand skin detail; 1024 px JPEG derivative |

The garment's `delete_verts` mask determines which underlying anatomical faces to omit. Clothing and hair are fitted to the morphed anatomical mesh using the proxy's three-vertex barycentric maps and axis-scaled offsets. Skin weights transfer through the same maps, reduce to the strongest four influences, and normalize. OBJ vertex/UV pairs are duplicated at atlas seams; UV coordinates are not averaged across seams.

## Generated runtime asset

`public/assets/clinical/doctor.json` is the reusable character asset; `doctor.json.gz` is an optional compressed equivalent. Geometry is in metres, +Y up and +Z forward. The origin remains near the pelvis, not at the floor. The anatomical height is approximately 1.74 m. This scale is an artistic fit to the scene, not a measured real person.

The root-level `positions`, `normals`, `uvs`, `joints`, `weights` describe the anatomical mesh. Render `groups.skin`; `groups.scrubs` retains covered anatomy only as a fallback. When rendering the actual `clothing` mesh, omit `groups.scrubs`. The `clothing`, `hair` and `eyes` objects each have their own vertex arrays, indices and four bone influences per vertex. Hair uses alpha testing (suggested threshold 0.35). Mesh arrays preserve UV seams.

`bones` is an array of `{name,parent,head,tail}`. Parent indices are **not necessarily earlier than children**; evaluate transforms recursively or topologically. Head/tail coordinates are in the common rest coordinate system. Rig joints come from means of morphed helper vertices. The default pose is standing with arms angled outward, not an arbitrary T-pose. Bone rest transforms must be retained when constructing pose/skinning matrices.

The eye centers are approximately `[±0.02931, 0.81511, 0.12883]`. Their forward surface reaches Z ≈ 0.146. These coordinates support fitting the unchanged Hero eyewear; they are not product measurements.

Reproduce locally:

```text
node scripts/prepare-doctor-source.mjs
node scripts/build-doctor-asset.mjs
powershell -NoProfile -File scripts/prepare-doctor-textures.ps1
```

Optimized textures total about 456 KB: skin JPEG 115 KB, hair PNG 281 KB with alpha, eyes JPEG 21 KB and a procedural scrub-fabric PNG 39 KB. The JSON contains the full rig/mesh data; gzip reduces it to about 867 KB. Mesh validity and rig hierarchy tests are in `tests/doctor-asset.test.mjs`. Visible pose, hand contact, clothing fit and face/eyewear clearance must still be checked in the actual rendered scene.

The current refinement retains the same character and licensed garment. `scripts/clinical-wardrobe.mjs` adds a small loose cloth envelope, low-amplitude folds, separate boundary hem bands and a filtered woven material. `seams` is an additional skinned mesh; its data follows the same four-influence schema.

## 2026-11-03 rendering refinement

Higher-resolution skin/hair runtime WebP atlases and the original CC0 garment normal atlas are now used. Short01/short02 alternatives were audited and rejected; short04 and the same character/rig remain. See [visual-quality-upgrade.md](visual-quality-upgrade.md) for provenance, GPU/CPU parity and current limitations.
