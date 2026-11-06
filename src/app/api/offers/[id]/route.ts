import { NextResponse } from "next/server";
import { getSessionUser, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { company: { select: { name: true } } },
  });

  const user = await getSessionUser();
  const isOwner = Boolean(user?.company && offer && offer.companyId === user.company.id);
  if (!offer || (!offer.isActive && !isOwner)) {
    return NextResponse.json({ error: "Offre introuvable." }, { status: 404 });
  }

  if (!isOwner) {
    return NextResponse.json({
      offer: {
        id: offer.id,
        title: offer.title,
        body: offer.body,
        domain: offer.domain,
        isActive: offer.isActive,
        createdAt: offer.createdAt,
        company: offer.company,
      },
    });
  }

  return NextResponse.json({ offer });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await requireUser("EMPLOYER");
  if (!user?.company) {
    return NextResponse.json({ error: "Accès employeur requis." }, { status: 403 });
  }

  const { id } = await params;
  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer || offer.companyId !== user.company.id) {
    return NextResponse.json({ error: "Offre introuvable." }, { status: 404 });
  }

  await prisma.offer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
