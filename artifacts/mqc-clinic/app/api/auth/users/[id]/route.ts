import { readActiveClinicSession } from "../../session";

export const dynamic = "force-dynamic";

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return { url, key };
}

function authEmail(username: string) {
  return `${username.toLowerCase()}@mqc-clinic.local`;
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await readActiveClinicSession(request);
    if (!session) return Response.json({ message: "Sign in to manage clinic accounts." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    if (session.role !== "Head Nurse & Administrator") return Response.json({ message: "Only the Head Nurse & Administrator can update clinic accounts." }, { status: 403, headers: { "Cache-Control": "no-store" } });

    const { id } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ message: "Invalid account details." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ message: "Invalid account details." }, { status: 400 });

    const input = body as Record<string, unknown>;
    const lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";
    const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
    const middleInitial = typeof input.middleInitial === "string" ? input.middleInitial.trim() : "";
    const username = typeof input.username === "string" ? input.username.trim() : "";
    const role = typeof input.role === "string" ? input.role : "";
    const status = input.status === "Disabled" ? "Disabled" : input.status === "Active" ? "Active" : "";
    if (!lastName || !firstName || !username || !status) return Response.json({ message: "Name, username, and status are required." }, { status: 400 });
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) return Response.json({ message: "Username must be 3-50 letters, numbers, dots, underscores, or hyphens." }, { status: 400 });
    if (!["Head Nurse & Administrator", "Head Nurse", "Staff Nurse"].includes(role)) return Response.json({ message: "Invalid clinic role." }, { status: 400 });

    const existingResponse = await supabaseRequest(`clinic_users?id=eq.${encodeURIComponent(id)}&select=id,auth_user_id,username,role,status,deleted_at&limit=1`);
    if (!existingResponse.ok) throw new Error(`clinic_users lookup returned ${existingResponse.status}`);
    const [existing] = await existingResponse.json() as Array<{ id: string; auth_user_id: string | null; username: string; role: string; status: string; deleted_at: string | null }>;
    if (!existing || existing.deleted_at) return Response.json({ message: "This user record is no longer available." }, { status: 404 });
    if (id === session.userId && status !== "Active") return Response.json({ message: "You cannot disable your signed-in account." }, { status: 409 });
    if (id === session.userId && role !== "Head Nurse & Administrator") return Response.json({ message: "You cannot remove administrator access from your signed-in account." }, { status: 409 });

    if (existing.role === "Head Nurse & Administrator" && existing.status === "Active" && (role !== existing.role || status !== "Active")) {
      const remainingAdmins = await supabaseRequest(`clinic_users?role=eq.Head%20Nurse%20%26%20Administrator&status=eq.Active&deleted_at=is.null&id=neq.${encodeURIComponent(id)}&select=id&limit=1`);
      if (!remainingAdmins.ok) throw new Error(`active administrator lookup returned ${remainingAdmins.status}`);
      if (!(await remainingAdmins.json() as unknown[]).length) return Response.json({ message: "At least one active administrator account must remain." }, { status: 409 });
    }

    const name = `${lastName}, ${firstName}${middleInitial ? ` ${middleInitial.replace(/\.$/, "")}.` : ""}`;
    const profile = { name, last_name: lastName, first_name: firstName, middle_initial: middleInitial || null, role, username, status, updated_at: new Date().toISOString() };
    let authEmailUpdated = false;
    if (existing.auth_user_id && existing.username.toLowerCase() !== username.toLowerCase()) {
      const { url, key } = config();
      const authResponse = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(existing.auth_user_id)}`, {
        method: "PUT",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail(username), user_metadata: { username } }),
        cache: "no-store",
      });
      if (!authResponse.ok) {
        const result = await authResponse.json().catch(() => ({})) as { msg?: string; message?: string };
        return Response.json({ message: result.msg || result.message || "Unable to update the linked sign-in username." }, { status: authResponse.status === 422 ? 409 : 502 });
      }
      authEmailUpdated = true;
    }

    const updateResponse = await supabaseRequest(`clinic_users?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(profile),
    });
    if (!updateResponse.ok) {
      if (authEmailUpdated && existing.auth_user_id) {
        const { url, key } = config();
        await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(existing.auth_user_id)}`, {
          method: "PUT",
          headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail(existing.username), user_metadata: { username: existing.username } }),
          cache: "no-store",
        }).catch(() => undefined);
      }
      const details = await updateResponse.text();
      if (updateResponse.status === 409 || updateResponse.status === 422) return Response.json({ message: "That username is already in use." }, { status: 409 });
      throw new Error(`clinic_users update returned ${updateResponse.status}: ${details}`);
    }

    return Response.json({ id, ...profile, lastName, firstName, middleInitial }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to update clinic account", error);
    return Response.json({ message: "Unable to update clinic account." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}