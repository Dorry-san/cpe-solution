import { NextResponse } from "next/server";
import { hasApplicationSession } from "@/lib/auth";
import { generateMainTest, generateScreeningTest } from "@/lib/ai";
import { extractCvContent } from "@/lib/files";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };
type Question = {
  id: number;
  type?: "qcm" | "problem" | "situation";
  question: string;
  options?: string[];
};

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!(await hasApplicationSession(id))) {
    return NextResponse.json({ error: "Candidature non autorisée." }, { status: 403 });
  }

  const application = await prisma.application.findUnique({
    where: { id },
    include: { offer: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Candidature introuvable." }, { status: 404 });
  }

  if (["RESULTS_READY", "REJECTED", "HIRED"].includes(application.status)) {
    return NextResponse.json({ completed: true });
  }

  const tests = await prisma.test.findMany({
    where: { applicationId: id },
    orderBy: { type: "asc" },
  });
  const screeningTest = tests.find((test) => test.type === "SCREENING");
  const mainTest = tests.find((test) => test.type === "MAIN");

  if (application.status === "MAIN_TEST") {
    if (mainTest) {
      return NextResponse.json({
        testId: mainTest.id,
        questions: mainTest.questions,
      });
    }
  } else if (screeningTest) {
    return NextResponse.json({
      testId: screeningTest.id,
      questions: screeningTest.questions,
    });
  }

  try {
    const cvContent = await extractCvContent(application.cvPath);
    const aiInput = {
      offerTitle: application.offer.title,
      offerBody: application.offer.body,
      needs: application.offer.specificNeeds,
      domain: application.offer.domain,
      criticalSkills: application.offer.criticalSkills,
      cvContent,
    };

    if (application.status === "MAIN_TEST") {
      const generatedMain = await generateMainTest(aiInput);
      const createdMain = await prisma.test.create({
        data: {
          applicationId: id,
          type: "MAIN",
          questions: generatedMain.questions,
        },
      });

      return NextResponse.json({
        testId: createdMain.id,
        questions: generatedMain.questions satisfies Question[],
      }, { status: 201 });
    }

    const [generatedScreening, generatedMain] = await Promise.all([
      screeningTest
        ? Promise.resolve({ questions: screeningTest.questions as Question[] })
        : generateScreeningTest(aiInput),
      mainTest
        ? Promise.resolve({ questions: mainTest.questions as Question[] })
        : generateMainTest(aiInput),
    ]);

    const createdTests = await prisma.$transaction([
      ...(!screeningTest ? [prisma.test.create({
        data: {
          applicationId: id,
          type: "SCREENING",
          questions: generatedScreening.questions,
        },
      })] : []),
      ...(!mainTest ? [prisma.test.create({
        data: {
          applicationId: id,
          type: "MAIN",
          questions: generatedMain.questions,
        },
      })] : []),
    ]);

    const firstTest = createdTests.find((test) => test.type === "SCREENING") ?? screeningTest;
    if (!firstTest) {
      return NextResponse.json({ error: "Questionnaire indisponible." }, { status: 502 });
    }

    return NextResponse.json({
      testId: firstTest.id,
      questions: firstTest.questions as Question[],
    }, { status: screeningTest ? 200 : 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Génération du questionnaire impossible." },
      { status: 502 }
    );
  }
}
