export const dynamic = "force-dynamic";

function authEmail(username: string) {
  return `${username.toLowerCase()}@mqc-clinic.local`;
}

function supabaseHeaders(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
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
  const { username, password } = body as { username?: unknown; password?: unknown };
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return Response.json({ message: "Username and password are required." }, { status: 400 });
  }

  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("Supabase server configuration is missing.");
    const response = await fetch(`${url}/rest/v1/rpc/authenticate_clinic_user`, {
      method: "POST",
      headers: supabaseHeaders(key),
      body: JSON.stringify({ p_username: username, p_password: password }),
      cache: "no-store",
    });
    if (!response.ok && response.status !== 404) throw new Error(`Supabase returned ${response.status}`);
    const users = (await response.json()) as Array<Record<string, string>>;
    if (users[0]) return Response.json(users[0], { headers: { "Cache-Control": "no-store" } });

    const profileResponse = await fetch(`${url}/rest/v1/clinic_users?username=eq.${encodeURIComponent(username)}&select=id,name,role,username,status,auth_user_id&limit=1`, {
      headers: supabaseHeaders(key),
      cache: "no-store",
    });
    if (!profileResponse.ok) throw new Error(`Supabase returned ${profileResponse.status}`);
    const profiles = (await profileResponse.json()) as Array<Record<string, string>>;
    const profile = profiles[0];
    if (!profile || profile.status !== "Active" || !profile.auth_user_id) {
      return Response.json({ message: "Invalid username or password." }, { status: 401 });
    }

    const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: supabaseHeaders(key),
      body: JSON.stringify({ email: authEmail(username), password }),
      cache: "no-store",
    });
    if (!authResponse.ok) return Response.json({ message: "Invalid username or password." }, { status: 401 });
    const authResult = (await authResponse.json()) as { user?: { id?: string } };
    if (authResult.user?.id !== profile.auth_user_id) return Response.json({ message: "Invalid username or password." }, { status: 401 });
    return Response.json({ id: profile.id, name: profile.name, role: profile.role, username: profile.username, status: profile.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to authenticate clinic account", error);
    return Response.json({ message: "Clinic account authentication is unavailable." }, { status: 503 });
  }
}
