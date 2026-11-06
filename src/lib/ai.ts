import OpenAI from "openai";
import { z } from "zod";

const scoreSchema = z.number().min(0).max(10).transform(Math.round);

export const screeningTestSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.number().int().min(1).max(3),
        question: z.string().min(5),
        options: z.array(z.string()).min(2).max(4),
      })
    )
    .length(3),
});

export const mainTestSchema = z.object({
  criteria: z.array(z.string().min(2)).min(2).max(10),
  questions: z
    .array(
      z.object({
        id: z.number().int().min(1).max(5),
        type: z.enum(["qcm", "problem", "situation"]),
        question: z.string().min(10),
        options: z.array(z.string()).max(4).optional(),
      })
    )
    .length(5),
});

export const screeningEvaluationSchema = z.object({
  score: scoreSchema,
  passed: z.boolean(),
  summary: z.string().min(3),
});

export const mainEvaluationSchema = z.object({
  totalScore: scoreSchema,
  criteriaScores: z
    .array(
      z.object({
        name: z.string().min(1),
        score: scoreSchema,
      })
    )
    .min(1),
  summary: z.string().min(3).max(500),
  strengths: z.array(z.string().min(2).max(120)).max(3),
  concerns: z.array(z.string().min(2).max(120)).max(3),
  recommendation: z.enum(["Recommandé", "À considérer", "Non recommandé"]).optional(),
}).transform((evaluation) => ({
  ...evaluation,
  recommendation: evaluation.recommendation ?? (
    evaluation.totalScore >= 8
      ? "Recommandé"
      : evaluation.totalScore > 5
        ? "À considérer"
        : "Non recommandé"
  ),
}));

export type ScreeningTest = z.infer<typeof screeningTestSchema>;
export type MainTest = z.infer<typeof mainTestSchema>;
export type ScreeningEvaluation = z.infer<typeof screeningEvaluationSchema>;
export type MainEvaluation = z.infer<typeof mainEvaluationSchema>;

export function createAiClient() {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error("GLM_API_KEY is not configured.");

  return new OpenAI({
    apiKey,
    baseURL: process.env.GLM_BASE_URL ?? "https://api.z.ai/api/v1",
    timeout: numberFromEnvironment("GLM_TIMEOUT_MS", 300000),
    maxRetries: numberFromEnvironment("GLM_MAX_RETRIES", 4),
  });
}

function numberFromEnvironment(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function completeJson<T>(schema: z.ZodType<T>, system: string, user: string) {
  const client = createAiClient();
  const effortValue = process.env.GLM_REASONING_EFFORT ?? "high";
  const effort: "low" | "high" = effortValue === "low" ? "low" : "high";
  const configuredMaxOutputTokens = Number(process.env.GLM_MAX_OUTPUT_TOKENS ?? "8000");
  const maxOutputTokens =
    Number.isFinite(configuredMaxOutputTokens) && configuredMaxOutputTokens > 0
      ? configuredMaxOutputTokens
      : 8000;

  const response = await client.responses.create({
    model: process.env.GLM_MODEL ?? "glm-5.3-flash",
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text: {
      format: { type: "json_object" },
    },
    reasoning: { effort },
    max_output_tokens: maxOutputTokens,
  });

  if (response.status !== "completed") {
    throw new Error(
      `La génération IA est incomplète (${response.status}${response.incomplete_details?.reason ? ` : ${response.incomplete_details.reason}` : ""}).`
    );
  }

  const content = response.output_text;
  if (!content) throw new Error("L'IA n'a retourné aucune réponse.");

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error("L'IA a retourné un JSON invalide.");
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "racine"} : ${issue.message}`)
      .join(" ; ");
    throw new Error(`La réponse de l'IA ne respecte pas le format attendu. ${issues}`);
  }
  return parsed.data;
}

