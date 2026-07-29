import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-20 text-center">
      <p className="text-6xl">🎟️</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-white/50">
        O link pode ter expirado ou o evento saiu do ar.
      </p>
      <Link href="/" className="btn-primary">
        Voltar para a home
      </Link>
    </div>
  );
}
