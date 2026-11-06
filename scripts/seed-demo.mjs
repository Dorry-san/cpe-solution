import { PrismaClient } from "@prisma/client";
import { randomUUID, scryptSync, randomBytes } from "node:crypto";
import { mkdir, readdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const uploadDir = process.env.CV_UPLOAD_DIR ?? "/app/uploads";

function escapePdfText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createCvPdf(lines) {
  const content = [
    "BT",
    "/F1 12 Tf",
    "18 TL",
    "48 770 Td",
    ...lines.map((line) => `(${escapePdfText(line)}) Tj T*`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const webScreeningQuestions = [
  { id: 1, question: "Avez-vous déjà travaillé sur une application web avec TypeScript ?", options: ["Oui, régulièrement", "Quelques notions", "Non"] },
  { id: 2, question: "Souhaitez-vous travailler sur des projets de développement web ?", options: ["Oui, c'est mon domaine", "Peut-être", "Non"] },
  { id: 3, question: "Êtes-vous prêt à contribuer sur React et Node.js ?", options: ["Oui, sans difficulté", "Avec un accompagnement", "Non"] },
];

const webMainQuestions = [
  { id: 1, type: "qcm", question: "En TypeScript, que permet une interface ?", options: ["Décrire la structure attendue d'un objet", "Exécuter du code au démarrage", "Remplacer une base de données", "Compiler JavaScript plus vite"] },
  { id: 2, type: "qcm", question: "Dans une API REST, quelle méthode doit mettre à jour une ressource existante ?", options: ["GET", "POST", "PUT ou PATCH", "DELETE"] },
  { id: 3, type: "problem", question: "Un module React appelle directement PostgreSQL et duplique la logique métier. Proposez une organisation modulaire en TypeScript." },
  { id: 4, type: "situation", question: "Un déploiement Docker fonctionne en recette mais échoue en production avec PostgreSQL. Expliquez votre méthode de diagnostic." },
  { id: 5, type: "qcm", question: "Quelle pratique sécurise le plus une requête SQL construite avec une entrée utilisateur ?", options: ["Concaténer la valeur dans la requête", "Utiliser une requête paramétrée", "Encoder uniquement le rendu HTML", "Masquer l'erreur en production"] },
];

const accountingScreeningQuestions = [
  { id: 1, question: "Avez-vous déjà travaillé sur des déclarations de TVA ?", options: ["Oui, régulièrement", "Quelques notions", "Non"] },
  { id: 2, question: "Souhaitez-vous travailler en comptabilité générale ?", options: ["Oui, c'est mon domaine", "Peut-être", "Non"] },
  { id: 3, question: "Êtes-vous à l'aise avec SAP et Excel ?", options: ["Oui, sans difficulté", "Avec un accompagnement", "Non"] },
];

const accountingMainQuestions = [
  { id: 1, type: "qcm", question: "Une TVA déductible est enregistrée au débit du compte 44566. Quel effet produit-elle sur la TVA à payer ?", options: ["Elle augmente la TVA à payer", "Elle diminue la TVA à payer", "Elle n'a aucun effet", "Elle devient immédiatement un produit"] },
  { id: 2, type: "qcm", question: "Quelle écriture constate une facture fournisseur TTC avec TVA déductible ?", options: ["Débit 60 et 44566, crédit 401", "Débit 401, crédit 60", "Débit 44571, crédit 44566", "Débit 411, crédit 701"] },
  { id: 3, type: "problem", question: "Un écart de TVA de 240 EUR apparaît sur une facture fournisseur. Identifiez les vérifications et l'écriture de correction." },
  { id: 4, type: "situation", question: "Avant une clôture, un rapprochement bancaire montre un paiement enregistré deux fois. Décrivez votre traitement dans SAP." },
  { id: 5, type: "qcm", question: "Qu'est-ce qu'un rapprochement bancaire ?", options: ["Un contrat avec la banque", "La comparaison du compte 512 et du relevé bancaire", "Une déclaration fiscale", "Un inventaire de caisse"] },
];

const candidates = [
  {
    offerKey: "web", firstName: "Alice", lastName: "Dupont", email: "alice.dupont@demo-candidats.fr", phone: "06 11 22 33 44",
    cvLines: ["CV - Alice Dupont", "Développeuse web full stack", "Compétences : TypeScript, React, Node.js, PostgreSQL, Docker", "Expérience : maintenance d'une application REST et corrections d'interfaces React"],
    screeningPassed: true, screeningScore: 9, screeningSummary: "Profil technique cohérent et intéressé par le domaine proposé.",
    screeningAnswers: ["Oui, régulièrement", "Oui, c'est mon domaine", "Oui, sans difficulté"],
    mainScore: 3, mainCriteria: [{ name: "Sécurité et architecture", score: 4 }, { name: "Réponse au problème", score: 2 }, { name: "Raisonnement technique", score: 3 }],
    mainAnswers: ["Une interface sert à compiler plus vite", "POST, parce que tout changement passe par POST", "Je mettrais tout le code dans un composant et je changerais la base plus tard", "Je relance Docker jusqu'à ce que cela fonctionne", "Concaténer la valeur, c'est plus simple"],
    summary: "Le CV montre une base pertinente, mais les réponses au test ne démontrent pas une maîtrise opérationnelle.",
    strengths: ["CV cohérent avec le domaine"], concerns: ["Réponses techniques incohérentes", "Méthode de diagnostic absente"], recommendation: "Non recommandé",
  },
  {
    offerKey: "web", firstName: "Karim", lastName: "Bernard", email: "karim.bernard@demo-candidats.fr", phone: "06 22 33 44 55",
    cvLines: ["CV - Karim Bernard", "Développeur TypeScript full stack", "Compétences : React, Node.js, API REST, PostgreSQL, Docker, tests automatisés", "Expérience : refactoring d'un module monolithique et mise en place de requêtes paramétrées"],
    screeningPassed: true, screeningScore: 10, screeningSummary: "Candidat motivé, avec une expérience directe sur la pile technique.",
    screeningAnswers: ["Oui, régulièrement", "Oui, c'est mon domaine", "Oui, sans difficulté"],
    mainScore: 9, mainCriteria: [{ name: "TypeScript et API", score: 9 }, { name: "Architecture modulaire", score: 9 }, { name: "Diagnostic et sécurité", score: 9 }],
    mainAnswers: ["Une interface décrit la structure attendue d'un objet et facilite les contrats de type", "PUT pour un remplacement complet, PATCH pour une mise à jour partielle", "Extraire un service TypeScript pour la logique métier, un repository PostgreSQL, puis faire appeler ce service par React via l'API REST", "Comparer les logs des deux environnements, vérifier les variables PostgreSQL, les migrations appliquées, le réseau Docker et reproduire la requête en échec", "Utiliser une requête paramétrée pour isoler la valeur de la requête SQL"],
    summary: "Réponses précises et directement applicables au problème de modularité proposé.",
    strengths: ["Architecture API claire", "Diagnostic Docker méthodique", "Sécurité SQL maîtrisée"], concerns: ["Peut être amené à confirmer la profondeur DevOps"], recommendation: "Recommandé",
  },
  {
    offerKey: "web", firstName: "Sofia", lastName: "Martin", email: "sofia.martin@demo-candidats.fr", phone: "06 33 44 55 66",
    cvLines: ["CV - Sofia Martin", "Développeuse backend TypeScript", "Compétences : Node.js, TypeScript, PostgreSQL, API REST, Docker, audit de sécurité", "Expérience : conception d'une architecture modulaire et correction d'injections SQL"],
    screeningPassed: false, screeningScore: 2, screeningSummary: "Réponses de pré-filtrage peu alignées avec l'intérêt immédiat annoncé.",
    screeningAnswers: ["Non", "Non", "Non"],
    mainScore: 10, mainCriteria: [{ name: "TypeScript et API", score: 10 }, { name: "Architecture modulaire", score: 10 }, { name: "Diagnostic et sécurité", score: 10 }],
    mainAnswers: ["Une interface TypeScript décrit un contrat de structure sans exécuter de logique", "PUT remplace la ressource, PATCH applique une mise à jour partielle", "Isoler la couche PostgreSQL dans un repository, créer un service TypeScript pour les règles métier, exposer un contrôleur API REST typé et garder React uniquement consommateur", "Je comparerais d'abord les différences de configuration et de version, vérifierais les migrations, les variables d'environnement, le réseau Docker et les logs PostgreSQL, puis reproduirais localement", "Une requête paramétrée empêche la valeur utilisateur d'être interprétée comme du SQL"],
    summary: "Excellente maîtrise technique malgré des réponses de motivation initiale contradictoires.",
    strengths: ["Réponses très structurées", "Architecture et sécurité solides", "Diagnostic production pertinent"], concerns: ["Écart à clarifier avec les réponses d'intérêt"], recommendation: "Recommandé",
  },
  {
    offerKey: "accounting", firstName: "Marc", lastName: "Lefevre", email: "marc.lefevre@demo-candidats.fr", phone: "06 44 55 66 77",
    cvLines: ["CV - Marc Lefevre", "Comptable", "Compétences : comptabilité générale, TVA, Excel, SAP, rapprochements bancaires", "Expérience : saisie et lettrage d'écritures, préparation de clôtures"],
    screeningPassed: true, screeningScore: 9, screeningSummary: "Profil intéressé par la comptabilité et familiarisé avec les outils demandés.",
    screeningAnswers: ["Oui, régulièrement", "Oui, c'est mon domaine", "Oui, sans difficulté"],
    mainScore: 3, mainCriteria: [{ name: "Maîtrise de la TVA", score: 3 }, { name: "Justification des écritures", score: 3 }, { name: "Rigueur de clôture", score: 3 }],
    mainAnswers: ["La TVA déductible augmente la TVA à payer", "On débite le 401 et on crédite le 60", "Je supprime simplement la facture", "Je refais tout le mois", "Un contrat signé avec la banque"],
    summary: "Les réponses principales présentent des erreurs comptables malgré une expérience de base annoncée.",
    strengths: ["Connaissance des outils annoncés"], concerns: ["Erreurs de base sur la TVA", "Correction d'écarts non maîtrisée"], recommendation: "Non recommandé",
  },
  {
    offerKey: "accounting", firstName: "Nadia", lastName: "Roche", email: "nadia.roche@demo-candidats.fr", phone: "06 55 66 77 88",
    cvLines: ["CV - Nadia Roche", "Comptable confirmé", "Compétences : TVA, bilans, SAP, Excel, rapprochements bancaires, clôtures", "Expérience : détection et correction d'écarts de TVA fournisseur"],
    screeningPassed: true, screeningScore: 10, screeningSummary: "Candidature motivée et alignée avec les besoins comptables.",
    screeningAnswers: ["Oui, régulièrement", "Oui, c'est mon domaine", "Oui, sans difficulté"],
    mainScore: 9, mainCriteria: [{ name: "Maîtrise de la TVA", score: 9 }, { name: "Justification des écritures", score: 9 }, { name: "Rigueur de clôture", score: 9 }],
    mainAnswers: ["La TVA déductible diminue la TVA à payer au titre de la période", "Débit 60 pour la charge HT, débit 44566 pour la TVA déductible, crédit 401 pour le TTC", "Vérifier taux, montant HT, montant TTC et justificatif, puis passer une écriture corrective du compte 44566 avec une note explicative et contrôler la nouvelle déclaration", "Annuler ou contre-passer l'écriture dupliquée dans SAP, documenter la cause, mettre à jour le lettrage et vérifier le solde du compte 512", "La comparaison du solde du compte 512 avec le relevé bancaire après analyse des écarts"],
    summary: "Démarche comptable fiable et réponses cohérentes avec la problématique TVA.",
    strengths: ["Correction TVA bien justifiée", "Clôture rigoureuse", "Bonne connaissance SAP"], concerns: ["Aucun point bloquant identifié"], recommendation: "Recommandé",
  },
  {
    offerKey: "accounting", firstName: "Olivier", lastName: "Faure", email: "olivier.faure@demo-candidats.fr", phone: "06 66 77 88 99",
    cvLines: ["CV - Olivier Faure", "Expert comptable junior", "Compétences : TVA, bilan, SAP, Excel, audit des écarts et contrôle interne", "Expérience : redressement d'écritures et fiabilisation de déclarations fiscales"],
    screeningPassed: false, screeningScore: 2, screeningSummary: "Réponses de motivation peu cohérentes avec le poste annoncé.",
    screeningAnswers: ["Non", "Non", "Non"],
    mainScore: 10, mainCriteria: [{ name: "Maîtrise de la TVA", score: 10 }, { name: "Justification des écritures", score: 10 }, { name: "Rigueur de clôture", score: 10 }],
    mainAnswers: ["Une TVA déductible réduit la TVA nette à reverser car elle vient en imputation de la TVA collectée", "Débit compte 60 pour la charge HT, débit compte 44566 pour la TVA déductible et crédit compte 401 pour le montant TTC", "Contrôler la facture, le taux et les bases HT/TTC, rechercher une erreur de saisie ou de code taxe, passer une écriture corrective sur 44566, documenter le dossier et vérifier l'impact de la déclaration", "Identifier les deux écritures, conserver l'écriture justifiée, contre-passer la duplication dans SAP, relancer le rapprochement et documenter le contrôle", "C'est la comparaison contrôlée du solde comptable 512 avec le relevé bancaire, après explication ou correction des écarts"],
    summary: "Très bonne maîtrise comptable malgré un premier filtre de motivation non validé.",
    strengths: ["Analyse TVA excellente", "Correction documentée", "Contrôle de clôture solide"], concerns: ["Écart à clarifier sur l'intérêt initial"], recommendation: "Recommandé",
  },
];

try {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Test", "Application", "Offer", "Company", "User" RESTART IDENTITY CASCADE;');
  await mkdir(uploadDir, { recursive: true });

  for (const file of await readdir(uploadDir)) {
    await unlink(path.join(uploadDir, file)).catch(() => undefined);
  }

  const password = "DemoEntreprise123!";
  const user = await prisma.user.create({
    data: {
      email: "entreprise@demo.fr",
      passwordHash: hashPassword(password),
      firstName: "Claire",
      lastName: "Moreau",
      role: "EMPLOYER",
    },
  });

  const company = await prisma.company.create({
    data: { name: "Tech & Gestion Demo", ownerId: user.id },
  });

  const webOffer = await prisma.offer.create({
    data: {
      companyId: company.id,
      title: "Développeur Web Full Stack",
      domain: "Développement Web",
      body: "Nous développons une application web en TypeScript avec React, Node.js, PostgreSQL et une API REST.\nVous participerez à la fiabilisation des fonctionnalités, à l'amélioration du parcours utilisateur et au déploiement avec Docker.",
      specificNeeds: "Concevoir la migration d'un module monolithique vers une architecture modulaire en TypeScript, en justifiant l'impact sur l'API REST et PostgreSQL.",
      criticalSkills: "TypeScript",
    },
  });

  const accountingOffer = await prisma.offer.create({
    data: {
      companyId: company.id,
      title: "Comptable confirmé",
      domain: "Comptabilité",
      body: "Nous recherchons un profil pour la tenue de la comptabilité générale, la déclaration de TVA, le suivi des bilans et les rapprochements bancaires.\nVous utiliserez Excel et SAP au quotidien pour sécuriser les écritures et préparer les clôtures.",
      specificNeeds: "Corriger un écart de TVA sur une facture fournisseur, puis expliquer son impact sur la déclaration et le bilan.",
      criticalSkills: "TVA",
    },
  });

  const offers = { web: webOffer, accounting: accountingOffer };
  const questions = {
    web: { screening: webScreeningQuestions, main: webMainQuestions },
    accounting: { screening: accountingScreeningQuestions, main: accountingMainQuestions },
  };

  let createdAt = new Date("2026-11-06T09:00:00.000Z");

  for (const candidate of candidates) {
    createdAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
    const filePath = path.join(uploadDir, `${randomUUID()}.pdf`);
    await writeFile(filePath, createCvPdf(candidate.cvLines));

    const application = await prisma.application.create({
      data: {
        offerId: offers[candidate.offerKey].id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        phone: candidate.phone,
        cvPath: filePath,
        cvFileName: `CV_${candidate.firstName}_${candidate.lastName}.pdf`,
        screeningPassed: candidate.screeningPassed,
        status: "RESULTS_READY",
        createdAt,
      },
    });

    await prisma.test.create({
      data: {
        applicationId: application.id,
        type: "SCREENING",
        status: "EVALUATED",
        questions: questions[candidate.offerKey].screening,
        answers: candidate.screeningAnswers,
        totalScore: candidate.screeningScore,
        aiSummary: candidate.screeningSummary,
        completedAt: createdAt,
      },
    });

    await prisma.test.create({
      data: {
        applicationId: application.id,
        type: "MAIN",
        status: "EVALUATED",
        questions: questions[candidate.offerKey].main,
        answers: candidate.mainAnswers,
        totalScore: candidate.mainScore,
        criteriaScores: candidate.mainCriteria,
        aiSummary: JSON.stringify({
          summary: candidate.summary,
          strengths: candidate.strengths,
          concerns: candidate.concerns,
          recommendation: candidate.recommendation,
        }),
        completedAt: new Date(createdAt.getTime() + 30 * 60 * 1000),
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    companies: await prisma.company.count(),
    offers: await prisma.offer.count(),
    applications: await prisma.application.count(),
    tests: await prisma.test.count(),
    failedScreeningStored: await prisma.application.count({
      where: { screeningPassed: false, status: "RESULTS_READY" },
    }),
  };

  console.log(JSON.stringify({
    email: user.email,
    password,
    counts,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
