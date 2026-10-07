import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { AnalysisResult, Cell, Dataset, PlotSettings, QueryResult } from './types';
import type * as PlotlyType from 'plotly.js';
const palette = ['#14867a', '#7765bb', '#e49a44', '#479bc3', '#c96883', '#7ba553', '#576fc4'];
let library: Promise<typeof PlotlyType> | undefined;
const getPlotly = () => library ??= import('plotly.js-dist-min').then(m => m.default ?? m);
const safe = (value: Cell | undefined) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export interface PlotHandle { download: (format: 'png' | 'svg') => Promise<void> }
interface Props { dataset?: Dataset; query?: QueryResult; settings: PlotSettings; analysis?: AnalysisResult; componentX?: number; componentY?: number; componentZ?: number; analysis3d?: boolean; variance?: boolean; onSelect: (ids: number[]) => void }
export const Plot = forwardRef<PlotHandle, Props>(function Plot({ dataset, query, settings, analysis, componentX = 0, componentY = 1, componentZ = 2, analysis3d, variance, onSelect }, ref) {
  const element = useRef<HTMLDivElement>(null); const latestSelect = useRef(onSelect); latestSelect.current = onSelect;
  const [error, setError] = useState('');
  useImperativeHandle(ref, () => ({ download: async format => { if (element.current) await ((await getPlotly()).downloadImage as any)(element.current, { format, filename: 'wiz-chart', width: 1400, height: 900, scale: 2 }); } }));
  useEffect(() => {
    const graph = element.current; if (!graph || !dataset || !query) return;
    let disposed = false;
    const render = async () => {
      try {
        const Plotly = await getPlotly(); if (disposed) return;
        setError('');
        const columnName = (id: string) => safe(dataset.columns.find(c => c.id === id)?.name ?? id);
        const column = (id: string) => query.plot.rows.map(row => row.values[query.plot.columns.indexOf(id)]);
        let traces: any[] = []; let xTitle = columnName(settings.x), yTitle = columnName(settings.y); let threeD = settings.type === 'scatter3d';
        if (analysis) {
          threeD = !!analysis3d && analysis.scores[0]?.length >= 3;
          const prefix = analysis.method === 'pca' ? 'PC' : 'LD';
          xTitle = `${prefix}${componentX + 1} (${(analysis.variance[componentX] * 100).toFixed(1)}%)`;
          yTitle = analysis.scores[0]?.length > 1 ? `${prefix}${componentY + 1} (${(analysis.variance[componentY] * 100).toFixed(1)}%)` : 'One-dimensional projection';
          if (variance) {
            threeD = false; xTitle = 'Component'; yTitle = 'Explained variance (%)';
            traces = [
              { type: 'bar', name: 'Individual', x: analysis.variance.map((_, i) => `${prefix}${i+1}`), y: analysis.variance.map(v => v*100), marker: { color: '#14867a' } },
              { type: 'scatter', mode: 'lines+markers', name: 'Cumulative', x: analysis.variance.map((_, i) => `${prefix}${i+1}`), y: analysis.cumulative.map(v => v*100), line: { color: '#7765bb', width: 2 } },
            ];
          } else {
            const groups = [...new Set(analysis.labels.map(v => String(v ?? 'All rows')))];
            traces = groups.map((group, i) => {
              const indices = analysis.labels.map((v, idx) => String(v ?? 'All rows') === group ? idx : -1).filter(idx => idx >= 0);
              return { type: threeD ? 'scatter3d' : analysis.scores.length > 5000 ? 'scattergl' : 'scatter', mode: 'markers', name: safe(group), x: indices.map(idx => analysis.scores[idx][componentX]), y: indices.map(idx => analysis.scores[0]?.length > 1 ? analysis.scores[idx][componentY] ?? 0 : 0), z: threeD ? indices.map(idx => analysis.scores[idx][componentZ]) : undefined, customdata: indices.map(idx => analysis.rowIds[idx]), marker: { size: threeD ? 5 : settings.pointSize, color: palette[i % palette.length], opacity: 0.82, line: { width: 0.7, color: 'white' } }, hovertemplate: '%{x:.4f}<br>%{y:.4f}<extra>%{fullData.name}</extra>' };
            });
          }
        } else if (query.active && settings.x) {
          const x = column(settings.x), y = column(settings.y), z = column(settings.z), colors = column(settings.color), sizes = column(settings.size), labels = column(settings.label);
          const xKind = dataset.columns.find(c => c.id === settings.x)?.kind;
          const type = settings.type === 'auto' ? !settings.y ? 'histogram' : xKind === 'text' ? 'box' : 'scatter' : settings.type;
          threeD = type === 'scatter3d';
          const grouping = settings.group || (settings.color && dataset.columns.find(c => c.id === settings.color)?.kind !== 'number' ? settings.color : '');
          const groups = grouping ? column(grouping).map(v => String(v ?? '(missing)')) : x.map(() => 'All rows');
          const unique = [...new Set(groups)];
          const numericColor = !!settings.color && !grouping && dataset.columns.find(c => c.id === settings.color)?.kind === 'number';
          const finiteSizes = sizes.filter(v => typeof v === 'number' && Number.isFinite(v)) as number[];
          const maxSize = finiteSizes.reduce((a, v) => Math.max(a, Math.abs(v)), 1);
          traces = unique.map((group, groupIndex) => {
            let indices = groups.map((v, idx) => v === group ? idx : -1).filter(idx => idx >= 0);
            if (type === 'line') indices = indices.slice().sort((a, b) => typeof x[a] === 'number' && typeof x[b] === 'number' ? Number(x[a])-Number(x[b]) : String(x[a]).localeCompare(String(x[b])));
            const values = (list: (Cell | undefined)[]) => indices.map(i => typeof list[i] === 'number' && !Number.isFinite(list[i]) ? null : list[i]);
            if (type === 'histogram') return { type: 'histogram', name: safe(group), x: values(x), opacity: 0.8, marker: { color: palette[groupIndex % palette.length] } };
            if (type === 'box') return { type: 'box', name: safe(group), x: values(x), y: values(y), boxpoints: 'outliers', marker: { color: palette[groupIndex % palette.length] }, line: { width: 1.8 } };
            return { type: threeD ? 'scatter3d' : query.active > 5000 ? 'scattergl' : 'scatter', mode: type === 'line' ? 'lines+markers' : 'markers', name: safe(group), x: values(x), y: values(y), z: threeD ? values(z) : undefined, customdata: indices.map(i => query.plot.rows[i].id), text: indices.map(i => safe(labels[i])), marker: { color: numericColor ? values(colors) : palette[groupIndex % palette.length], colorscale: 'Viridis', showscale: numericColor, colorbar: { title: { text: columnName(settings.color) } }, size: settings.size ? indices.map(i => typeof sizes[i] === 'number' && Number.isFinite(sizes[i]) ? 5 + 15*Math.abs(Number(sizes[i]))/maxSize : 5) : threeD ? 5 : settings.pointSize, opacity: 0.82, line: { color: '#ffffff', width: 0.65 } }, line: { color: palette[groupIndex % palette.length], width: 2 }, hovertemplate: `${settings.label ? '%{text}<br>' : ''}${xTitle}: %{x}<br>${yTitle}: %{y}${threeD ? `<br>${columnName(settings.z)}: %{z}` : ''}<extra>%{fullData.name}</extra>` };
          });
          if (type === 'histogram') yTitle = 'Count';
        }
        const axis = { gridcolor: '#eef1f3', zerolinecolor: '#e4e9ed', tickfont: { color: '#75838d', size: 11 }, title: { font: { color: '#53636c', size: 12 } }, automargin: true };
        const layout: any = { title: !analysis && settings.title ? { text: safe(settings.title), x: 0.05, font: { size: 14 } } : undefined, paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff', margin: { t: 30, r: 35, b: 65, l: 70 }, font: { family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', color: '#263e47', size: 12 }, xaxis: { ...axis, title: { text: xTitle } }, yaxis: { ...axis, title: { text: yTitle } }, legend: { orientation: 'h', x: 0, y: 1.08, font: { size: 11 } }, hovermode: 'closest', dragmode: threeD ? 'orbit' : 'zoom', showlegend: traces.length > 1, scene: { xaxis: { ...axis, title: { text: analysis ? xTitle : columnName(settings.x) } }, yaxis: { ...axis, title: { text: yTitle } }, zaxis: { ...axis, title: { text: analysis ? `${analysis.method === 'pca' ? 'PC' : 'LD'}${componentZ+1}` : columnName(settings.z) } }, bgcolor: '#ffffff' }, annotations: !traces.length ? [{ text: 'No active rows. Clear the selection or adjust your filters.', xref: 'paper', yref: 'paper', x: 0.5, y: 0.5, showarrow: false, font: { size: 15, color: '#71828b' } }] : [], uirevision: `${dataset.id}:${settings.type}:${settings.x}:${settings.y}:${settings.z}:${analysis?.method ?? ''}:${componentX}:${componentY}` };
        await Plotly.react(graph, traces, layout, { responsive: true, displaylogo: false, scrollZoom: false, modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'], toImageButtonOptions: { filename: 'wiz-chart' } });
        if (disposed) return;
        const emitter = graph as any;
        emitter.removeAllListeners('plotly_selected'); emitter.removeAllListeners('plotly_click');
        if (!threeD && !variance) {
          emitter.on('plotly_selected', (event: any) => { if (event?.points?.length) latestSelect.current([...new Set<number>(event.points.map((p: any) => p.customdata).filter((v: unknown) => typeof v === 'number'))]); });
          emitter.on('plotly_click', (event: any) => { const row = event?.points?.[0]?.customdata; if (typeof row === 'number') latestSelect.current([row]); });
        }
      } catch (e) { if (!disposed) setError(`Unable to render this chart: ${e instanceof Error ? e.message : String(e)}`); }
    };
    void render();
    const observer = new ResizeObserver(() => { if (!disposed && (graph as any).data) void getPlotly().then(p => { if (!disposed && graph.isConnected && graph.getClientRects().length) return p.Plots.resize(graph); }).catch(() => undefined); });
    observer.observe(graph);
    return () => { disposed = true; observer.disconnect(); };
  }, [dataset, query, settings, analysis, componentX, componentY, componentZ, analysis3d, variance]);
  useEffect(() => { const graph = element.current; return () => { if (graph && library) void library.then(p => p.purge(graph)); }; }, []);
  return <div className="plot-wrap"><div ref={element} className="plot" data-testid="chart" />{error && <p role="alert" className="plot-error">{error}</p>}</div>;
});
