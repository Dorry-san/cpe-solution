import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readCv } from "@/lib/files";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await requireUser("EMPLOYER");
  if (!user?.company) {
    return NextResponse.json({ error: "Accès employeur requis." }, { status: 403 });
  }

  const { id } = await params;
  const application = await prisma.application.findUnique({
    where: { id },
    include: { offer: { select: { companyId: true } } },
  });

  if (!application || application.offer.companyId !== user.company.id) {
    return NextResponse.json({ error: "Candidature introuvable." }, { status: 404 });
  }

  try {
    const file = await readCv(application.cvPath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(application.cvFileName)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "CV introuvable." }, { status: 404 });
  }
}
