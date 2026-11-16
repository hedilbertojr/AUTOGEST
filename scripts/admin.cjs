const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const { loadConfig } = require('../backend/src/config/env');
const { openDatabase } = require('../backend/src/database/connection');
const { createAuth } = require('../backend/src/security/auth');

async function main() {
  const db = openDatabase(loadConfig().databasePath);
  let reader;
  try {
    if (db.prepare('SELECT id FROM usuarios LIMIT 1').get())
      throw Error(
        'O primeiro administrador já existe. Crie os próximos usuários pela tela de administração.',
      );
    reader = readline.createInterface({ input: process.stdin, output: process.stdout });
    const nome = await reader.question('Nome do dono: ');
    const email = await reader.question('E-mail de acesso: ');
    reader.close();
    // Suppress terminal echo while readline captures the password.
    const silent = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    reader = readline.createInterface({
      input: process.stdin,
      output: silent,
      terminal: Boolean(process.stdin.isTTY),
    });
    process.stdout.write('Senha (12 a 128 caracteres; entrada oculta): ');
    const senha = await reader.question('');
    process.stdout.write('\nRepita a senha: ');
    const confirmacao = await reader.question('');
    process.stdout.write('\n');
    if (senha !== confirmacao) throw Error('As senhas não coincidem.');
    await createAuth(db, loadConfig()).firstAdmin({ nome, email, senha });
    console.log('Administrador criado. Inicie o sistema e faça login.');
  } finally {
    reader?.close();
    db.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
