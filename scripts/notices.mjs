import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const packages = ['react', 'react-dom', 'plotly.js-dist-min', 'papaparse', 'xlsx', 'lucide-react'];
let notices = '# Bundled library licenses\n\nGenerated from the installed, locked dependency packages.\n';
for (const name of packages) {
  const manifest = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'));
  notices += `\n## ${name} ${manifest.version}\n\n` + readFileSync(`node_modules/${name}/LICENSE`, 'utf8') + '\n';
}
writeFileSync('DEPENDENCY_LICENSES.md', notices);
mkdirSync('docs', { recursive: true });
writeFileSync('docs/dependency-licenses.txt', notices);
