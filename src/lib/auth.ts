import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "pme_jobs_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set to a value with at least 16 characters.");
  }
  return secret;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedKey] = storedHash.split(":");
  if (!salt || !expectedKey) return false;
  const derivedKey = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedKey, "hex");
  return derivedKey.length === expectedBuffer.length && timingSafeEqual(derivedKey, expectedBuffer);
}

function sign(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

function createSessionToken(userId: string) {
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, signature] = parts;
  const payload = `${userId}.${expiresAt}`;
  const expectedSignature = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }
  if (Number(expiresAt) < Date.now()) return null;
  return userId;
}

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = readSessionToken(token);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    include: { company: true },
  });
}

export async function requireUser(role?: "EMPLOYER") {
  const user = await getSessionUser();
  if (!user || (role && user.role !== role)) return null;
  return user;
}

function applicationCookieName(applicationId: string) {
  return `candidate_application_${applicationId}`;
}

function createApplicationTicket(applicationId: string) {
  return `${applicationId}.${sign(`application:${applicationId}`)}`;
}

function verifyApplicationTicket(value: string) {
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [applicationId, signature] = parts;
  const expectedSignature = sign(`application:${applicationId}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
}

export async function createApplicationSession(applicationId: string) {
  const cookieStore = await cookies();
  cookieStore.set(applicationCookieName(applicationId), createApplicationTicket(applicationId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function hasApplicationSession(applicationId: string) {
  const cookieStore = await cookies();
  const ticket = cookieStore.get(applicationCookieName(applicationId))?.value;
  return Boolean(ticket && verifyApplicationTicket(ticket));
}

