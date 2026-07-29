const MAP: Record<string, [string, string]> = {
  DRAFT: ["Rascunho", "bg-white/10 text-white/60"],
  PUBLISHED: ["Publicado", "bg-emerald-500/20 text-emerald-300"],
  CANCELLED: ["Cancelado", "bg-red-500/20 text-red-300"],
  FINISHED: ["Encerrado", "bg-sky-500/20 text-sky-300"],
};

export function StatusBadge({ status }: { status: string }) {
  const [text, className] = MAP[status] ?? MAP.DRAFT;
  return <span className={`badge ${className}`}>{text}</span>;
}
