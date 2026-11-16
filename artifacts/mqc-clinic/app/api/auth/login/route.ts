import { timingSafeEqual } from "node:crypto";
import {
  clinicSessionExpiresAt,
  createClinicSessionCookie,
  createClinicSessionId,
  hashClinicSessionId,
  readActiveClinicSession,
} from "../session";

export const dynamic = "force-dynamic";

function matchesConfiguredPassword(candidate: string, configured: string) {
  const candidateBytes = Buffer.from(candidate);
  const configuredBytes = Buffer.from(configured);
  return (
    candidateBytes.length === configuredBytes.length &&
    timingSafeEqual(candidateBytes, configuredBytes)
  );
}

function authEmail(username: string) {
  return `${username.toLowerCase()}@mqc-clinic.local`;
}

function supabaseHeaders(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function supabaseRpc<T>(url: string, key: string, name: string, body: Record<string, unknown>) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: supabaseHeaders(key),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${name} returned ${response.status}`);
  const result = await response.text();
  return (result ? JSON.parse(result) : undefined) as T;
}

type LoginSecurityState = {
  is_locked?: boolean;
  locked_until?: string | null;
  permanently_disabled?: boolean;
  lockout_stage?: number;
  failed_attempts?: number;
};

type ClinicSessionCreationResult = LoginSecurityState & {
  created?: boolean;
  reason?: string | null;
  expires_at?: string | null;
};

function loginSecurityResponse(state: LoginSecurityState) {
  if (state.permanently_disabled) {
    return Response.json({
      message: `This account has been permanently disabled after ${state.failed_attempts ?? 3} additional failed login attempts in the final lockout stage. Contact an authorized administrator to reactivate it.`,
      accountStatus: "Disabled",
      lockoutStage: state.lockout_stage ?? 4,
    }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  if (!state.locked_until) throw new Error("Supabase returned an invalid account lockout timestamp.");
  const retryAt = new Date(state.locked_until);
  if (Number.isNaN(retryAt.getTime())) throw new Error("Supabase returned an invalid account lockout timestamp.");
  const retryText = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "long",
  }).format(retryAt);
  const stage = state.lockout_stage ?? 1;
  const failedAttempts = state.failed_attempts ?? (stage === 1 ? 5 : 3);
  return Response.json({
    message: `This account is temporarily locked at stage ${stage} after ${failedAttempts} consecutive failed login attempts. Try again at ${retryText} (Asia/Manila).`,
    lockedUntil: retryAt.toISOString(),
    lockoutStage: stage,
    failedAttempts,
  }, { status: 423, headers: { "Cache-Control": "no-store" } });
}

async function verifyRecaptcha(token: string, secret: string) {
  const body = new URLSearchParams({ secret, response: token });
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google reCAPTCHA verification returned ${response.status}`);
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Username and password are required." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ message: "Username and password are required." }, { status: 400 });
  }
  const { username, password, rememberMe, recaptchaToken } = body as {
    username?: unknown;
    password?: unknown;
    rememberMe?: unknown;
    recaptchaToken?: unknown;
  };
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return Response.json({ message: "Username and password are required." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (username !== "super admin" && /\s/.test(username)) return Response.json({ message: "Username cannot contain spaces." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (username !== "super admin" && !/^[A-Za-z0-9._-]{3,50}$/.test(username)) return Response.json({ message: "Username must be 3-50 letters, numbers, dots, underscores, or hyphens." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (typeof recaptchaToken !== "string" || !recaptchaToken) {
    return Response.json({ message: "Complete the reCAPTCHA verification before signing in." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("Supabase server configuration is missing.");
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    if (!recaptchaSecret) throw new Error("Google reCAPTCHA server configuration is missing.");
    if (!(await verifyRecaptcha(recaptchaToken, recaptchaSecret))) {
      return Response.json({ message: "Google reCAPTCHA verification failed. Please try again." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    if (await readActiveClinicSession(request)) {
      return Response.json({
        message: "This browser already has an active clinic session. Please log out from the existing session before signing in to another account.",
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    const lockoutRows = await supabaseRpc<LoginSecurityState[]>(
      url,
      key,
      "get_clinic_login_lockout",
      { p_username: username },
    );
    const currentSecurityState = lockoutRows[0];
    if (currentSecurityState && (currentSecurityState.permanently_disabled || currentSecurityState.is_locked)) {
      return loginSecurityResponse(currentSecurityState);
    }

    const profileResponse = await fetch(`${url}/rest/v1/clinic_users?username=eq.${encodeURIComponent(username)}&select=id,name,role,username,status,auth_user_id,deleted_at,appearance_theme,password_hash&limit=1`, {
      headers: supabaseHeaders(key),
      cache: "no-store",
    });
    if (!profileResponse.ok) throw new Error(`Supabase returned ${profileResponse.status}`);
    const profiles = await profileResponse.json() as Array<{
      id?: string;
      name?: string;
      role?: string;
      username?: string;
      status?: string;
      auth_user_id?: string | null;
      deleted_at?: string | null;
      appearance_theme?: string | null;
      password_hash?: string | null;
    }>;
    const profile = profiles[0];
    if (!profile?.id || !profile.username || profile.status !== "Active" || profile.deleted_at) {
      return Response.json({ message: "Invalid username or password." }, { status: 401 });
    }

    if (
      username === "super admin" &&
      !profile.password_hash &&
      process.env.SUPER_ADMIN_INITIAL_PASSWORD &&
      matchesConfiguredPassword(
        password,
        process.env.SUPER_ADMIN_INITIAL_PASSWORD,
      )
    ) {
      await supabaseRpc<void>(url, key, "set_super_admin_password", {
        p_password: process.env.SUPER_ADMIN_INITIAL_PASSWORD,
      });
    }

    let authenticatedUser: Record<string, string> | null = null;
    const legacyAuthResponse = await fetch(`${url}/rest/v1/rpc/authenticate_clinic_user`, {
      method: "POST",
      headers: supabaseHeaders(key),
      body: JSON.stringify({ p_username: username, p_password: password }),
      cache: "no-store",
    });
    if (!legacyAuthResponse.ok && legacyAuthResponse.status !== 404 && legacyAuthResponse.status !== 429) {
      throw new Error(`Supabase returned ${legacyAuthResponse.status}`);
    }
    if (legacyAuthResponse.ok) {
      const users = await legacyAuthResponse.json() as Array<Record<string, string>>;
      if (users[0]?.id === profile.id) authenticatedUser = users[0];
    }

    if (!authenticatedUser && profile.auth_user_id) {
      const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: supabaseHeaders(key),
        body: JSON.stringify({ email: authEmail(username), password }),
        cache: "no-store",
      });
      if (authResponse.ok) {
        const authResult = await authResponse.json() as { user?: { id?: string } };
        if (authResult.user?.id === profile.auth_user_id) {
          authenticatedUser = {
            id: profile.id,
            name: profile.name || profile.username,
            role: profile.role || "Staff Nurse",
            username: profile.username || username,
            status: "Active",
          };
        }
      } else if (authResponse.status >= 500) {
        throw new Error(`Supabase Auth returned ${authResponse.status}`);
      }
    }

    if (!authenticatedUser) {
      const failures = await supabaseRpc<LoginSecurityState[]>(
        url,
        key,
        "record_clinic_login_attempt",
        { p_username: username, p_succeeded: false },
      );
      const failedSecurityState = failures[0];
      if (failedSecurityState && (failedSecurityState.permanently_disabled || failedSecurityState.is_locked)) {
        return loginSecurityResponse(failedSecurityState);
      }
      return Response.json({ message: "Invalid username or password." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const rememberSession = rememberMe === true;
    const sessionId = createClinicSessionId();
    const expiresAt = clinicSessionExpiresAt(rememberSession);
    const sessions = await supabaseRpc<ClinicSessionCreationResult[]>(
      url,
      key,
      "create_clinic_session",
      {
        p_user_id: profile.id,
        p_token_hash: hashClinicSessionId(sessionId),
        p_expires_at: new Date(expiresAt * 1000).toISOString(),
      },
    );
    const sessionState = sessions[0];
    if (!sessionState) throw new Error("Supabase returned no clinic session result.");
    if (!sessionState.created) {
      if (sessionState.reason === "active_session") {
        return Response.json({
          message: "This account is already logged in on another device or browser. Please log out from the existing session before attempting to log in again.",
        }, { status: 409, headers: { "Cache-Control": "no-store" } });
      }
      if (sessionState.reason === "locked" || sessionState.reason === "permanently_disabled") {
        return loginSecurityResponse({
          ...sessionState,
          is_locked: sessionState.reason === "locked",
          permanently_disabled: sessionState.reason === "permanently_disabled",
        });
      }
      if (sessionState.reason === "account_disabled") {
        return Response.json(
          { message: "This account is disabled or no longer active." },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }
      throw new Error(`Supabase rejected clinic session creation: ${sessionState.reason || "unknown reason"}`);
    }

    const profileName = profile.name || profile.username || "Clinic staff";
    return Response.json({
      ...authenticatedUser,
      id: profile.id,
      name: profileName,
      role: profile.role || "Staff Nurse",
      username: profile.username || username,
      status: profile.status,
      appearanceTheme: profile.appearance_theme || "forest",
    }, { headers: { "Cache-Control": "no-store", "Set-Cookie": createClinicSessionCookie(profile.id, profileName, sessionId, rememberSession, expiresAt) } });
  } catch (error) {
    console.error("Unable to authenticate clinic account", error);
    return Response.json({ message: "Clinic account authentication is unavailable." }, { status: 503 });
  }
}
