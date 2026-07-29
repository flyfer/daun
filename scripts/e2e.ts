/**
 * Teste ponta a ponta do fluxo de venda.
 * Uso: npm run build && npm start & ; npx tsx --env-file=.env scripts/e2e.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE = process.env.TEST_URL || "http://127.0.0.1:3000";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`, detail ?? "");
  }
}

async function main() {
  console.log("\n1. Páginas públicas");
  for (const path of ["/", "/eventos", "/e/festival-verao-2026", "/ajuda", "/entrar"]) {
    const res = await fetch(`${BASE}${path}`);
    check(`GET ${path} → ${res.status}`, res.ok);
  }

  const event = await prisma.event.findUniqueOrThrow({
    where: { slug: "festival-verao-2026" },
    include: { ticketTypes: { orderBy: { position: "asc" } } },
  });
  const pista = event.ticketTypes[0];
  // baseline: o teste compara variações, então roda em banco novo ou já usado
  const base = { sold: pista.sold, reserved: pista.reserved };

  console.log("\n2. Compra via Pix");
  const pix = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: event.id,
      paymentMethod: "PIX",
      buyer: { name: "Maria Teste", email: "maria@teste.com", document: "12345678909" },
      lines: [{ ticketTypeId: pista.id, quantity: 2 }],
    }),
  });
  const pixData = await pix.json();
  check("pedido criado", pix.ok && !!pixData.code, pixData);

  const order = await prisma.order.findUniqueOrThrow({ where: { code: pixData.code } });
  check("total = 2 × 120,00 + 10% taxa = 264,00", order.totalCents === 26400, order.totalCents);
  check("taxa de serviço = 24,00", order.feeCents === 2400, order.feeCents);
  check("QR Code Pix gerado", !!order.pixQrCodeImage?.startsWith("data:image/png"));
  check("payload Pix (BR Code) válido", (order.pixQrCode ?? "").startsWith("000201"), order.pixQrCode?.slice(0, 20));

  const reserved = await prisma.ticketType.findUniqueOrThrow({ where: { id: pista.id } });
  check(
    "estoque reservado (+2)",
    reserved.reserved === base.reserved + 2 && reserved.sold === base.sold,
    reserved,
  );

  console.log("\n3. Confirmação do pagamento");
  await fetch(`${BASE}/api/payments/mock/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: pixData.code }),
  });
  const status = await (await fetch(`${BASE}/api/orders/${pixData.code}/status`)).json();
  check("status → PAID", status.status === "PAID", status);

  const sold = await prisma.ticketType.findUniqueOrThrow({ where: { id: pista.id } });
  check(
    "reserva virou venda",
    sold.sold === base.sold + 2 && sold.reserved === base.reserved,
    sold,
  );

  const tickets = await prisma.ticket.findMany({ where: { orderId: order.id } });
  check("2 ingressos emitidos", tickets.length === 2, tickets.length);
  check("códigos únicos no formato TKT-", tickets.every((t) => /^TKT(-[A-Z0-9]{4}){3}$/.test(t.code)), tickets.map((t) => t.code));

  console.log("\n4. Idempotência");
  await fetch(`${BASE}/api/payments/mock/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: pixData.code }),
  });
  const again = await prisma.ticket.count({ where: { orderId: order.id } });
  check("confirmar 2× não duplica ingressos", again === 2, again);

  console.log("\n5. Páginas do ingresso");
  const ticketPage = await fetch(`${BASE}/ingresso/${tickets[0].code}`);
  check(`GET /ingresso/[code] → ${ticketPage.status}`, ticketPage.ok);
  const orderPage = await fetch(`${BASE}/pedido/${pixData.code}`);
  check(`GET /pedido/[code] → ${orderPage.status}`, orderPage.ok);
  const mine = await fetch(`${BASE}/meus-ingressos?email=maria@teste.com`);
  check("meus ingressos lista a compra", (await mine.text()).includes(event.title));

  console.log("\n6. Cartão");
  const approved = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: event.id,
      paymentMethod: "CARD",
      buyer: { name: "João Teste", email: "joao@teste.com" },
      lines: [{ ticketTypeId: pista.id, quantity: 1 }],
      card: { number: "4242424242424242", holder: "JOAO TESTE", expMonth: 12, expYear: 2030, cvv: "123", installments: 1 },
    }),
  });
  const approvedData = await approved.json();
  check("cartão aprovado → PAID", approved.ok && approvedData.status === "PAID", approvedData);

  const rejected = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: event.id,
      paymentMethod: "CARD",
      buyer: { name: "Ana Teste", email: "ana@teste.com" },
      lines: [{ ticketTypeId: pista.id, quantity: 1 }],
      card: { number: "4242424242424241", holder: "ANA TESTE", expMonth: 12, expYear: 2030, cvv: "123" },
    }),
  });
  check("cartão recusado → 402", rejected.status === 402, await rejected.text());
  const afterReject = await prisma.ticketType.findUniqueOrThrow({ where: { id: pista.id } });
  check(
    "estoque devolvido após recusa",
    afterReject.reserved === base.reserved,
    afterReject.reserved,
  );

  console.log("\n7. Regras de estoque e limites");
  const tooMany = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: event.id,
      paymentMethod: "PIX",
      buyer: { name: "Teste Limite", email: "limite@teste.com" },
      lines: [{ ticketTypeId: pista.id, quantity: 50 }],
    }),
  });
  check("bloqueia acima do máximo por pedido", tooMany.status === 400, await tooMany.text());

  const vip = event.ticketTypes.find((t) => t.name.includes("Camarote"))!;
  await prisma.ticketType.update({ where: { id: vip.id }, data: { quantity: 1, sold: 1 } });
  const soldOut = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: event.id,
      paymentMethod: "PIX",
      buyer: { name: "Teste Esgotado", email: "esgotado@teste.com" },
      lines: [{ ticketTypeId: vip.id, quantity: 1 }],
    }),
  });
  const soldOutBody = await soldOut.json();
  check("bloqueia venda de lote esgotado", soldOut.status === 400 && /esgotado/i.test(soldOutBody.error), soldOutBody);
  await prisma.ticketType.update({ where: { id: vip.id }, data: { quantity: 40, sold: 0 } });

  console.log("\n8. Evento gratuito");
  const free = await prisma.event.findUniqueOrThrow({
    where: { slug: "meetup-tecnologia-gratuito" },
    include: { ticketTypes: true },
  });
  const freeRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: free.id,
      paymentMethod: "PIX",
      buyer: { name: "Grátis Teste", email: "gratis@teste.com" },
      lines: [{ ticketTypeId: free.ticketTypes[0].id, quantity: 1 }],
    }),
  });
  const freeData = await freeRes.json();
  check("inscrição gratuita confirma na hora", freeRes.ok && freeData.status === "PAID", freeData);
  const freeOrder = await prisma.order.findUniqueOrThrow({ where: { code: freeData.code } });
  check("evento gratuito não cobra taxa", freeOrder.feeCents === 0 && freeOrder.totalCents === 0);

  console.log("\n9. Autenticação e painel do produtor");
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "produtor@ticketeira.com.br", password: "senha1234" }),
  });
  check("login do produtor", login.ok);
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  check("cookie de sessão httpOnly", /httponly/i.test(login.headers.get("set-cookie") ?? ""));

  const badLogin = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "produtor@ticketeira.com.br", password: "errada" }),
  });
  check("senha errada → 401", badLogin.status === 401);

  const dash = await fetch(`${BASE}/organizador`, { headers: { cookie } });
  const dashHtml = await dash.text();
  check("painel mostra o produtor", dashHtml.includes("A2 Live Produções"));
  check("painel mostra faturamento", /Você recebe|Vendas brutas/.test(dashHtml));

  console.log("\n10. Check-in");
  const noAuth = await fetch(`${BASE}/api/organizer/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: tickets[0].code, eventId: event.id }),
  });
  check("check-in sem sessão → 401", noAuth.status === 401);

  const checkin = async (code: string) =>
    (
      await fetch(`${BASE}/api/organizer/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ code, eventId: event.id }),
      })
    ).json();

  const ok1 = await checkin(tickets[0].code);
  check("primeira leitura libera entrada", ok1.result === "OK", ok1);
  const ok2 = await checkin(tickets[0].code);
  check("segunda leitura bloqueia (anti-fraude)", ok2.result === "ALREADY_USED", ok2);
  const invalid = await checkin("TKT-ZZZZ-ZZZZ-ZZZZ");
  check("código inexistente é rejeitado", invalid.result === "INVALID", invalid);

  const freeTicket = await prisma.ticket.findFirstOrThrow({ where: { orderId: freeOrder.id } });
  const wrongEvent = await checkin(freeTicket.code);
  check("ingresso de outro evento é rejeitado", wrongEvent.result === "WRONG_EVENT", wrongEvent);

  console.log("\n11. Criação de evento pelo produtor");
  const created = await fetch(`${BASE}/api/organizer/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      title: "Evento de Teste Automatizado",
      description: "Evento criado pelo teste ponta a ponta.",
      category: "Show",
      venueName: "Local Teste",
      address: "Rua Teste, 1",
      city: "Curitiba",
      state: "PR",
      startsAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      publish: true,
      ticketTypes: [{ name: "Lote único", priceCents: 5000, quantity: 10 }],
    }),
  });
  const createdData = await created.json();
  check("evento criado e publicado", created.ok && !!createdData.slug, createdData);
  const publicPage = await fetch(`${BASE}/e/${createdData.slug}`);
  check("evento novo aparece na página pública", publicPage.ok);
  const listing = await (await fetch(`${BASE}/eventos`)).text();
  check("evento novo aparece na listagem", listing.includes("Evento de Teste Automatizado"));

  const noAuthCreate = await fetch(`${BASE}/api/organizer/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Hack", description: "xxxxxxxxxxx", category: "Show", venueName: "x", address: "xxx", city: "xx", state: "PR", startsAt: new Date().toISOString(), ticketTypes: [{ name: "a", priceCents: 0, quantity: 1 }] }),
  });
  check("criar evento sem sessão → 401", noAuthCreate.status === 401);

  console.log("\n12. Expiração de pedido");
  const expiring = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: event.id,
      paymentMethod: "PIX",
      buyer: { name: "Expira Teste", email: "expira@teste.com" },
      lines: [{ ticketTypeId: pista.id, quantity: 3 }],
    }),
  });
  const expiringData = await expiring.json();
  const before = await prisma.ticketType.findUniqueOrThrow({ where: { id: pista.id } });
  check(
    "estoque reservado antes de expirar",
    before.reserved === base.reserved + 3,
    before.reserved,
  );
  await prisma.order.update({
    where: { code: expiringData.code },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  const expiredStatus = await (await fetch(`${BASE}/api/orders/${expiringData.code}/status`)).json();
  check("pedido vencido → EXPIRED", expiredStatus.status === "EXPIRED", expiredStatus);
  const after = await prisma.ticketType.findUniqueOrThrow({ where: { id: pista.id } });
  check("estoque devolvido após expirar", after.reserved === base.reserved, after.reserved);

  console.log(`\n${"=".repeat(46)}`);
  console.log(`  ${passed} passaram · ${failed} falharam`);
  console.log("=".repeat(46));
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
