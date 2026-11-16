CREATE INDEX IF NOT EXISTS idx_veiculos_cliente ON veiculos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_veiculo ON orcamentos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_itens_orcamento ON itens(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_cliente ON notificacoes(cliente_id);
