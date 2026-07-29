"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionPayload } from "@/lib/auth";

export function UserMenu({ session }: { session: SessionPayload | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/entrar" className="rounded-lg px-3 py-2 text-white/70 hover:text-white">
          Entrar
        </Link>
        <Link href="/organizador" className="btn-primary !px-4 !py-2">
          Criar evento
        </Link>
      </div>
    );
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10"
      >
        <span className="grid size-6 place-items-center rounded-full bg-brand-600 text-xs font-bold">
          {session.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-28 truncate sm:block">
          {session.name.split(" ")[0]}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-ink-800 shadow-2xl">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="truncate text-sm font-medium">{session.name}</p>
              <p className="truncate text-xs text-white/40">{session.email}</p>
            </div>
            <Link
              href="/meus-ingressos"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm hover:bg-white/5"
            >
              Meus ingressos
            </Link>
            <Link
              href="/organizador"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm hover:bg-white/5"
            >
              Painel do produtor
            </Link>
            <button
              onClick={logout}
              className="w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/5"
            >
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}
