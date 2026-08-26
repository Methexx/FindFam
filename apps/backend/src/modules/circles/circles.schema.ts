import { z } from 'zod';

export const createCircleBodySchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateCircleBody = z.infer<typeof createCircleBodySchema>;

export const updateCircleBodySchema = z.object({
  name: z.string().min(1).max(100),
});
export type UpdateCircleBody = z.infer<typeof updateCircleBodySchema>;

export const addMemberBodySchema = z.object({
  username: z.string().min(1),
});
export type AddMemberBody = z.infer<typeof addMemberBodySchema>;

// Length is not constrained to exactly 8 here: the code is normalised and
// looked up, and an unknown code already answers 404. Pinning the length in
// the schema would turn "wrong length" into a 400 that reads differently
// from "wrong code", which tells a guesser something.
export const joinCircleBodySchema = z.object({
  code: z.string().min(1).max(32),
});
export type JoinCircleBody = z.infer<typeof joinCircleBodySchema>;
