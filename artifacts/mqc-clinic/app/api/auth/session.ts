import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "mqc_clinic_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const REMEMBERED_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type ClinicSession = { userId: string; userName: string; sessionId: string; expiresAt: number };
export type ActiveClinicSession = ClinicSession & { role: string; username: string; appearanceTheme: string };

export function hasClinicAdminPrivileges(role: string) {
  return role === "Head Nurse" || role === "Super Admin";
}

export type ClinicSessionStatus = {
  session: ActiveClinicSession | null;
  expired: boolean;
  lastActivityAt: string | null;
};

function sessionSecret() {
  const secret = process.env.AUDIT_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("A server-side session signing key is not configured.");
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createClinicSessionId() {
  return randomUUID();
}

export function hashClinicSessionId(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex");
}

export function clinicSessionExpiresAt(rememberMe = false) {
  const maxAge = rememberMe ? REMEMBERED_SESSION_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;
  return Math.floor(Date.now() / 1000) + maxAge;
}

export function createClinicSessionCookie(
  userId: string,
  userName: string,
  sessionId: string,
  rememberMe = false,
  expiresAt = clinicSessionExpiresAt(rememberMe),
) {
  const maxAge = rememberMe ? REMEMBERED_SESSION_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;
  const payload = Buffer.from(JSON.stringify({
    userId,
    userName,
    sessionId,
    expiresAt,
  } satisfies ClinicSession)).toString("base64url");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const persistence = rememberMe
    ? `; Max-Age=${Math.max(0, Math.min(maxAge, expiresAt - Math.floor(Date.now() / 1000)))}`
    : "";
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
    if (
      typeof session.userId !== "string" ||
      typeof session.userName !== "string" ||
      typeof session.sessionId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session.sessionId) ||
      !Number.isSafeInteger(session.expiresAt) ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null;
    return session;
  } catch {
    return null;
  }
}

export async function readClinicSessionStatus(
  request: Request,
  recordActivity = false,
): Promise<ClinicSessionStatus> {
  const session = readClinicSession(request);
  if (!session) return { session: null, expired: false, lastActivityAt: null };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");

  const sessionResponse = await fetch(`${url}/rest/v1/rpc/validate_clinic_session`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_user_id: session.userId,
      p_token_hash: hashClinicSessionId(session.sessionId),
      p_record_activity: recordActivity,
    }),
    cache: "no-store",
  });
  if (!sessionResponse.ok) throw new Error(`Clinic session record validation returned ${sessionResponse.status}`);
  const validation = await sessionResponse.json() as Array<{
    is_valid?: boolean;
    expired?: boolean;
    last_activity_at?: string | null;
    user_name?: string | null;
    role?: string | null;
    username?: string | null;
    appearance_theme?: string | null;
  }>;
  const status = validation[0];
  if (status?.is_valid !== true) {
    return {
      session: null,
      expired: status?.expired === true,
      lastActivityAt: status?.last_activity_at ?? null,
    };
  }
  if (!status.user_name || !status.username) {
    return { session: null, expired: false, lastActivityAt: status.last_activity_at ?? null };
  }

  return {
    session: {
      ...session,
      userName: status.user_name || session.userName,
      role: status.role || "Staff Nurse",
      username: status.username,
      appearanceTheme: status.appearance_theme || "forest",
    },
    expired: false,
    lastActivityAt: status.last_activity_at ?? null,
  };
}

export async function readActiveClinicSession(request: Request): Promise<ActiveClinicSession | null> {
  const { session } = await readClinicSessionStatus(request);
  return session;
}