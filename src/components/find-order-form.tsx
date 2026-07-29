"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FindOrderForm() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (email) router.push(`/meus-ingressos?email=${encodeURIComponent(email)}`);
      }}
    >
      <div>
        <label className="label">E-mail da compra</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          required
        />
      </div>
      <button className="btn-primary w-full">Buscar ingressos</button>
    </form>
  );
}
