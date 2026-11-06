"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Offer = {
  title: string;
  company: { name: string };
};

export default function CandidateApplyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/offers/${params.id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Offre introuvable.");
        setOffer(data.offer);
      })
      .catch((reason) => setError(reason.message));
  }, [params.id]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);

    const response = await fetch(`/api/offers/${params.id}/applications`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Candidature impossible.");
      return;
    }
    router.push(`/applications/${data.application.id}/test`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold">Postuler</h1>
        <p className="mt-1 text-sm text-slate-600">
          {offer ? `${offer.title} — ${offer.company.name}` : "Chargement de l'offre..."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <input name="firstName" placeholder="Prénom" className="field" required />
          <input name="lastName" placeholder="Nom" className="field" required />
        </div>
        <input name="email" type="email" placeholder="Email" className="field" required />
        <input name="phone" placeholder="Téléphone (optionnel)" className="field" />
        <div>
          <label className="mb-1 block text-sm font-medium">CV PDF, DOC ou DOCX (5 Mo maximum)</label>
          <input name="cv" type="file" accept=".pdf,.doc,.docx,application/pdf" className="field" required />
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="btn w-full">{loading ? "Envoi..." : "Continuer"}</button>
      </form>
    </div>
  );
}
