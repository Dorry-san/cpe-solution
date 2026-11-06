import { NextResponse } from "next/server";
import { z } from "zod";
import { createApplicationSession } from "@/lib/auth";
import { deleteCv, extractCvContent, saveCv } from "@/lib/files";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

const applicationSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis."),
  lastName: z.string().min(1, "Le nom est requis."),
  email: z.string().email("L'email est invalide."),
  phone: z.string().optional(),
});

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer || !offer.isActive) {
    return NextResponse.json({ error: "Offre introuvable." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
  }

  const cvFile = formData.get("cv");
  if (!(cvFile instanceof File)) {
    return NextResponse.json({ error: "Le CV est requis." }, { status: 400 });
  }

  const parsed = applicationSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 }
    );
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const existingApplication = await prisma.application.findUnique({
    where: { offerId_email: { offerId: id, email: normalizedEmail } },
  });
  if (existingApplication) {
    return NextResponse.json(
      { error: "Cet email a déjà été utilisé pour cette offre." },
      { status: 409 }
    );
  }

  let cv;
  try {
    cv = await saveCv(cvFile);
    await extractCvContent(cv.fullPath);
  } catch (error) {
    if (cv) await deleteCv(cv.fullPath);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload impossible." },
      { status: 400 }
    );
  }

  const application = await prisma.application.create({
    data: {
      ...parsed.data,
      email: normalizedEmail,
      offerId: id,
      cvPath: cv.fullPath,
      cvFileName: cv.originalName,
    },
  });

  await createApplicationSession(application.id);
  return NextResponse.json({ application }, { status: 201 });
}
