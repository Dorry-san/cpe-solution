"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EmployerRegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Inscription impossible.");
      return;
    }
    router.push("/employer");
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <h1 className="text-2xl font-bold">Compte employeur</h1>
        <p className="mt-1 text-sm text-slate-600">Seules les informations de l'entreprise sont nécessaires.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input name="companyName" placeholder="Nom de l'entreprise" className="field" required />
          <input name="email" type="email" placeholder="Email professionnel" className="field" required />
          <input name="password" type="password" placeholder="Mot de passe (8 caractères minimum)" className="field" minLength={8} required />
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="btn w-full">{loading ? "Création..." : "Créer le compte"}</button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          Déjà inscrit ? <Link className="font-semibold text-blue-700" href="/employer/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
