const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { fail } = require('../shared/errors');
const scrypt = promisify(scryptCallback);
const parameters = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
let active = 0;
const waiting = [];
async function derive(password, salt) {
  if (active >= 2) {
    if (waiting.length >= 8) fail('Muitas tentativas. Aguarde e tente novamente.', 429);
    await new Promise((resolve) => waiting.push(resolve));
  } else active++;
  try {
    return await scrypt(password, salt, 64, parameters);
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    fail('Use uma senha de 12 a 128 caracteres. Uma frase longa é uma boa opção.');
  }
  return password;
}
async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt);
  return `scrypt$131072$8$1$${salt}$${hash.toString('hex')}`;
}
async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const parts = (encoded || `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const actual = await derive(password, parts[4]);
  const expected = Buffer.from(parts[5], 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
module.exports = { hashPassword, verifyPassword, validatePassword };
