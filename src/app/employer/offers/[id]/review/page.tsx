"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Offer = {
  id: string;
  title: string;
  body: string;
  specificNeeds: string;
  criticalSkills?: string | null;
  domain: string;
  isActive: boolean;
  company: { name: string };
};

export default function OfferPreviewPage() {
  const params = useParams<{ id: string }>();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOffer = useCallback(async () => {
    const response = await fetch(`/api/offers/${params.id}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Offre introuvable.");
      return;
    }
    setOffer(data.offer);
  }, [params.id]);

  useEffect(() => {
    loadOffer();
  }, [loadOffer]);

  if (error && !offer) {
    return <div className="card bg-red-50 text-sm text-red-700">{error}</div>;
  }

  if (!offer) {
    return <div className="card text-sm text-slate-600">Chargement de la prévisualisation...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Prévisualisation de l&apos;offre</h1>
          <p className="text-sm text-slate-600">{offer.company.name}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${offer.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
          {offer.isActive ? "Publiée" : "Inactive"}
        </span>
      </div>

      <div className="card space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">TITRE</p>
          <p className="text-lg font-semibold">{offer.title}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">DOMAINE</p>
          <p>{offer.domain}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">CORPS DE L&apos;OFFRE</p>
          <p className="whitespace-pre-line text-sm text-slate-700">{offer.body}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">BESOIN SPÉCIFIQUE</p>
          <p className="whitespace-pre-line text-sm text-slate-700">{offer.specificNeeds}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">CONNAISSANCES CRITIQUES</p>
          <p className="whitespace-pre-line text-sm text-slate-700">{offer.criticalSkills || "Aucune"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/employer" className="btn-secondary">Retour au tableau de bord</Link>
        <Link href={`/employer/offers/${offer.id}/candidates`} className="btn-secondary">Voir les candidats</Link>
      </div>
    </div>
  );
}
