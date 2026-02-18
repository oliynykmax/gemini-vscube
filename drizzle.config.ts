import type { Config } from "drizzle-kit";

export default {
  schema: "./src/local-server/db/schema/*",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.LOCAL_DB_PATH || "./data/local.db",
  },
} satisfies Config;
