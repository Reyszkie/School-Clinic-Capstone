import { createClinicSessionCookie, readClinicSession } from "../auth/session";

export const dynamic = "force-dynamic";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return { url, key };
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig();
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

export async function POST(request: Request) {
  const session = readClinicSession(request);
  if (!session) return Response.json({ message: "Sign in to record audit activity." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Audit event must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ message: "Audit event must be an object." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const id = Number(input.id);
  const action = typeof input.action === "string" ? input.action.trim() : "";
  const module = typeof input.module === "string" ? input.module.trim() : "";
  const status = input.status === "Warning" || input.status === "Error" ? input.status : "Success";
  const createdAt = typeof input.createdAt === "string" ? input.createdAt : "";
  const parsedCreatedAt = new Date(createdAt);

  if (!Number.isSafeInteger(id) || id <= 0 || !action || action.length > 500 || !module || module.length > 100) {
    return Response.json({ message: "Audit event has invalid required fields." }, { status: 400 });
  }
  if (!createdAt || Number.isNaN(parsedCreatedAt.getTime())) {
    return Response.json({ message: "Audit event timestamp is invalid." }, { status: 400 });
  }

  try {
    const userResponse = await supabaseRequest(`clinic_users?id=eq.${encodeURIComponent(session.userId)}&status=eq.Active&select=id,name&limit=1`);
    if (!userResponse.ok) throw new Error(`clinic_users lookup returned ${userResponse.status}`);
    const users = (await userResponse.json()) as Array<{ id?: string; name?: string }>;
    if (!users[0]?.id) return Response.json({ message: "This clinic account is no longer active." }, { status: 401, headers: { "Cache-Control": "no-store" } });

    const response = await supabaseRequest("audit_logs?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id,
        user_id: users[0].id,
        user_name: users[0].name || session.userName,
        action,
        module,
        status,
        created_at: parsedCreatedAt.toISOString(),
      }),
    });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`audit_logs insert returned ${response.status}: ${details}`);
    }

    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store", "Set-Cookie": createClinicSessionCookie(users[0].id, users[0].name || session.userName) } });
  } catch (error) {
    console.error("Unable to save audit event", error);
    return Response.json({ message: "Unable to save audit event to Supabase." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}