import { integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";

export const clinicStateTable = pgTable("clinic_state", {
	id: integer("id").primaryKey(),
	state: jsonb("state").$type<Record<string, unknown>>().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});