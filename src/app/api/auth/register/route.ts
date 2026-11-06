import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { employerRegistrationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = employerRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 }
    );
  }

  const { email, password, companyName } = parsed.data;
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
  }

  const createdUser = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      role: "EMPLOYER",
    },
  });

  if (companyName?.trim()) {
    await prisma.company.create({
      data: { name: companyName.trim(), ownerId: createdUser.id },
    });
  }

  await createSession(createdUser.id);
  return NextResponse.json({ id: createdUser.id, role: createdUser.role }, { status: 201 });
}
