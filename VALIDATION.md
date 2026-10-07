# Validation record — Wiz.io 1.1.0

Date: 2026-10-07. Reference SHA: `ff94a3805889f76c050fbea7f9b1bf6d4b15dfab`.

## Completed before publication

- **32 unit tests** passed (`npm test`): seven file formats, workbook sheets, duplicate headers, malformed/empty/capacity inputs, missing records and NA/inf handling, float-preserving CSV round trips (including negatives), stable filter/sort/selection IDs, legacy grammar, reference chart data/style, 2D/3D layout, large unsampled WebGL plots and LDA display conventions.
- **6 scientific tests** passed (`python scripts/test-analysis.py`, locked reference environment): fixed PCA/LDA scores/variance/cumulative ratios at rtol 1e-7 / atol 1e-8; missing/infinite rows; constant/integer features; insufficient samples/classes; degenerate LDA; one dimension; repeated-eigenvalue subspaces.
- **36 production-browser workflows** passed (`WIZ_BASE_URL=http://127.0.0.1:4173/Wiz.io/ npm run test:e2e`), 12 in each engine: Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6. Production output was served from the committed `docs/` build, not Vite's source transform.
- Browser workflows cover import formats and mixed files, worksheet switching, disabled-upload/clear/reupload, 20 MiB / row / combined-cell boundaries, 50-row popup and cross-page selection, filter/sort/export row consistency, click annotation without subset changes, legend/zoom/reset/editable SVG toolbar, auto histogram/box/Jet/log/bubble sizes, 3D and PNG/SVG, both multi-Y line formats and row order, public examples, lazy science failure/cancel/retry, default/Advanced science, same-row analysis/export intersection, stale results, dataset switching, mobile layout and memory-only persistence.
- **TypeScript / production build** passed (`npm run build`); frontend and worker URLs use `/Wiz.io/`. `.nojekyll` is present. All six fixed data-file hashes match provenance; `docs/examples/` matches source assets byte-for-byte. `git diff --check` passes; CSV CRLF is preserved deliberately via attributes.
- **Native hardware WebGL** passed in headed Chromium: Apple M3 / ANGLE Metal, 2,932 oxygen points in a 3D scene, legacy 2:2:1 aspect and font sizes. SVG includes a PNG raster layer. No page errors. Evidence: `tests/reference/native-webgl.json`.
- **Network/storage audit** passed while importing a sentinel-containing private test file and running real PCA: only GET requests to the website and fixed jsDelivr runtime; no dataset text in URLs or payloads; localStorage, sessionStorage and IndexedDB empty. Evidence: `tests/reference/network-validation.json`.
- **Reference UI** started without modifying its source; real upload, axis selection and click annotation were replayed with no browser page errors. Reference/new screenshots were visually checked. Oracle regenerated from the fixed checkout with an identical checksum.
- Public example comparison: all oxygen and Wine cells/dtypes match. Iris's three public-data corrections are documented in `tests/reference/example-comparison.json` and `COMPATIBILITY.md`. Stock-index replacement is explicit.

## Publication verification

The release is configured for GitHub Pages `main/docs` at https://vickie02736.github.io/Wiz.io/ . Live-site results are recorded after the deployment finishes. The release does not claim unknown historical dependencies, pixel-identical Dash widgets, all possible numerical inputs or browser/device combinations; see `COMPATIBILITY.md` for exact scope and intentional differences.
