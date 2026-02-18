import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "local.db");

mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL;");

export const db = drizzle(sqlite);

export { sqlite };
