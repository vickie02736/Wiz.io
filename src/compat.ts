import type { Column, Dataset, Filter, PlotSettings, Cell } from './types';
export const REFERENCE_SHA = 'ff94a3805889f76c050fbea7f9b1bf6d4b15dfab';
export const defaultPlot: PlotSettings = {
  type: 'auto', x: '', y: '', z: '', color: '', size: '', group: '', label: '', title: '',
  pointSize: 25, xScale: 'linear', yScale: 'linear', yColumns: [], lineInputType: 1,
};
export function numeric(column?: Column) { return column?.kind === 'number'; }
export function categorical(column: Column | undefined, values: Cell[]) {
  return !column || column.legacyType === 'text' || column.legacyType === 'date' ||
    (column.legacyType === 'integer' && new Set(values.map(String)).size <= 20);
}
export function classColumns(dataset: Dataset) {
  return dataset.columns.filter(c => c.kind !== 'number' || c.distinct < 10);
}
export function legacyFeatures(dataset: Dataset, label: string) {
  return dataset.columns.filter(c => c.legacyType === 'float' && c.id !== label).map(c => c.id);
}
export function lineOptions(dataset: Dataset, type: 1 | 2) {
  return dataset.columns.filter((_, i) => type === 1 ? i > 0 : i % 2 === 1);
}
export function plottedColumns(dataset: Dataset, settings: PlotSettings) {
  if (settings.type === 'line') {
    const out: string[] = [];
    if (settings.lineInputType === 1) out.push(dataset.columns[0].id);
    for (const y of settings.yColumns) {
      const i = dataset.columns.findIndex(c => c.id === y);
      if (settings.lineInputType === 2 && i > 0) out.push(dataset.columns[i - 1].id);
      out.push(y);
    }
    return [...new Set(out)];
  }
  return [...new Set([settings.label, settings.x, settings.y, settings.color, settings.size, settings.type === 'scatter3d' ? settings.z : '', settings.group].filter(Boolean))];
}
export function parseColumnFilter(column: string, expression: string): Filter | undefined {
  const text = expression.trim(); if (!text) return;
  const match = text.match(/^(datestartswith|contains|>=|<=|!=|=|>|<|ge\b|le\b|ne\b|eq\b|gt\b|lt\b)?\s*(.*)$/);
  if (!match) throw new Error('Invalid filter.');
  const aliases: Record<string, Filter['op']> = { '>=': 'gte', ge: 'gte', '<=': 'lte', le: 'lte', '!=': 'neq', ne: 'neq', '=': 'eq', eq: 'eq', '>': 'gt', gt: 'gt', '<': 'lt', lt: 'lt', contains: 'contains', datestartswith: 'datestartswith' };
  let value = match[2];
  if (/^["'`]/.test(value) && value.at(-1) === value[0]) value = value.slice(1, -1).replace(/\\(["'`])/g, '$1');
  return { column, op: aliases[match[1] || 'contains'], value, legacy: true };
}
export function bubbleSizes(values: Cell[], defaultSize = 25) {
  const numbers = values.map(Number);
  if (values.some(v => v == null) || numbers.some(v => !Number.isFinite(v))) return values.map(() => defaultSize);
  const min = numbers.reduce((a, b) => Math.min(a, b), Infinity), max = numbers.reduce((a, b) => Math.max(a, b), -Infinity);
  return min === max ? values.map(() => defaultSize) : numbers.map(v => 10 + 30 * (v - min) / (max - min));
}
