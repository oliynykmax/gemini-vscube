import { z } from "zod";

export const createSolveSchema = z.object({
  userId: z.string(),
  disciplineSlug: z.string(),
  scramble: z.string(),
  timeMs: z.number().optional(),
  isDnf: z.boolean().default(false),
  solution: z.string().optional(),
});

export const updateSolveSchema = z.object({
  id: z.number(),
  timeMs: z.number().optional(),
  isDnf: z.boolean().optional(),
  solution: z.string().optional(),
});

export const getSolvesSchema = z.object({
  userId: z.string(),
  disciplineSlug: z.string().optional(),
  limit: z.number().default(50),
  offset: z.number().default(0),
});

export const createUserSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  email: z.string().optional(),
});

export const updateSettingsSchema = z.object({
  userId: z.string(),
  animationDuration: z.number().optional(),
  inspectionVoiceAlert: z.string().optional(),
  cameraPositionTheta: z.number().optional(),
  cameraPositionPhi: z.number().optional(),
});

export type CreateSolveInput = z.infer<typeof createSolveSchema>;
export type UpdateSolveInput = z.infer<typeof updateSolveSchema>;
export type GetSolvesInput = z.infer<typeof getSolvesSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
