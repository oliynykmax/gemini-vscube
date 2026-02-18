import { join } from "path";
import { runMigrations } from "./db/migrate";
import { createUser, getUser, createSolve, updateSolve, getSolves, getSolveStats, getDisciplines, getUserSettings, updateUserSettings } from "./api/solves";
import { createSolveSchema, updateSolveSchema, getSolvesSchema, createUserSchema, updateSettingsSchema } from "./api/schemas";

const PORT = parseInt(process.env.LOCAL_PORT || "3000");

await runMigrations();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

async function parseBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === "/health" && method === "GET") {
        return jsonResponse({ status: "ok", mode: "local" });
      }

      if (path === "/api/disciplines" && method === "GET") {
        const disciplines = await getDisciplines();
        return jsonResponse(disciplines);
      }

      if (path === "/api/users" && method === "POST") {
        const body = await parseBody(req);
        const input = createUserSchema.parse(body);
        const user = await createUser(input);
        return jsonResponse(user);
      }

      if (path.startsWith("/api/users/") && method === "GET") {
        const id = path.split("/")[3];
        const user = await getUser(id);
        if (!user) return jsonResponse({ error: "User not found" }, 404);
        return jsonResponse(user);
      }

      if (path === "/api/solves" && method === "POST") {
        const body = await parseBody(req);
        const input = createSolveSchema.parse(body);
        const solve = await createSolve(input);
        return jsonResponse(solve);
      }

      if (path.startsWith("/api/solves/") && method === "PATCH") {
        const id = parseInt(path.split("/")[3]);
        const body = await parseBody(req);
        const input = updateSolveSchema.parse({ ...body, id });
        const solve = await updateSolve(input);
        return jsonResponse(solve);
      }

      if (path === "/api/solves/list" && method === "POST") {
        const body = await parseBody(req);
        const input = getSolvesSchema.parse(body);
        const solves = await getSolves(input);
        return jsonResponse(solves);
      }

      if (path.startsWith("/api/stats/") && method === "GET") {
        const parts = path.split("/");
        const userId = parts[3];
        const disciplineSlug = parts[4];
        const stats = await getSolveStats(userId, disciplineSlug);
        return jsonResponse(stats);
      }

      if (path.startsWith("/api/settings/") && method === "GET") {
        const userId = path.split("/")[3];
        const settings = await getUserSettings(userId);
        return jsonResponse(settings);
      }

      if (path === "/api/settings" && method === "POST") {
        const body = await parseBody(req);
        const input = updateSettingsSchema.parse(body);
        const settings = await updateUserSettings(input);
        return jsonResponse(settings);
      }

      if (path === "/" && method === "GET") {
        return jsonResponse({
          name: "VSCubing Local Server",
          version: "0.1.0",
          endpoints: [
            "GET /health",
            "GET /api/disciplines",
            "POST /api/users",
            "GET /api/users/:id",
            "POST /api/solves",
            "PATCH /api/solves/:id",
            "POST /api/solves/list",
            "GET /api/stats/:userId/:disciplineSlug",
            "GET /api/settings/:userId",
            "POST /api/settings",
          ],
        });
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (error) {
      console.error("[server] Error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return jsonResponse({ error: "Validation error", details: error }, 400);
      }
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
});

console.log(`[local-server] Running at http://localhost:${PORT}`);

export { server };
