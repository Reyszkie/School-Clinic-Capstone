import { clinicUsersTable, getDb } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

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
    const [user] = await getDb()
      .select({
        id: clinicUsersTable.id,
        name: clinicUsersTable.name,
        role: clinicUsersTable.role,
        username: clinicUsersTable.username,
        status: clinicUsersTable.status,
      })
      .from(clinicUsersTable)
      .where(
        and(
          eq(clinicUsersTable.username, username),
          eq(clinicUsersTable.status, "Active"),
          sql`${clinicUsersTable.passwordHash} is not null and crypt(${password}, ${clinicUsersTable.passwordHash}) = ${clinicUsersTable.passwordHash}`,
        ),
      );

    if (!user) return Response.json({ message: "Invalid username or password." }, { status: 401 });
    return Response.json(user, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to authenticate clinic account", error);
    return Response.json({ message: "Clinic account authentication is unavailable." }, { status: 503 });
  }
}