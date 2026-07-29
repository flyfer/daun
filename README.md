# Ticketeira — plataforma de venda de ingressos

MVP funcional de uma plataforma de ticketing no modelo Uticket/Sympla: qualquer produtor
cria o evento, vende com Pix ou cartão, e a plataforma fica com uma taxa de serviço por
ingresso. Ingressos são emitidos com QR Code único e validados na portaria.

Stack: **Next.js 15 (App Router) · TypeScript · Prisma 7 · PostgreSQL · Tailwind 4**.

---

## Rodando em 4 comandos

Pré-requisitos: Node 20+ e Docker (ou um Postgres já instalado).

```bash
cp .env.example .env          # e troque AUTH_SECRET
docker compose up -d          # sobe o Postgres local
npm install
npm run setup                 # cria as tabelas e popula com dados de demonstração
npm run dev                   # http://localhost:3000
```

Contas criadas pelo seed:

| Perfil   | E-mail                       | Senha       |
| -------- | ---------------------------- | ----------- |
| Produtor | produtor@ticketeira.com.br   | senha1234   |
| Cliente  | cliente@ticketeira.com.br    | senha1234   |

Com `PAYMENT_PROVIDER=mock` (padrão) o fluxo roda inteiro sem gateway: o Pix gera um
QR Code de verdade e a tela do pedido tem o botão **Simular pagamento**; no cartão,
qualquer número aprova e um número terminado em **1** é recusado.

---

## O que já está implementado

**Comprador**

- Home com destaques, listagem com busca e filtro por cidade/categoria
- Página do evento com lotes, limite por pedido, estoque e taxa de serviço visível
- Checkout em duas etapas (ingressos → dados → pagamento) com Pix e cartão
- Tela do pedido com QR Code Pix, copia-e-cola, contagem regressiva e atualização
  automática quando o pagamento cai
- Ingresso com QR Code único, e página "Meus ingressos" (por conta ou por e-mail)
- Eventos gratuitos: inscrição confirmada na hora, sem taxa

**Produtor**

- Cadastro de conta de produtor e painel com faturamento bruto, líquido e ingressos vendidos
- Criação de evento com múltiplos lotes, publicação/pausa/cancelamento, link de venda
- Gestão de lotes (criar, ativar, desativar, excluir) com trava para lotes já vendidos
- Relatório de vendas por evento
- Tela de check-in: leitor de QR (funciona como teclado) ou digitação, com bloqueio de
  ingresso repetido, cancelado ou de outro evento

**Plataforma**

- Taxa de serviço configurável por evento (em basis points), repassada ao comprador ou
  absorvida pelo produtor
- Reserva de estoque no pedido pendente e devolução automática na expiração
- Emissão de ingressos idempotente (webhook duplicado não gera ingresso a mais)
- Log de webhooks para auditoria

---

## Arquitetura

```
src/
  app/
    (público)      /  /eventos  /e/[slug]  /pedido/[code]  /ingresso/[code]  /meus-ingressos
    organizador/   painel, criação de evento, gestão e check-in
    api/           auth, orders, organizer, webhooks, simulador de pagamento
  components/      UI (checkout, painel de lotes, console de check-in...)
  lib/
    orders.ts      regras de negócio: reserva de estoque, confirmação, expiração
    payments/      camada de gateway (mock, Mercado Pago, BR Code do Pix)
    auth.ts        sessão JWT em cookie httpOnly + bcrypt
    money.ts       tudo em centavos; cálculo de taxa e líquido do produtor
prisma/
  schema.prisma    modelo de dados
  migrations/      SQL versionado
  seed.ts          dados de demonstração
scripts/e2e.ts     teste ponta a ponta do fluxo completo
```

### Decisões que valem conhecer

**Dinheiro em centavos (Int), nunca float.** Todo cálculo de preço, taxa e total usa
inteiros — evita os erros de arredondamento clássicos de `0.1 + 0.2`.

