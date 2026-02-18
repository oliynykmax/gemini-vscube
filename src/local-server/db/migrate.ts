import { sqlite } from "./index";

export async function runMigrations() {
  const migrations = [
    `
    CREATE TABLE IF NOT EXISTS "user" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL DEFAULT '',
      "email" TEXT,
      "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
      "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS "discipline" (
      "slug" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
      "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS "solve" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      "user_id" TEXT NOT NULL,
      "discipline_slug" TEXT NOT NULL,
      "scramble" TEXT NOT NULL,
      "time_ms" INTEGER,
      "is_dnf" INTEGER DEFAULT 0 NOT NULL,
      "solution" TEXT,
      "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
      "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
      FOREIGN KEY ("discipline_slug") REFERENCES "discipline"("slug") ON DELETE CASCADE
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS "user_settings" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      "user_id" TEXT NOT NULL UNIQUE,
      "animation_duration" INTEGER DEFAULT 100 NOT NULL,
      "inspection_voice_alert" TEXT DEFAULT 'Male' NOT NULL,
      "camera_position_theta" INTEGER DEFAULT 0 NOT NULL,
      "camera_position_phi" INTEGER DEFAULT 6 NOT NULL,
      "created_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
      "updated_at" INTEGER DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
    );
    `,
    `
    CREATE INDEX IF NOT EXISTS "solve_user_id_idx" ON "solve"("user_id");
    `,
    `
    CREATE INDEX IF NOT EXISTS "solve_discipline_idx" ON "solve"("discipline_slug");
    `,
    `
    INSERT OR IGNORE INTO "discipline" ("slug", "name") VALUES 
      ('3x3', '3x3 Cube'),
      ('2x2', '2x2 Cube'),
      ('4x4', '4x4 Cube'),
      ('5x5', '5x4 Cube'),
      ('pyraminx', 'Pyraminx'),
      ('megaminx', 'Megaminx'),
      ('skewb', 'Skewb'),
      ('square1', 'Square-1');
    `,
  ];

  for (const migration of migrations) {
    sqlite.exec(migration);
  }

  console.log("[db] Migrations completed successfully");
}