export function generateScreeningTest(input: { offerTitle: string; offerBody: string; needs: string; domain: string; criticalSkills?: string | null; cvContent: string }) {
  return completeJson(
    screeningTestSchema,
    "Tu es un assistant de recrutement. Réponds uniquement avec un objet JSON valide.",
    `Génère exactement 3 questions très simples de pré-filtrage pour cette offre.
Chaque question doit avoir 2 à 4 options. Vérifie si le candidat a des notions liées au domaine et veut travailler dans ce domaine.
Le problème spécifique doit rester cohérent avec le corps de l'offre et sert à préparer le test du candidat.
Une connaissance critique ne peut être utilisée que si cette notion est déjà présente dans le corps de l'offre.

Domaine : ${input.domain}
Titre : ${input.offerTitle}
Offre : ${input.offerBody}
Problème spécifique réservé au test : ${input.needs}
Connaissances critiques déjà présentes dans l'offre : ${input.criticalSkills?.trim() || "Aucune"}
Contenu du CV du candidat : ${input.cvContent}

Format attendu : {"questions":[{"id":1,"question":"...","options":["..."]},...]}`
  );
}

export function generateMainTest(input: { offerTitle: string; offerBody: string; needs: string; domain: string; criticalSkills?: string | null; cvContent: string }) {
  return completeJson(
    mainTestSchema,
    "Tu conçois des tests de recrutement équilibrés. Réponds uniquement avec un objet JSON valide.",
    `Génère exactement 5 questions adaptées à cette offre et au profil recherché.
Renvoie entre 2 et 6 critères maximum.
Mélange des QCM, problèmes métier et mises en situation. Ne génère aucune épreuve de code ni demande d'écriture de code.
Utilise seulement des questions de connaissances conceptuelles si "Connaissances critiques" contient explicitement un langage, un outil ou une librairie.
Le problème spécifique doit être directement lié au corps de l'offre et constituer la matière principale du test.
Les questions ne doivent être ni trop courtes ni trop longues. Le CV du candidat sera joint à l'évaluation par le backend.

Domaine : ${input.domain}
Titre : ${input.offerTitle}
Offre : ${input.offerBody}
Problème spécifique réservé au test : ${input.needs}
Connaissances critiques déjà présentes dans l'offre : ${input.criticalSkills?.trim() || "Aucune"}
Contenu du CV du candidat : ${input.cvContent}

Format attendu : {"criteria":["..."],"questions":[{"id":1,"type":"qcm|problem|situation","question":"...","options":["..."]},...]}`
  );
}

export function evaluateScreening(input: { questions: unknown; answers: unknown; cvContent: string }) {
  return completeJson(
    screeningEvaluationSchema,
    "Tu évalues des réponses de pré-filtrage de façon objective. Réponds uniquement avec un objet JSON valide.",
    `Évalue ces réponses de pré-filtrage. Un score de 7 ou plus signifie généralement que le candidat passe.
Questions : ${JSON.stringify(input.questions)}
Réponses : ${JSON.stringify(input.answers)}
Contenu du CV du candidat : ${input.cvContent}

Format attendu : {"score":0,"passed":true,"summary":"..."}`
  );
}

export function evaluateMainTest(input: { offerTitle: string; offerBody: string; needs: string; domain: string; questions: unknown; answers: unknown; criticalSkills?: string | null; cvContent: string }) {
  return completeJson(
    mainEvaluationSchema,
    "Tu évalues un test de recrutement et produis un score détaillé. Réponds uniquement avec un objet JSON valide.",
    `Évalue le test sur 10 points. Fournis un score de 0 à 10 pour chaque critère, le score total et une synthèse très courte pour l'employeur.
Domaine : ${input.domain}
Titre : ${input.offerTitle}
Corps de l'offre : ${input.offerBody}
Problème spécifique utilisé pour le test : ${input.needs}
Connaissances critiques déjà présentes dans l'offre : ${input.criticalSkills?.trim() || "Aucune"}
Contenu du CV du candidat : ${input.cvContent}
Questions : ${JSON.stringify(input.questions)}
Réponses : ${JSON.stringify(input.answers)}

Le score total est 0 si aucune réponse n'est pertinente et 10 si toutes les réponses sont excellentes.
Un score de 5 ou moins n'est pas suffisant. Plus de 5 est considéré comme à considérer ou recommandé selon la qualité.
"summary" doit contenir au maximum deux phrases factuelles. "strengths" et "concerns" doivent contenir au maximum trois points courts.
"recommendation" doit être exactement "Recommandé", "À considérer" ou "Non recommandé".

Format attendu : {"totalScore":0,"criteriaScores":[{"name":"...","score":0}],"summary":"...","strengths":["..."],"concerns":["..."],"recommendation":"..."}`
  );
}

