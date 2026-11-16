ALTER TABLE servicos ADD COLUMN custo INTEGER CHECK (custo IS NULL OR custo >= 0);
ALTER TABLE itens ADD COLUMN custo_unitario INTEGER CHECK (custo_unitario IS NULL OR custo_unitario >= 0);
ALTER TABLE ordens ADD COLUMN iniciada_em TEXT;
ALTER TABLE ordens ADD COLUMN finalizada_em TEXT;
ALTER TABLE ordens ADD COLUMN entregue_em TEXT;
ALTER TABLE ordens ADD COLUMN mecanico_conclusao_id INTEGER REFERENCES usuarios(id);

CREATE TABLE financeiro_titulos (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL CHECK(tipo IN ('receber','pagar')),
  natureza TEXT NOT NULL CHECK(natureza IN ('venda_os','outra_receita','despesa_operacional','compra_estoque','retirada','aporte')),
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  valor INTEGER NOT NULL CHECK(valor > 0),
  competencia TEXT NOT NULL,
  vencimento TEXT NOT NULL,
  ordem_id INTEGER UNIQUE REFERENCES ordens(id),
  cancelado INTEGER NOT NULL DEFAULT 0 CHECK(cancelado IN (0,1)),
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE financeiro_movimentos (
  id INTEGER PRIMARY KEY,
  titulo_id INTEGER NOT NULL REFERENCES financeiro_titulos(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('baixa','estorno')),
  valor INTEGER NOT NULL CHECK(valor > 0),
  data TEXT NOT NULL,
  meio TEXT NOT NULL,
  estorno_de INTEGER UNIQUE REFERENCES financeiro_movimentos(id),
  observacao TEXT NOT NULL DEFAULT '',
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE estoque_movimentos (
  id INTEGER PRIMARY KEY,
  estoque_id INTEGER NOT NULL REFERENCES estoque(id),
  ordem_id INTEGER REFERENCES ordens(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('saldo_inicial','entrada','consumo','ajuste')),
  quantidade INTEGER NOT NULL,
  custo_unitario INTEGER NOT NULL CHECK(custo_unitario >= 0),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO estoque_movimentos(estoque_id,tipo,quantidade,custo_unitario)
SELECT id,'saldo_inicial',quantidade,custo FROM estoque WHERE quantidade>0;
CREATE INDEX idx_financeiro_competencia ON financeiro_titulos(competencia);
CREATE INDEX idx_financeiro_vencimento ON financeiro_titulos(vencimento);
CREATE INDEX idx_movimentos_data ON financeiro_movimentos(data);
CREATE INDEX idx_movimentos_titulo ON financeiro_movimentos(titulo_id);
CREATE INDEX idx_consumo_ordem ON estoque_movimentos(ordem_id);
CREATE INDEX idx_ordens_finalizada ON ordens(finalizada_em);
