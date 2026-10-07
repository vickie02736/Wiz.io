const e=`https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`;let t;self.onmessage=async({data:n})=>{let{id:r,payload:i,version:a}=n;try{t||=(async()=>{self.postMessage({id:r,version:a,progress:`Downloading the analysis engine…`});let{loadPyodide:t}=await import(
/* @vite-ignore */
`${e}pyodide.mjs`),n=await t({indexURL:e});return self.postMessage({id:r,version:a,progress:`Loading scientific libraries…`}),await n.loadPackage(`scikit-learn`),await n.runPythonAsync(`import json
import numpy as np
from sklearn.decomposition import PCA
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.preprocessing import StandardScaler

def analyze(payload):
    p = json.loads(payload)
    settings = p['settings']
    method = settings['method']
    X = np.array([[np.nan if v is None else v for v in row] for row in p['matrix']], dtype=float)
    if X.ndim != 2 or X.shape[0] < 2:
        raise ValueError('At least two active rows are required for analysis.')
    valid = np.isfinite(X).all(axis=1)
    if method == 'lda':
        if not settings['label']:
            raise ValueError('LDA requires a class label column.')
        valid &= np.array([v is not None and str(v).strip() != '' for v in p['labels']])
    clean = X[valid]
    if len(clean) < 2:
        raise ValueError('Fewer than two complete rows remain. Choose other features or clean the missing values.')
    mask = np.ptp(clean, axis=0) > 0
    features = [name for name, keep in zip(p['featureNames'], mask) if keep]
    dropped_features = [name for name, keep in zip(p['featureNames'], mask) if not keep]
    clean = clean[:, mask]
    if clean.shape[1] == 0:
        raise ValueError('All selected features are constant. Choose other numeric features.')
    if settings['standardize']:
        clean = StandardScaler().fit_transform(clean)
    labels = [v for v, keep in zip(p['labels'], valid) if keep]
    if method == 'pca':
        model = PCA(n_components=min(clean.shape[1], len(clean)-1), svd_solver='full')
        scores = model.fit_transform(clean)
        if settings.get('compatibility'):
            # sklearn 1.4 full-SVD PCA chose signs using the left singular vectors.
            for j in range(scores.shape[1]):
                if scores[np.argmax(np.abs(scores[:, j])), j] < 0:
                    scores[:, j] *= -1
                    model.components_[j] *= -1
        loadings = model.components_.T.tolist()
    else:
        y = np.array(labels) if settings.get('compatibility') else np.array([str(v) for v in labels])
        classes = np.unique(y)
        if len(classes) < 2:
            raise ValueError('LDA requires at least two classes in the active subset.')
        if len(clean) <= len(classes):
            raise ValueError('LDA needs more complete rows than classes.')
        if not any(np.ptp(clean[y == cls], axis=0).any() for cls in classes):
            raise ValueError('LDA needs variation within at least one class. The selected data is degenerate.')
        model = LinearDiscriminantAnalysis(n_components=min(clean.shape[1], len(classes)-1), solver='svd')
        scores = model.fit_transform(clean, y)
        loadings = []
    if scores.shape[1] == 0 or not np.isfinite(scores).all():
        raise ValueError('This dataset does not have a valid discriminant dimension. Try different features or classes.')
    variance = model.explained_variance_ratio_
    if not np.isfinite(variance).all():
        raise ValueError('The selected data has no finite explained variance. Try different features.')
    result = {
        'method': method, 'scores': scores.tolist(),
        'rowIds': [v for v, keep in zip(p['rowIds'], valid) if keep],
        'labels': labels, 'variance': variance.tolist(),
        'cumulative': np.cumsum(variance).tolist(), 'loadings': loadings,
        'features': features, 'droppedRows': int((~valid).sum()),
        'droppedFeatures': dropped_features, 'standardize': settings['standardize']
    }
    return json.dumps(result, allow_nan=False)
`),n})();let n=await t;self.postMessage({id:r,version:a,progress:`Analyzing your selected data…`}),n.globals.set(`analysis_payload`,JSON.stringify(i));let o=JSON.parse(await n.runPythonAsync(`analyze(analysis_payload)`));n.globals.delete(`analysis_payload`),self.postMessage({id:r,version:a,result:o})}catch(e){let n=e instanceof Error?e.message:String(e),i=n.split(`
`).reverse().find(e=>/^(ValueError|IndexError|LinAlgError):/.test(e.trim()));i||(t=void 0),self.postMessage({id:r,version:a,errorKind:i?`input`:`runtime`,error:`Analysis failed: ${i?i.replace(/^[^:]+:\s*/,``):n}`})}};