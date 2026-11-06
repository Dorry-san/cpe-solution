import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email ou mot de passe invalide." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return NextResponse.json({ error: "Email ou mot de passe invalide." }, { status: 401 });
  }

  if (user.role !== "EMPLOYER") {
    return NextResponse.json({ error: "Cet espace est réservé aux employeurs." }, { status: 403 });
  }

  await createSession(user.id);
  return NextResponse.json({ id: user.id, role: user.role });
}
