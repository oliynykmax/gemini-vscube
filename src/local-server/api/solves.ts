import { db } from "../db";
import { solves, users, disciplines, userSettings } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { CreateSolveInput, UpdateSolveInput, GetSolvesInput, CreateUserInput, UpdateSettingsInput } from "./schemas";

export async function createUser(input: CreateUserInput) {
  const [user] = await db
    .insert(users)
    .values({
      id: input.id,
      name: input.name,
      email: input.email,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { name: input.name, email: input.email },
    })
    .returning();
  
  await db
    .insert(userSettings)
    .values({ userId: input.id })
    .onConflictDoNothing();
  
  return user;
}

export async function getUser(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function createSolve(input: CreateSolveInput) {
  const [solve] = await db
    .insert(solves)
    .values({
      userId: input.userId,
      disciplineSlug: input.disciplineSlug,
      scramble: input.scramble,
      timeMs: input.timeMs,
      isDnf: input.isDnf,
      solution: input.solution,
    })
    .returning();
  return solve;
}

export async function updateSolve(input: UpdateSolveInput) {
  const [solve] = await db
    .update(solves)
    .set({
      timeMs: input.timeMs,
      isDnf: input.isDnf,
      solution: input.solution,
      updatedAt: new Date(),
    })
    .where(eq(solves.id, input.id))
    .returning();
  return solve;
}

export async function getSolves(input: GetSolvesInput) {
  const conditions = [eq(solves.userId, input.userId)];
  
  if (input.disciplineSlug) {
    conditions.push(eq(solves.disciplineSlug, input.disciplineSlug));
  }
  
  const results = await db
    .select()
    .from(solves)
    .where(and(...conditions))
    .orderBy(desc(solves.createdAt))
    .limit(input.limit)
    .offset(input.offset);
  
  return results;
}

export async function getSolveStats(userId: string, disciplineSlug: string) {
  const userSolves = await db
    .select()
    .from(solves)
    .where(and(
      eq(solves.userId, userId),
      eq(solves.disciplineSlug, disciplineSlug),
      eq(solves.isDnf, false)
    ));
  
  const times = userSolves
    .map(s => s.timeMs)
    .filter((t): t is number => t !== null && t !== undefined);
  
  if (times.length === 0) {
    return { best: null, average: null, count: 0 };
  }
  
  const best = Math.min(...times);
  const average = times.reduce((a, b) => a + b, 0) / times.length;
  
  return { best, average, count: times.length };
}

export async function getDisciplines() {
  return await db.select().from(disciplines);
}

export async function getUserSettings(userId: string) {
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return settings;
}

export async function updateUserSettings(input: UpdateSettingsInput) {
  const [settings] = await db
    .insert(userSettings)
    .values({
      userId: input.userId,
      animationDuration: input.animationDuration,
      inspectionVoiceAlert: input.inspectionVoiceAlert,
      cameraPositionTheta: input.cameraPositionTheta,
      cameraPositionPhi: input.cameraPositionPhi,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        animationDuration: input.animationDuration,
        inspectionVoiceAlert: input.inspectionVoiceAlert,
        cameraPositionTheta: input.cameraPositionTheta,
        cameraPositionPhi: input.cameraPositionPhi,
      },
    })
    .returning();
  return settings;
}
