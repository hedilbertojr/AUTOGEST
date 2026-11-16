const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist')
  throw new Error('Diretório de saída inesperado.');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(path.join(root, 'frontend'), output, {
  recursive: true,
  filter: (source) => !['tests', 'package.json'].includes(path.basename(source)),
});
const index = path.join(output, 'index.html');
fs.writeFileSync(
  index,
  fs
    .readFileSync(index, 'utf8')
    .replace(
      '<head>',
      '<head>\n<meta name="autogest-mode" content="demo">\n<meta name="description" content="AutoGest: demonstração interativa de gestão de oficina, com clientes, estoque, orçamentos e ordens de serviço.">',
    ),
);
buildSync({
  entryPoints: [path.join(root, 'frontend/js/demo/runtime.js')],
  outfile: path.join(output, 'js/demo/runtime.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['es2022'],
  minify: true,
  legalComments: 'none',
});
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log('Demo estática criada em dist/. Nenhum banco, segredo ou cadastro local foi incluído.');
