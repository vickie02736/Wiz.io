# Wiz.io

An independent, browser-only implementation of the normal visualization workflow in Kesler Wiz, fixed at commit [`ff94a3805889f76c050fbea7f9b1bf6d4b15dfab`](https://github.com/kesler20/Wiz/tree/ff94a3805889f76c050fbea7f9b1bf6d4b15dfab).

**Open [Wiz.io](https://vickie02736.github.io/Wiz.io/). No installation, account, Python server or continuously running computer is needed.**

The application and help are in English. All user data stays in browser memory. Source and styles were independently written; the original restricted Wiz source, logo, styles and documentation are not redistributed.

## Normal workflow

- **Scatter**: upload once, choose X/Y, Linear/Log, color, bubble size and optionally Z for 3D. One variable gives a histogram; categorical X gives a box plot showing original points. Numeric continuous colors use Jet. Click a 2D point to add an annotation; clicking does not select a subset.
- **Lines**: select multiple Y columns. Type 1 shares the first X column; Type 2 uses adjacent X/Y pairs. Lines follow input row order, until an explicit table sort changes the display order.
- **PCA/LDA**: automatically analyze floating-point features, excluding the class column. PCA standardizes; LDA does not. Projection and explained/cumulative variance appear together. Classes are required for LDA.
- **View Data**: a read-only, 50-row popup. Scatter and Type 1 lines support filters, sorting and row selection. PCA/LDA supports filtering. Type 2 lines has a plain preview. Stable row IDs retain selections across pages.
- **Download**: default CSV contains plotted columns, or PC/LD scores plus Individual/Cumulative variance. Download SVG with the button or Plotly toolbar.
- **Examples**: dynamic/static oxygen, historical stock-index lines, Wine histograms and Iris PCA/LDA.

**Advanced** holds box/lasso subset selection, explicit plot types/grouping/labels, numeric type correction, integer/selected features, scaling overrides, manual analysis, component controls, loadings, scores with settings, full-column subset CSV and PNG. A deterministic synthetic time series is in Advanced examples.

See the website's **Help** and [COMPATIBILITY.md](COMPATIBILITY.md) for detailed behavior, fixed bugs, tested coverage and remaining platform differences. This is functional compatibility with a fixed source/reference environment, not a claim of identical pixels or Kesler's unrecorded historical deployment.

## Data rules and privacy

CSV, TSV, TXT/DAT, XLSX, XLS and ODS are read by a data worker using Papa Parse / SheetJS. TXT/DAT accept comma, semicolon, tab, pipe and simple whitespace. The first nonempty row is a header; duplicate names are distinguished and reported. Each worksheet has its own stable dataset, column and row IDs. Worksheet changes retain valid variables by column name. Clear Data permits a fresh upload; leaving a tool releases its session.

An import is accepted as a whole or rejected: at most **20 MiB**, **100,000 rows per worksheet**, **1,000,000 cells across all loaded sheets**. Rows are not truncated or sampled. Scatter plots above 7,500 active rows use WebGL. Device memory still determines practical performance.

Filters combine with AND. Table selection further intersects the matching rows; without a selection all matching rows are active. An empty intersection remains empty. Charts, analysis and CSV export use the same active row set. Table sorting preserves that set.

Analysis deletes rows with incomplete/nonfinite selected features (or missing LDA labels), then excludes constant features. Exclusions are reported. It checks sample/class counts and handles one dimension as a horizontal projection. Existing results become invalid as soon as inputs change; old jobs cannot overwrite newer state. Cancel terminates the worker and suspends automatic analysis until **Run analysis**. A failed analysis also waits for an explicit retry, avoiding loops.

User files/results exist only in page memory. They are not uploaded, written to local/session storage or added to the repository. Refresh, close or clear to release them. Downloads are only user-initiated. GitHub Pages serves program/example files; jsDelivr serves fixed scientific program assets. Those GET requests contain no dataset payload. Normal HTTP caching stores code assets, not user data. There are no remote fonts, accounts or analytics.

## Public examples

All examples are hosted with the site. [provenance.json](public/examples/provenance.json) records versions, sources, SHA-256 checksums and transformations. [Data licenses](public/examples/LICENSES.md) are separate from the application license.

- **Oxygen**: unchanged Table S2 from [the Wiz paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC7691393/), ten pressure sheets of 2,932 rows. CC BY-NC-ND 4.0. The dynamic example replays existing rows, +150 every three seconds, with pause/restart controls; it is not a live experiment.
- **Stocks**: Ahmad Firdaus Cayzer's [S&P 500 CSV, Figshare v1](https://doi.org/10.6084/m9.figshare.26169322.v1), CC BY 4.0, 8,565 historical records from 1990–2023. Original CSV retained; plotting CSV normalizes calendar dates. Open/High/Low/Close replace the reference's unavailable company tickers.
- **Wine / Iris**: fixed public UCI data distributed with scikit-learn, renamed/reordered for the reference. Wine values/dtypes match. Iris uses the current public measurements; three cells differ from the reference workbook and are listed in [example-comparison.json](tests/reference/example-comparison.json).
- **Time series**: deterministic synthetic data, Advanced only.

## Maintenance and publishing

Website users need none of the following tools. Maintainers use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Development URL: `http://127.0.0.1:5173/Wiz.io/`.

```sh
npm test
npx playwright install chromium firefox webkit
npm run test:e2e
npm run build
```

`build` runs TypeScript and Vite, generates dependency license notices, and writes the site into `docs/`. Commit source, lockfile and matching `docs/` together. Pages publishes **main / docs**, with `.nojekyll` and `/Wiz.io/` as resource base. Navigation is internal, so there are no nested routes to cause refresh 404s. No purchased domain is needed.

Check the deployed site with:

```sh
WIZ_BASE_URL=https://vickie02736.github.io/Wiz.io/ npm run test:e2e
```

## Reproducible reference

The historical deployment's actual dependencies are unknown. The numerical/graph oracle was generated from the fixed checkout with **NumPy 1.24.4, pandas 1.5.3, SciPy 1.10.1, scikit-learn 1.4.2 and Plotly Python 5.13.1**. Its complete installed dependency freeze is [requirements.lock.txt](tests/reference/requirements.lock.txt). The reference runs in a separate Python 3.9 virtual environment, with its own temporary cache, outside the public app.

With your separately obtained original checkout (subject to its license) and that reference environment:

```sh
WIZ_REFERENCE_DIR=/path/to/private/reference python scripts/generate-reference.py
python scripts/test-analysis.py
```

The generator checks the exact commit and scientific versions; it records graph output for independent fixture data and PCA/LDA expected values in [oracle.json](tests/reference/oracle.json). It does not copy reference source or private user datasets. Browser tests compare actual downloaded scores/ratios using `rtol=1e-7`, `atol=1e-8`, and separately check LDA's negated display. PCA signs are matched to sklearn 1.4's full-SVD convention; repeated-eigenvalue tests compare subspaces.

Frontend dependencies are exact in `package-lock.json`. Plotly.js is **2.18.2**, matching Plotly Python 5.13.1. Scientific assets load lazily from **Pyodide 314.0.7**: scikit-learn 1.8.0, NumPy 2.4.6, SciPy 1.18.0, joblib 1.5.3, threadpoolctl 3.6.0. Nothing unpinned is installed at runtime.

## Source organization

- `src/data.ts`, `src/workers/data.worker.ts`: import, original dtype metadata, filtering, versioned datasets, paging and exports.
- `src/compat.ts`, `src/plotModel.ts`: independent legacy rules and testable chart models.
- `src/App.tsx`, `src/Plot.tsx`: navigation, module sessions, controls, tables and Plotly interaction.
- `src/analysis.py`, `src/workers/analysis.worker.ts`, `src/rpc.ts`: lazy science, request/version checks and cancellation.
- `public/examples/`: published example data and attribution.
- `tests/`, `scripts/`: reference fixtures, scientific checks and cross-browser workflows.
- `docs/`: tracked production website.

The independent application code is MIT. Third-party dependencies and example data retain their own licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [DEPENDENCY_LICENSES.md](DEPENDENCY_LICENSES.md), [data licenses](public/examples/LICENSES.md).
