import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "mqc_clinic_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

type ClinicSession = { userId: string; userName: string; expiresAt: number };

function sessionSecret() {
  const secret = process.env.AUDIT_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("A server-side session signing key is not configured.");
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createClinicSessionCookie(userId: string, userName: string) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    userName,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  } satisfies ClinicSession)).toString("base64url");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${payload}.${signature(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearClinicSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function readClinicSession(request: Request): ClinicSession | null {
  const cookie = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  const separator = token?.lastIndexOf(".") ?? -1;
  if (!token || separator < 1) return null;

  try {
    const payload = token.slice(0, separator);
    const providedSignature = Buffer.from(token.slice(separator + 1), "base64url");
    const expectedSignature = Buffer.from(signature(payload), "base64url");
    if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ClinicSession;
    if (typeof session.userId !== "string" || typeof session.userName !== "string" || session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}