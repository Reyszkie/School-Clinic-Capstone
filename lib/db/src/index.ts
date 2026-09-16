import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let dbInstance: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (!dbInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX ?? 1),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    dbInstance = drizzle(pool, { schema });
  }

  return dbInstance;
}

export * from "./schema";
