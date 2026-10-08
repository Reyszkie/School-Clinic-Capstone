import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "mqc_clinic_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const REMEMBERED_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type ClinicSession = { userId: string; userName: string; expiresAt: number };
export type ActiveClinicSession = ClinicSession & { role: string; username: string };

function sessionSecret() {
  const secret = process.env.AUDIT_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("A server-side session signing key is not configured.");
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createClinicSessionCookie(userId: string, userName: string, rememberMe = false) {
  const maxAge = rememberMe ? REMEMBERED_SESSION_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;
  const payload = Buffer.from(JSON.stringify({
    userId,
    userName,
    expiresAt: Math.floor(Date.now() / 1000) + maxAge,
  } satisfies ClinicSession)).toString("base64url");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const persistence = rememberMe ? `; Max-Age=${maxAge}` : "";
  return `${SESSION_COOKIE}=${payload}.${signature(payload)}; Path=/; HttpOnly; SameSite=Strict${persistence}${secure}`;
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

export async function readActiveClinicSession(request: Request): Promise<ActiveClinicSession | null> {
  const session = readClinicSession(request);
  if (!session) return null;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");

  const profileResponse = await fetch(`${url}/rest/v1/clinic_users?id=eq.${encodeURIComponent(session.userId)}&status=eq.Active&deleted_at=is.null&select=id,name,role,username&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!profileResponse.ok) throw new Error(`Clinic session validation returned ${profileResponse.status}`);
  const profiles = await profileResponse.json() as Array<{ id?: string; name?: string; role?: string; username?: string }>;
  const profile = profiles[0];
  if (!profile?.id || !profile.username) return null;
  return { ...session, userName: profile.name || session.userName, role: profile.role || "Staff Nurse", username: profile.username };
}