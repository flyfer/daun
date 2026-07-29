"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateOrganizerForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultName);
  const [document, setDocument] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/organizer/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, document, pixKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Não foi possível ativar o perfil.");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <label className="label">Nome do produtor / marca</label>
        <input
          className="input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label">CNPJ ou CPF (opcional)</label>
        <input
          className="input"
          value={document}
          onChange={(e) => setDocument(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Chave Pix para repasse (opcional)</label>
        <input
          className="input"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder="CNPJ, e-mail ou chave aleatória"
        />
      </div>
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Ativando..." : "Ativar perfil de produtor"}
      </button>
    </form>
  );
}
