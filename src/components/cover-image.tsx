"use client";

import { useState } from "react";

/**
 * Capa do evento com fallback: se a URL informada pelo produtor quebrar,
 * mostra o gradiente padrão em vez de um ícone de imagem quebrada.
 */
export function CoverImage({
  src,
  alt,
  className = "",
  zoomOnHover = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  zoomOnHover?: boolean;
}) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div
        className={`grid size-full place-items-center bg-linear-to-br from-brand-600/40 to-accent-500/40 text-5xl ${className}`}
      >
        🎟️
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className={`size-full object-cover ${
        zoomOnHover ? "transition duration-500 group-hover:scale-105" : ""
      } ${className}`}
    />
  );
}
