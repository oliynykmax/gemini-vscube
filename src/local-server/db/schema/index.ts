import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const disciplines = sqliteTable("discipline", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const solves = sqliteTable("solve", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  disciplineSlug: text("discipline_slug").notNull().references(() => disciplines.slug, { onDelete: "cascade" }),
  scramble: text("scramble").notNull(),
  timeMs: integer("time_ms", { mode: "number" }),
  isDnf: integer("is_dnf", { mode: "boolean" }).notNull().default(false),
  solution: text("solution"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const userSettings = sqliteTable("user_settings", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  animationDuration: integer("animation_duration").notNull().default(100),
  inspectionVoiceAlert: text("inspection_voice_alert").notNull().default("Male"),
  cameraPositionTheta: integer("camera_position_theta").notNull().default(0),
  cameraPositionPhi: integer("camera_position_phi").notNull().default(6),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  solves: many(solves),
  settings: one(userSettings),
}));

export const solvesRelations = relations(solves, ({ one }) => ({
  user: one(users, { fields: [solves.userId], references: [users.id] }),
  discipline: one(disciplines, { fields: [solves.disciplineSlug], references: [disciplines.slug] }),
}));

export const disciplinesRelations = relations(disciplines, ({ many }) => ({
  solves: many(solves),
}));
