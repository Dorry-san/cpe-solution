"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EmployerLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Connexion impossible.");
      return;
    }
    router.push("/employer");
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <h1 className="text-2xl font-bold">Connexion employeur</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input name="email" type="email" placeholder="Email professionnel" className="field" required />
          <input name="password" type="password" placeholder="Mot de passe" className="field" required />
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="btn w-full">{loading ? "Connexion..." : "Se connecter"}</button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          Pas de compte employeur ? <Link className="font-semibold text-blue-700" href="/employer/register">Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}

