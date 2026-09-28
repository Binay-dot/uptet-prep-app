import { z } from "zod";
import { PaperId } from "./enums";

export const UserDto = z
  .object({
    id: z.string().uuid(),
    displayName: z.string().max(100).nullable(),
    preparingFor: z.array(PaperId),
    createdAt: z.string().datetime(),
  })
  .strict();
export type UserDto = z.infer<typeof UserDto>;

export const BootstrapUserInput = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    preparingFor: z.array(PaperId).min(1),
  })
  .strict();
export type BootstrapUserInput = z.infer<typeof BootstrapUserInput>;

export const UpdateProfileInput = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    preparingFor: z.array(PaperId).min(1).optional(),
  })
  .strict();
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;
