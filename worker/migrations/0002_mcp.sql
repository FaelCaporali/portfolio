-- MCP do portfólio (.wai/mcp/02-plano.md, T4 e T5): registro das chamadas e cotas diárias, no mesmo D1 do formulário.
-- Sem IP nem identificador de pessoa; argumentos de texto livre gravados com e-mail e telefone mascarados; apagados
-- após 90 dias (cron).

-- Mensagem enviada pelo MCP: vai para a mesma tabela do formulário (mesma finalidade, reenvio e retenção), marcada com
-- o cliente que a mandou. NULL = formulário do site (o teto diário do formulário só conta essas).
ALTER TABLE messages ADD COLUMN via TEXT;

CREATE TABLE mcp_calls (
  id          INTEGER PRIMARY KEY,
  created_at  INTEGER NOT NULL,                -- epoch ms
  tool        TEXT NOT NULL,
  args        TEXT,                            -- JSON tratado (mcp/audit.ts): nada de nome, contato nem mensagem
  client      TEXT,                            -- clientInfo declarado (nome e versão) ou o produto do User-Agent
  protocol    TEXT,                            -- versão do protocolo MCP da requisição
  network     TEXT,                            -- organização da rede de origem (Anthropic, OpenAI, provedor)
  country     TEXT,
  outcome     TEXT NOT NULL,                   -- ok, error, invalid, sent, queued, lost, limited, email_failed
  duration_ms INTEGER NOT NULL                 -- só tempo de espera de I/O (o relógio do Worker para durante a CPU)
);

CREATE INDEX mcp_calls_created ON mcp_calls (created_at);

-- Cotas por dia UTC (o limite grátis do D1 zera à meia-noite UTC): quantas linhas de registro, mensagens e beacons
-- o MCP já gastou; 'summary' marca o resumo semanal já enviado (day = a segunda-feira da semana).
CREATE TABLE mcp_quota (
  day   TEXT NOT NULL,                         -- AAAA-MM-DD
  kind  TEXT NOT NULL CHECK (kind IN ('log', 'message', 'beacon', 'summary')),
  used  INTEGER NOT NULL,
  PRIMARY KEY (day, kind)
) WITHOUT ROWID;
