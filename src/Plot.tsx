import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Dataset, PlotSettings, PointAnnotation, QueryResult } from './types';
import type * as PlotlyType from 'plotly.js';
import { escapeText, makePlot } from './plotModel';
import type { AnalysisView } from './plotModel';
let library: Promise<typeof PlotlyType> | undefined;
let libraryReady = false;
export const getPlotly = () => library ??= import('plotly.js-dist-min').then(m => { libraryReady = true; return m.default ?? m; }).catch(error => { library = undefined; throw error; });
// Let the loading state paint before expensive drawing, even in a background tab.
const nextPaint = () => new Promise<void>(resolve => {
  const finish = () => { cancelAnimationFrame(frame); clearTimeout(fallback); resolve(); };
  const frame = requestAnimationFrame(() => { setTimeout(finish, 0); });
  const fallback = setTimeout(finish, 100);
});
export interface PlotHandle { download: (format: 'png' | 'svg') => Promise<void> }
interface Props { dataset?: Dataset; query?: QueryResult; settings: PlotSettings; analysis?: AnalysisView; loading?: string; selectPoints?: boolean; onSelect: (ids: number[]) => void; onAnnotate: (annotation?: PointAnnotation) => void; testId?: string }
export const Plot = forwardRef<PlotHandle, Props>(function Plot(props, ref) {
  const { dataset, query, settings, analysis, selectPoints, testId = 'chart' } = props;
  const element = useRef<HTMLDivElement>(null); const latest = useRef(props); latest.current = props;
  const [error, setError] = useState('');
  const [renderStage, setRenderStage] = useState('Loading chart tools…');
  const queue = useRef(Promise.resolve());
  const legendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useImperativeHandle(ref, () => ({ download: async format => {
    await queue.current;
    if (element.current) await getPlotly().then(p => p.downloadImage(element.current!, { format, filename: 'wiz-chart', width: format === 'png' ? 1400 : null, height: format === 'png' ? 900 : null }));
  } }));
  useEffect(() => {
    const graph = element.current; if (!graph) return;
    let disposed = false;
    setError(''); setRenderStage(libraryReady ? 'Preparing chart…' : 'Loading chart tools…');
    queue.current = queue.current.catch(() => undefined).then(async () => {
      if (disposed) return;
      try {
        const Plotly = await getPlotly(); if (disposed) return;
        setRenderStage('Preparing chart…'); await nextPaint(); if (disposed) return;
        const model = makePlot(dataset, query, settings, analysis);
        setRenderStage('Rendering chart…'); await nextPaint(); if (disposed) return;
        await Plotly.react(graph, model.traces, model.layout, { responsive: true, displaylogo: false, displayModeBar: model.traces.length ? 'hover' : false,
          editable: true, edits: { titleText: false }, toImageButtonOptions: { format: 'svg', filename: 'wiz-chart' } });
        if (disposed) return; setError('');
        const emitter = graph as any;
        emitter.removeAllListeners('plotly_selected'); emitter.removeAllListeners('plotly_click');
        emitter.removeAllListeners('plotly_legendclick'); emitter.removeAllListeners('plotly_legenddoubleclick');
        emitter.on('plotly_legendclick', (event: any) => {
          clearTimeout(legendTimer.current);
          legendTimer.current = setTimeout(() => {
            if (disposed || !graph.isConnected) return;
            const index = event.curveNumber;
            void Plotly.restyle(graph, { visible: emitter.data[index].visible === 'legendonly' ? true : 'legendonly' }, [index]);
          }, 310);
          return false;
        });
        emitter.on('plotly_legenddoubleclick', (event: any) => {
          clearTimeout(legendTimer.current);
          const isolated = emitter.data.every((trace: any, i: number) => i === event.curveNumber || trace.visible === 'legendonly');
          void Plotly.restyle(graph, { visible: emitter.data.map((_: any, i: number) => isolated || i === event.curveNumber ? true : 'legendonly') });
          return false;
        });
        if (!model.threeD && !analysis?.variance) {
          emitter.on('plotly_selected', (event: any) => {
            if (latest.current.selectPoints && event?.points?.length) latest.current.onSelect([...new Set<number>(event.points.map((p: any) => p.customdata).filter((v: unknown) => typeof v === 'number'))]);
          });
          emitter.on('plotly_click', (event: any) => {
            const point = event?.points?.[0]; if (!point || point.data?.type === 'histogram') return;
            const key = `${point.curveNumber}:${point.pointNumber}`;
            const name = (id: string) => escapeText(dataset?.columns.find(c => c.id === id)?.name ?? id);
            const row = query?.plot.rows.find(r => r.id === point.customdata);
            const value = (id: string) => row?.values[query!.plot.columns.indexOf(id)];
            const prefix = analysis?.result.method === 'lda' ? 'LD' : 'PC';
            const xName = analysis ? `${prefix} ${(analysis.x ?? 0)+1}` : settings.type === 'line' ? settings.lineInputType === 1 ? name(dataset!.columns[0].id) : 'X' : name(settings.x);
            const yName = analysis ? `${prefix} ${(analysis.y ?? 1)+1}` : settings.type === 'line' ? 'Y' : name(settings.y);
            const text = `${!analysis && settings.type !== 'line' ? `${escapeText(point.text)}<br>` : ''}${xName}: ${escapeText(point.x)}<br>${yName}: ${escapeText(point.y)}<br>${!analysis && settings.color ? `${name(settings.color)}: ${escapeText(value(settings.color))}<br>` : ''}${!analysis && settings.size ? `${name(settings.size)}: ${escapeText(value(settings.size))}<br>` : ''}`;
            latest.current.onAnnotate(latest.current.settings.annotation?.key === key ? undefined : { x: point.x, y: point.y, key, text });
          });
        }
      } catch (e) { if (!disposed) setError(`Unable to render this chart: ${e instanceof Error ? e.message : String(e)}`); }
      finally { if (!disposed) setRenderStage(''); }
    });
    const observer = new ResizeObserver(() => {
      if (!disposed && (graph as any).data) void getPlotly().then(p => { if (!disposed && graph.isConnected && graph.getClientRects().length) return p.Plots.resize(graph); }).catch(() => undefined);
    });
    observer.observe(graph);
    return () => { disposed = true; clearTimeout(legendTimer.current); observer.disconnect(); };
  }, [dataset, query, settings, analysis, selectPoints]);
  useEffect(() => { const graph = element.current; return () => { if (graph && library) void library.then(p => p.purge(graph)); }; }, []);
  const stage = props.loading || renderStage;
  return <div className="plot-wrap" aria-busy={!!stage}><div ref={element} className="plot" data-testid={testId} />{stage && <div className="plot-loading" data-testid={`${testId}-loading`}><div className="plot-loading-card"><p className="plot-loading-title">Loading visualization</p><div className="plot-loading-track" role="progressbar" aria-label="Loading visualization" aria-valuetext={stage}><span /></div><p className="plot-loading-stage" aria-live="polite">{stage}</p></div></div>}{error && <p role="alert" className="plot-error">{error}</p>}</div>;
});
