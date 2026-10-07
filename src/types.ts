export type Cell = string | number | null;
export type ColumnKind = 'number' | 'text' | 'date';
export interface Column { id: string; name: string; kind: ColumnKind }
export interface DataRow { id: number; values: Cell[] }
export interface Dataset { id: string; name: string; source: string; columns: Column[]; rowCount: number; warnings: string[] }
export interface StoredDataset extends Dataset { rows: DataRow[] }
export type Operator = 'contains' | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty';
export interface Filter { column: string; op: Operator; value: string }
export interface ViewState { filters: Filter[]; selected: number[]; sort?: { column: string; direction: 'asc' | 'desc' } }
export interface QueryResult { matching: number; active: number; rows: DataRow[]; pageCount: number; plot: { columns: string[]; rows: DataRow[] } }
export type ChartType = 'auto' | 'scatter' | 'scatter3d' | 'histogram' | 'box' | 'line';
export interface PlotSettings { type: ChartType; x: string; y: string; z: string; color: string; size: string; group: string; label: string; title: string; pointSize: number }
export interface AnalysisSettings { method: 'pca' | 'lda'; features: string[]; label: string; standardize: boolean }
export interface AnalysisInput { matrix: (number | null)[][]; rowIds: number[]; labels: Cell[]; featureNames: string[]; settings: AnalysisSettings }
export interface AnalysisResult { method: 'pca' | 'lda'; scores: number[][]; rowIds: number[]; labels: Cell[]; variance: number[]; cumulative: number[]; loadings: number[][]; features: string[]; droppedRows: number; droppedFeatures: string[]; standardize: boolean }
export interface RpcRequest { id: number; action: string; payload: unknown }
export interface RpcResponse { id: number; result?: unknown; error?: string; progress?: string }
