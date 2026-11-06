import { z } from "zod";

export const employerRegistrationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
  companyName: z.string().min(1, "Le nom de l'entreprise est requis."),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const offerSchema = z.object({
  title: z.string().min(3, "Le titre est trop court."),
  body: z.string().min(30, "Décrivez l'offre avec au moins 30 caractères."),
  specificNeeds: z.string().min(10, "Décrivez le problème ou les besoins spécifiques."),
  criticalSkills: z.string().max(500, "Les connaissances critiques sont trop longues.").optional(),
  domain: z.string().min(2, "Le domaine est requis."),
});

export const screeningAnswersSchema = z.object({
  testId: z.string().min(1),
  answers: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).length(3),
});

export const mainAnswersSchema = z.object({
  testId: z.string().min(1),
  answers: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).length(5),
});

export type ScreeningAnswersInput = z.infer<typeof screeningAnswersSchema>;
export type MainAnswersInput = z.infer<typeof mainAnswersSchema>;

