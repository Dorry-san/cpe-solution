import { NextResponse } from "next/server";
import { hasApplicationSession } from "@/lib/auth";
import { evaluateMainTest, evaluateScreening, generateMainTest } from "@/lib/ai";
import { extractCvContent } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { mainAnswersSchema, screeningAnswersSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const test = await prisma.test.findUnique({
    where: { id },
    include: { application: { include: { offer: true } } },
  });

  if (!test || !(await hasApplicationSession(test.applicationId))) {
    return NextResponse.json({ error: "Questionnaire non autorisé." }, { status: 403 });
  }
  if (test.status !== "GENERATED") {
    return NextResponse.json({ error: "Ces questions ont déjà été envoyées." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);

  try {
    if (test.type === "SCREENING") {
      const parsed = screeningAnswersSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Il faut répondre aux 3 questions." }, { status: 400 });
      }

      const evaluation = await evaluateScreening({
        questions: test.questions,
        answers: parsed.data.answers,
        cvContent: await extractCvContent(test.application.cvPath),
      });

      await prisma.$transaction([
        prisma.test.update({
          where: { id: test.id },
          data: {
            answers: parsed.data.answers,
            totalScore: evaluation.score,
            aiSummary: evaluation.summary,
            status: "EVALUATED",
            completedAt: new Date(),
          },
        }),
        prisma.application.update({
          where: { id: test.applicationId },
          data: {
            screeningPassed: evaluation.passed,
            status: "MAIN_TEST",
          },
        }),
      ]);

      const preparedMainTest = await prisma.test.findUnique({
        where: { applicationId_type: { applicationId: test.applicationId, type: "MAIN" } },
      });

      if (preparedMainTest) {
        return NextResponse.json({
          completed: false,
          testId: preparedMainTest.id,
          questions: preparedMainTest.questions,
        });
      }

      const generated = await generateMainTest({
        offerTitle: test.application.offer.title,
        offerBody: test.application.offer.body,
        needs: test.application.offer.specificNeeds,
        domain: test.application.offer.domain,
        criticalSkills: test.application.offer.criticalSkills,
        cvContent: await extractCvContent(test.application.cvPath),
      });

      const mainTest = await prisma.test.create({
        data: {
          applicationId: test.applicationId,
          type: "MAIN",
          questions: generated.questions,
        },
      });

      return NextResponse.json({
        completed: false,
        testId: mainTest.id,
        questions: generated.questions,
      });
    }

    const parsed = mainAnswersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Il faut répondre aux 5 questions." }, { status: 400 });
    }

    const evaluation = await evaluateMainTest({
      offerTitle: test.application.offer.title,
      offerBody: test.application.offer.body,
      needs: test.application.offer.specificNeeds,
      domain: test.application.offer.domain,
      criticalSkills: test.application.offer.criticalSkills,
      cvContent: await extractCvContent(test.application.cvPath),
      questions: test.questions,
      answers: parsed.data.answers,
    });

    const evaluationSummary = {
      summary: evaluation.summary,
      strengths: evaluation.strengths,
      concerns: evaluation.concerns,
      recommendation: evaluation.recommendation,
    };
    const failedScreening = test.application.screeningPassed === false;

    await prisma.$transaction([
      prisma.test.update({
        where: { id: test.id },
        data: {
          answers: parsed.data.answers,
          totalScore: evaluation.totalScore,
          criteriaScores: evaluation.criteriaScores,
          aiSummary: JSON.stringify(evaluationSummary),
          status: "EVALUATED",
          completedAt: new Date(),
        },
      }),
      prisma.application.update({
        where: { id: test.applicationId },
        data: {
          status:
            !failedScreening || evaluation.totalScore > 5
              ? "RESULTS_READY"
              : "REJECTED",
        },
      }),
    ]);

    return NextResponse.json({ completed: true });
  } catch (error) {
    await prisma.test.update({
      where: { id: test.id },
      data: { status: "GENERATED" },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Évaluation impossible." },
      { status: 502 }
    );
  }
}
