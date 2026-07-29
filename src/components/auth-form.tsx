"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({
  mode,
  defaultOrganizer = false,
}: {
  mode: "login" | "register";
  defaultOrganizer?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    organizerName: "",
  });
  const [organizer, setOrganizer] = useState(defaultOrganizer);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { email: form.email, password: form.password }
            : { ...form, organizer },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível continuar.");
      router.push(data.organizer ? "/organizador" : "/meus-ingressos");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      {mode === "register" && (
        <div>
          <label className="label">Nome completo</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
      )}

      <div>
        <label className="label">E-mail</label>
        <input
          className="input"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="label">Senha</label>
        <input
          className="input"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          minLength={mode === "register" ? 8 : 1}
          required
        />
      </div>

      {mode === "register" && (
        <>
          <div>
            <label className="label">Celular (opcional)</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(11) 90000-0000"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-4">
            <input
              type="checkbox"
              checked={organizer}
              onChange={(e) => setOrganizer(e.target.checked)}
              className="mt-1 size-4 accent-violet-500"
            />
            <span className="text-sm">
              <span className="font-medium">Quero vender ingressos</span>
              <span className="block text-white/40">
                Cria também o perfil de produtor e libera o painel de eventos.
              </span>
            </span>
          </label>

          {organizer && (
            <div>
              <label className="label">Nome do produtor / marca</label>
              <input
                className="input"
                value={form.organizerName}
                onChange={(e) => setForm({ ...form, organizerName: e.target.value })}
                placeholder="Ex: A2 Eventos"
              />
            </div>
          )}
        </>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
      </button>
    </form>
  );
}
