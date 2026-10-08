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

The public repository publishes GitHub Pages from `main/docs` at **https://vickie02736.github.io/Wiz.io/**. Application release commit: `5e17049f3770a57849e62d43008d5acee08e8827`.

- GitHub reports Pages **built** for that release; live HTML matches the committed production HTML byte-for-byte.
- **All 36 live-site Playwright workflows passed**, 12 each in Chromium, Firefox and WebKit, using `WIZ_BASE_URL=https://vickie02736.github.io/Wiz.io/ npm run test:e2e`. Real CDN-based PCA/LDA, downloads, imports, examples, filters, selection, clear, cancellation and retry were exercised through the public URL.
- A separate headed Chromium check on the live URL rendered 2,932 oxygen points with Apple M3 hardware WebGL, downloaded a 3D SVG containing a PNG raster layer, imported a sentinel-containing private test file and ran PCA. It observed **20 GET requests**, only to GitHub Pages and fixed jsDelivr assets; no dataset sentinel in requests, no page errors, and empty localStorage/sessionStorage/IndexedDB. Evidence: `tests/reference/live-validation.json`.
- Validation notes were committed separately after the live checks; no runtime source or generated application assets changed during that documentation update.

## Visualization loading indicator update

- A chart-area loading indicator covers example retrieval, file/subset preparation, scientific initialization and calculation, lazy chart tools, and drawing. It reports actual stages without an invented percentage, and clears after drawing, errors or cancellation. Rendering yields for a paint with a bounded fallback so background tabs cannot indefinitely stall the drawing queue. Image exports wait for pending drawing.
- **32 unit tests**, TypeScript and the production build passed. **All 42 distinct production-browser cases were validated** across Chromium, Firefox and WebKit: 41 passed in the full parallel run; the Firefox zoom/reset case timed out in that run and passed on an isolated rerun. Numerical comparisons, cancellation/retry, 3D, SVG/PNG, imports and subset workflows passed.
- The six new browser checks (two per engine) deliberately delay chart-code and example requests. They verify visible stage text, indeterminate progress semantics, completion, failed example loading/retry, mobile width and navigation cleanup. Chart interaction checks now wait until loading finishes before inspecting or clicking rendered content.
- The desktop loading view was captured and visually inspected. The indicator fits within the chart and respects reduced-motion preferences.

## Full oxygen view by default — 2026-10-08

At the user's request, the dynamic oxygen example now starts with all 2,932 rows. Timed replay is explicit, and **Show all rows** exits playback. Worksheet changes restore the complete view. Playback stops at completion instead of continuing to request/render the same full dataset.

- **32 unit tests**, TypeScript and production build passed.
- **12 targeted production-browser cases** passed across Chromium, Firefox and WebKit: full oxygen defaults and absence of periodic idle redraws, start/pause/show-all/restart, worksheet reset, Wine/stocks controls, clear/session behavior, and chart/example loading indicators.
- An additional Chromium check advanced all 19 replay ticks using the browser test clock, confirmed all 2,932 rows and the restored **Start replay** button, and recorded **zero Plotly.react calls** over another ten simulated seconds after completion.
- Help, README and compatibility notes record the requested default change and retained optional legacy replay.

The release does not claim unknown historical dependencies, pixel-identical Dash widgets, all possible numerical inputs or browser/device combinations; see `COMPATIBILITY.md` for exact scope and intentional differences.
