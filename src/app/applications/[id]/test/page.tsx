"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Question = {
  id: number;
  type?: "qcm" | "problem" | "situation";
  question: string;
  options?: string[];
};

type Questionnaire = {
  testId: string;
  questions: Question[];
};

type AnswerValue = string | number | boolean | null;

export default function CandidateQuestionnairePage() {
  const params = useParams<{ id: string }>();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<AnswerValue[]>([]);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"generating" | "evaluating">("generating");

  useEffect(() => {
    setLoading(true);
    setLoadingPhase("generating");
    fetch(`/api/applications/${params.id}/tests`, { method: "POST" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Questionnaire indisponible.");
        if (data.completed) {
          setCompleted(true);
          return;
        }
        setQuestionnaire(data);
        setAnswers(new Array(data.questions.length).fill(null));
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function submitQuestions() {
    if (!questionnaire) return;
    setLoading(true);
    setLoadingPhase("evaluating");
    setError(null);

    const response = await fetch(`/api/tests/${questionnaire.testId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId: questionnaire.testId, answers }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Envoi impossible.");
      return;
    }

    if (data.completed) {
      setCompleted(true);
      setQuestionnaire(null);
      return;
    }

    setQuestionnaire({ testId: data.testId, questions: data.questions });
    setAnswers(new Array(data.questions.length).fill(null));
  }

  function updateAnswer(index: number, value: AnswerValue) {
    setAnswers((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
        <div className="card w-full text-center">
          <div aria-hidden="true" className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <h1 className="mt-6 text-xl font-bold">
            {loadingPhase === "generating" ? "Préparation du questionnaire" : "Analyse de vos réponses"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">Veuillez patienter, cela peut prendre quelques instants.</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card bg-green-50 text-center">
          <h1 className="text-2xl font-bold text-green-800">Candidature transmise</h1>
          <p className="mt-3 text-sm text-green-700">Merci. L&apos;entreprise examinera votre candidature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold">Questionnaire de candidature</h1>
        <p className="mt-1 text-sm text-slate-600">Répondez aux questions suivantes pour compléter votre candidature.</p>
      </div>

      {error && <div className="card bg-red-50 text-sm text-red-700">{error}</div>}

      {questionnaire && (
        <div className="space-y-4">
          {questionnaire.questions.map((question, index) => (
            <article key={question.id} className="card">
              <h2 className="font-semibold">{index + 1}. {question.question}</h2>
              {question.options?.length ? (
                <div className="mt-4 space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <label key={optionIndex} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="radio" name={`question-${question.id}`} checked={answers[index] === option} onChange={() => updateAnswer(index, option)} />
                      {option}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea className="field mt-4 min-h-28" value={typeof answers[index] === "string" ? answers[index] : ""} onChange={(event) => updateAnswer(index, event.target.value)} placeholder="Votre réponse..." />
              )}
            </article>
          ))}

          <button onClick={submitQuestions} disabled={answers.some((answer) => answer === null || answer === "")} className="btn w-full">Envoyer mes réponses</button>
        </div>
      )}
    </div>
  );
}
