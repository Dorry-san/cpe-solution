"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Offer = {
  id: string;
  title: string;
  domain: string;
  isActive: boolean;
  body: string;
};

type CurrentUser = {
  role: "EMPLOYER";
  company?: { name: string } | null;
};

export default function EmployerPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [checked, setChecked] = useState(false);

  async function loadData() {
    const authResponse = await fetch("/api/auth/me");
    const authData = await authResponse.json();
    setUser(authData.user);

    if (authData.user?.role !== "EMPLOYER") {
      setChecked(true);
      return;
    }

    const offersResponse = await fetch("/api/offers?scope=mine");
    const offersData = await offersResponse.json();
    setOffers(offersData.offers ?? []);
    setChecked(true);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setOffers([]);
  }

  useEffect(() => {
    loadData();
  }, []);

  if (!checked) {
    return <div className="card text-sm text-slate-600">Chargement...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="card">
          <h1 className="text-2xl font-bold">Espace employeur</h1>
          <p className="mt-2 text-sm text-slate-600">Connectez-vous pour publier et gérer vos offres.</p>
          <div className="mt-6 flex gap-3">
            <Link href="/employer/login" className="btn">Se connecter</Link>
            <Link href="/employer/register" className="btn-secondary">Créer un compte</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Espace employeur</h1>
          <p className="text-sm text-slate-600">{user.company?.name ?? "Entreprise non configurée"}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/employer/offers/new" className="btn">Publier une offre</Link>
          <button onClick={loadData} className="btn-secondary">Actualiser</button>
          <button onClick={logout} className="btn-secondary">Se déconnecter</button>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Mes offres</h2>
        {offers.length === 0 && <div className="card text-sm text-slate-600">Aucune offre publiée.</div>}
        <div className="grid gap-4 md:grid-cols-2">
          {offers.map((offer) => (
            <article key={offer.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{offer.title}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${offer.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                  {offer.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <span className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{offer.domain}</span>
              <p className="mt-3 line-clamp-2 text-sm text-slate-600">{offer.body}</p>
              <div className="mt-5 flex gap-3">
                <Link href={`/employer/offers/${offer.id}/review`} className="btn">Prévisualiser</Link>
                <Link href={`/employer/offers/${offer.id}/candidates`} className="btn-secondary">Candidats</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
