-- Mensagens do formulário de contato. Guardadas antes do envio: se o e-mail falhar, o cron reenvia.
-- Sem IP nem identificador do visitante; apagadas após 90 dias (cron).
CREATE TABLE messages (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,                -- epoch ms
  name        TEXT NOT NULL,
  contact     TEXT NOT NULL,                   -- como o visitante escreveu (e-mail ou telefone)
  reply_email TEXT,                            -- preenchido só quando o contato é um e-mail válido
  body        TEXT NOT NULL,
  country     TEXT,                            -- país da requisição (Cloudflare), para contexto
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,                            -- só o código do erro, nunca conteúdo
  sent_at     INTEGER,
  message_id  TEXT
);

CREATE INDEX messages_status_created ON messages (status, created_at);
CREATE INDEX messages_created ON messages (created_at);
