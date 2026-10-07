import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Cell, ColumnKind, DataRow, Dataset, Filter, StoredDataset, ViewState } from './types';
export const LIMITS = { bytes: 20 * 1024 * 1024, rows: 100_000, cells: 1_000_000 };
export const isMissing = (v: Cell | undefined) => v == null || typeof v === 'number' && Number.isNaN(v) || (typeof v === 'string' && /^(?:\s*|NaN|NA|N\/A|NULL|None|<NA>|#N\/A)$/i.test(v.trim()));
export function numberValue(v: Cell | undefined): number | null {
  if (isMissing(v)) return null;
  if (typeof v === 'number') return v;
  const text = String(v).trim();
  if (/^[+-]?inf(?:inity)?$/i.test(text)) return text.startsWith('-') ? -Infinity : Infinity;
  if (!/^[+-]?(?:(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|Infinity)$/i.test(text)) return null;
  return Number(text);
}
export function typedCell(value: Cell, kind: ColumnKind): Cell {
  if (isMissing(value)) return null;
  return kind === 'number' ? numberValue(value) : String(value);
}
export function normalizeTable(table: unknown[][], name: string, source: string): StoredDataset {
  const start = table.findIndex(row => row.some(v => v != null && String(v).trim() !== ''));
  const clean = start < 0 ? [] : table.slice(start);
  if (clean.length < 2) throw new Error(`${name}: a header and at least one data row are required.`);
  const width = clean[0].length;
  if (clean.some(row => row.length > width)) throw new Error(`${name}: a row has more fields than the header. Check the delimiter.`);
  if (clean.length - 1 > LIMITS.rows) throw new Error(`${name}: exceeds the 100,000-row limit. No data was imported.`);
  if (width * (clean.length - 1) > LIMITS.cells) throw new Error(`${name}: exceeds the 1,000,000-cell limit.`);
  const names = new Set<string>(); const warnings: string[] = [];
  const columns = Array.from({ length: width }, (_, i) => {
    const base = String(clean[0][i] ?? '').trim() || `Column ${i + 1}`;
    let name = base; let suffix = 2;
    while (names.has(name)) name = `${base} (${suffix++})`;
    if (name !== base) warnings.push(`Duplicate column “${base}” renamed to “${name}”.`);
    names.add(name);
    const values = clean.slice(1).map(row => asCell(row[i])).filter(v => !isMissing(v));
    const kind: ColumnKind = values.every(v => numberValue(v) !== null) ? 'number'
      : values.length && values.every(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/.test(v) && Number.isFinite(Date.parse(v))) ? 'date' : 'text';
    const legacyType = kind === 'number' ? values.some(v => typeof v === 'string' ? /[.eE]/.test(v) || !Number.isFinite(Number(v)) : !Number.isInteger(v)) || values.length !== clean.length - 1 ? 'float' : 'integer' : kind;
    return { id: `c${i}`, name, kind, legacyType, distinct: new Set(values.map(v => String(typedCell(v,kind)))).size } as import('./types').Column;
  });
  const rows = clean.slice(1).map((row, id) => ({ id, values: columns.map((_, i) => asCell(row[i])) }));
  return { id: crypto.randomUUID(), version: 1, name, source, columns, rows, rowCount: rows.length, warnings };
}
function asCell(v: unknown): Cell {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number') return v;
  return String(v);
}
export async function parseFile(file: File): Promise<StoredDataset[]> {
  if (!file.size) throw new Error(`${file.name}: the file is empty.`);
  if (file.size > LIMITS.bytes) throw new Error('The combined import limit is 20 MB.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['xlsx', 'xls', 'ods'].includes(ext ?? '')) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, sheetRows: LIMITS.rows + 2 });
    return workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      const range = sheet['!fullref'] ?? sheet['!ref'];
      if (range) {
        const dimensions = XLSX.utils.decode_range(range);
        if (dimensions.e.r - dimensions.s.r > LIMITS.rows) throw new Error(`${name}: exceeds the 100,000-row limit.`);
        if ((dimensions.e.r - dimensions.s.r) * (dimensions.e.c - dimensions.s.c + 1) > LIMITS.cells) throw new Error(`${name}: exceeds the cell limit.`);
      }
      return normalizeTable(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true }), `${file.name} · ${name}`, file.name);
    });
  }
  if (!['csv', 'tsv', 'txt', 'dat'].includes(ext ?? '')) throw new Error(`${file.name}: use CSV, TSV, TXT, DAT, XLSX, XLS or ODS.`);
  const text = (await file.text()).replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/).find(line => line.trim()) ?? '';
  const whitespace = ['txt', 'dat'].includes(ext ?? '') && !/[,;\t|]/.test(first);
  const parsed = whitespace ? text.trim().split(/\r?\n/).filter(l => l.trim()).map(l => l.trim().split(/\s+/))
    : Papa.parse<string[]>(text, { delimiter: ext === 'tsv' ? '\t' : '', skipEmptyLines: true });
  if (!Array.isArray(parsed) && parsed.errors.some(e => e.code !== 'UndetectableDelimiter')) throw new Error(`${file.name}: ${parsed.errors[0].message}`);
  return [normalizeTable(Array.isArray(parsed) ? parsed : parsed.data, file.name, file.name)];
}
export function summary({ rows: _rows, ...dataset }: StoredDataset): Dataset { return dataset; }
export function getCell(dataset: StoredDataset, row: DataRow, columnId: string): Cell {
  const i = dataset.columns.findIndex(c => c.id === columnId);
  return i < 0 ? null : typedCell(row.values[i], dataset.columns[i].kind);
}
function matches(dataset: StoredDataset, row: DataRow, filter: Filter): boolean {
  const value = getCell(dataset, row, filter.column);
  if (filter.op === 'empty') return isMissing(value);
  const input = filter.value;
  if (filter.op === 'contains') {
    if (!filter.legacy) return String(value ?? '').toLowerCase().includes(input.toLowerCase());
    try { return value != null && new RegExp(input).test(String(value)); }
    catch { throw new Error(`Invalid regular expression for “${dataset.columns.find(c => c.id === filter.column)?.name}”.`); }
  }
  if (filter.op === 'datestartswith') return value != null && String(value).startsWith(input);
  if (filter.op === 'eq' || filter.op === 'neq') {
    const same = typeof value === 'number' && numberValue(input) !== null ? value === numberValue(input) : String(value ?? '') === input;
    return filter.op === 'eq' ? same : !same;
  }
  if (value === null) return false;
  const kind = dataset.columns.find(c => c.id === filter.column)?.kind;
  const left = kind === 'date' ? Date.parse(String(value)) : numberValue(value);
  const right = kind === 'date' ? Date.parse(input) : numberValue(input);
  if (left === null || right === null || !Number.isFinite(left) || !Number.isFinite(right)) return false;
  return filter.op === 'gt' ? left > right : filter.op === 'gte' ? left >= right : filter.op === 'lt' ? left < right : left <= right;
}
export function resolveRows(dataset: StoredDataset, view: ViewState) {
  const matching = (view.limit == null ? dataset.rows : dataset.rows.slice(0, view.limit)).filter(row => view.filters.every(f => matches(dataset, row, f)));
  if (view.sort) {
    const { column, direction } = view.sort;
    matching.sort((a, b) => {
      const x = getCell(dataset, a, column), y = getCell(dataset, b, column);
      const cmp = x == null ? (y == null ? 0 : 1) : y == null ? -1 : typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return direction === 'asc' ? cmp : -cmp;
    });
  }
  const selected = new Set(view.selected);
  const active = selected.size ? matching.filter(row => selected.has(row.id)) : matching;
  return { matching, active };
}
export function csvFor(dataset: StoredDataset, rows: DataRow[]): string {
  return Papa.unparse({ fields: dataset.columns.map(c => c.name), data: rows.map(row => dataset.columns.map(c => {
    const value = getCell(dataset,row,c.id);
    return c.legacyType === 'float' && typeof value === 'number' && Number.isInteger(value) ? `${value}.0` : value;
  })) }, { escapeFormulae: /^(?:[=+@\t\r]|-(?!\d+(?:\.0)?$))/ });
}
