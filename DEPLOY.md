# Publicando a Ticketeira na Vercel

Tempo estimado: 20 minutos. Custo: R$ 0 para começar (Vercel Hobby + Neon Free).

---

## Passo 1 — Subir o código para o GitHub

A Vercel puxa o código de um repositório Git. Na pasta do projeto:

```bash
git init
git add .
git commit -m "Ticketeira - MVP"
```

Crie um repositório **privado** em [github.com/new](https://github.com/new) (nome sugerido:
`ticketeira`), sem README nem .gitignore, e conecte:

```bash
git remote add origin https://github.com/SEU-USUARIO/ticketeira.git
git branch -M main
git push -u origin main
```

O `.gitignore` do projeto já exclui `.env`, `node_modules` e `src/generated` — seus
segredos não vão para o GitHub.

---

## Passo 2 — Criar o banco Postgres

O Postgres do `docker-compose.yml` é só para a sua máquina. Em produção use um banco
gerenciado. O caminho mais curto é o **Neon**, que já vive dentro da Vercel:

1. Entre em [vercel.com](https://vercel.com) com sua conta do GitHub
2. No menu superior: **Storage → Create Database → Neon (Serverless Postgres)**
3. Escolha a região **Washington D.C. (iad1)** ou **São Paulo**, se disponível — quanto mais
   perto do banco a aplicação estiver, mais rápido o site responde
4. Ao criar, a Vercel já injeta as variáveis `DATABASE_URL` e `POSTGRES_*` no projeto que
   você conectar

Alternativa: [Supabase](https://supabase.com) ou [Railway](https://railway.app) — nesses
casos você copia a connection string manualmente.

> **Importante:** use sempre a connection string **pooled** (a do Neon vem com
> `-pooler` no host). Funções serverless abrem e fecham muitas conexões; sem o pooler o
> banco esgota o limite de conexões nos primeiros picos de venda.

---

## Passo 3 — Importar o projeto na Vercel

1. **Add New → Project → Import** o repositório `ticketeira`
2. A Vercel detecta Next.js sozinha — **não mexa** em Build Command nem Output Directory.
   O projeto tem um script `vercel-build` que roda as migrations antes do build:
   ```
   prisma migrate deploy && prisma generate && next build
   ```
   Ou seja, as tabelas são criadas no primeiro deploy automaticamente.
3. Em **Environment Variables**, cadastre (para Production, Preview e Development):

| Variável                   | Valor                                                     |
| -------------------------- | --------------------------------------------------------- |
| `DATABASE_URL`             | connection string pooled do Neon (se usou o Storage da Vercel, já está lá) |
| `AUTH_SECRET`              | rode `openssl rand -base64 32` e cole o resultado          |
| `NEXT_PUBLIC_APP_URL`      | `https://seu-projeto.vercel.app` (ajuste depois do domínio) |
| `NEXT_PUBLIC_BRAND_NAME`   | o nome da sua plataforma                                   |
| `PAYMENT_PROVIDER`         | `mock` por enquanto — troque para `mercadopago` quando for vender de verdade |
| `DEFAULT_SERVICE_FEE_BPS`  | `1000` (= 10%)                                             |
| `ORDER_EXPIRATION_MINUTES` | `30`                                                       |
| `TZ`                       | `America/Sao_Paulo`                                        |

4. **Deploy**. O primeiro build leva uns 2 minutos.

Se o build falhar em `prisma migrate deploy`, é quase sempre `DATABASE_URL` errada ou
faltando — confira e clique em **Redeploy**.

---

## Passo 4 — Criar sua conta de produtor

O banco de produção sobe **vazio** (sem os eventos de demonstração — o que é o certo).
Acesse `https://seu-projeto.vercel.app/cadastro?produtor=1`, crie sua conta marcando
"quero vender ingressos", e já dá para publicar o primeiro evento.

Se quiser popular com os dados de exemplo só para testar a cara do site, rode **na sua
máquina** apontando para o banco de produção — lembrando que isso **apaga tudo** que
estiver lá:

```bash
DATABASE_URL="sua-string-do-neon" npm run db:seed:remote
```

---

## Passo 5 — Domínio próprio

Em **Settings → Domains**, adicione `ingressos.seudominio.com.br` (ou o domínio que for
usar). A Vercel mostra o registro DNS — é um `CNAME` apontando para `cname.vercel-dns.com`.
Como você já administra domínios, é o mesmo procedimento de sempre. O certificado HTTPS é
emitido automaticamente em alguns minutos.

Depois de apontar o domínio, **volte e atualize `NEXT_PUBLIC_APP_URL`** para a URL final e
faça um redeploy — essa variável é usada nos links e na URL do webhook do gateway.

---

## Passo 6 — Ligar o pagamento real

1. Crie a aplicação em
   [mercadopago.com.br/developers/panel/app](https://www.mercadopago.com.br/developers/panel/app)
2. Na Vercel, mude as variáveis:
   ```
   PAYMENT_PROVIDER = mercadopago
   MP_ACCESS_TOKEN  = APP_USR-...
   ```
3. No painel do Mercado Pago, em **Webhooks**, cadastre a URL:
   ```
   https://seudominio.com.br/api/webhooks/payments
   ```
   marcando o evento **Pagamentos (payment)**
4. Redeploy e faça um teste real de R$ 1,00 por Pix, com o celular, do começo ao fim

Lembrete do que já falei: **o Pix funciona direto**, mas o cartão precisa do passo do
token no navegador (SDK do Mercado Pago) antes de funcionar em produção. Enquanto isso
não é feito, deixe só o Pix disponível ou o cliente vai ver um erro ao tentar pagar com
cartão.

---

## Depois do ar: o que monitorar

**Logs**: aba **Logs** do projeto na Vercel mostra erros em tempo real. Vale olhar depois
do primeiro dia de vendas.

**Conexões do banco**: se aparecer erro `too many connections`, é a connection string sem
pooler — o item mais comum de dar problema em serverless.

**Timeout**: no plano Hobby, cada requisição tem 10 segundos. É suficiente para tudo que a
plataforma faz hoje, mas se um dia você adicionar envio de e-mail em massa ou geração de
relatório pesado, isso precisa virar uma fila ou um cron.

**Backup**: o Neon Free tem retenção de 24h. Se a plataforma começar a faturar, suba para
um plano com backup maior — perder o banco significa perder ingressos já vendidos.

---

## Custos quando crescer

| Item              | Grátis até                          | Depois                    |
| ----------------- | ----------------------------------- | ------------------------- |
| Vercel Hobby      | uso pessoal, sem fins comerciais    | Pro, US$ 20/mês por membro |
| Neon Free         | 0,5 GB e limite de horas de compute | a partir de US$ 19/mês     |
| Mercado Pago      | —                                   | taxa por transação (Pix mais barato que cartão) |

Atenção a um ponto: o plano **Hobby da Vercel é para projetos não comerciais**. No momento
em que a plataforma começar a vender ingressos com taxa, o correto é migrar para o plano
Pro. Uma alternativa mais barata é rodar num VPS (Hetzner, Contabo, DigitalOcean) com
Docker — nesse caso me chame que eu monto o `Dockerfile` e o compose de produção.
