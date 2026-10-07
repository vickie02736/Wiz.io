# Wiz.io

**A clearer view of your data.** An independent, browser-based workspace for interactive data visualization, PCA and LDA.

**Open the website: https://vickie02736.github.io/Wiz.io/**

No installation, account, local server or cloud computation is required. Import a spreadsheet, explore relationships, and take your discoveries with you. User files are processed in browser workers and never uploaded.

## What you can do

- Import CSV, TSV, delimited/whitespace TXT and DAT, XLSX, XLS and ODS. Switch between files and spreadsheet sheets.
- Explore histograms, box plots, line charts, 2D scatter and 3D scatter, with axes, color, size, grouping and labels.
- Filter with multiple conditions, sort and page through data, and select table rows or 2D chart points.
- Run PCA or LDA with optional standardization, class labels, explained and cumulative variance, component selection and PCA loadings.
- Export your active data, analysis scores and PCA loadings to CSV, and charts to PNG/SVG.
- Try built-in Iris, Wine and synthetic time-series examples.

The interface and documentation are in English. This project was written independently and does not include source code or assets from kesler20/Wiz.

## Using the website

1. Open the link above and import files, or choose an example.
2. Choose the active dataset and set your chart type and axes. The first non-empty row is treated as the header. Duplicate headers are renamed and reported. Adjust inferred column types if needed.
3. Add filters, then optionally select rows. The table previews all matching rows so you can extend your selection. Charts, analysis and data exports use the intersection of matching rows and selected rows; without a selection, all matching rows are active. An empty intersection remains empty.
4. Open **PCA / LDA**, choose numeric features and a class label, then run analysis. The scientific engine loads only on first use. You can cancel or retry.
5. Export data, scores, loadings or images using the workspace buttons.

### Capacity and browser requirements

An import is limited to 20 MiB, 100,000 data rows per sheet, and 1,000,000 data cells across all datasets in the workspace. Files in an import are accepted together or rejected together; data is never silently truncated. Empty spreadsheets and empty sheets require a header and at least one data row. Actual capacity depends on device memory; the limits are guardrails, not a performance guarantee.

TXT/DAT support common delimiters and simple whitespace-separated columns. Use CSV/TSV for quoted labels containing spaces. Numeric columns recognize standard decimal/scientific notation, with missing cells distinct from zero. ISO date columns are detected; you can override types.

Use a modern browser supporting ES modules, Web Workers and WebAssembly. 3D charts and large scatter plots require WebGL. Charts render all active rows without implicit sampling. WebGL and 3D layers in SVG exports are raster images, not fully vector output.

### Analysis behavior

- PCA defaults to `StandardScaler` followed by full-SVD PCA; the component count is at most `min(features, complete_rows - 1)`.
- LDA uses scikit-learn's SVD solver, requires a class label with at least two classes, and needs more complete samples than classes. Its dimension is at most `min(features, classes - 1)`.
- Label columns and non-numeric columns are excluded from features. Rows with missing/non-finite feature values are removed; LDA also removes rows with missing class labels. Constant features are removed after row cleaning. The interface reports exclusions.
- One-dimensional results are shown on a horizontal line. Component signs are arbitrary and do not change the interpretation. LDA projection is supervised exploration, not a reported model-accuracy estimate.
- Changing data, selection, filters, labels or settings makes existing results stale. Run again before exporting them. Cancel terminates the analysis worker.
- Score exports include stable zero-based source row IDs, class labels, method, standardization and feature names. PCA loading exports also record standardization.

## Privacy

User files, filtered data and analysis results exist only in the page's memory. They are not sent to a backend, stored in local/session storage or committed to this repository. Refreshing, closing or clearing the page removes them. Downloaded files are saved only when you request an export.

The website is hosted by GitHub Pages. Pyodide/scientific packages load from a pinned jsDelivr URL, and fonts load from Google Fonts. Those services receive normal asset requests; **user data is not included**. Normal browser HTTP caching may retain program assets. There is no analytics or tracking code.

## Development and publishing (maintainers only)

Website users need none of these tools. Maintainers use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Development URL: `http://127.0.0.1:5173/Wiz.io/`.

```sh
npm run check
npx playwright install chromium firefox webkit
npm run test:e2e
npm run build
```

`build` checks TypeScript and writes the production website to `docs/`, including `.nojekyll`. Commit source, `package-lock.json` and the generated `docs/` together. Do not commit dependencies, private datasets, test output or credentials.

GitHub Pages is configured to publish **main / docs**. The Vite base path is `/Wiz.io/`; all example and worker URLs follow it. Navigation is internal to the page, so no server-side route rewrites are required. No custom domain is configured.

To validate the deployed website:

```sh
WIZ_BASE_URL=https://vickie02736.github.io/Wiz.io/ npm run test:e2e
```

The test suite covers supported formats and workbook sheets; capacity and data-integrity boundaries; cross-browser imports, filtering, selection, exports, real PCA/LDA, cancellation and failure; mobile layout, storage and network privacy; and analytical PCA/LDA reference values that tolerate arbitrary component signs.

## Project structure

- `src/data.ts`: import, typing, filtering, stable IDs and CSV exports.
- `src/workers/`: dataset and scientific-computation workers with request IDs.
- `src/analysis.py`: independently written scientific analysis using scikit-learn.
- `src/App.tsx`, `src/Plot.tsx`: workspace and interactive rendering.
- `public/examples/`: public example datasets only.
- `tests/`: unit tests and Playwright browser tests.
- `docs/`: committed production website.

Frontend dependencies are locked in `package-lock.json`. Scientific runtime: Pyodide **314.0.7**, with scikit-learn **1.8.0**, NumPy **2.4.6**, SciPy **1.18.0**, joblib **1.5.3** and threadpoolctl **3.6.0** from that distribution. No unpinned scientific packages are installed at runtime.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for library licenses and example-data attribution.
