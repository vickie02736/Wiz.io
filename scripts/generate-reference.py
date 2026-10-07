"""Run the user's separately obtained legacy checkout; never vendor its restricted source."""
import os,sys,subprocess,json,pathlib,hashlib
import numpy as np,pandas as pd,scipy,sklearn,plotly
from plotly.utils import PlotlyJSONEncoder
root=pathlib.Path(os.environ['WIZ_REFERENCE_DIR']).resolve()
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
assert sha=='ff94a3805889f76c050fbea7f9b1bf6d4b15dfab'
assert [np.__version__,pd.__version__,scipy.__version__,sklearn.__version__,plotly.__version__]==['1.24.4','1.5.3','1.10.1','1.4.2','5.13.1']
app_root=pathlib.Path(__file__).resolve().parents[1]
os.chdir(root)
sys.path.insert(0,str(root))
from functions.app_main import graph as scatter
from functions.lines import graph as lines
from functions.pca import data as analysis
cases={}
def store(name,table,fn,*args):
 df=pd.DataFrame(table[1:],columns=table[0]);result=fn(df,*args)
 cases[name]={'table':table,'traces':result}
 return df
store('histogram',[['sample','x'],['a',1.2],['b',3.4],['c',2.1]],scatter.histogram_data)
store('scatter',[['sample','x','y'],['a',1.2,3.4],['b',3.4,2.1],['c',2.1,4.2]],scatter.scatter_2D_data)
df=store('continuous',[['sample','x','y','color','size'],['a',1.2,3.4,0.2,1.0],['b',3.4,2.1,0.5,2.0],['c',2.1,4.2,0.9,3.0]],scatter.scatter_2D_data)
cases['continuous']['layout']=scatter.scatter_2D_layout(df,'linear','log',None)
store('categorical',[['sample','x','y','color','size'],['a',1.2,3.4,'A',1.0],['b',3.4,2.1,'B',2.0],['c',2.1,4.2,'A',3.0]],scatter.scatter_2D_data)
store('box',[['sample','group','y'],['a',1,3.4],['b',2,2.1],['c',1,4.2]],scatter.scatter_2D_data)
df3=store('3d',[['sample','x','y','color','size','z'],['a',1.2,3.4,0.2,1.0,7.2],['b',3.4,2.1,0.5,2.0,2.3],['c',2.1,4.2,0.9,3.0,5.3]],scatter.scatter_3D_data)
cases['3d']['layout']=scatter.scatter_3D_layout(df3,'linear','linear')
store('lines1',[['x','y','z'],[3.0,1.5,2.1],[1.0,2.5,5.2],[2.0,3.5,3.2]],lines.lines_type1_data)
store('lines2',[['x1','y1','x2','y2'],[3.0,1.5,4.0,2.1],[1.0,2.5,6.0,5.2],[2.0,3.5,5.0,3.2]],lines.lines_type2_data)
table=[['sample','x','y','z','integer','class'],['a',1.2,2.3,1.9,2,'A'],['b',2.8,1.2,1.5,4,'A'],['c',3.7,2.7,3.1,6,'A'],['d',4.1,4.7,4.2,8,'B'],['e',5.6,3.8,2.4,10,'B'],['f',6.3,6.9,4.8,12,'B'],['g',7.2,5.4,7.1,14,'C'],['h',8.5,8.2,6.3,16,'C'],['i',9.1,7.6,9.2,18,'C']]
df=pd.DataFrame(table[1:],columns=table[0])
for method,fn in [('pca',analysis.PCA),('lda',analysis.LDA)]:
 scores,variance,cumulative=fn(df,'class');cases[method]={'table':table,'scores':scores,'variance':variance,'cumulative':cumulative,'features':['x','y','z']}
out={'reference':sha,'environment':{'python':sys.version.split()[0],'numpy':np.__version__,'pandas':pd.__version__,'scipy':scipy.__version__,'scikit-learn':sklearn.__version__,'plotly':plotly.__version__,'plotly.js':'2.18.2'},'cases':cases}
path=app_root/'tests/reference/oracle.json';path.write_text(json.dumps(out,cls=PlotlyJSONEncoder,indent=2)+'\n');print('Wrote',path,hashlib.sha256(path.read_bytes()).hexdigest())
