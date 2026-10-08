import { useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import { WorkerClient } from './rpc';
import { Plot, type PlotHandle } from './Plot';
import { classColumns, defaultPlot, legacyFeatures, lineOptions, parseColumnFilter, plottedColumns } from './compat';
import type { AnalysisInput, AnalysisResult, AnalysisSettings, ColumnKind, Dataset, PlotSettings, QueryResult, ViewState } from './types';

type Tool = 'scatter' | 'lines' | 'analysis';
type Page = Tool | 'examples' | 'help';
const examples = [
  { id: 'oxygen-dynamic', title: 'Dynamic oxygen adsorption', tool: 'scatter' as Tool, file: 'oxygen.xlsx', detail: 'All published MOF data shown at once. Start replay for a step-by-step view.' },
  { id: 'oxygen-static', title: 'Static oxygen adsorption', tool: 'scatter' as Tool, file: 'oxygen.xlsx', detail: 'Explore oxygen uptake and material properties at ten pressures.' },
  { id: 'stocks', title: 'Stock market lines', tool: 'lines' as Tool, file: 'sp500.csv', detail: 'Historical S&P 500 index: Open, High, Low and Close.' },
  { id: 'wine', title: 'Wine data histograms', tool: 'scatter' as Tool, file: 'wine.csv', detail: '178 wine samples; histogram, box and scatter controls.' },
  { id: 'iris', title: 'Iris classification', tool: 'analysis' as Tool, file: 'iris.csv', detail: '150 flowers, three species.' },
];
type Example = typeof examples[number];
function save(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Select({ label, value, change, children, disabled = false }: { label: string; value: string; change: (v: string) => void; children: React.ReactNode; disabled?: boolean }) {
  return <label className="field"><span>{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={e => change(e.target.value)}>{children}</select></label>;
}
function Scale({label,value,change,disabled=false}:{label:string;value:string;change:(v:string)=>void;disabled?:boolean}) {
  return <fieldset className="scale" aria-label={label} disabled={disabled}><legend>{label}</legend>{['linear','log'].map(v=><label key={v}><input type="radio" name={label} checked={value===v} onChange={()=>change(v)}/>{v==='linear'?'Linear':'Log'}</label>)}</fieldset>;
}
export default function App() {
  const [page, setPage] = useState<Page>('scatter'), [example, setExample] = useState<Example>();
  const open = (p: Page) => { setExample(undefined); setPage(p); };
  const pick = (e: Example) => { setExample(e); setPage(e.tool); };
  return <><header className="navbar"><a className="brand" href={import.meta.env.BASE_URL}>Wiz.io</a><nav aria-label="Main navigation">{(['scatter','lines','analysis','examples','help'] as Page[]).map(p => <button key={p} className={page === p ? 'current' : ''} onClick={() => open(p)}>{({scatter:'Scatter',lines:'Lines',analysis:'PCA/LDA',examples:'Examples',help:'Help'})[p]}</button>)}</nav><a href="https://github.com/vickie02736/Wiz.io" target="_blank" rel="noreferrer">GitHub</a></header>
    <main className="container">{page === 'examples' ? <><h1>Examples</h1><p>Five familiar Wiz examples, using fixed public datasets. Choose an example to open its controls.</p><div className="examples">{examples.map(e => <button className="example" key={e.id} onClick={() => pick(e)}><h2>{e.title}</h2><p>{e.detail}</p><span>Open example →</span></button>)}</div><details><summary>Advanced example</summary><Workspace key="timeseries" tool="lines" example={{id:'timeseries',title:'Generated time series',tool:'lines',file:'timeseries.csv',detail:'Synthetic measurements; not a legacy example.'}} /></details></> : page === 'help' ? <Help /> : <Workspace key={`${page}:${example?.id ?? 'upload'}`} tool={page} example={example} quickExample={pick} />}</main>
    <footer>Wiz.io · Independent browser implementation · No user data uploads</footer></>;
}
function Workspace({ tool, example, quickExample }: { tool: Tool; example?: Example; quickExample?: (e: Example) => void }) {
  const client = useRef<WorkerClient | null>(null), engine = useRef<WorkerClient | null>(null), input = useRef<HTMLInputElement>(null), graph = useRef<PlotHandle>(null), varianceGraph = useRef<PlotHandle>(null);
  const owned = useRef<string[]>([]), importEpoch = useRef(0), exampleEpoch = useRef(0), queryEpoch = useRef(0), analysisEpoch = useRef(0), lastAutomatic = useRef('');
  const [datasets, setDatasets] = useState<Dataset[]>([]), [index, setIndex] = useState(0); const dataset = datasets[index];
  const [plot, setPlot] = useState<PlotSettings>({...defaultPlot, type: tool === 'lines' ? 'line' : 'auto',webglCutoff:example?.id.startsWith('oxygen')?2500:7500});
  const [view, setView] = useState<ViewState>({filters:[],selected:[]}), [query, setQuery] = useState<QueryResult>(), [page, setPage] = useState(0), [table, setTable] = useState(false);
  const [filters, setFilters] = useState<Record<string,string>>({}), [advanced, setAdvanced] = useState(false), [selectPoints, setSelectPoints] = useState(false);
  const [settings, setSettings] = useState<AnalysisSettings>({method:'pca',features:[],label:'',standardize:true,compatibility:true});
  const [automatic, setAutomatic] = useState(true), [suspended, setSuspended] = useState(false), [analyzing, setAnalyzing] = useState(false), [progress, setProgress] = useState('');
  const [result, setResult] = useState<AnalysisResult>(), [resultSignature, setResultSignature] = useState('');
  const [cx, setCx] = useState(0), [cy, setCy] = useState(1), [cz, setCz] = useState(2), [threeD, setThreeD] = useState(false);
  const [importing, setImporting] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [playing, setPlaying] = useState(false);
  const [loadingExample, setLoadingExample] = useState(!!example), [querying, setQuerying] = useState(false);
  const [years, setYears] = useState([2021,2023]);
  const signature = JSON.stringify([dataset?.id,dataset?.version,view,settings]); const latestSignature = useRef(signature); latestSignature.current = signature;
  const stale = !!result && signature !== resultSignature; const current = result && !stale ? result : undefined;
  const chartColumns = dataset ? tool === 'analysis' ? dataset.columns.map(c => c.id) : plottedColumns(dataset,plot) : [];
  useEffect(() => {
    client.current = new WorkerClient(new Worker(new URL('./workers/data.worker.ts',import.meta.url),{type:'module'}));
    if (example) void loadExample(example.file);
    return () => { importEpoch.current++; exampleEpoch.current++; queryEpoch.current++; analysisEpoch.current++; client.current?.terminate(); engine.current?.terminate(); };
  }, []);
  useEffect(() => {
    const epoch = ++queryEpoch.current;
    if (!dataset) { setQuery(undefined); setQuerying(false); return; }
    setQuerying(true);
    void client.current!.request<QueryResult>('query',{datasetId:dataset.id,view,page,pageSize:50,columns:chartColumns,rangesReferenceId:example?.id.startsWith('oxygen')?datasets.at(-1)?.id:undefined,axes:{x:{id:plot.x,scale:plot.xScale},y:{id:plot.y,scale:plot.yScale},z:{id:plot.z,scale:'linear'}}},undefined,dataset.version).then(q => {
      if (epoch !== queryEpoch.current) return;
      if (page && page >= q.pageCount) { setPage(Math.max(0,q.pageCount-1)); return; } setQuery(q);
    }).catch(e => { if (epoch === queryEpoch.current) setError(e.message); }).finally(() => { if (epoch === queryEpoch.current) setQuerying(false); });
  }, [dataset,view,page,JSON.stringify(chartColumns),plot.xScale,plot.yScale]);
  useEffect(() => {
    if (example?.id !== 'oxygen-dynamic' || !playing || !dataset) return;
    if (view.limit === undefined || view.limit >= dataset.rowCount) { setPlaying(false); return; }
    const timer = setTimeout(() => setView(v => v.limit === undefined ? v : {...v,limit:Math.min(dataset.rowCount,v.limit+150)}),3000); return () => clearTimeout(timer);
  }, [example?.id,playing,dataset,view.limit]);
  useEffect(() => {
    analysisEpoch.current++; if (analyzing) { engine.current?.terminate(); engine.current = null; setAnalyzing(false); setProgress(''); }
  }, [signature]);
  useEffect(() => {
    if (tool !== 'analysis' || !dataset || !automatic || suspended || lastAutomatic.current === signature) return;
    const timer = setTimeout(() => { lastAutomatic.current = signature; void runAnalysis(); },350); return () => clearTimeout(timer);
  }, [signature,automatic,suspended]);
  useEffect(() => {
    if (!table) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setTable(false); }; window.addEventListener('keydown',close); return () => window.removeEventListener('keydown',close);
  }, [table]);
  function activate(d: Dataset, sheetIndex: number, first = false) {
    queryEpoch.current++; setQuery(undefined); setIndex(sheetIndex); setPlaying(false); setView({filters:[],selected:[]}); setFilters({}); setPage(0); setResult(undefined); setError('');
    const preserve = (id: string) => { const name = dataset?.columns.find(c => c.id===id)?.name; return d.columns.find(c=>c.name===name)?.id ?? ''; };
    const get = (name: string) => d.columns.find(c=>c.name===name)?.id ?? '';
    setPlot(s => {
      const next = {...s,x:first?'':preserve(s.x),y:first?'':preserve(s.y),z:first?'':preserve(s.z),color:first?'':preserve(s.color),size:first?'':preserve(s.size),group:'',label:d.columns[0].id,annotation:undefined,yColumns:first?[]:s.yColumns.map(preserve).filter(Boolean)};
      if (first && example?.id.startsWith('oxygen')) Object.assign(next,{x:d.columns[1].id,y:d.columns[2].id,color:d.columns[4].id,size:d.columns[5].id,z:d.columns[7].id});
      if (first && example?.id === 'stocks') next.yColumns = ['Open','High','Low','Close'].map(get);
      if (first && example?.id === 'wine') Object.assign(next,{x:get('Cultivar'),y:get('Alcohol')});
      if (first && example?.id === 'timeseries') next.yColumns = d.columns.filter(c=>c.kind==='number').map(c=>c.id);
      return next;
    });
    setSettings(s=>({...s,label:s.method==='lda'?classColumns(d)[0]?.id??'':'',features:d.columns.filter(c=>c.kind==='number').map(c=>c.id)}));
    if (first && example?.id==='stocks') setView({selected:[],filters:[{column:d.columns[0].id,op:'gte',value:'2021-01-01'},{column:d.columns[0].id,op:'lte',value:'2023-12-31'}]});
  }
  async function importFiles(files: File[]) {
    if (!files.length || !client.current || importing) return;
    const epoch = ++importEpoch.current; setImporting(true); setError('');
    try { const ds = await client.current.request<Dataset[]>('import',{files}); if (epoch !== importEpoch.current) return; owned.current.push(...ds.map(d=>d.id)); setDatasets(ds); const i = example?.id.startsWith('oxygen')?Math.min(7,ds.length-1):0; activate(ds[i],i,true); setNotice(ds.flatMap(d=>d.warnings).join(' ')); }
    catch(e) { if (epoch === importEpoch.current) setError((e as Error).message); }
    finally { if (epoch === importEpoch.current) { setImporting(false); if (input.current) input.current.value=''; } }
  }
  async function loadExample(file: string) {
    const epoch = ++exampleEpoch.current; setLoadingExample(true); setError('');
    try { const response = await fetch(`${import.meta.env.BASE_URL}examples/${file}`); if (!response.ok) throw new Error('Unable to load the example. Retry using its button.'); const blob = await response.blob(); if (epoch === exampleEpoch.current) { setLoadingExample(false); await importFiles([new File([blob],file)]); } }
    catch(e) { if (epoch === exampleEpoch.current) setError((e as Error).message); }
    finally { if (epoch === exampleEpoch.current) setLoadingExample(false); }
  }
  function cancelAnalysis() { analysisEpoch.current++; engine.current?.terminate(); engine.current=null; setAnalyzing(false); setProgress(''); setSuspended(true); setNotice('Analysis cancelled. Choose Run analysis to resume.'); }
  async function clear() {
    importEpoch.current++; exampleEpoch.current++; queryEpoch.current++; analysisEpoch.current++; engine.current?.terminate(); engine.current=null; setAnalyzing(false); setProgress(''); setLoadingExample(false); setQuerying(false);
    await client.current?.request('clear',{ids:owned.current}); owned.current=[]; setDatasets([]); setIndex(0); setQuery(undefined); setView({filters:[],selected:[]}); setFilters({}); setResult(undefined); setSuspended(false); lastAutomatic.current=''; setPlot({...defaultPlot,type:tool==='lines'?'line':'auto'}); setError(''); setNotice('Data cleared from page memory. You can upload again.');
  }
  async function runAnalysis() {
    if (!dataset || !client.current) return;
    const epoch = ++analysisEpoch.current, snapshot = signature; lastAutomatic.current = snapshot; setSuspended(false); setAnalyzing(true); setProgress('Preparing the current subset…'); setError('');
    try {
      const payload = await client.current.request<AnalysisInput>('analysis',{datasetId:dataset.id,view,settings},undefined,dataset.version);
      if (epoch !== analysisEpoch.current || snapshot !== latestSignature.current) return;
      engine.current ??= new WorkerClient(new Worker(new URL('./workers/analysis.worker.ts',import.meta.url),{type:'module'}));
      const output = await engine.current.request<AnalysisResult>('analyze',payload,p=>{if(epoch===analysisEpoch.current)setProgress(p);},dataset.version);
      if (epoch !== analysisEpoch.current || snapshot !== latestSignature.current) return;
      setResult(output); setResultSignature(snapshot); setCx(0); setCy(1); setCz(2); setThreeD(false);
    } catch(e) { if (epoch === analysisEpoch.current) { setError((e as Error).message); setSuspended(true); if ((e as Error & {kind?:string}).kind !== 'input') { engine.current?.terminate(); engine.current=null; } } }
    finally { if (epoch===analysisEpoch.current) { setAnalyzing(false); setProgress(''); } }
  }
  async function exportData(full = false) {
    if (!dataset) return;
    try { const csv = await client.current!.request<string>('export',{datasetId:dataset.id,view,columns:full||tool==='analysis'?undefined:chartColumns},undefined,dataset.version); save(csv,'data.csv'); } catch(e) { setError((e as Error).message); }
  }
  function exportAnalysis(complete = false) {
    if (!current) return;
    const r=current,prefix=r.method==='pca'?'PC':'LD';
    const fields=complete?['row_id','label',...r.variance.map((_,i)=>`${prefix} ${i+1}`),'method','standardized','features']:[...r.variance.map((_,i)=>`${prefix} ${i+1}`),'Individual','Cumulative'];
    const data=r.scores.map((row,i)=>complete?[r.rowIds[i],r.labels[i],...row,r.method,r.standardize,r.features.join('; ')]:[...row,r.variance[i]??'',r.cumulative[i]??'']);
    save(Papa.unparse({fields,data},{escapeFormulae:true}),complete?'wiz-analysis.csv':'data.csv');
  }
  function exportLoadings() { if(current)save(Papa.unparse({fields:['feature',...current.variance.map((_,i)=>`PC ${i+1}`)],data:current.loadings.map((r,i)=>[current.features[i],...r])},{escapeFormulae:true}),'wiz-loadings.csv'); }
  async function image(format: 'png'|'svg', variance=false) { try { await (variance?varianceGraph:graph).current?.download(format); } catch(e) { setError(`Image export failed: ${(e as Error).message}`); } }
  const sizeValues = plot.size ? query?.plot.rows.map(r=>r.values[query.plot.columns.indexOf(plot.size)]).filter((v): v is number=>typeof v==='number'&&Number.isFinite(v))??[]:[];
  const sizeMin = sizeValues.reduce((a,b)=>Math.min(a,b),Infinity), sizeMax=sizeValues.reduce((a,b)=>Math.max(a,b),-Infinity);
  const update = (values: Partial<PlotSettings>) => setPlot(s=>({...s,...values,annotation:undefined}));
  const options = (all=false) => <><option value="">None</option>{(all?dataset?.columns:dataset?.columns.slice(1))?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</>;
  const classes = dataset?classColumns(dataset):[];
  const setMethod = (method:'pca'|'lda') => setSettings(s=>({...s,method,standardize:method==='pca',label:method==='lda'?s.label||classes[0]?.id||'':s.label}));
  function columnFilter(id: string,value: string) {
    const next={...filters,[id]:value}; setFilters(next); setPage(0);
    try { setView(s=>({...s,filters:Object.entries(next).map(([id,text])=>parseColumnFilter(id,text)).filter(f=>!!f)})); setError(''); } catch(e){setError((e as Error).message);}
  }
  const rowSelectable = tool==='scatter'||(tool==='lines'&&plot.lineInputType===1)||selectPoints;
  const filterable = !(tool==='lines'&&plot.lineInputType===2)&&example?.id!=='stocks';
  const sortable = tool!=='analysis'&&!(tool==='lines'&&plot.lineInputType===2);
  const tableColumns = dataset?.columns.filter(c=>tool==='analysis'||chartColumns.includes(c.id))??[];
  const chartLoading = loadingExample ? 'Loading example data…' : importing ? 'Reading data…' : analyzing ? progress || 'Preparing analysis…' : querying ? 'Preparing chart data…' : undefined;
  const replayPartial = !!dataset && view.limit !== undefined && view.limit < dataset.rowCount;
  function toggleReplay() {
    if (playing) { setPlaying(false); return; }
    if (!replayPartial) { setView(v=>({...v,limit:150})); setPage(0); }
    setPlaying(true);
  }
  function showAllRows() { setPlaying(false); setView(v=>({...v,limit:undefined})); setPage(0); }
  return <section className="workspace"><h1>{example?.title ?? ({scatter:'Scatter plots',lines:'Line plots',analysis:'Principal component analysis / Linear discriminant analysis'})[tool]}</h1>
    <div className={`upload ${datasets.length?'disabled':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!datasets.length&&!example)void importFiles(Array.from(e.dataTransfer.files));}}>
      {example ? <span>{example.detail} {dataset?'':<button disabled={loadingExample||importing} onClick={()=>void loadExample(example.file)}>Load example</button>}</span> : <><input ref={input} type="file" multiple accept=".csv,.tsv,.txt,.dat,.xlsx,.xls,.ods" aria-label="Import files" disabled={!!datasets.length||importing} onChange={e=>void importFiles(Array.from(e.target.files??[]))}/><span>{importing?'Reading data…':datasets.length?'Clear Data before uploading new files.':'Drag and drop or select files · CSV, Excel, ODS, TXT/DAT, TSV'}</span></>}
    </div>
    {error&&<div role="alert" className="banner error">{error}</div>}{notice&&<div role="status" className="banner">{notice}</div>}
    {tool==='analysis'&&<div className="analysis-status">{analyzing?<><span role="status">{progress}</span><button onClick={cancelAnalysis}>Cancel</button></>:<><span>{stale?'Previous result is out of date.':current?`${current.scores.length} analyzed rows · ${current.features.length} features · ${current.droppedRows} incomplete rows excluded${current.droppedFeatures.length?` · Constant features excluded: ${current.droppedFeatures.join(', ')}`:''}`:dataset?'Default: floating-point features only. PCA standardizes; LDA does not.':'Upload a dataset or open an example.'}</span>{dataset&&<button className="run-analysis" onClick={()=>void runAnalysis()}>Run analysis</button>}</>}</div>}
    <div className={tool==='analysis'?'analysis-charts':'chart-area'}><Plot ref={graph} dataset={dataset} query={query} settings={plot} loading={chartLoading} analysis={current?{result:current,x:cx,y:cy,z:cz,threeD}:undefined} selectPoints={selectPoints} onSelect={ids=>{setView(s=>({...s,selected:ids}));setPage(0);}} onAnnotate={annotation=>setPlot(s=>({...s,annotation}))}/>{tool==='analysis'&&<Plot ref={varianceGraph} dataset={dataset} query={undefined} settings={plot} loading={chartLoading} analysis={current?{result:current,variance:true}:undefined} onSelect={()=>{}} onAnnotate={()=>{}} testId="variance-chart"/>}</div>
    {dataset&&<>
      <div className="settings">
        {tool==='scatter'?<><Select label="X" value={plot.x} change={v=>update({x:v})}>{options()}</Select><Scale label="X scale" value={plot.xScale} change={v=>update({xScale:v as 'linear'|'log'})}/><Select label="Y" value={plot.y} change={v=>update({y:v})}>{options()}</Select><Scale label="Y scale" value={plot.yScale} change={v=>update({yScale:v as 'linear'|'log'})}/><Select label="Color" value={plot.color} change={v=>update({color:v})}>{options()}</Select><Select label="Size" value={plot.size} change={v=>update({size:v})}><option value="">None</option>{dataset.columns.slice(1).filter(c=>c.kind==='number').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><Select label="Z" value={plot.z} change={v=>update({z:v})} disabled={plot.type!=='scatter3d'}>{options()}</Select><fieldset><legend>Plot type</legend>{['2D','3D'].map((v,i)=><label key={v}><input type="radio" name="dimension" checked={i===0?plot.type!=='scatter3d':plot.type==='scatter3d'} onChange={()=>update({type:i?'scatter3d':'auto'})}/>{v}</label>)}</fieldset></>:tool==='lines'?<><fieldset><legend>Input type</legend>{[1,2].map(i=><label key={i}><input type="radio" name="inputType" checked={plot.lineInputType===i} onChange={()=>{update({lineInputType:i as 1|2,yColumns:[]});setView({filters:[],selected:[]});setFilters({});}}/>Type {i}</label>)}</fieldset><label className="field wide"><span>Y columns</span><select multiple aria-label="Y columns" value={plot.yColumns} onChange={e=>update({yColumns:Array.from(e.target.selectedOptions,o=>o.value)})}>{lineOptions(dataset,plot.lineInputType).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Scale label="X scale" value={plot.xScale} change={v=>update({xScale:v as 'linear'|'log'})}/><Scale label="Y scale" value={plot.yScale} change={v=>update({yScale:v as 'linear'|'log'})}/></>:<><fieldset><legend>Analysis type</legend>{(['pca','lda'] as const).map(m=><label key={m}><input type="radio" name="method" checked={settings.method===m} onChange={()=>setMethod(m)}/>{m.toUpperCase()}</label>)}</fieldset><Select label="Classes" value={settings.label} change={v=>setSettings(s=>({...s,label:v}))}><option value="">None</option>{(settings.compatibility?classes:dataset.columns).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select><p className="hint">{settings.compatibility?`${legacyFeatures(dataset,settings.label).length} floating-point features selected automatically.`:'Advanced features are active.'}</p></>}
      </div>
      {plot.size&&<div className="size-legend" aria-label="Bubble size legend"><b>{dataset.columns.find(c=>c.id===plot.size)?.name}</b><i style={{width:10,height:10}}/><span>{Number.isFinite(sizeMin)?sizeMin.toPrecision(4):'—'}</span><i style={{width:40,height:40}}/><span>{Number.isFinite(sizeMax)?sizeMax.toPrecision(4):'—'}</span><small>Diameter: 10–40; constant / incomplete values: 25.</small></div>}
      {datasets.length>1&&<label className="sheet"><span>Worksheet {index+1} / {datasets.length}: <b>{dataset.name}</b></span><input aria-label="Worksheet" type="range" min={0} max={datasets.length-1} value={index} onChange={e=>activate(datasets[Number(e.target.value)],Number(e.target.value))}/><select aria-label="Active dataset" value={index} onChange={e=>activate(datasets[Number(e.target.value)],Number(e.target.value))}>{datasets.map((d,i)=><option value={i} key={d.id}>{d.name}</option>)}</select></label>}
      {example?.id==='oxygen-dynamic'&&<div className="actions"><button onClick={toggleReplay}>{playing?'Pause replay':replayPartial?'Resume replay':'Start replay'}</button><button onClick={()=>{setView(s=>({...s,limit:150}));setPage(0);setPlaying(true);}}>Restart replay</button><button disabled={!replayPartial} onClick={showAllRows}>Show all rows</button><span>{replayPartial?'Replay of published measurements · +150 rows / 3 seconds':'All published measurements shown'} · {Math.min(view.limit??dataset.rowCount,dataset.rowCount)} / {dataset.rowCount} rows</span></div>}
      {example?.id==='stocks'&&<div className="date-range"><label>Start year<input aria-label="Start year" type="range" min={1990} max={years[1]} value={years[0]} onChange={e=>{const y=Number(e.target.value);setYears([y,years[1]]);setView(s=>({...s,filters:[{column:dataset.columns[0].id,op:'gte',value:`${y}-01-01`},{column:dataset.columns[0].id,op:'lte',value:`${years[1]}-12-31`}]}));}}/>{years[0]}</label><label>End year<input aria-label="End year" type="range" min={years[0]} max={2023} value={years[1]} onChange={e=>{const y=Number(e.target.value);setYears([years[0],y]);setView(s=>({...s,filters:[{column:dataset.columns[0].id,op:'gte',value:`${years[0]}-01-01`},{column:dataset.columns[0].id,op:'lte',value:`${y}-12-31`}]}));}}/>{years[1]}</label></div>}
      <div className="actions"><button onClick={()=>setTable(true)}>View Data</button><button onClick={()=>tool==='analysis'?exportAnalysis():void exportData()} disabled={tool==='analysis'&&!current}>Download CSV</button><button onClick={()=>void image('svg')} disabled={tool==='analysis'&&!current}>Download SVG</button>{tool==='analysis'&&<button onClick={()=>void image('svg',true)} disabled={!current}>Variance SVG</button>}<button onClick={()=>void clear()}>Clear Data</button><span className="counts">Matching: <b data-testid="matching-count">{query?.matching.toLocaleString()??'…'}</b> · Selected: {view.selected.length} · Active: <b data-testid="active-count">{query?.active.toLocaleString()??'…'}</b></span>{view.selected.length>0&&<button onClick={()=>setView(s=>({...s,selected:[]}))}>Clear selection</button>}</div>
      <details className="advanced" open={advanced} onToggle={e=>setAdvanced(e.currentTarget.open)}><summary>Advanced</summary><div className="advanced-content"><label><input type="checkbox" checked={selectPoints} onChange={e=>setSelectPoints(e.target.checked)}/>Enable box / lasso subset selection and extended table selection</label><p>Default point clicks add annotations. Selection intersects matching rows; an empty intersection stays empty.</p>
        {tool==='analysis'?<><label><input type="checkbox" checked={!settings.compatibility} onChange={e=>setSettings(s=>({...s,compatibility:!e.target.checked}))}/>Include integer features / choose features</label>{!settings.compatibility&&<div className="feature-list">{dataset.columns.filter(c=>c.kind==='number'&&c.id!==settings.label).map(c=><label key={c.id}><input type="checkbox" checked={settings.features.includes(c.id)} onChange={e=>setSettings(s=>({...s,features:e.target.checked?[...s.features,c.id]:s.features.filter(id=>id!==c.id)}))}/>{c.name}</label>)}</div>}<label><input type="checkbox" checked={settings.standardize} onChange={e=>setSettings(s=>({...s,standardize:e.target.checked}))}/>Standardize features</label><label><input type="checkbox" checked={automatic} onChange={e=>setAutomatic(e.target.checked)}/>Automatically run analysis when data or parameters change</label>{current&&<><div className="settings">{[['Horizontal component',cx,setCx],['Vertical component',cy,setCy],['Depth component',cz,setCz]].map(([label,value,set])=><Select key={String(label)} label={String(label)} value={String(value)} change={v=>(set as (v:number)=>void)(Number(v))}><option value="-1">Zero (one dimension)</option>{current.variance.map((_,i)=><option value={i} key={i}>{current.method==='pca'?'PC':'LD'} {i+1}</option>)}</Select>)}<label><input type="checkbox" checked={threeD} onChange={e=>setThreeD(e.target.checked)}/>3D components</label></div><button onClick={()=>exportAnalysis(true)}>Scores with settings CSV</button>{current.method==='pca'&&<><button onClick={exportLoadings}>Loadings CSV</button><table className="loadings"><thead><tr><th>Feature</th>{current.variance.map((_,i)=><th key={i}>PC {i+1}</th>)}</tr></thead><tbody>{current.loadings.map((r,i)=><tr key={i}><td>{current.features[i]}</td>{r.map((v,j)=><td key={j}>{v.toFixed(6)}</td>)}</tr>)}</tbody></table></>}</>}</>:<div className="settings"><Select label="Chart type" value={plot.type} change={v=>update({type:v as PlotSettings['type']})}>{(tool==='lines'?['line']:['auto','scatter','scatter3d','histogram','box']).map(v=><option key={v}>{v}</option>)}</Select><Select label="Label column" value={plot.label} change={v=>update({label:v})}>{options(true)}</Select><Select label="Group by" value={plot.group} change={v=>update({group:v})}>{options(true)}</Select><label className="field"><span>Point size</span><input type="number" min={1} max={100} value={plot.pointSize} onChange={e=>update({pointSize:Number(e.target.value)})}/></label></div>}
        <div className="actions"><button onClick={()=>void exportData(true)}>Full-column subset CSV</button><button onClick={()=>void image('png')} disabled={tool==='analysis'&&!current}>Download PNG</button></div><details><summary>Column types</summary><div className="types">{dataset.columns.map(c=><Select key={c.id} label={c.name} value={c.kind} change={async v=>{try{const d=await client.current!.request<Dataset>('column',{datasetId:dataset.id,columnId:c.id,kind:v as ColumnKind},undefined,dataset.version);setDatasets(ds=>ds.map(x=>x.id===d.id?d:x));}catch(e){setError((e as Error).message);}}}><option value="number">Numeric (float)</option><option value="text">Text</option><option value="date">Date</option></Select>)}</div></details></div></details>
    </>}
    {!dataset&&<div className="settings empty-settings">{tool==='scatter'?<>{['X','Y','Color','Size','Z'].map(label=><Select key={label} label={label} value="" disabled change={()=>{}}><option value="">Select…</option></Select>)}</>:tool==='lines'?<Select label="Y columns" value="" disabled change={()=>{}}><option value="">Select…</option></Select>:<Select label="Classes" value="" disabled change={()=>{}}><option value="">None</option></Select>}</div>}
    {!dataset&&quickExample&&<div className="quick-examples"><p>Try an example:</p>{examples.map(e=><button key={e.id} onClick={()=>quickExample(e)}>{e.title}</button>)}</div>}
    {table&&dataset&&<div className="modal-backdrop" onClick={()=>setTable(false)}><section role="dialog" aria-modal="true" aria-labelledby="data-title" className="data-modal" onClick={e=>e.stopPropagation()}><div className="modal-heading"><h2 id="data-title">Data: {dataset.name}</h2><button aria-label="Close data" onClick={()=>setTable(false)}>×</button></div><p>Read-only · 50 rows per page · Filters use contains, =, !=, &gt;, &gt;=, &lt;, &lt;=, datestartswith. Select rows across pages to keep their intersection with filters.</p><div className="table-scroll"><table><thead><tr>{rowSelectable&&<th><input type="checkbox" aria-label="Select page" checked={!!query?.rows.length&&query.rows.every(r=>view.selected.includes(r.id))} onChange={e=>{const ids=query?.rows.map(r=>r.id)??[];setView(s=>({...s,selected:e.target.checked?[...new Set([...s.selected,...ids])]:s.selected.filter(id=>!ids.includes(id))}));}}/></th>}{tableColumns.map(c=><th key={c.id}>{sortable?<button onClick={()=>setView(s=>({...s,sort:s.sort?.column===c.id&&s.sort.direction==='desc'?undefined:{column:c.id,direction:s.sort?.column===c.id&&s.sort.direction==='asc'?'desc':'asc'}}))}>{c.name}{view.sort?.column===c.id?(view.sort.direction==='asc'?' ↑':' ↓'):''}</button>:c.name}</th>)}</tr>{filterable&&<tr>{rowSelectable&&<th/>}{tableColumns.map(c=><th key={c.id}><input aria-label={`Filter ${c.name}`} value={filters[c.id]??''} placeholder="Filter…" onChange={e=>columnFilter(c.id,e.target.value)}/></th>)}</tr>}</thead><tbody>{query?.rows.map(r=><tr key={r.id} className={view.selected.includes(r.id)?'selected-row':''}>{rowSelectable&&<td><input type="checkbox" aria-label={`Select row ${r.id+1}`} checked={view.selected.includes(r.id)} onChange={()=>setView(s=>({...s,selected:s.selected.includes(r.id)?s.selected.filter(id=>id!==r.id):[...s.selected,r.id]}))}/></td>}{tableColumns.map(c=><td key={c.id}>{String(r.values[dataset.columns.findIndex(col=>col.id===c.id)]??'')}</td>)}</tr>)}{!query?.rows.length&&<tr><td colSpan={tableColumns.length+1}>No matching rows.</td></tr>}</tbody></table></div><div className="pagination"><span>{query?.matching?`${page*50+1}–${Math.min((page+1)*50,query.matching)} of ${query.matching}`:'0 matching rows'}</span><button onClick={()=>setPage(p=>p-1)} disabled={!page}>Previous page</button><span>Page {page+1} of {Math.max(1,query?.pageCount??1)}</span><button onClick={()=>setPage(p=>p+1)} disabled={page+1>=(query?.pageCount??0)}>Next page</button><button onClick={()=>{setFilters({});setView(s=>({...s,filters:[],selected:[],sort:undefined}));setPage(0);}}>Reset table</button></div></section></div>}
    {example&&<p className="source-note">Example provenance, licenses and checksums: <a href={`${import.meta.env.BASE_URL}examples/provenance.json`} target="_blank" rel="noreferrer">data manifest</a>. {example.id.startsWith('oxygen')?'Table S2 is published under CC BY-NC-ND 4.0; the original workbook is distributed unchanged.':example.id==='stocks'?'S&P 500 historical index data replaces the unavailable original company stocks.':'UCI public research data.'}</p>}
  </section>;
}
function Help() { return <article className="help"><h1>Help</h1><h2>Start with your data</h2><p>Upload CSV, TSV, TXT/DAT (comma, tab, semicolon, pipe or whitespace), XLSX, XLS or ODS. The first nonempty row contains column names. Duplicate names are distinguished and reported. Each worksheet is separate. Clear Data to upload again. Each tool has an independent session; navigating away releases that session.</p><p>Limits: 20 MB per import, 100,000 rows per sheet and 1,000,000 cells across loaded sheets. Imports are rejected as a whole rather than truncated. Your files stay in page memory. Clear, refresh or close to release them. No accounts, uploads or persistent data storage.</p><h2>Scatter</h2><p>The first column supplies labels by default. Choose X alone for a histogram; choose X and Y for a scatter plot, or a box plot when X is text or an integer with at most 20 distinct values and no color is specified. Box plots show all raw points. Numeric continuous colors use Jet; discrete colors create traces. Sizes map to diameters 10–40, or 25 for constant/incomplete values. Switch to 3D and choose Z. Linear / Log controls apply to numeric axes.</p><p>Hover to inspect. Click a 2D point to add an annotation, click it again to remove. Click legend items to toggle traces; double-click to isolate. Drag to zoom, double-click to reset. The hover toolbar supports pan, zoom, reset and SVG download. Most figure elements are editable. Advanced explicitly enables box / lasso selection to change the data subset.</p><h2>Lines</h2><p>Type 1 shares the first column as X for all selected Y columns. Type 2 uses adjacent X/Y pairs: columns 1/2, 3/4 and so on. Use Ctrl/Cmd or Shift to select multiple Y columns. Lines connect points in file row order; sorting the table changes display order. Date X axes support stock example year ranges.</p><h2>Data table and exports</h2><p>View Data opens a read-only table with 50 rows per page. Scatter and Type 1 lines allow sorting and selection; PCA/LDA allows filters; Type 2 lines keeps a plain preview. Filter expressions combine with AND. Examples: &gt;= 5, = "setosa", contains "MOF", datestartswith "2021". Contains uses case-sensitive regular expressions, as in the reference.</p><p>Charts, analysis and exports use matching rows intersected with selected rows; if nothing is selected all matching rows are active. Selection persists across pages. Sorting alone preserves the row set. An empty intersection stays empty. Default CSV contains displayed columns; analysis CSV has PC/LD scores and Individual/Cumulative variance in the first component-count rows. Advanced offers full-column subset CSV, scores with features/settings, PCA loadings and PNG. SVG from WebGL / 3D contains raster layers.</p><h2>PCA / LDA</h2><p>By default only floating-point features are used, excluding the class column. Integer-valued columns are available in Advanced. PCA standardizes by default; LDA does not. LDA requires two or more classes and more complete rows than classes. Classes defaults to None for PCA and the first eligible class for LDA. Default candidate classes are text or have fewer than ten distinct values.</p><p>Analysis runs automatically after changes, downloading a pinned scientific engine on first use. Projection and variance appear together. The legacy variance axis reads “Variance (%)”, but values are ratios from 0 to 1, matching the reference. LDA display is negated to match the reference, while CSV keeps the computed scores. One dimension is shown on a horizontal line. Missing/infinite rows and constant features are removed and counted. Invalid or degenerate inputs produce a clear error. Cancel terminates the worker and stops automatic retries until Run analysis. Old results immediately become invalid when inputs change. Advanced supports manual mode and component controls.</p><h2>Examples and compatibility</h2><p>Oxygen uses the unchanged published Wiz Table S2. Both examples show all rows immediately. Start replay optionally adds 150 existing rows every 3 seconds; Show all rows stops replay and restores the full view. Replay stops at completion, and worksheet changes show all rows. These are published measurements, not live data. Stocks uses fixed historical S&P 500 index data (Figshare v1), replacing the empty legacy example. Wine and Iris use public UCI data; a synthetic time series is in Advanced examples.</p><p>This is an independent implementation targeting Kesler Wiz commit ff94a3805889f76c050fbea7f9b1bf6d4b15dfab, not its original restricted source. Browser execution, bug fixes, public-data replacements and Advanced extensions are documented in the repository. All computation is in your browser; the fixed-version CDN receives requests for scientific code, never your dataset.</p><a href="https://github.com/vickie02736/Wiz.io/blob/main/COMPATIBILITY.md">Compatibility and verification notes</a></article>; }
