import { csvFor, getCell, LIMITS, parseFile, resolveRows, summary } from '../data';
import type { AnalysisInput, AnalysisSettings, Dataset, RpcRequest, StoredDataset, ViewState } from '../types';
const datasets = new Map<string, StoredDataset>();
self.onmessage = async ({ data }: MessageEvent<RpcRequest>) => {
  const { id, action } = data; const p = data.payload as any;
  try {
    let result: unknown;
    if (action === 'import') {
      const files = p.files as File[];
      if (files.reduce((sum, file) => sum + file.size, 0) > LIMITS.bytes) throw new Error('The combined import limit is 20 MB.');
      const imported: StoredDataset[] = [];
      for (const file of files) imported.push(...await parseFile(file));
      if (imported.reduce((sum, d) => sum + d.rowCount * d.columns.length, 0) > LIMITS.cells) throw new Error('The combined import exceeds 1,000,000 cells. No data was imported.');
      if ([...datasets.values(), ...imported].reduce((sum, d) => sum + d.rowCount * d.columns.length, 0) > LIMITS.cells) throw new Error('The workspace exceeds 1,000,000 cells. Clear existing data before importing more.');
      imported.forEach(d => datasets.set(d.id, d)); result = imported.map(summary);
    } else if (action === 'clear') { datasets.clear(); result = true; }
    else {
      const dataset = datasets.get(p.datasetId);
      if (!dataset) throw new Error('The dataset is no longer available. Please import it again.');
      if (action === 'column') {
        const column = dataset.columns.find(c => c.id === p.columnId);
        if (!column) throw new Error('Column not found.'); column.kind = p.kind;
        result = summary(dataset);
      } else {
        const { matching, active } = resolveRows(dataset, p.view as ViewState);
        if (action === 'query') {
          const columns = (p.columns as string[]).filter((c, i, arr) => c && arr.indexOf(c) === i);
          const indices = columns.map(c => dataset.columns.findIndex(col => col.id === c));
          result = { matching: matching.length, active: active.length, rows: matching.slice(p.page * 25, (p.page + 1) * 25).map(row => ({ id: row.id, values: dataset.columns.map(c => getCell(dataset, row, c.id)) })), pageCount: Math.ceil(matching.length / 25), plot: { columns, rows: active.map(row => ({ id: row.id, values: indices.map(i => getCell(dataset, row, dataset.columns[i].id)) })) } };
        } else if (action === 'export') { result = csvFor(dataset, active); }
        else if (action === 'analysis') {
          const settings = p.settings as AnalysisSettings;
          const features = settings.features.filter(c => c !== settings.label && dataset.columns.find(col => col.id === c)?.kind === 'number');
          if (!features.length) throw new Error('Select at least one numeric feature other than the label column.');
          result = { matrix: active.map(row => features.map(c => getCell(dataset, row, c) as number | null)), rowIds: active.map(r => r.id), labels: active.map(row => getCell(dataset, row, settings.label)), featureNames: features.map(c => dataset.columns.find(col => col.id === c)!.name), settings } satisfies AnalysisInput;
        }
      }
    }
    self.postMessage({ id, result });
  } catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : String(error) }); }
};
