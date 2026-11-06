"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Offer = {
  id: string;
  title: string;
  body: string;
  domain: string;
  company: { name: string };
};

export default function CandidateOfferPage() {
  const params = useParams<{ id: string }>();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/offers/${params.id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Offre introuvable.");
        setOffer(data.offer);
      })
      .catch((reason) => setError(reason.message));
  }, [params.id]);

  if (error && !offer) return <div className="card bg-red-50 text-sm text-red-700">{error}</div>;
  if (!offer) return <div className="card text-sm text-slate-600">Chargement de l&apos;offre...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{offer.title}</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">{offer.company.name}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{offer.domain}</span>
        </div>
      </div>

      <div className="card space-y-5">
        <section>
          <h2 className="font-semibold">Description de l&apos;offre</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{offer.body}</p>
        </section>
      </div>

      <div className="flex gap-3">
        <Link href={`/offers/${offer.id}/apply`} className="btn">Postuler</Link>
        <Link href="/" className="btn-secondary">Retour aux offres</Link>
      </div>
    </div>
  );
}
