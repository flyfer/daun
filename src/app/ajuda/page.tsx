import Link from "next/link";

export const metadata = { title: "Ajuda" };

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "Ticketeira";

const FAQ = [
  {
    q: "Como recebo meu ingresso?",
    a: "Assim que o pagamento é confirmado, o ingresso fica disponível na página do pedido e em 'Meus ingressos'. Cada ingresso tem um QR Code único que só pode ser lido uma vez na portaria.",
  },
  {
    q: "Quanto tempo leva a confirmação do Pix?",
    a: "Normalmente segundos. A página do pedido atualiza sozinha quando o banco confirma. O código Pix expira em 30 minutos e, se não for pago, os ingressos voltam para o estoque.",
  },
  {
    q: "Posso cancelar minha compra?",
    a: "Sim. Pelo Código de Defesa do Consumidor você pode desistir em até 7 dias da compra, desde que faltem mais de 48 horas para o evento. Fale com o suporte pelo e-mail informado na confirmação.",
  },
  {
    q: "Sou produtor. Quanto custa vender aqui?",
    a: "Criar e publicar o evento é gratuito. Cobramos apenas uma taxa de serviço sobre cada ingresso vendido, que você escolhe repassar ao comprador ou absorver. Ingressos gratuitos não têm taxa.",
  },
  {
    q: "Quando recebo o dinheiro das vendas?",
    a: "O repasse é feito em D+2 após a realização do evento, na chave Pix cadastrada no seu perfil de produtor.",
  },
  {
    q: "Como funciona o check-in?",
    a: "No painel do evento existe a tela de check-in. Use um leitor de QR Code (funciona como teclado) ou digite o código do ingresso. Ingressos já usados ou de outro evento são bloqueados na hora.",
  },
];

export default function AjudaPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Central de ajuda</h1>
        <p className="text-sm text-white/50">
          Dúvidas frequentes sobre compras e vendas no {BRAND}.
        </p>
      </div>

      <div className="space-y-3">
        {FAQ.map((item) => (
          <details key={item.q} className="card group">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">
              <span className="mr-2 text-brand-400 transition group-open:rotate-90 inline-block">
                ›
              </span>
              {item.q}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{item.a}</p>
          </details>
        ))}
      </div>

      <div className="card text-center">
        <p className="mb-3 text-white/60">Não achou o que precisava?</p>
        <Link href="/eventos" className="btn-primary">
          Ver eventos
        </Link>
      </div>
    </div>
  );
}
