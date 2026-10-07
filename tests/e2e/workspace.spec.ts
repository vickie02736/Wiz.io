import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import fs from 'node:fs/promises';
import path from 'node:path';
async function iris(page:any){await page.goto('./');await page.getByRole('button',{name:/Iris flowers/}).click();await expect(page.getByTestId('active-count')).toHaveText('150');await expect(page.locator('.js-plotly-plot')).toBeVisible();}
test('loads an example, selects rows, filters and exports the same active subset',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const sent:string[]=[];page.on('request',r=>{if(r.method()!=='GET')sent.push(r.url());});
  await iris(page);await page.getByRole('checkbox',{name:'Select row 1',exact:true}).check();await page.getByRole('checkbox',{name:'Select row 2',exact:true}).check();await expect(page.getByTestId('active-count')).toHaveText('2');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export data',exact:true}).click();const file=await download;const csv=await fs.readFile((await file.path())!,'utf8');expect(csv).toContain('iris-1');expect(csv).toContain('iris-2');expect(csv).not.toContain('iris-3,');
  await page.getByRole('button',{name:/Filters/}).click();await page.getByRole('button',{name:'Add condition'}).click();await page.getByLabel('Filter 1 column').selectOption({label:'class'});await page.getByLabel('Filter 1 operator').selectOption('eq');await page.getByLabel('Filter 1 value').fill('virginica');
  await expect(page.getByTestId('matching-count')).toHaveText('50');await expect(page.getByTestId('active-count')).toHaveText('0');await page.getByRole('button',{name:'Clear selection',exact:true}).click();await expect(page.getByTestId('active-count')).toHaveText('50');
  await page.getByRole('button',{name:'Clear all data'}).click();await expect(page.getByRole('heading',{name:'From data to discovery.'})).toBeVisible();expect(sent).toEqual([]);expect(errors).toEqual([]);
});
test('imports every supported format including multiple workbook sheets',async({page})=>{
  await page.goto('./');
  for(const [extension,text] of [['csv','sample,x,y\nprivate-sentinel,1,2\nb,3,4'],['tsv','sample\tx\ty\na\t1\t2\nb\t3\t4'],['txt','sample x y\na 1 2\nb 3 4'],['dat','sample;x;y\na;1;2\nb;3;4']]){
    await page.getByLabel('Import files').setInputFiles({name:`data.${extension}`,mimeType:'text/plain',buffer:Buffer.from(text)});await expect(page.getByTestId('active-count')).toHaveText('2');
  }
  for(const [extension,bookType] of [['xlsx','xlsx'],['xls','biff8'],['ods','ods']] as const){
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['sample','x','y'],['a',1,2],['b',3,4]]),'One');XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['sample','x'],['c',5]]),'Two');
    await page.getByLabel('Import files').setInputFiles({name:`book.${extension}`,mimeType:'application/octet-stream',buffer:XLSX.write(book,{type:'buffer',bookType})});await expect(page.getByTestId('active-count')).toHaveText('2');await page.getByLabel('Active dataset').selectOption({label:`book.${extension} · Two`});await expect(page.getByTestId('active-count')).toHaveText('1');
  }
});
test('draws all chart types and exports images',async({page},testInfo)=>{
  await iris(page);
  for(const type of ['histogram','box','line','scatter']){await page.getByLabel('Chart type').selectOption(type);await expect(page.locator('.js-plotly-plot')).toBeVisible();await expect(page.locator('.plot-error')).toHaveCount(0);}
  if(testInfo.project.name==='chromium'){await page.getByLabel('Chart type').selectOption('scatter3d');await expect(page.locator('.gl-container canvas')).toBeVisible();await expect(page.locator('.plot-error')).toHaveCount(0);}
  for(const format of ['PNG','SVG']){const download=page.waitForEvent('download');await page.getByRole('button',{name:format,exact:true}).click();expect((await download).suggestedFilename()).toContain(format.toLowerCase());}
});
test('handles analysis load failure, cancellation and retry',async({page})=>{
  await iris(page);await page.getByRole('button',{name:'PCA / LDA'}).click();await page.route('https://cdn.jsdelivr.net/pyodide/**',route=>route.abort());await page.locator('.run-analysis').click();await expect(page.getByRole('alert')).toContainText('Analysis failed');await expect(page.locator('.run-analysis')).toBeEnabled();await page.unroute('https://cdn.jsdelivr.net/pyodide/**');
  await page.route('https://cdn.jsdelivr.net/pyodide/**',async route=>{await new Promise(r=>setTimeout(r,2000));await route.continue().catch(()=>{});});await page.locator('.run-analysis').click();await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.run-analysis')).toBeEnabled();await page.unroute('https://cdn.jsdelivr.net/pyodide/**');
});
test('runs real PCA and LDA and marks changed results out of date',async({page})=>{
  await iris(page);await page.getByRole('button',{name:'PCA / LDA'}).click();await page.locator('.run-analysis').click();await expect(page.getByRole('heading',{name:'PCA · Component projection'})).toBeVisible({timeout:150000});await expect(page.locator('.card-heading p').filter({hasText:'150 analyzed rows'})).toBeVisible();
  await page.getByRole('button',{name:'Variance',exact:true}).click();await expect(page.getByRole('heading',{name:'PCA · Explained variance'})).toBeVisible();await page.getByRole('button',{name:'Loadings',exact:true}).click();await expect(page.getByRole('cell',{name:'sepal length (cm)',exact:true})).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export loadings'}).click();expect((await download).suggestedFilename()).toContain('loadings');
  await page.getByLabel('Analysis method').selectOption('lda');await expect(page.getByText('This result is out of date.',{exact:false})).toBeVisible();await page.locator('.run-analysis').click();await expect(page.getByRole('heading',{name:'LDA · Component projection'})).toBeVisible({timeout:150000});
  await page.getByRole('checkbox',{name:'Select row 1',exact:true}).check();await expect(page.getByText('This result is out of date.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Export scores'})).toBeDisabled();
});
test('handles one-dimensional and invalid analysis data',async({page})=>{
  await page.goto('./');await page.getByLabel('Import files').setInputFiles({name:'one.csv',mimeType:'text/csv',buffer:Buffer.from('label,x,constant,class\na,1,4,A\nb,2,4,A\nc,3,4,B\nd,,4,B')});await expect(page.getByTestId('active-count')).toHaveText('4');await page.getByRole('button',{name:'PCA / LDA'}).click();await page.locator('.run-analysis').click();await expect(page.getByRole('heading',{name:'PCA · Component projection'})).toBeVisible({timeout:150000});await expect(page.getByText('1 incomplete rows excluded · Constant features excluded: constant')).toBeVisible();await expect.poll(()=>page.locator('.js-plotly-plot').evaluate((el:any)=>el.data?.every((trace:any)=>trace.y.every((v:number)=>v===0)))).toBe(true);
  await page.getByLabel('Analysis method').selectOption('lda');await page.getByLabel('Class label').selectOption('');await page.locator('.run-analysis').click();await expect(page.getByRole('alert')).toContainText('LDA requires a class label');
});
test('works at mobile width and keeps data out of storage and network payloads',async({page})=>{
  await page.setViewportSize({width:390,height:844});const requests:string[]=[];page.on('request',r=>requests.push(r.url()+(r.postData()??'')));await page.goto('./');await page.getByLabel('Import files').setInputFiles({name:'private.csv',mimeType:'text/csv',buffer:Buffer.from('label,x,y\nUNIQUE_PRIVATE_SENTINEL_9724,1,2\na,3,4')});await expect(page.getByTestId('active-count')).toHaveText('2');expect(requests.some(r=>r.includes('UNIQUE_PRIVATE_SENTINEL_9724'))).toBe(false);expect(await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}))).toEqual({local:[],session:[]});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.reload();await expect(page.getByRole('heading',{name:'From data to discovery.'})).toBeVisible();
});
test('matches analytical PCA and LDA reference values, independent of component signs',async({page})=>{
  await page.goto('./');
  await page.getByLabel('Import files').setInputFiles({name:'reference.csv',mimeType:'text/csv',buffer:Buffer.from('sample,x,y\na,1,2\nb,2,1\nc,3,3')});
  await expect(page.getByTestId('active-count')).toHaveText('3');await page.getByRole('button',{name:'PCA / LDA'}).click();await page.locator('.run-analysis').click();await expect(page.getByRole('heading',{name:'PCA · Component projection'})).toBeVisible({timeout:150000});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export scores'}).click();const csv=await fs.readFile((await (await download).path())!,'utf8');
  const records=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/).slice(1).map(line=>line.split(','));const scores=records.map(row=>[Number(row[2]),Number(row[3])]);
  const gram=[[1.5,0,-1.5],[0,1.5,-1.5],[-1.5,-1.5,3]];for(let i=0;i<3;i++)for(let j=0;j<3;j++)expect(scores[i][0]*scores[j][0]+scores[i][1]*scores[j][1]).toBeCloseTo(gram[i][j],7);
  await page.getByRole('button',{name:'Variance',exact:true}).click();await expect.poll(()=>page.locator('.js-plotly-plot').evaluate((el:any)=>el.data?.[0]?.type)).toBe('bar');const variance=await page.locator('.js-plotly-plot').evaluate((el:any)=>el.data[0].y);expect(variance[0]).toBeCloseTo(75,7);expect(variance[1]).toBeCloseTo(25,7);
  await page.getByLabel('Import files').setInputFiles({name:'lda-reference.csv',mimeType:'text/csv',buffer:Buffer.from('sample,x,class\na,0,A\nb,1,A\nc,2,B\nd,3,B')});await expect(page.getByTestId('active-count')).toHaveText('4');await page.getByRole('button',{name:'PCA / LDA'}).click();await page.getByLabel('Analysis method').selectOption('lda');await page.getByRole('checkbox',{name:'Standardize features'}).uncheck();await page.locator('.run-analysis').click();await expect(page.getByRole('heading',{name:'LDA · Component projection'})).toBeVisible({timeout:150000});
  const ldaDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export scores'}).click();const ldaCsv=await fs.readFile((await(await ldaDownload).path())!,'utf8');const ldaScores=ldaCsv.replace(/^\uFEFF/,'').trim().split(/\r?\n/).slice(1).map(line=>Number(line.split(',')[2]));for(let i=0;i<3;i++)expect(Math.abs(ldaScores[i+1]-ldaScores[i])).toBeCloseTo(Math.SQRT2,7);
});
