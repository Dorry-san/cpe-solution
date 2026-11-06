"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Criterion = { name: string; score: number };
type AnswerValue = string | number | boolean | null;
type Question = {
  id?: number;
  question?: string;
  options?: string[];
};
type TestSummary = {
  id: string;
  type: "SCREENING" | "MAIN";
  questions?: unknown;
  answers?: unknown;
  totalScore?: number | null;
  criteriaScores?: Criterion[] | null;
  aiSummary?: string | null;
};
type EvaluationSummary = {
  summary?: string;
  strengths?: string[];
  concerns?: string[];
  recommendation?: "Recommandé" | "À considérer" | "Non recommandé";
};

type Application = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: string;
  screeningPassed?: boolean | null;
  tests: TestSummary[];
};

function parseEvaluation(value?: string | null): EvaluationSummary | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as EvaluationSummary;
  } catch {
    return { summary: value };
  }
}

function parseQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Question =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Question).question === "string"
    )
    .sort((first, second) => (first.id ?? 0) - (second.id ?? 0));
}

function parseAnswers(value: unknown): AnswerValue[] {
  if (!Array.isArray(value)) return [];

  return value.filter((answer): answer is AnswerValue =>
    typeof answer === "string" ||
    typeof answer === "number" ||
    typeof answer === "boolean" ||
    answer === null
  );
}

function formatAnswer(value: AnswerValue | undefined) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
    return "Aucune réponse fournie";
  }
  if (typeof value === "boolean") return value ? "Oui" : "Non";

  return String(value);
}

export default function OfferCandidatesPage() {
  const params = useParams<{ id: string }>();
  const [minScore, setMinScore] = useState(7);
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({
      offerId: params.id,
      minScore: minScore.toString(),
    });
    const response = await fetch(`/api/applications?${query}`);
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Chargement impossible.");
      return;
    }
    setApplications(data.applications ?? []);
  }, [minScore, params.id]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Link href={`/employer/offers/${params.id}/review`} className="btn-secondary">Retour à l&apos;offre</Link>
        <Link href="/employer" className="btn-secondary">Tableau de bord</Link>
      </div>
      <div className="card">
        <h1 className="text-2xl font-bold">Candidats</h1>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Score minimum (/10)</label>
            <input type="number" min={0} max={10} value={minScore} onChange={(event) => setMinScore(Number(event.target.value))} className="field" />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Filtre par défaut : à partir de 7/10.</p>
      </div>

      {loading && <div className="card text-sm">Chargement...</div>}
      {error && <div className="card bg-red-50 text-sm text-red-700">{error}</div>}

      <div className="space-y-4">
        {applications.map((application) => {
          const mainTest = application.tests.find((test) => test.type === "MAIN");
          const screeningTest = application.tests.find((test) => test.type === "SCREENING");
          const screeningFailed =
            application.screeningPassed === false ||
            (application.screeningPassed == null &&
              screeningTest?.totalScore != null &&
              screeningTest.totalScore < 7);
          const evaluation = parseEvaluation(mainTest?.aiSummary);
          const isExpanded = expandedApplicationId === application.id;

          function toggleQuestionnaire() {
            setExpandedApplicationId(isExpanded ? null : application.id);
          }

          return (
            <article key={application.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{application.firstName} {application.lastName}</h2>
                  <p className="text-sm text-slate-600">{application.email}{application.phone ? ` — ${application.phone}` : ""}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Statut : {application.status === "RESULTS_READY" ? "Retenu" : application.status === "REJECTED" ? "Non retenu" : application.status}
                  </p>
                </div>
                {mainTest?.totalScore != null && (
                  <div className="rounded-xl bg-blue-50 px-4 py-2 text-blue-800">
                    <span className="text-xl font-bold">{mainTest.totalScore}</span>
                    <span className="text-sm">/10</span>
                  </div>
                )}
              </div>

              {evaluation?.recommendation && (
                <p className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{evaluation.recommendation}</p>
              )}

              {mainTest?.criteriaScores?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {mainTest.criteriaScores.map((criterion) => (
                    <span key={criterion.name} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                      {criterion.name} : {criterion.score}/10
                    </span>
                  ))}
                </div>
              ) : null}

              {evaluation?.summary && <p className="mt-4 text-sm text-slate-700">{evaluation.summary}</p>}

              {screeningFailed && (
                <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-amber-800">
                    Premier test de filtrage non réussi
                  </summary>
                  <div className="border-t border-amber-200 px-4 py-3 text-sm text-amber-900">
                    <p>
                      Score d&apos;intérêt : {screeningTest?.totalScore ?? "non disponible"}/10.
                      Ce filtre sert surtout à vérifier la motivation et la pertinence immédiate de la candidature.
                    </p>
                    {screeningTest?.aiSummary && <p className="mt-2">Observation : {screeningTest.aiSummary}</p>}
                  </div>
                </details>
              )}

              {(evaluation?.strengths?.length || evaluation?.concerns?.length) && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-semibold text-emerald-700">Points forts</h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {evaluation.strengths?.slice(0, 3).map((item, index) => <li key={index}>• {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-amber-700">Points d&apos;attention</h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {evaluation.concerns?.slice(0, 3).map((item, index) => <li key={index}>• {item}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={toggleQuestionnaire} className="btn-secondary">
                  {isExpanded ? "Masquer le questionnaire" : "Voir le questionnaire et les réponses"}
                </button>
                <a href={`/api/applications/${application.id}/cv`} className="btn-secondary">Télécharger le CV</a>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {[screeningTest, mainTest].map((test) => {
                    if (!test) return null;

                    const questions = parseQuestions(test.questions);
                    const answers = parseAnswers(test.answers);
                    const title = test.type === "SCREENING"
                      ? "Questionnaire de pré-filtrage"
                      : "Questionnaire principal";

                    return (
                      <section key={test.id}>
                        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                        <div className="mt-3 space-y-3">
                          {questions.map((question, index) => (
                            <div key={question.id ?? index} className="rounded-lg border border-slate-200 bg-white p-3">
                              <p className="font-medium text-slate-900">{index + 1}. {question.question}</p>
                              <p className="mt-2 text-sm text-slate-600">
                                Réponse : <span className="font-medium text-slate-800">{formatAnswer(answers[index])}</span>
                              </p>
                            </div>
                          ))}
                          {!questions.length && <p className="text-sm text-slate-600">Aucune question disponible.</p>}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
        {!loading && !error && applications.length === 0 && (
          <div className="card text-sm text-slate-600">Aucun candidat ne correspond à ce filtre.</div>
        )}
      </div>
    </div>
  );
}
