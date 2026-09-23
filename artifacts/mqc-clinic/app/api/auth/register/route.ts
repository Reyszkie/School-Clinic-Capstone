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

async function restRequest(path: string, init: RequestInit = {}) {
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

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid account details." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ message: "Invalid account details." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const username = typeof input.username === "string" ? input.username.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";
  const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
  const middleInitial = typeof input.middleInitial === "string" ? input.middleInitial.trim() : null;
  const role = typeof input.role === "string" ? input.role : "Staff Nurse";
  const status = input.status === "Disabled" ? "Disabled" : "Active";

  if (!username || !password || !lastName || !firstName) {
    return Response.json({ message: "Name, username, and password are required." }, { status: 400 });
  }
  if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
    return Response.json({ message: "Username must be 3-50 letters, numbers, dots, underscores, or hyphens." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ message: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!["Head Nurse & Administrator", "Head Nurse", "Staff Nurse"].includes(role)) {
    return Response.json({ message: "Invalid clinic role." }, { status: 400 });
  }

  let authUserId: string | undefined;
  try {
    const { url, key } = config();
    const authResponse = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: authEmail(username), password, email_confirm: true, user_metadata: { username } }),
      cache: "no-store",
    });
    const authBody = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok) {
      const message = typeof authBody.msg === "string" ? authBody.msg : typeof authBody.message === "string" ? authBody.message : "Unable to create Supabase account.";
      return Response.json({ message }, { status: authResponse.status === 422 ? 409 : 502 });
    }
    authUserId = authBody.id;

    const clinicResponse = await restRequest("clinic_users", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: `NRS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        auth_user_id: authUserId,
        name: `${lastName}, ${firstName}${middleInitial ? ` ${middleInitial.replace(/\.$/, "")}.` : ""}`,
        last_name: lastName,
        first_name: firstName,
        middle_initial: middleInitial,
        role,
        username,
        status,
      }),
    });
    if (!clinicResponse.ok) throw new Error(`clinic_users insert returned ${clinicResponse.status}`);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Unable to create clinic account", error);
    if (authUserId) {
      const { url, key } = config();
      await fetch(`${url}/auth/v1/admin/users/${authUserId}`, {
        method: "DELETE",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      }).catch(() => undefined);
    }
    return Response.json({ message: "Unable to create clinic account." }, { status: 503 });
  }
}