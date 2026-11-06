"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewOfferPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Création impossible.");
      return;
    }
    router.push(`/employer/offers/${data.offer.id}/review`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/employer" className="btn-secondary">Retour au tableau de bord</Link>
      </div>
      <div className="card">
        <h1 className="text-2xl font-bold">Nouvelle offre</h1>
        <p className="mt-1 text-sm text-slate-600">Vous pourrez revoir et modifier chaque paramètre après création.</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <input name="title" placeholder="Titre de l'offre" className="field" required />
        <input name="domain" placeholder="Domaine (ex: Développement Web, Comptabilité)" className="field" required />
        <textarea name="body" placeholder="Corps de l'offre" className="field min-h-32" required />
        <div className="space-y-2">
          <label className="block text-sm font-medium">Problème spécifique donné pour le test</label>
          <textarea name="specificNeeds" placeholder="Décrivez le problème que le candidat devra traiter pendant son test" className="field min-h-24" required />
          <p className="text-xs text-slate-500">Ce problème n&apos;est pas visible par le candidat. Il doit être directement lié au corps de l&apos;offre.</p>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Connaissances critiques (optionnel)</label>
          <textarea name="criticalSkills" placeholder="Langage, outil ou librairie déjà présent dans le corps de l'offre" className="field min-h-20" />
          <p className="text-xs text-slate-500">Utilisez ce champ seulement pour insister sur une notion déjà présente dans le corps de l&apos;offre.</p>
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="btn w-full">{loading ? "Création..." : "Créer et revoir"}</button>
      </form>
    </div>
  );
}

