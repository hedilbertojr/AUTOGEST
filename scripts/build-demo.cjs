const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist')
  throw new Error('Diretório de saída inesperado.');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
const frontend = path.join(root, 'frontend');
fs.cpSync(frontend, output, {
  recursive: true,
  filter: (source) =>
    !['tests', 'package.json'].includes(path.basename(source)) &&
    source !== path.join(frontend, 'js'),
});
// Content-addressed assets prevent browsers from mixing files from different deployments.
const result = buildSync({
  entryPoints: [path.join(frontend, 'js/app.js')],
  outdir: path.join(output, 'js'),
  entryNames: 'app-[hash]',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['es2022'],
  minify: true,
  legalComments: 'none',
  metafile: true,
});
const entry = Object.entries(result.metafile.outputs).find(([, metadata]) => metadata.entryPoint);
const stylesheet = path.join(output, 'css/style.css');
const styleHash = createHash('sha256')
  .update(fs.readFileSync(stylesheet))
  .digest('hex')
  .slice(0, 12);
const styleName = `style-${styleHash}.css`;
fs.renameSync(stylesheet, path.join(output, 'css', styleName));
const index = path.join(output, 'index.html');
fs.writeFileSync(
  index,
  fs
    .readFileSync(index, 'utf8')
    .replace(
      '<head>',
      '<head>\n<meta name="autogest-mode" content="demo">\n<meta name="description" content="AutoGest: demonstração interativa de gestão de oficina, com clientes, estoque, orçamentos e ordens de serviço.">',
    )
    .replace('./js/app.js', './js/' + path.basename(entry[0]))
    .replace('./css/style.css', './css/' + styleName),
);
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log(
  'Demo estática criada em dist/ com arquivos versionados. Nenhum banco ou cadastro local foi incluído.',
);