**Estoque com reserva.** Ao criar o pedido, a quantidade sai de `available` e vai para
`reserved` dentro de uma transação com guarda de concorrência (`updateMany` condicionado
ao valor lido). Só vira `sold` quando o pagamento confirma. Pedido não pago expira em 30
minutos e devolve o estoque. Isso é o que impede overbooking quando 200 pessoas clicam em
comprar no mesmo segundo.

**Confirmação por webhook + reconciliação.** O gateway avisa em
`/api/webhooks/payments`, mas a tela do pedido também consulta o status a cada 4s e,
se necessário, pergunta direto ao gateway. Se o webhook falhar, a venda não trava.

**Camada de pagamento plugável.** `PaymentProvider` é uma interface com três métodos.
Trocar de gateway é escrever uma classe nova e mudar uma variável de ambiente — não
mexe em nenhuma regra de negócio.

---

## Colocando pagamento real (Mercado Pago)

1. Crie a aplicação em [mercadopago.com.br/developers/panel/app](https://www.mercadopago.com.br/developers/panel/app)
2. No `.env`:
   ```
   PAYMENT_PROVIDER="mercadopago"
   MP_ACCESS_TOKEN="APP_USR-..."
   NEXT_PUBLIC_APP_URL="https://seudominio.com.br"
   ```
3. No painel do Mercado Pago, cadastre o webhook apontando para
   `https://seudominio.com.br/api/webhooks/payments`, evento `payment`.

**Pix** já funciona assim. Para **cartão** falta um passo obrigatório por PCI-DSS: o
número do cartão não pode passar pelo seu servidor. É preciso carregar o SDK
(`https://sdk.mercadopago.com/js/v2`) no formulário de checkout, gerar o token no
navegador e enviar apenas `card.token` — o backend (`src/lib/payments/mercadopago.ts`) já
está pronto para receber o token, o issuer e o `payment_method_id`. Enquanto isso não é
feito, o cartão só funciona no modo mock.

Outros gateways (Pagar.me, Asaas, Stripe) entram criando uma classe em
`src/lib/payments/` que implemente a mesma interface.

---

## Testes

Com o servidor rodando:

```bash
npm run build && npm start &
npx tsx --env-file=.env scripts/e2e.ts
```

Cobre 43 verificações: páginas públicas, compra por Pix, confirmação, idempotência,
cartão aprovado e recusado, devolução de estoque, limites por pedido, lote esgotado,
evento gratuito, login, autorização das rotas do produtor, check-in (incluindo tentativa
de reuso e ingresso de outro evento), criação de evento e expiração de pedido.

---

## Publicando

**Vercel**: passo a passo completo em [DEPLOY.md](DEPLOY.md). Resumo: repositório no
GitHub → banco Neon → importar na Vercel → variáveis de ambiente. O script `vercel-build`
roda `prisma migrate deploy` sozinho, então as tabelas nascem no primeiro deploy.

**VPS com Docker**: passo a passo em [DEPLOY-VPS.md](DEPLOY-VPS.md). O
`docker-compose.prod.yml` sobe a stack inteira — aplicação, Postgres, HTTPS automático via
Caddy, migrations no deploy e backup diário do banco.

Antes de vender de verdade:

- [ ] Trocar `AUTH_SECRET` por um valor gerado (`openssl rand -base64 32`)
- [ ] Ligar o gateway real e testar um Pix de R$ 1,00 ponta a ponta
- [ ] Envio de e-mail com o ingresso (Resend/SendGrid) — hoje o ingresso fica só no site
- [ ] Termos de uso, política de privacidade e conformidade LGPD
- [ ] Fluxo de reembolso e a meia-entrada, se for vender eventos que exigem
- [ ] Rate limiting no checkout e no login
- [ ] Backup automático do banco

---

## Roadmap sugerido

Curto prazo: e-mail transacional com o ingresso em PDF, cupons de desconto, cortesias,
mapa de assentos para teatro, relatório financeiro exportável.

Médio prazo: app de portaria offline (o check-in atual precisa de internet), split de
pagamento automático para o produtor, antecipação de recebíveis, página do produtor com
todos os seus eventos, domínio próprio por produtor (white-label).
