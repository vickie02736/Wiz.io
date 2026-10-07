import { bubbleSizes, categorical } from './compat';
import type { AnalysisResult, Cell, Dataset, PlotSettings, QueryResult } from './types';
export const escapeText = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export interface AnalysisView { result: AnalysisResult; variance?: boolean; x?: number; y?: number; z?: number; threeD?: boolean }
export function makePlot(dataset: Dataset | undefined, query: QueryResult | undefined, settings: PlotSettings, analysis?: AnalysisView) {
  const title = (id: string) => escapeText(dataset?.columns.find(c => c.id === id)?.name ?? id);
  const meta = (id: string) => dataset?.columns.find(c => c.id === id);
  const rows = query?.plot.rows ?? [];
  const values = (id: string): Cell[] => rows.map(r => r.values[query!.plot.columns.indexOf(id)] ?? null);
  const axis = (id: string, scale: string) => ({ title: { text: `<b>${title(id)}</b>`, font: { family: 'Arial', size: 24 } }, showline: true, linewidth: 2, linecolor: 'black', mirror: true, ticks: 'outside', showgrid: false, zeroline: false, automargin: true, autorange: true, ...(meta(id)?.kind === 'number' ? { type: scale, nticks: 5 } : {}) });
  let traces: any[] = []; let threeD = settings.type === 'scatter3d';
  let xAxis: any = axis(settings.x, settings.xScale), yAxis: any = axis(settings.y, settings.yScale);
  if (analysis) {
    const result = analysis.result; const prefix = result.method === 'pca' ? 'PC' : 'LD';
    const cx = analysis.x ?? 0, cy = analysis.y ?? 1, cz = analysis.z ?? 2;
    const labels = result.variance.map((_, i) => `${prefix} ${i + 1}`);
    if (analysis.variance) {
      threeD = false;
      traces = [{ type: 'bar', x: labels, y: result.variance, name: 'Individual' }, { type: 'scatter', x: labels, y: result.cumulative, name: 'Cumulative' }];
      xAxis = { ...axis('', 'linear'), title: '' }; yAxis = { ...axis('', 'linear'), title: {text:'<b>Variance (%)</b>',font:{family:'Arial',size:24}} };
    } else {
      threeD = !!analysis.threeD && result.scores[0]?.length > 2;
      const groups = settings.group === '__all__' ? ['All rows'] : [...new Set(result.labels.map(v => String(v ?? 'All rows')))];
      const direction = result.method === 'lda' ? -1 : 1;
      traces = groups.map(group => {
        const indices = result.rowIds.map((_, i) => settings.group === '__all__' || String(result.labels[i] ?? 'All rows') === group ? i : -1).filter(i => i >= 0);
        return { type: threeD ? 'scatter3d' : result.rowIds.length > 7500 ? 'scattergl' : 'scatter', mode: 'markers', ...(result.labels.some(v => v != null) ? {name: escapeText(group)} : {}),
          x: indices.map(i => direction * result.scores[i][cx]), y: indices.map(i => direction * (result.scores[i][cy] ?? 0)),
          ...(threeD ? { z: indices.map(i => direction * result.scores[i][cz]) } : {}),
          customdata: indices.map(i => result.rowIds[i]),
          opacity: 0.8, marker: { size: 15, sizemode: 'diameter', colorscale: 'Jet', line: { width: 0.5, color: 'white' } } };
      });
      xAxis = { ...axis('', 'linear'), title: {text:`${prefix} ${cx + 1}`,font:{family:'Arial',size:24}}, type: 'linear', nticks: 5 };
      yAxis = { ...axis('', 'linear'), title: {text:result.variance.length > 1 ? `${prefix} ${cy + 1}` : 'One-dimensional projection',font:{family:'Arial',size:24}}, type: 'linear', nticks: 5 };
    }
  } else if (dataset && query?.active) {
    if (settings.type === 'line') {
      for (const id of settings.yColumns) {
        const i = dataset.columns.findIndex(c => c.id === id);
        const xId = settings.lineInputType === 1 ? dataset.columns[0].id : dataset.columns[i - 1]?.id;
        if (!xId) continue;
        traces.push({ type: 'scatter', mode: 'lines+markers', x: values(xId), y: values(id), text: title(id), name: title(id), customdata: rows.map(r => r.id), opacity: 0.8, hoverinfo: 'text', marker: { size: 10, sizemode: 'diameter', colorscale: 'Jet', line: { width: 0.5, color: 'white' } } });
      }
      const firstY = settings.yColumns[0] ?? '', firstIndex = dataset.columns.findIndex(c=>c.id===firstY);
      xAxis = settings.lineInputType === 1 ? axis(dataset.columns[0].id, settings.xScale) : { ...axis(dataset.columns[firstIndex-1]?.id??'', settings.xScale), title: {text:'<b>X</b>',font:{family:'Arial',size:24}} };
      yAxis = { ...axis(firstY, settings.yScale), title: {text:'<b>Y</b>',font:{family:'Arial',size:24}} };
    } else if (settings.x) {
      const x = values(settings.x), y = values(settings.y), z = values(settings.z), labels = values(settings.label);
      const type = settings.type === 'auto' ? !settings.y ? 'histogram' : !settings.color && categorical(meta(settings.x), x) ? 'box' : 'scatter' : settings.type;
      if (type === 'histogram') {
        traces = [{ type: 'histogram', x, opacity: 0.8, name: title(settings.label) }];
        yAxis = { ...axis('', 'linear'), title: '<b>Count</b>' };
      } else if (type === 'box') {
        const categories = [...new Set(x.map(String))];
        traces = categories.map(category => {
          const indices = x.map((v, i) => String(v) === category ? i : -1).filter(i => i >= 0);
          return { type: 'box', y: indices.map(i => y[i]), text: indices.map(i => escapeText(labels[i])), customdata: indices.map(i => rows[i].id), name: escapeText(category), boxpoints: 'all', jitter: 0.5, pointpos: -1.5, opacity: 0.8, hoverinfo: 'x+y+text', marker: { size: 10, line: { width: 0.5, color: 'white' } } };
        });
        delete xAxis.type;
      } else if (settings.y && (!threeD || settings.z)) {
        const colors = values(settings.color), sizes = values(settings.size);
        const grouping = settings.group || (settings.color && (threeD ? meta(settings.color)?.kind !== 'number' : categorical(meta(settings.color), colors)) ? settings.color : '');
        const groups = grouping ? values(grouping).map(v => String(v ?? '(missing)')) : x.map(() => 'Label');
        const continuousColor = !!settings.color && !grouping;
        traces = [...new Set(groups)].map(group => {
          const indices = groups.map((v, i) => v === group ? i : -1).filter(i => i >= 0);
          return { type: threeD ? 'scatter3d' : rows.length > (settings.webglCutoff ?? 7500) ? 'scattergl' : 'scatter', mode: 'markers', name: escapeText(group),
            x: indices.map(i => x[i]), y: indices.map(i => y[i]), ...(threeD ? { z: indices.map(i => z[i]) } : {}),
            text: indices.map(i => escapeText(labels[i])), customdata: indices.map(i => rows[i].id), hoverinfo: 'text',
            ...(!threeD ? { opacity: 0.8 } : { hoverlabel: { bgcolor: 'lightgray' } }),
            marker: { size: settings.size ? bubbleSizes(indices.map(i => sizes[i])) : settings.pointSize,
              sizemode: 'diameter', colorscale: 'Jet', ...(!threeD ? { opacity: 0.8 } : {}),
              ...(continuousColor ? { color: indices.map(i => colors[i]), colorbar: { title: `<b>${title(settings.color)}</b>`, titleside: 'right', titlefont: { family: 'Arial', size: 24 } } } : {}),
              line: threeD ? { width: 0 } : { width: 0.5, color: 'white' } } };
        });
      }
    }
  }
  const a = settings.annotation;
  const annotations: any[] = a && !threeD && !analysis?.variance ? [{ x: settings.xScale === 'log' && typeof a.x === 'number' ? Math.log10(a.x) : a.x, y: settings.yScale === 'log' && typeof a.y === 'number' ? Math.log10(a.y) : a.y, text: a.text, align: 'right', ax: 180, ay: 20, bgcolor: '#666666', opacity: 0.8, font: { color: 'white' }, showarrow: true, arrowhead: 7, arrowsize: 1, arrowwidth: 2, clicktoshow: 'onout' }] : [];
  if (!traces.length) {
    xAxis = { showline: false, showgrid: false, zeroline: false, showticklabels: false };
    yAxis = { ...xAxis };
    annotations.push({ text: dataset ? query?.active === 0 ? 'No active rows. Adjust filters or clear selection.' : 'Select variables to begin.' : 'Upload your data to begin.', xref: 'paper', yref: 'paper', x: 0.5, y: 0.5, showarrow: false, font: { color: '#777', size: 18 } });
  }
  const layout: any = { template: { layout: { paper_bgcolor: 'white', plot_bgcolor: 'white', colorway: ['#636efa','#EF553B','#00cc96','#ab63fa','#FFA15A','#19d3f3','#FF6692','#B6E880','#FF97FF','#FECB52'], xaxis: { gridcolor: '#EBF0F8' }, yaxis: { gridcolor: '#EBF0F8' } } },
    paper_bgcolor: 'white', plot_bgcolor: 'white', font: { family: 'Arial', size: 18 }, xaxis: xAxis, yaxis: yAxis,
    margin: { l: 50, b: 40, t: 10, r: 30 }, hovermode: 'closest', legend: { x: 1.02, y: 0.98 }, bargap: 0.2,
    annotations, uirevision: dataset?.id ?? 'empty', ...(settings.title ? { title: { text: escapeText(settings.title) } } : {}),
    scene: { xaxis: { title: title(settings.x), type: settings.xScale }, yaxis: { title: title(settings.y), type: settings.yScale }, zaxis: { title: title(settings.z) } } };
  if (threeD && !analysis) {
    const sceneAxis = (id:string,scale:string) => ({title:{text:title(id),font:{family:'Arial',size:18}},zeroline:false,autorange:true,...(meta(id)?.kind==='number'?{type:scale,nticks:5}:{})});
    layout.font = {family:'Arial',size:13.5}; layout.margin = {l:0,b:0,t:0,r:0}; layout.legend.y = 0.95;
    layout.scene = {aspectratio:{x:2,y:2,z:1},xaxis:sceneAxis(settings.x,settings.xScale),yaxis:sceneAxis(settings.y,settings.yScale),zaxis:sceneAxis(settings.z,'linear')};
  }
  if (!analysis && traces.length && query?.ranges) for (const key of ['x','y','z'] as const) {
    const range = query.ranges[key]; if (!range) continue;
    const target = threeD ? layout.scene[`${key}axis`] : key==='z' ? undefined : layout[`${key}axis`];
    if (target) Object.assign(target,{range,autorange:false});
  }
  if (analysis && threeD) layout.scene = { xaxis: { title: xAxis.title }, yaxis: { title: yAxis.title }, zaxis: { title: `${analysis.result.method === 'pca' ? 'PC' : 'LD'} ${(analysis.z ?? 2) + 1}` } };
  traces.forEach((trace, i) => {
    const identity = `${trace.type}:${trace.name ?? i}`;
    let hash = 2166136261;
    for (let j = 0; j < identity.length; j++) hash = Math.imul(hash ^ identity.charCodeAt(j), 16777619);
    trace.uid = (hash >>> 0).toString(16);
  });
  return { traces, layout, threeD };
}
