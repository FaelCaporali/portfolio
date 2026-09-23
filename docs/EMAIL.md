# E-mail profissional — caporali.dev

Configurado em 23/09/2026. Custo zero: Cloudflare (DNS, Email Routing) e Resend (plano free: 3.000/mês, 100/dia, SMTP).
Nenhum segredo neste arquivo. A chave SMTP do Gmail fica em `~/.config/caporali/resend-gmail-smtp.key` (fora do repositório, 600).

## Separação de reputação

| Uso | Endereço | Caminho | Por quê |
|---|---|---|---|
| Caixa pessoal (receber) | `fael@caporali.dev` | Cloudflare Email Routing → o Gmail pessoal | tudo centralizado no Gmail |
| Caixa pessoal (responder) | `fael@caporali.dev` | Gmail "Enviar como" → SMTP do Resend | o remetente precisa ser o domínio principal; volume humano |
| Disparos do site (formulário) | `worker@mail.caporali.dev` | Worker → Cloudflare Email Service → destino verificado | subdomínio isola a reputação de envio automático; grátis para destino verificado |

Return-Path do Resend em `send.caporali.dev` (bounces fora do domínio principal). DMARC `p=reject` mantido no domínio principal
(vale também para subdomínios); SPF e DKIM alinhados nos dois caminhos.

## DNS (zona caporali.dev, Cloudflare)

| Registro | Origem |
|---|---|
| `MX caporali.dev` route1/2/3.mx.cloudflare.net | Email Routing (substituiu o MX nulo `.`) |
| `TXT caporali.dev` `v=spf1 include:_spf.mx.cloudflare.net ~all` | Email Routing (substituiu `v=spf1 -all`) |
| `TXT cf2024-1._domainkey` | DKIM do Email Routing |
| `MX/TXT mail.caporali.dev` | Email Routing no subdomínio (disparos do site) |
| `TXT resend._domainkey` | DKIM do Resend |
| `MX send.caporali.dev` feedback-smtp.sa-east-1.amazonses.com, `TXT send` `v=spf1 include:amazonses.com ~all` | Return-Path do Resend |
| `CNAME rsend` send.forge.rmta.net (sem proxy) | Resend |
| `TXT _dmarc` `v=DMARC1; p=reject; rua=mailto:(e-mail pessoal)` | já existia |

Regra de roteamento: `fael@caporali.dev` → o Gmail pessoal (catch-all continua desligado: outros endereços são recusados).
Rollback do estado anterior (domínio sem e-mail): desativar Email Routing e recriar `MX caporali.dev .` (prioridade 0) e `TXT v=spf1 -all`.

## Resend

Domínio `caporali.dev`, região sa-east-1, rastreio de abertura e clique desligados (e-mail pessoal).
Chave `gmail-send-as-fael`: só envio, restrita ao domínio.

## Gmail "Enviar como"

Configurações → Contas e importação → Enviar e-mail como → Adicionar outro endereço:
nome "Fael Caporali", e-mail `fael@caporali.dev`, **tratar como alias** marcado.
SMTP `smtp.resend.com`, porta 465, SSL, usuário `resend`, senha = chave do arquivo acima.
O Gmail manda um código para `fael@caporali.dev`, que chega pelo roteamento (testa os dois caminhos de uma vez).
Depois: "Responder do mesmo endereço para o qual a mensagem foi enviada".
