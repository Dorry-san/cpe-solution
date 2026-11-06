import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await requireUser("EMPLOYER");
  if (!user?.company) {
    return NextResponse.json({ error: "Accès employeur requis." }, { status: 403 });
  }

  const url = new URL(request.url);
  const offerId = url.searchParams.get("offerId");
  const minScore = Number(url.searchParams.get("minScore") ?? "0");
  const status = url.searchParams.get("status");
  const allowedStatuses = ["SCREENING", "SCREENING_FAILED", "MAIN_TEST", "RESULTS_READY", "REJECTED", "HIRED"] as const;
  const selectedStatus = allowedStatuses.find((item) => item === status);

  const applications = await prisma.application.findMany({
    where: {
      offer: { companyId: user.company.id },
      ...(offerId ? { offerId } : {}),
      ...(selectedStatus ? { status: selectedStatus } : {}),
      tests: {
        some: {
          type: "MAIN",
          status: "EVALUATED",
          totalScore: { gte: Number.isFinite(minScore) ? minScore : 0 },
        },
      },
    },
    include: {
      offer: { select: { id: true, title: true, domain: true } },
      tests: {
        select: {
          id: true,
          type: true,
          questions: true,
          answers: true,
          totalScore: true,
          criteriaScores: true,
          aiSummary: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ applications });
}
