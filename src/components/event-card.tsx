import Link from "next/link";
import { formatBRL } from "@/lib/money";
import { formatDateShort, formatTime } from "@/lib/dates";
import { CoverImage } from "./cover-image";

type Props = {
  event: {
    slug: string;
    title: string;
    city: string;
    state: string;
    venueName: string;
    category: string;
    coverUrl: string | null;
    startsAt: Date;
  };
  fromCents: number | null;
  soldOut?: boolean;
};

export function EventCard({ event, fromCents, soldOut }: Props) {
  return (
    <Link
      href={`/e/${event.slug}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-ink-900 transition hover:-translate-y-1 hover:border-brand-500/50 hover:shadow-xl hover:shadow-brand-600/10"
    >
      <div className="relative aspect-16/9 overflow-hidden bg-ink-800">
        <CoverImage src={event.coverUrl} alt={event.title} zoomOnHover />
        <span className="absolute left-3 top-3 badge bg-black/70 text-white/90 backdrop-blur">
          {event.category}
        </span>
        {soldOut && (
          <span className="absolute right-3 top-3 badge bg-red-500/90 text-white">
            Esgotado
          </span>
        )}
      </div>

      <div className="space-y-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">
          {formatDateShort(event.startsAt)} · {formatTime(event.startsAt)}
        </p>
        <h3 className="line-clamp-2 font-bold leading-snug">{event.title}</h3>
        <p className="line-clamp-1 text-sm text-white/50">
          {event.venueName} · {event.city}/{event.state}
        </p>
        <p className="pt-1 text-sm">
          {fromCents === null ? (
            <span className="text-white/40">Em breve</span>
          ) : fromCents === 0 ? (
            <span className="font-semibold text-emerald-400">Gratuito</span>
          ) : (
            <>
              <span className="text-white/40">a partir de </span>
              <span className="font-semibold">{formatBRL(fromCents)}</span>
            </>
          )}
        </p>
      </div>
    </Link>
  );
}
