import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { offerSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  const scope = url.searchParams.get("scope");

  if (scope === "mine") {
    const user = await requireUser("EMPLOYER");
    if (!user?.company) {
      return NextResponse.json({ error: "Accès employeur requis." }, { status: 403 });
    }

    const ownOffers = await prisma.offer.findMany({
      where: { companyId: user.company.id },
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ offers: ownOffers });
  }

  const offers = await prisma.offer.findMany({
    where: {
      isActive: true,
      ...(domain ? { domain: { contains: domain, mode: "insensitive" } } : {}),
    },
      select: {
        id: true,
        title: true,
        body: true,
        domain: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ offers });
}

export async function POST(request: Request) {
  const user = await requireUser("EMPLOYER");
  if (!user?.company) {
    return NextResponse.json({ error: "Accès employeur requis." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = offerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 }
    );
  }

  const offer = await prisma.offer.create({
    data: { ...parsed.data, companyId: user.company.id },
    include: { company: { select: { name: true } } },
  });

  return NextResponse.json({ offer }, { status: 201 });
}
