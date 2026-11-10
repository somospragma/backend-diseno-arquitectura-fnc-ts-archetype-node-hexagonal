import { z } from 'zod';

/** Validacion de entrada estricta (SEG-O-005): tipos, longitudes, formato. */
export const createAccountSchema = z.object({
  holderName: z.string().min(1).max(120),
  email: z.email().max(254),
  accountType: z.string().min(1).max(40),
  initialBalance: z.number().nonnegative(),
});

export const patchAccountSchema = z.object({
  holderName: z.string().min(1).max(120).optional(),
  email: z.email().max(254).optional(),
  accountType: z.string().min(1).max(40).optional(),
  status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED']).optional(),
  balance: z.number().nonnegative().optional(),
});

export const searchAccountSchema = z.object({
  status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED']).optional(),
  accountType: z.string().max(40).optional(),
  holderName: z.string().max(120).optional(),
});

export type CreateAccountDto = z.infer<typeof createAccountSchema>;
export type PatchAccountDto = z.infer<typeof patchAccountSchema>;
export type SearchAccountDto = z.infer<typeof searchAccountSchema>;
