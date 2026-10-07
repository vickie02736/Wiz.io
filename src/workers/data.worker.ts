import { csvFor, getCell, LIMITS, parseFile, resolveRows, summary } from '../data';
import { legacyFeatures } from '../compat';
import type { AnalysisInput, AnalysisSettings, ColumnKind, RpcRequest, StoredDataset, ViewState } from '../types';
const datasets = new Map<string, StoredDataset>();
self.onmessage = async ({ data }: MessageEvent<RpcRequest>) => {
  const { id, action, version } = data; const p = data.payload as any;
  try {
    let result: unknown;
    if (action === 'import') {
      const files = p.files as File[];
      if (files.reduce((sum, file) => sum + file.size, 0) > LIMITS.bytes) throw new Error('The combined import limit is 20 MB.');
      const imported: StoredDataset[] = [];
      for (const file of files) imported.push(...await parseFile(file));
      if ([...datasets.values(), ...imported].reduce((sum, d) => sum + d.rowCount * d.columns.length, 0) > LIMITS.cells) throw new Error('The workspace exceeds 1,000,000 cells. Clear existing data before importing more.');
      imported.forEach(d => datasets.set(d.id, d)); result = imported.map(summary);
    } else if (action === 'clear') {
      if (p.ids) p.ids.forEach((key: string) => datasets.delete(key)); else datasets.clear();
      result = true;
    } else {
      const dataset = datasets.get(p.datasetId);
      if (!dataset) throw new Error('The dataset is no longer available. Please import it again.');
      if (version !== undefined && version !== dataset.version) throw new Error('The data has changed. Please retry.');
      if (action === 'column') {
        const column = dataset.columns.find(c => c.id === p.columnId);
        if (!column) throw new Error('Column not found.');
        column.kind = p.kind as ColumnKind;
        column.legacyType = p.kind === 'number' ? 'float' : p.kind;
        dataset.version++; result = summary(dataset);
      } else {
        const { matching, active } = resolveRows(dataset, p.view as ViewState);
        if (action === 'query') {
          const columns = (p.columns as string[]).filter((c, i, arr) => c && arr.indexOf(c) === i);
          const pageSize = p.pageSize ?? 50;
          const indices = columns.map(c => dataset.columns.findIndex(col => col.id === c));
          const ranges: Record<string,number[]> = {};
          const reference = datasets.get(p.rangesReferenceId);
          if (reference) for (const [axis, info] of Object.entries(p.axes) as [string,{id:string;scale:string}][]) {
            const name = dataset.columns.find(c => c.id === info.id)?.name;
            const column = reference.columns.find(c => c.name === name && c.kind === 'number');
            if (!column) continue;
            let min = Infinity, max = -Infinity;
            for (const row of reference.rows) {
              const value = getCell(reference,row,column.id);
              if (typeof value !== 'number' || !Number.isFinite(value) || info.scale === 'log' && value <= 0) continue;
              min = Math.min(min,value); max = Math.max(max,value);
            }
            if (min <= max) {
              if (info.scale === 'log') { min = Math.log10(min); max = Math.log10(max); }
              const pad = (max-min || Math.abs(max) || 1) * (info.scale === 'log' ? 0.1 : 0.05);
              ranges[axis] = [min-pad,max+pad];
            }
          }
          result = { matching: matching.length, active: active.length,
            rows: matching.slice(p.page * pageSize, (p.page + 1) * pageSize).map(row => ({ id: row.id, values: dataset.columns.map(c => getCell(dataset, row, c.id)) })),
            pageCount: Math.ceil(matching.length / pageSize), ranges,
            plot: { columns, rows: active.map(row => ({ id: row.id, values: indices.map(i => i < 0 ? null : getCell(dataset, row, dataset.columns[i].id)) })) } };
        } else if (action === 'export') {
          if (p.columns) {
            const cols = dataset.columns.filter(c => p.columns.includes(c.id)).sort((a, b) => p.columns.indexOf(a.id) - p.columns.indexOf(b.id));
            result = csvFor({ ...dataset, columns: cols, rows: [] }, active.map(row => ({ ...row, values: cols.map(c => row.values[dataset.columns.findIndex(dc => dc.id === c.id)]) })));
          } else result = csvFor(dataset, active);
        } else if (action === 'analysis') {
          const settings = p.settings as AnalysisSettings;
          const features = settings.compatibility ? legacyFeatures(dataset, settings.label) : settings.features.filter(c => c !== settings.label && dataset.columns.find(col => col.id === c)?.kind === 'number');
          if (!features.length) throw new Error(settings.compatibility ? 'No floating-point features remain. Use Advanced to include integer features.' : 'Select at least one numeric feature other than the class column.');
          result = { matrix: active.map(row => features.map(c => getCell(dataset, row, c) as number | null)), rowIds: active.map(r => r.id),
            labels: active.map(row => getCell(dataset, row, settings.label)), featureNames: features.map(c => dataset.columns.find(col => col.id === c)!.name), settings } satisfies AnalysisInput;
        } else throw new Error('Unknown data request.');
      }
    }
    self.postMessage({ id, result, version });
  } catch (error) { self.postMessage({ id, version, error: error instanceof Error ? error.message : String(error) }); }
};
