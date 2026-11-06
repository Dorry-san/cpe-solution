-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('EMPLOYER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SCREENING', 'SCREENING_FAILED', 'MAIN_TEST', 'RESULTS_READY', 'REJECTED', 'HIRED');

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('SCREENING', 'MAIN');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('GENERATED', 'COMPLETED', 'EVALUATED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "profileRequirements" TEXT NOT NULL,
    "specificNeeds" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "cvPath" TEXT NOT NULL,
    "cvFileName" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SCREENING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "TestType" NOT NULL,
    "status" "TestStatus" NOT NULL DEFAULT 'GENERATED',
    "questions" JSONB NOT NULL,
    "answers" JSONB,
    "totalScore" INTEGER,
    "criteriaScores" JSONB,
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_ownerId_key" ON "Company"("ownerId");

-- CreateIndex
CREATE INDEX "Offer_companyId_idx" ON "Offer"("companyId");

-- CreateIndex
CREATE INDEX "Offer_isActive_createdAt_idx" ON "Offer"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Application_offerId_status_idx" ON "Application"("offerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_offerId_email_key" ON "Application"("offerId", "email");

-- CreateIndex
CREATE INDEX "Test_applicationId_type_idx" ON "Test"("applicationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Test_applicationId_type_key" ON "Test"("applicationId", "type");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

