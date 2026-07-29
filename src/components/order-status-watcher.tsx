"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Faz polling do status enquanto o pedido está pendente e recarrega quando muda. */
export function OrderStatusWatcher({
  code,
  status,
}: {
  code: string;
  status: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "PENDING") return;
    let stopped = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/orders/${code}/status`, { cache: "no-store" });
        const data = await res.json();
        if (!stopped && data.status && data.status !== "PENDING") router.refresh();
      } catch {
        /* offline: tenta de novo no próximo ciclo */
      }
    };

    const id = setInterval(tick, 4000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [code, status, router]);

  return null;
}
