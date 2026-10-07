# Third-party notices and data attribution

Wiz.io's application code, interface and illustrative artwork were written independently. No code, documentation or images from the original Wiz repository are included.

The application uses the following third-party projects. Their licenses govern their components; upstream copyright and license notices are retained in packages and generated bundles where supplied.

| Project | License | Source |
| --- | --- | --- |
| React / React DOM | MIT | https://github.com/facebook/react |
| Vite | MIT | https://github.com/vitejs/vite |
| TypeScript | Apache-2.0 | https://github.com/microsoft/TypeScript |
| Plotly.js | MIT | https://github.com/plotly/plotly.js |
| Papa Parse | MIT | https://github.com/mholt/PapaParse |
| SheetJS Community Edition 0.20.3 | Apache-2.0 | https://git.sheetjs.com/sheetjs/sheetjs |
| Lucide | ISC | https://github.com/lucide-icons/lucide |
| Pyodide | MPL-2.0 | https://github.com/pyodide/pyodide |
| CPython | PSF-2.0 | https://github.com/python/cpython |
| scikit-learn | BSD-3-Clause | https://github.com/scikit-learn/scikit-learn |
| NumPy / SciPy | BSD-3-Clause | https://github.com/numpy/numpy / https://github.com/scipy/scipy |
| joblib / threadpoolctl | BSD-3-Clause | https://github.com/joblib/joblib / https://github.com/joblib/threadpoolctl |
| Vitest | MIT | https://github.com/vitest-dev/vitest |
| Playwright | Apache-2.0 | https://github.com/microsoft/playwright |
| DM Sans / Manrope fonts | SIL Open Font License 1.1 | https://fonts.google.com/specimen/DM+Sans / https://fonts.google.com/specimen/Manrope |

## Public example data

Iris and Wine are sourced from the scikit-learn distribution's public dataset files. Wiz.io adds a sample-label column and human-readable class labels; measurements are preserved.

- **Iris**: Fisher's classic iris dataset, obtained from `sklearn/datasets/data/iris.csv`. UCI record: https://archive.ics.uci.edu/dataset/53/iris. Citation: Fisher, R. A. (1936), *The use of multiple measurements in taxonomic problems*, Annals of Eugenics 7, 179–188.
- **Wine**: wine-recognition data by Forina et al., obtained from `sklearn/datasets/data/wine_data.csv`. UCI record: https://archive.ics.uci.edu/dataset/109/wine. Citation: Aeberhard, S. and Forina, M. (1991), *Wine*, UCI Machine Learning Repository, https://doi.org/10.24432/C5PC7J.
- **Time series**: 180 deterministic synthetic observations generated for Wiz.io. These do not represent a real experiment, company or market.

Upstream scikit-learn source: https://github.com/scikit-learn/scikit-learn/tree/main/sklearn/datasets/data.

## scikit-learn license

BSD 3-Clause License

Copyright (c) 2007-2026 The scikit-learn developers.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
