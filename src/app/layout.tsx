import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { UserMenu } from "@/components/user-menu";

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "Ticketeira";

export const metadata: Metadata = {
  title: {
    default: `${BRAND} — ingressos para os melhores eventos`,
    template: `%s · ${BRAND}`,
  },
  description:
    "Compre ingressos online com segurança e crie seu evento de graça. Pix, cartão e repasse rápido.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-linear-to-br from-brand-500 to-accent-500 text-sm font-black">
                {BRAND.charAt(0)}
              </span>
              <span className="text-lg font-bold tracking-tight">{BRAND}</span>
            </Link>

            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/eventos"
                className="hidden rounded-lg px-3 py-2 text-white/70 hover:text-white sm:block"
              >
                Eventos
              </Link>
              <Link
                href="/meus-ingressos"
                className="hidden rounded-lg px-3 py-2 text-white/70 hover:text-white sm:block"
              >
                Meus ingressos
              </Link>
              <UserMenu session={session} />
            </nav>
          </div>
        </header>

        <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-8">{children}</main>

        <footer className="mt-16 border-t border-white/10 py-10 text-sm text-white/40">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {BRAND}. Plataforma de venda de ingressos.
            </p>
            <div className="flex gap-4">
              <Link href="/organizador" className="hover:text-white">
                Criar evento
              </Link>
              <Link href="/ajuda" className="hover:text-white">
                Ajuda
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
