const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let failed = false;
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'data', 'backups'].includes(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(filename);
    else if (/\.(?:js|cjs)$/.test(filename)) {
      const result = spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
      if (result.status !== 0) failed = true;
    }
  }
}
visit(root);
process.exitCode = failed ? 1 : 0;
if (!failed) console.log('Sintaxe de todos os módulos verificada.');
