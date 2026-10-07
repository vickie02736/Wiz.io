import script from '../analysis.py?raw';
import type { RpcRequest } from '../types';
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
let runtime: Promise<any> | undefined;
self.onmessage = async ({ data }: MessageEvent<RpcRequest>) => {
  const { id, payload, version } = data;
  try {
    if (!runtime) {
      runtime = (async () => {
        self.postMessage({ id, version, progress: 'Downloading the analysis engine…' });
        const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
        const py = await loadPyodide({ indexURL: PYODIDE_URL });
        self.postMessage({ id, version, progress: 'Loading scientific libraries…' });
        await py.loadPackage('scikit-learn');
        await py.runPythonAsync(script);
        return py;
      })();
    }
    const py = await runtime;
    self.postMessage({ id, version, progress: 'Analyzing your selected data…' });
    py.globals.set('analysis_payload', JSON.stringify(payload));
    const result = JSON.parse(await py.runPythonAsync('analyze(analysis_payload)'));
    py.globals.delete('analysis_payload');
    self.postMessage({ id, version, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const readable = message.split('\n').reverse().find(line => /^(ValueError|IndexError|LinAlgError):/.test(line.trim()));
    if (!readable) runtime = undefined;
    self.postMessage({ id, version, errorKind: readable ? 'input' : 'runtime', error: `Analysis failed: ${readable ? readable.replace(/^[^:]+:\s*/, '') : message}` });
  }
};
