CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('admin', 'operador')),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  trocar_senha INTEGER NOT NULL DEFAULT 0 CHECK (trocar_senha IN (0, 1)),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sessoes (
  token_hash TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  csrf TEXT NOT NULL,
  expira_em INTEGER NOT NULL,
  ultima_atividade INTEGER NOT NULL
);
CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id);
CREATE TABLE tentativas_login (
  chave TEXT PRIMARY KEY,
  quantidade INTEGER NOT NULL,
  expira_em INTEGER NOT NULL
);
CREATE TABLE auditoria (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  acao TEXT NOT NULL,
  alvo_id INTEGER,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE ordens ADD COLUMN operador_id INTEGER REFERENCES usuarios(id);
CREATE INDEX idx_ordens_operador ON ordens(operador_id);
