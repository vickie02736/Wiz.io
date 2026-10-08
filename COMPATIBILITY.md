# Compatibility contract and acceptance checklist

Target: [kesler20/Wiz commit ff94a3805889f76c050fbea7f9b1bf6d4b15dfab](https://github.com/kesler20/Wiz/tree/ff94a3805889f76c050fbea7f9b1bf6d4b15dfab), dated 2025-09-24. This is a separately written implementation. Original code/assets remain outside this repository. The actual dependency set in Kesler's historical deployment is not recorded; numerical parity refers to the reproducible environment below.

## Reference and evidence

- The unmodified fixed reference starts in an isolated Python 3.9 virtual environment on loopback, separate from the application. Dash 2.8.1, Plotly Python 5.13.1 / Plotly.js 2.18.2, Flask 2.2.3, Werkzeug 2.2.3; scientific packages are NumPy 1.24.4, pandas 1.5.3, SciPy 1.10.1, scikit-learn 1.4.2. All installed transitive versions are in `tests/reference/requirements.lock.txt`.
- `scripts/generate-reference.py` verifies the checkout SHA and science/Plotly versions, imports the privately obtained reference, supplies independently authored fixture data, and saves its graph and analysis output. `tests/reference/oracle.json` is this fixed output, not copied source.
- `tests/compat.test.ts` compares default graph trace arrays and marker rules for histogram, 2D continuous/discrete scatter, raw-point box plots, 3D and both line formats; it also checks axes/font/margins/log behavior and legacy dtype/filter rules.
- `tests/e2e/workspace.spec.ts` replays full workflows in Chromium, Firefox and WebKit. Real mouse interactions cover annotations, legend toggling, zoom/reset and toolbar SVG. Tests download real browser-computed PCA/LDA output and compare scores/ratios/cumulative ratios with the oracle at `rtol=1e-7`, `atol=1e-8`; LDA display negation is checked separately. Selection/filter row IDs are compared across plots, science and exports.
- `scripts/test-analysis.py` checks numerical parity, missing/infinite rows, constant features, integer advanced input, inadequate samples/classes, degenerate LDA, one dimension and repeated-eigenvalue subspaces.
- Reference and updated UI screenshots are inspected for layout and graph presentation. Native WebGL inspection and live-site checks are recorded in `VALIDATION.md`. Automated comparisons target semantic data/configuration, not screenshot pixel equality across engines.

## Normal behavior checklist

- [x] Scatter opens by default; English top navigation includes Scatter, Lines, PCA/LDA, Examples and Help. Independently drawn Wiz.io branding.
- [x] Upload area above the plot, controls below, worksheet slider and read-only popup data table.
- [x] First upload, upload disabled until Clear Data, re-upload after clear, per-tool session release, worksheet changes retaining variables by name.
- [x] CSV, TXT/DAT, Excel and ODS; original first-column labels. Additional TSV/mixed batches and explicit capacity checks.
- [x] Linear / Log numeric axes, auto histogram and categorical-X box plots, 2D / 3D scatter.
- [x] Jet continuous colors; category traces; integer color threshold of 20 in 2D; numeric continuous color in 3D.
- [x] Arial plot font 18, axis-title font 24, black width-2 axes, opacity 0.8, diameter sizes 25 default / 10–40 normalized; 3D uses plot size 13.5 / title size 18, aspect ratio 2:2:1 and zero margins; box plots show all points, jitter 0.5, pointpos -1.5.
- [x] Bubble-size legend; categorical 2D normalization within each trace.
- [x] Click-to-annotate, log-coordinate annotations, legend toggle/isolate, hover, pan/zoom/reset, editable figure elements and toolbar SVG. Point clicks do not change the active subset.
- [x] Lines Type 1 shares the first X; Type 2 pairs adjacent X/Y columns. Multi-Y selection, markers size 10, input order by default.
- [x] Read-only table, 50 rows/page. Scatter/Lines Type 1 filters/sort/select; Type 2 plain preview; PCA/LDA filters. Default CSV column order follows plotted columns.
- [x] Legacy comparison/contains/datestartswith syntax; case-sensitive regex contains; multiple filters combine with AND.
- [x] Automatic analysis, floating-point features only, class excluded, PCA standardization on, LDA off; candidate classes are text or fewer than ten distinct values.
- [x] PCA starts with Classes None; switching to LDA chooses the first eligible class when none is set. Projection and individual/cumulative variance appear together.
- [x] Reference PCA sign convention for full SVD; LDA display negated while download retains positive computed direction. Variance values remain 0–1 ratios. The inherited axis label `Variance (%)` is explained in Help.
- [x] Default analysis CSV `PC 1...` / `LD 1...`, followed by `Individual,Cumulative` in the first component-count rows, blank thereafter. Filename `data.csv`.
- [x] Five original example entry points and matching tool controls: oxygen dynamic/static, stocks lines, Wine histograms/box/scatter and Iris analysis.

## Deliberate differences

### Browser platform

There is no Python/Dash HTTP backend, server-side cache directory, login/password/contact form or live market request. Workers hold original data and compute projections in the browser. Local files and analysis results are not stored persistently. Module navigation releases session memory rather than creating a server cache session. Pyodide code initializes only when analysis is requested; loading/failure/retry/cancel controls replace server-side waiting.

The controls are native HTML/React rather than Dash widgets. Top-level links are explicit buttons, multi-Y uses native multi-select (Ctrl/Cmd/Shift), dialogs are responsive, and the upload area provides file/limit descriptions. Main region order, available settings and normal effects follow the reference; precise widget chrome, text widths, padding and dropdown search/keyboard behavior are browser-dependent and are not claimed pixel-identical. Empty figures include guidance. Figure elements themselves use the matching Plotly.js version.

Cancellation terminates the analysis worker (and discards its runtime); retry recreates it. Cold initialization requires a working asset network connection. All CDN requests are for pinned programs; no dataset is sent. Browser CPU/RAM/WebGL availability affects practical capacity. Large plots render every active row with WebGL. SVG includes raster content for WebGL / 3D, as Plotly does in the reference.

### Error corrections

- Correct table page count and stable cross-page selection; use source row IDs rather than positional indices after sorting/filtering.
- Download the actual filtered/selected subset instead of the reference's cached pre-filter data. Protect spreadsheet exports against formula execution; UTF-8 BOM supports spreadsheet readers.
- Distinguish duplicate headers rather than overwriting/omitting columns. Enforce capacity atomically without truncation.
- Retain and align Z/color/size arrays for 3D categorical data; permit complete 3D axes even without optional color/size. Size-only controls apply even without color. Constants/missing size values use safe defaults.
- Report and remove incomplete/infinite analysis rows, then constant features; check sample/class counts and degenerate within-class variation. One dimension is plotted at zero Y instead of raising an index error. PCA uses at most `min(features, complete_rows - 1)` to avoid requesting unsupported components or showing the zero last dimension.
- Correct legacy callback/filter-name errors; parameter/subset changes invalidate old results immediately. Request IDs, dataset versions and UI epochs prevent old jobs from overwriting new data. Cancelling stops automatic restarts; failures wait for explicit retry.
- Escape dataset-derived chart/annotation text. Keep figure trace identities stable; explicitly resolve legend visibility to the clicked trace across Firefox/WebKit, retaining single-toggle and double-isolate behavior.

### Advanced extensions

Explicit integer/feature selection, scaling overrides, manual run, component switching/3D, loadings, metadata score CSV, full-column subset CSV, PNG, label/group/type correction and box/lasso selection are Advanced controls. They do not change the default legacy rules. Advanced analysis-table selection obeys the same subset intersection. The deterministic synthetic series is an additional Advanced example.

### Published example replacements

- **Oxygen**: published Table S2 workbook is unchanged. Ten sheet names, column names, dtypes and every cell match the reference O2 workbook. It carries CC BY-NC-ND 4.0, independent of the original code license. At the user's request, both pages now display all rows immediately instead of automatically starting the original dynamic playback. **Start replay** retains the optional original rhythm of 150 existing rows every three seconds, with pause/resume/restart and **Show all rows**. Playback stops at completion; worksheet changes restore the full view. Axes use fixed ranges from the final pressure sheet with reference padding (5% linear, 10% logarithmic); the example WebGL threshold is 2,500 rows.
- **Stocks**: the fixed reference initializes all nine company ticker series as empty placeholders. They cannot supply a working normal chart. Fixed Figshare v1 S&P 500 historical index data replaces them, with Date and Open/High/Low/Close, year-range and log controls. This is explicitly historical index data, not the original company series or live prices. All 8,565 source rows remain available; default view is 2021–2023. The unchanged source CSV is retained alongside calendar-date-normalized plotting CSV.
- **Wine**: existing public UCI values were renamed/reordered to Sample #, Cultivar and the reference chemistry names. All 178 rows, columns, values and pandas dtypes match. Default Cultivar vs Alcohol reproduces the original box chart and permits histogram/scatter exploration.
- **Iris**: public UCI/scikit-learn measurements retain three corrected cells that differ from the old workbook: row 35 Petal Width 0.2 vs 0.1; row 38 Sepal Width 3.6 vs 3.1 and Petal Length 1.4 vs 1.5. Columns/labels/order/types match, but whole-dataset projections consequently differ. Numerical parity is tested using identical fixture data, not incorrectly asserted between these distinct example values.

Exact provenance, licenses, SHA-256 values and transformations are in `public/examples/provenance.json` and `LICENSES.md`; exact example comparison evidence is in `tests/reference/example-comparison.json`.

## Limits on the compatibility claim

The recorded tests certify the cases and flows above, not all possible floating-point degeneracies or devices. Equal-eigenvalue PCA bases may rotate; the invariant subspace is compared. Scientific packages in Pyodide differ from the reference versions; fixed fixture values pass the stated tolerances. Cross-engine layout/font metrics and browser file dialogs differ. The historical deployment environment cannot be reconstructed without its records, and is not represented as verified.
