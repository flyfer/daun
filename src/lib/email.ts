import { Resend } from "resend";
import { prisma } from "./prisma";
import { formatBRL } from "./money";
import { formatDateTime } from "./dates";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "TicketDaun <fernando@daun.com.br>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "TicketDaun";

async function sendEmail(params: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY não configurada — e-mail "${params.subject}" para ${params.to} não foi enviado.`,
    );
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) console.error("[email] falha ao enviar:", error);
}

function layout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="padding: 24px 0; text-align: center;">
        <span style="font-size: 20px; font-weight: 700;">${BRAND}</span>
      </div>
      <div style="background: #f7f7f8; border-radius: 16px; padding: 32px;">
        <h1 style="font-size: 20px; margin: 0 0 16px;">${title}</h1>
        ${bodyHtml}
      </div>
      <p style="text-align: center; color: #888; font-size: 12px; margin-top: 24px;">
        ${BRAND} · plataforma de venda de ingressos
      </p>
    </div>
  `;
}

export async function sendWelcomeEmail(user: { name: string; email: string }) {
  const html = layout(
    `Bem-vindo(a), ${user.name.split(" ")[0]}!`,
    `
      <p>Sua conta na ${BRAND} foi criada com sucesso.</p>
      <p>Agora você pode comprar ingressos para os melhores eventos ou, se quiser, criar o seu próprio evento e vender pela plataforma.</p>
      <a href="${APP_URL}/eventos"
         style="display: inline-block; margin-top: 16px; background: #a21caf; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">
        Ver eventos
      </a>
    `,
  );
  await sendEmail({ to: user.email, subject: `Bem-vindo(a) à ${BRAND}`, html });
}

export async function sendOrderConfirmationEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      event: true,
      items: { include: { ticketType: true } },
    },
  });
  if (!order) return;

  const itemsHtml = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding: 6px 0;">${i.quantity}× ${i.ticketType.name}</td>
          <td style="padding: 6px 0; text-align: right;">${formatBRL(
            (i.unitPriceCents + i.unitFeeCents) * i.quantity,
          )}</td>
        </tr>`,
    )
    .join("");

  const html = layout(
    "Pagamento confirmado 🎟️",
    `
      <p>Olá, ${order.buyerName.split(" ")[0]}! Seu pedido para <strong>${order.event.title}</strong> foi confirmado.</p>
      <p style="color: #555; font-size: 14px;">${formatDateTime(order.event.startsAt)} · ${order.event.venueName} — ${order.event.city}/${order.event.state}</p>
      <table style="width: 100%; border-top: 1px solid #ddd; margin-top: 16px; font-size: 14px;">
        ${itemsHtml}
        <tr>
          <td style="padding: 10px 0; border-top: 1px solid #ddd; font-weight: 700;">Total</td>
          <td style="padding: 10px 0; border-top: 1px solid #ddd; font-weight: 700; text-align: right;">${formatBRL(order.totalCents)}</td>
        </tr>
      </table>
      <a href="${APP_URL}/pedido/${order.code}"
         style="display: inline-block; margin-top: 16px; background: #a21caf; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">
        Ver meus ingressos
      </a>
      <p style="color: #888; font-size: 12px; margin-top: 16px;">Código do pedido: ${order.code}</p>
    `,
  );

  await sendEmail({
    to: order.buyerEmail,
    subject: `Ingresso confirmado — ${order.event.title}`,
    html,
  });
}
