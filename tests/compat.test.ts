import { describe,it,expect } from 'vitest';
import oracle from './reference/oracle.json';
import { normalizeTable,resolveRows } from '../src/data';
import { defaultPlot,legacyFeatures,parseColumnFilter,plottedColumns,bubbleSizes } from '../src/compat';
import { makePlot } from '../src/plotModel';
import type { PlotSettings } from '../src/types';
function chart(table: any[][],patch: Partial<PlotSettings>) {
 const d=normalizeTable(table,'reference','reference'),s={...defaultPlot,label:'c0',...patch};
 const columns=plottedColumns(d,s);const {active}=resolveRows(d,{filters:[],selected:[]});
 return makePlot(d,{active:active.length,matching:active.length,rows:[],pageCount:1,plot:{columns,rows:active.map(r=>({id:r.id,values:columns.map(c=>r.values[d.columns.findIndex(x=>x.id===c)])}))}},s);
}
describe('fixed legacy graph oracle',()=>{
 for(const name of ['histogram','scatter','continuous','categorical','box','3d','lines1','lines2'] as const){
  it(`replays ${name} data and supported marker configuration`,()=>{
   const c=oracle.cases[name];const patch:Partial<PlotSettings>=name.startsWith('lines')?{type:'line',lineInputType:name==='lines1'?1:2,yColumns:name==='lines1'?['c1','c2']:['c1','c3']}:{x:'c1',y:name==='histogram'?'':'c2',color:['continuous','categorical','3d'].includes(name)?'c3':'',size:['continuous','categorical','3d'].includes(name)?'c4':'',type:name==='3d'?'scatter3d':'auto',z:name==='3d'?'c5':''};
   const model=chart(c.table,patch);expect(model.traces).toHaveLength(c.traces.length);
   model.traces.forEach((trace,i)=>{const old:any=c.traces[i];for(const key of ['type','x','y','z','mode','opacity','boxpoints','jitter','pointpos','hoverinfo'])if(old[key]!==undefined)expect(trace[key],`${name}.${key}`).toEqual(old[key]);for(const key of ['size','sizemode','opacity','line'])if(old.marker?.[key]!==undefined)expect(trace.marker[key],`${name}.marker.${key}`).toEqual(old.marker[key]);});
  });
 }
 it('matches reference axes, font, margins, and log configuration',()=>{
  const model=chart(oracle.cases.continuous.table,{x:'c1',y:'c2',color:'c3',size:'c4',yScale:'log'});const old=oracle.cases.continuous.layout;
  for(const key of ['font','margin','legend','hovermode'])expect(model.layout[key]).toEqual(old[key as keyof typeof old]);
  for(const axis of ['xaxis','yaxis'] as const)for(const key of ['showline','linewidth','linecolor','mirror','ticks','zeroline','automargin','autorange','type'])expect(model.layout[axis][key]).toEqual((old[axis] as any)[key]);
 });
});
describe('compatibility and corrected boundaries',()=>{
 it('retains source float versus integer inference and excludes class',()=>{
  const d=normalizeTable([['label','integer','float','decimal','missing','class'],['a','1','1.0','2.5','4','A'],['b','2','2.0','4.5',null,'B']],'test','test');
  expect(d.columns.map(c=>c.legacyType)).toEqual(['text','integer','float','float','float','text']);expect(legacyFeatures(d,'c3')).toEqual(['c2','c4']);
 });
 it('uses legacy grammar, regex, numeric comparison, and stable row selection',()=>{
  const d=normalizeTable([['label','x'],['alpha','1.0'],['beta','2.0'],['alphabet','3.0']],'test','test');
  expect(resolveRows(d,{filters:[parseColumnFilter('c0','contains "^alpha"')!],selected:[0,1]}).active.map(r=>r.id)).toEqual([0]);
  expect(resolveRows(d,{filters:[parseColumnFilter('c1','ge 2')!],selected:[]}).active.map(r=>r.id)).toEqual([1,2]);
  expect(()=>resolveRows(d,{filters:[parseColumnFilter('c0','contains "["')!],selected:[]})).toThrow(/regular expression/);
 });
 it('never samples large plots and normalizes constant / missing sizes safely',()=>{
  expect(bubbleSizes([3,3])).toEqual([25,25]);expect(bubbleSizes([1,null])).toEqual([25,25]);expect(bubbleSizes([1,2,3])).toEqual([10,25,40]);
  const table=[['label','x','y'],...Array.from({length:8000},(_,i)=>[String(i),i+.1,i+.2])];const m=chart(table,{x:'c1',y:'c2'});expect(m.traces[0].type).toBe('scattergl');expect(m.traces[0].x).toHaveLength(8000);
 });
 it('click annotations keep log positions and do not change the row set',()=>{
  const m=chart(oracle.cases.scatter.table,{x:'c1',y:'c2',xScale:'log',annotation:{x:10,y:3.4,text:'a',key:'1'}});expect(m.layout.annotations[0].x).toBe(1);expect(m.traces[0].x).toHaveLength(3);
 });
});
describe('analysis display conventions',()=>{
 it('negates only LDA display and leaves exported scientific scores untouched',()=>{
  const result={method:'lda' as const,scores:[[1,2],[3,4]],rowIds:[0,1],labels:['A','B'],variance:[.7,.3],cumulative:[.7,1],loadings:[],features:['x','y'],droppedRows:0,droppedFeatures:[],standardize:false};
  const d=normalizeTable([['label','x'],['a',1],['b',2]],'test','test');const m=makePlot(d,undefined,defaultPlot,{result});expect(m.traces[0].x).toEqual([-1]);expect(result.scores).toEqual([[1,2],[3,4]]);expect(makePlot(d,undefined,defaultPlot,{result,variance:true}).traces[0].y).toEqual([.7,.3]);
 });
});
it('matches legacy 3D geometry, smaller scene fonts and zero margins',()=>{
 const m=chart(oracle.cases['3d'].table,{x:'c1',y:'c2',color:'c3',size:'c4',z:'c5',type:'scatter3d'}),old=oracle.cases['3d'].layout;
 expect(m.layout.font).toEqual(old.font);expect(m.layout.margin).toEqual(old.margin);expect(m.layout.scene.aspectratio).toEqual(old.scene.aspectratio);
 for(const name of ['xaxis','yaxis','zaxis'] as const){expect(m.layout.scene[name].type).toEqual(old.scene[name].type);expect(m.layout.scene[name].nticks).toEqual(old.scene[name].nticks);expect(m.layout.scene[name].title.font.size).toBe(18);}
});
