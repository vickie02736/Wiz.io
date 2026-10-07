import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { csvFor, LIMITS, normalizeTable, numberValue, parseFile, resolveRows, typedCell } from '../src/data';
const table = [['label','value','group'],['a',1,'A'],['b',2,'B'],['c',3,'A'],['d',null,'B']];
describe('data integrity', () => {
  it('keeps stable row IDs across filters, sorting and selection', () => {
    const d = normalizeTable(table,'test','test');
    const rows = resolveRows(d,{filters:[{column:'c1',op:'gte',value:'2'}],selected:[0,2],sort:{column:'c1',direction:'desc'}});
    expect(rows.matching.map(r=>r.id)).toEqual([2,1]); expect(rows.active.map(r=>r.id)).toEqual([2]);
    expect(csvFor(d,rows.active)).toContain('c,3,A'); expect(csvFor(d,rows.active)).not.toContain('b,2,B');
  });
  it('never falls back to all rows for an empty selection intersection', () => {
    const d = normalizeTable(table,'test','test');
    expect(resolveRows(d,{filters:[{column:'c1',op:'gt',value:'2'}],selected:[0]}).active).toEqual([]);
  });
  it('distinguishes duplicate and blank column names, preserving source values', () => {
    const d=normalizeTable([['x','x',''],['01','text',5]],'test','test');
    expect(d.columns.map(c=>c.name)).toEqual(['x','x (2)','Column 3']); expect(d.warnings).toHaveLength(1); expect(d.rows[0].values[0]).toBe('01');
  });
  it('supports explicit numeric type corrections without treating empty strings as zero', () => {
    expect(typedCell('', 'number')).toBeNull(); expect(typedCell('no', 'number')).toBeNull(); expect(numberValue('1.2e3')).toBe(1200); expect(numberValue('Infinity')).toBe(Infinity);
  });
  it('rejects empty datasets and rows wider than their header', () => {
    expect(()=>normalizeTable([],'test','test')).toThrow(/header/);
    expect(()=>normalizeTable([['x'],[1,2]],'test','test')).toThrow(/more fields/);
  });
  it('enforces row and cell limits without truncation', () => {
    expect(()=>normalizeTable([['x'],...Array.from({length:LIMITS.rows+1},()=>[1])],'big','big')).toThrow(/row limit/);
    expect(()=>normalizeTable([Array(11).fill('x'),...Array.from({length:91_000},()=>Array(11).fill(1))],'big','big')).toThrow(/cell limit/);
  });
  it('compares dates and combines filter conditions', () => {
    const d=normalizeTable([['date','group'],['2025-01-01','A'],['2025-02-01','A'],['2025-03-01','B']],'dates','dates');
    expect(d.columns[0].kind).toBe('date');
    expect(resolveRows(d,{filters:[{column:'c0',op:'gt',value:'2025-01-15'},{column:'c1',op:'eq',value:'A'}],selected:[]}).active.map(r=>r.id)).toEqual([1]);
  });
  it('escapes spreadsheet formulas in exports', () => {
    const d=normalizeTable([['text'],['=1+1']],'test','test');expect(csvFor(d,d.rows)).toContain("'=1+1");
  });
});
describe('import formats',()=>{
  for(const [extension,text] of [['csv','label,value\na,1\nb,2'],['tsv','label\tvalue\na\t1\nb\t2'],['txt','label value\na 1\nb 2'],['dat','label;value\na;1\nb;2']] as const){
    it(`imports ${extension}`,async()=>{const d=await parseFile(new File([text],`sample.${extension}`));expect(d[0].rowCount).toBe(2);expect(d[0].columns[1].kind).toBe('number');});
  }
  for(const [extension,bookType] of [['xlsx','xlsx'],['xls','biff8'],['ods','ods']] as const){
    it(`imports all sheets from ${extension}`,async()=>{
      const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(table),'First');XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['x','y'],[1,2]]),'Second');
      const bytes=XLSX.write(book,{type:'array',bookType});const d=await parseFile(new File([bytes],`sample.${extension}`));expect(d).toHaveLength(2);expect(d[0].rowCount).toBe(4);expect(d[1].rowCount).toBe(1);
    });
  }
  it('rejects unsupported formats and oversize files',async()=>{
    await expect(parseFile(new File(['x\na'],'a.json'))).rejects.toThrow(/use CSV/);
    await expect(parseFile(new File([new Uint8Array(LIMITS.bytes+1)],'huge.csv'))).rejects.toThrow(/20 MB/);
  });
});
