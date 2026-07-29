import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Criar conta" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ produtor?: string }>;
}) {
  if (await getSession()) redirect("/");
  const { produtor } = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">
          {produtor ? "Criar conta de produtor" : "Criar conta"}
        </h1>
        <p className="text-sm text-white/50">
          {produtor
            ? "Publique eventos e acompanhe as vendas em tempo real."
            : "Leva menos de um minuto."}
        </p>
      </div>
      <AuthForm mode="register" defaultOrganizer={Boolean(produtor)} />
      <p className="text-center text-sm text-white/40">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-brand-400 hover:text-brand-300">
          Entrar
        </Link>
      </p>
    </div>
  );
}
