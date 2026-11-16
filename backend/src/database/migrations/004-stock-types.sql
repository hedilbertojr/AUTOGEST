ALTER TABLE estoque ADD COLUMN tipo TEXT NOT NULL DEFAULT 'peca' CHECK (tipo IN ('peca', 'suprimento'));
ALTER TABLE estoque ADD COLUMN unidade TEXT NOT NULL DEFAULT 'un';
