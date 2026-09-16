export const dynamic = "force-dynamic";

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
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("Supabase server configuration is missing.");
    const response = await fetch(`${url}/rest/v1/rpc/authenticate_clinic_user`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_username: username, p_password: password }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    const users = (await response.json()) as Array<Record<string, string>>;
    if (!users[0]) return Response.json({ message: "Invalid username or password." }, { status: 401 });
    return Response.json(users[0], { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to authenticate clinic account", error);
    return Response.json({ message: "Clinic account authentication is unavailable." }, { status: 503 });
  }
}
