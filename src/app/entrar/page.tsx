import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Entrar</h1>
        <p className="text-sm text-white/50">
          Acesse seus ingressos e o painel do produtor.
        </p>
      </div>
      <AuthForm mode="login" />
      <p className="text-center text-sm text-white/40">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-brand-400 hover:text-brand-300">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
