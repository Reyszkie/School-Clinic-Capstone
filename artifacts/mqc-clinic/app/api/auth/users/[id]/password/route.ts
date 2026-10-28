import { readActiveClinicSession } from "../../../session";

export const dynamic = "force-dynamic";

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return { url, key };
}

async function supabaseRequest(path: string) {
  const { url, key } = config();
  return fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
}

function authEmail(username: string) {
  return `${username.toLowerCase()}@mqc-clinic.local`;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await readActiveClinicSession(request);
    if (!session) return Response.json({ message: "Sign in to manage clinic accounts." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    if (session.role !== "Head Nurse") return Response.json({ message: "Only a Head Nurse can change another user's password." }, { status: 403, headers: { "Cache-Control": "no-store" } });

    const { id } = await context.params;
    const isSelf=id===session.userId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ message: "Invalid password details." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ message: "Invalid password details." }, { status: 400 });

    const input = body as Record<string, unknown>;
    const password = typeof input.password === "string" ? input.password : "";
    const confirmPassword = typeof input.confirmPassword === "string" ? input.confirmPassword : "";
    const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : "";
    if (password.length < 8 || password.length > 128) return Response.json({ message: "Password must be between 8 and 128 characters." }, { status: 400 });
    if (/\s/.test(password)) return Response.json({ message: "Password cannot contain spaces." }, { status: 400 });
    if (password !== confirmPassword) return Response.json({ message: "Passwords do not match." }, { status: 400 });
    if (isSelf && !currentPassword) return Response.json({ message: "Enter your current password." }, { status: 400 });

    const profileResponse = await supabaseRequest(`clinic_users?id=eq.${encodeURIComponent(id)}&select=auth_user_id,username,deleted_at&limit=1`);
    if (!profileResponse.ok) throw new Error(`clinic_users lookup returned ${profileResponse.status}`);
    const [profile] = await profileResponse.json() as Array<{ auth_user_id: string | null; username: string; deleted_at: string | null }>;
    if (!profile || profile.deleted_at) return Response.json({ message: "This user record is no longer available." }, { status: 404, headers: { "Cache-Control": "no-store" } });

    const { url, key } = config();
    if (isSelf && !profile.auth_user_id) {
      const legacyResponse = await fetch(`${url}/rest/v1/rpc/change_legacy_clinic_user_password`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_username: profile.username, p_current_password: currentPassword, p_new_password: password }),
        cache: "no-store",
      });
      if (!legacyResponse.ok) {
        if (legacyResponse.status === 404) return Response.json({ message: "Password changes for this legacy account are not enabled. Apply the current schema update first." }, { status: 409, headers: { "Cache-Control": "no-store" } });
        throw new Error(`Legacy password update returned ${legacyResponse.status}`);
      }
      const changed = await legacyResponse.json() as boolean;
      if (!changed) return Response.json({ message: "The current password is incorrect." }, { status: 401, headers: { "Cache-Control": "no-store" } });
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    if (!profile.auth_user_id) return Response.json({ message: "This account is not linked to Supabase Auth and its password cannot be changed here." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    if (isSelf) {
      const verificationResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail(profile.username), password: currentPassword }),
        cache: "no-store",
      });
      if (!verificationResponse.ok) return Response.json({ message: "The current password is incorrect." }, { status: 401, headers: { "Cache-Control": "no-store" } });
      const verification = await verificationResponse.json() as { user?: { id?: string } };
      if (verification.user?.id !== profile.auth_user_id) return Response.json({ message: "The current password could not be verified for this account." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const authResponse = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(profile.auth_user_id)}`, {
      method: "PUT",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      cache: "no-store",
    });
    if (!authResponse.ok) {
      const result = await authResponse.json().catch(() => ({})) as { msg?: string; message?: string };
      return Response.json({ message: result.msg || result.message || "Supabase Auth could not update this password." }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to update clinic account password", error);
    return Response.json({ message: "Unable to update clinic account password." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
