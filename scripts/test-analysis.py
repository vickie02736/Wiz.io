"""Scientific edge cases and fixed-reference values, using the locked reference Python."""
import json,pathlib,unittest,numpy as np
root=pathlib.Path(__file__).resolve().parents[1]
namespace={};exec((root/'src/analysis.py').read_text(),namespace);analyze=namespace['analyze']
oracle=json.loads((root/'tests/reference/oracle.json').read_text())
def run(matrix,method='pca',labels=None,scale=None):
 return json.loads(analyze(json.dumps(dict(matrix=matrix,rowIds=list(range(len(matrix))),labels=labels or [None]*len(matrix),featureNames=[f'f{i}' for i in range(len(matrix[0]))],settings=dict(method=method,label='class' if method=='lda' else '',standardize=method=='pca' if scale is None else scale,compatibility=True)))))
class Science(unittest.TestCase):
 def test_fixed_reference_scores_ratios_and_direction(self):
  for method in ['pca','lda']:
   c=oracle['cases'][method];matrix=[r[1:4] for r in c['table'][1:]];r=run(matrix,method,[v[-1] for v in c['table'][1:]])
   for field in ['scores','variance','cumulative']:np.testing.assert_allclose(r[field],c[field],rtol=1e-7,atol=1e-8)
 def test_missing_nonfinite_then_constant_removal(self):
  r=run([[1.,4.],[2.,4.],[3.,4.],[None,4.],[float('inf'),4.]])
  self.assertEqual(r['droppedRows'],2);self.assertEqual(r['rowIds'],[0,1,2]);self.assertEqual(r['droppedFeatures'],['f1']);self.assertEqual(len(r['variance']),1)
 def test_integer_advanced_input(self):
  self.assertEqual(len(run([[1,2],[2,1],[3,3]])['scores']),3)
 def test_sample_class_and_degenerate_errors(self):
  for matrix,method,labels,pattern in [([[1.]],'pca',None,'two'),([[1.],[1.]],'pca',None,'constant'),([[None],[1.]],'pca',None,'complete'),([[1.],[2.]],'lda',['A','A'],'two classes'),([[1.],[2.]],'lda',['A','B'],'more complete'),([[1.],[1.],[2.],[2.]],'lda',['A','A','B','B'],'')]:
   with self.subTest(matrix=matrix,method=method):
    with self.assertRaises(Exception):run(matrix,method,labels)
 def test_two_class_single_dimension(self):
  r=run([[0.],[1.],[2.],[3.]],'lda',['A','A','B','B']);self.assertEqual(len(r['variance']),1);np.testing.assert_allclose(np.diff(np.array(r['scores'])[:,0]),np.sqrt(2),rtol=1e-7,atol=1e-8)
 def test_repeated_eigenvalues_compare_subspace(self):
  X=np.array([[1.,0.,0.],[-1.,0.,0.],[0.,1.,0.],[0.,-1.,0.],[0.,0.,1.],[0.,0.,-1.]])
  r=run(X.tolist());np.testing.assert_allclose(r['variance'],[1/3]*3,rtol=1e-7,atol=1e-8)
  S=np.array(r['scores']);np.testing.assert_allclose(S@S.T,3*X@X.T,rtol=1e-7,atol=1e-8)
if __name__=='__main__':unittest.main()
