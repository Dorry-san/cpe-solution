"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Offer = {
  id: string;
  title: string;
  body: string;
  domain: string;
  company: { name: string };
};

export default function CandidateHomePage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/offers")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Chargement impossible.");
        setOffers(data.offers ?? []);
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-blue-600 p-8 text-white">
        <h1 className="text-3xl font-bold">Offres pour candidats</h1>
        <p className="mt-2 max-w-2xl text-blue-100">
          Consultez un aperçu, ouvrez l&apos;offre complète, puis postulez sans créer de compte.
        </p>
      </section>

      {loading && <div className="card text-sm text-slate-600">Chargement des offres...</div>}
      {error && <div className="card bg-red-50 text-sm text-red-700">{error}</div>}

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Offres disponibles</h2>
        {!loading && !error && offers.length === 0 && (
          <div className="card text-sm text-slate-600">Aucune offre disponible pour le moment.</div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {offers.map((offer) => (
            <article key={offer.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{offer.title}</h3>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{offer.domain}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-500">{offer.company.name}</p>
              <p className="mt-3 line-clamp-2 text-sm text-slate-600">{offer.body}</p>
              <Link href={`/offers/${offer.id}`} className="btn mt-5">Voir l&apos;offre</Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
