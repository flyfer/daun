# Publicando a Ticketeira num VPS com Docker

Alternativa mais barata à Vercel e sem a restrição de "uso não comercial". Um VPS de
2 vCPU / 4 GB roda a plataforma inteira — aplicação, banco, HTTPS e backup — por algo
entre R$ 25 e R$ 60 por mês.

| Provedor     | Plano indicado    | Preço aproximado |
| ------------ | ----------------- | ---------------- |
| Hetzner CX22 | 2 vCPU / 4 GB     | € 4,5/mês        |
| Contabo      | 4 vCPU / 8 GB     | € 6/mês          |
| DigitalOcean | 2 vCPU / 4 GB     | US$ 24/mês       |
| Magalu Cloud | 2 vCPU / 4 GB     | R$ 90/mês (Brasil, latência menor) |

---

## O que a stack sobe

```
Internet :443
    │
    ▼
 [ caddy ]  HTTPS automático (Let's Encrypt), compressão, cache de assets
    │  rede "web"
    ▼
 [  app  ]  Next.js standalone, sem root, com healthcheck
    │  rede "internal" (sem acesso externo)
    ▼
 [   db   ] PostgreSQL 16, volume persistente, porta NÃO exposta
    ▲
 [ backup ] dump diário às 03h, retenção de 14 dias
 [ migrate ] roda as migrations e sai antes do app subir
```

Detalhes que importam: o Postgres **não** tem porta publicada — só a aplicação alcança o
banco. O container da aplicação roda com usuário sem privilégios. E o `app` só inicia
depois que o `migrate` termina com sucesso, então nunca sobe uma versão nova contra um
banco desatualizado.

---

## Passo 1 — Preparar o servidor

Com o VPS criado (Ubuntu 24.04), conecte por SSH e instale o Docker:

```bash
ssh root@SEU-IP

apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh

# firewall: só SSH e web
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Se você já usa fail2ban e chave SSH nos outros servidores, aplique o mesmo padrão aqui.

---

## Passo 2 — Apontar o domínio

No painel do seu registrador, crie um registro **A**:

```
ingressos.seudominio.com.br   A   SEU-IP-DO-VPS
```

Confirme a propagação antes de continuar — o Caddy só consegue emitir o certificado se o
domínio já resolver para o servidor:

```bash
dig +short ingressos.seudominio.com.br
```

---

## Passo 3 — Subir a aplicação

```bash
git clone https://github.com/SEU-USUARIO/ticketeira.git /opt/ticketeira
cd /opt/ticketeira

cp .env.production.example .env.production
nano .env.production
```

Preencha, no mínimo:

```bash
APP_DOMAIN="ingressos.seudominio.com.br"
LETSENCRYPT_EMAIL="voce@seudominio.com.br"
NEXT_PUBLIC_APP_URL="https://ingressos.seudominio.com.br"
POSTGRES_PASSWORD="<cole o resultado de: openssl rand -base64 24>"
AUTH_SECRET="<cole o resultado de: openssl rand -base64 32>"
```

E suba:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

O primeiro build leva de 3 a 5 minutos. Acompanhe:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

Quando o Caddy imprimir `certificate obtained successfully`, acesse
`https://ingressos.seudominio.com.br`. Crie sua conta de produtor em `/cadastro?produtor=1`.

> Dica: para não repetir `--env-file .env.production -f docker-compose.prod.yml` toda vez,
> crie um atalho no `.bashrc` do servidor:
> `alias tk='docker compose --env-file /opt/ticketeira/.env.production -f /opt/ticketeira/docker-compose.prod.yml'`
> Daí é só `tk logs -f app`, `tk ps`, `tk restart app`.

---

## Operação do dia a dia

**Atualizar para uma versão nova do código**

```bash
cd /opt/ticketeira
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

As migrations rodam sozinhas. A troca de container leva poucos segundos.

**Ver o que está rodando e a saúde dos serviços**

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl https://ingressos.seudominio.com.br/api/health
```

**Logs**

```bash
# aplicação
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
# acessos HTTP
docker compose --env-file .env.production -f docker-compose.prod.yml exec caddy tail -f /data/access.log
```

**Abrir o banco**

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec db \
  psql -U ticketeira -d ticketeira
```

---

## Backup e restauração

O container `backup` gera um dump comprimido em `/opt/ticketeira/backups` assim que sobe e
depois todo dia às 03h, apagando os mais antigos que 14 dias (ajustável em
`BACKUP_RETENTION_DAYS`).

**Backup manual, agora:**

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  pg_dump -U ticketeira --no-owner ticketeira | gzip > backup-manual.sql.gz
```

**Restaurar:**

```bash
gunzip -c backups/ticketeira-2026-07-28-030000.sql.gz | \
  docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  psql -U ticketeira -d ticketeira
```

**Leve os backups para fora do servidor.** Backup que só existe na mesma máquina não é
backup — se o VPS morrer, morre junto. Um `rclone`, um `rsync` para outro servidor seu ou
um sync para S3/Backblaze no cron da máquina resolve:

```bash
# /etc/cron.d/ticketeira-backup-offsite
30 3 * * * root rclone copy /opt/ticketeira/backups remoto:ticketeira-backups
```

---

## Ligando o pagamento real

Edite o `.env.production`:

```bash
PAYMENT_PROVIDER="mercadopago"
MP_ACCESS_TOKEN="APP_USR-..."
```

E aplique:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

No painel do Mercado Pago, cadastre o webhook em
`https://ingressos.seudominio.com.br/api/webhooks/payments`, evento **payment**. Faça um
Pix de teste de R$ 1,00 pelo celular, do começo ao fim.

Lembrando do que já conversamos: o Pix funciona direto; o cartão ainda precisa do passo de
tokenização no navegador. Até isso ficar pronto, o mais seguro é oferecer só o Pix.

---

## Quando o movimento crescer

**Mais tráfego na aplicação**: `deploy: replicas: 3` no serviço `app` do compose — o Caddy
distribui a carga sozinha entre as réplicas, sem configuração adicional.

**Banco no limite**: primeiro suba a RAM do VPS; depois separe o Postgres numa máquina
própria ou num serviço gerenciado, mudando só a `DATABASE_URL`.

**Picos de venda** (abertura de lote de um evento grande) são o cenário mais crítico. A
reserva de estoque é transacional e aguenta concorrência, mas vale subir a máquina um
degrau na véspera e voltar depois — em VPS isso é um resize de poucos minutos.

**Métricas**: se quiser gráficos, um Uptime Kuma apontando para `/api/health` já cobre
99% da necessidade e roda no mesmo servidor com poucos MB.
