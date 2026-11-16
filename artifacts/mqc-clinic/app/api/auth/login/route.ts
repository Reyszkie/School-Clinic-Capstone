import { timingSafeEqual } from "node:crypto";
import { createClinicSessionCookie } from "../session";

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

function lockedResponse(lockedUntil: string) {
  const retryAt = new Date(lockedUntil);
  if (Number.isNaN(retryAt.getTime())) throw new Error("Supabase returned an invalid account lockout timestamp.");
  const retryText = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "long",
  }).format(retryAt);
  return Response.json({
    message: `This account is temporarily locked after 5 failed login attempts. Try again at ${retryText} (Asia/Manila).`,
    lockedUntil: retryAt.toISOString(),
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

    const lockoutRows = await supabaseRpc<Array<{ is_locked?: boolean; locked_until?: string | null }>>(
      url,
      key,
      "get_clinic_login_lockout",
      { p_username: username },
    );
    if (lockoutRows[0]?.is_locked && lockoutRows[0].locked_until) {
      return lockedResponse(lockoutRows[0].locked_until);
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
    if (!legacyAuthResponse.ok && legacyAuthResponse.status !== 404) {
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
      } else if (authResponse.status >= 500 || authResponse.status === 429) {
        throw new Error(`Supabase Auth returned ${authResponse.status}`);
      }
    }

    if (!authenticatedUser) {
      const failures = await supabaseRpc<Array<{ is_locked?: boolean; locked_until?: string | null }>>(
        url,
        key,
        "record_clinic_login_attempt",
        { p_username: username, p_succeeded: false },
      );
      if (failures[0]?.is_locked && failures[0].locked_until) {
        return lockedResponse(failures[0].locked_until);
      }
      return Response.json({ message: "Invalid username or password." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const successes = await supabaseRpc<Array<{ is_locked?: boolean; locked_until?: string | null }>>(
      url,
      key,
      "record_clinic_login_attempt",
      { p_username: username, p_succeeded: true },
    );
    if (successes[0]?.is_locked && successes[0].locked_until) {
      return lockedResponse(successes[0].locked_until);
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
    }, { headers: { "Cache-Control": "no-store", "Set-Cookie": createClinicSessionCookie(profile.id, profileName, rememberMe === true) } });
  } catch (error) {
    console.error("Unable to authenticate clinic account", error);
    return Response.json({ message: "Clinic account authentication is unavailable." }, { status: 503 });
  }
}
