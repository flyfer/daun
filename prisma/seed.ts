import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const day = (n: number, hour = 21) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  console.log("Limpando dados anteriores...");
  await prisma.ticket.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organizer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.webhookLog.deleteMany();

  const passwordHash = await bcrypt.hash("senha1234", 10);

  const organizerUser = await prisma.user.create({
    data: {
      name: "Produtor Demo",
      email: "produtor@ticketeira.com.br",
      passwordHash,
      role: "ORGANIZER",
      organizer: {
        create: {
          displayName: "A2 Live Produções",
          slug: "a2-live-producoes",
          description: "Produtora de shows e festivais.",
          pixKey: "produtor@ticketeira.com.br",
          verified: true,
        },
      },
    },
    include: { organizer: true },
  });

  await prisma.user.create({
    data: {
      name: "Cliente Demo",
      email: "cliente@ticketeira.com.br",
      passwordHash,
      role: "CUSTOMER",
    },
  });

  const organizerId = organizerUser.organizer!.id;

  const events = [
    {
      slug: "festival-verao-2026",
      title: "Festival Verão 2026",
      subtitle: "Dois palcos, doze atrações, uma noite inesquecível",
      description:
        "O maior festival open air da região volta com line-up nacional e internacional.\n\nAtrações confirmadas em dois palcos, praça de alimentação, área VIP com open bar e estacionamento no local.\n\nAbertura dos portões às 18h. Proibida a entrada de bebidas e objetos cortantes.",
      category: "Show",
      coverUrl:
        "https://images.unsplash.com/photo-1470229722913-7ea0d339fa3f?w=1200&q=80",
      venueName: "Arena Multiuso",
      address: "Av. das Nações, 1500",
      city: "Curitiba",
      state: "PR",
      startsAt: day(21, 18),
      endsAt: day(22, 4),
      ageRating: "16 anos",
      ticketTypes: [
        { name: "1º Lote — Pista", priceCents: 12000, quantity: 300, sold: 0 },
        {
          name: "1º Lote — Front Stage",
          description: "Área exclusiva na frente do palco",
          priceCents: 24000,
          quantity: 100,
          sold: 0,
        },
        {
          name: "Camarote VIP",
          description: "Open bar e vista privilegiada",
          priceCents: 45000,
          quantity: 40,
          sold: 0,
        },
      ],
    },
    {
      slug: "workshop-seguranca-eletronica",
      title: "Workshop de Segurança Eletrônica",
      subtitle: "CFTV, controle de acesso e alarmes na prática",
      description:
        "Dia inteiro de conteúdo prático para integradores e técnicos.\n\nManhã: fundamentos de rede para CFTV, dimensionamento de storage e boas práticas de instalação.\nTarde: controle de acesso, integração com alarme e demonstração ao vivo.\n\nInclui coffee break e certificado de participação.",
      category: "Curso",
      coverUrl:
        "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80",
      venueName: "Centro de Convenções",
      address: "Rua da Tecnologia, 88",
      city: "São Paulo",
      state: "SP",
      startsAt: day(12, 9),
      endsAt: day(12, 18),
      ageRating: "Livre",
      ticketTypes: [
        { name: "Inscrição individual", priceCents: 29000, quantity: 80, sold: 0 },
        {
          name: "Inscrição + kit técnico",
          description: "Apostila impressa e ferramenta de crimpagem",
          priceCents: 39000,
          quantity: 30,
          sold: 0,
        },
      ],
    },
    {
      slug: "noite-do-samba",
      title: "Noite do Samba",
      subtitle: "Roda de samba com convidados especiais",
      description:
        "Toda última sexta do mês, a melhor roda de samba da cidade.\n\nCozinha da casa aberta até 1h. Entrada até 22h com desconto.",
      category: "Festa",
      coverUrl:
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80",
      venueName: "Clube do Samba",
      address: "Rua das Palmeiras, 240",
      city: "Rio de Janeiro",
      state: "RJ",
      startsAt: day(5, 22),
      ageRating: "18 anos",
      ticketTypes: [
        { name: "Pré-venda", priceCents: 4000, quantity: 150, sold: 0 },
        { name: "Mesa para 4 pessoas", priceCents: 20000, quantity: 20, sold: 0 },
      ],
    },
    {
      slug: "meetup-tecnologia-gratuito",
      title: "Meetup de Tecnologia",
      subtitle: "Encontro gratuito da comunidade dev",
      description:
        "Três palestras relâmpago e networking. Traga seu notebook e suas dúvidas.\n\nEvento gratuito, mas com inscrição obrigatória — as vagas são limitadas pelo espaço.",
      category: "Congresso",
      coverUrl:
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80",
      venueName: "Hub de Inovação",
      address: "Av. Central, 900",
      city: "Curitiba",
      state: "PR",
      startsAt: day(9, 19),
      ageRating: "Livre",
      ticketTypes: [{ name: "Inscrição gratuita", priceCents: 0, quantity: 120, sold: 0 }],
    },
  ];

  for (const e of events) {
    const { ticketTypes, ...data } = e;
    await prisma.event.create({
      data: {
        ...data,
        status: "PUBLISHED",
        organizerId,
        serviceFeeBps: Number(process.env.DEFAULT_SERVICE_FEE_BPS ?? 1000),
        feeMode: "BUYER",
        ticketTypes: {
          create: ticketTypes.map((t, i) => ({ ...t, position: i })),
        },
      },
    });
    console.log(`  ✓ ${e.title}`);
  }

  // Evento em rascunho, para o produtor ver o fluxo de publicação
  await prisma.event.create({
    data: {
      slug: "reveillon-2027",
      title: "Réveillon 2027",
      description:
        "Rascunho: virada do ano com queima de fogos, DJ residente e ceia inclusa.",
      category: "Festa",
      venueName: "Espaço Beira-Mar",
      address: "Av. Atlântica, 5000",
      city: "Florianópolis",
      state: "SC",
      startsAt: new Date(new Date().getFullYear(), 11, 31, 22, 0, 0),
      status: "DRAFT",
      organizerId,
      ticketTypes: {
        create: [
          { name: "1º Lote", priceCents: 35000, quantity: 200, position: 0 },
        ],
      },
    },
  });

  console.log("\nSeed concluído.");
  console.log("  Produtor: produtor@ticketeira.com.br / senha1234");
  console.log("  Cliente:  cliente@ticketeira.com.br  / senha1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
