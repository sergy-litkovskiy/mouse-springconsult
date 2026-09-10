import { z } from 'zod';
import { authConstraints } from './auth-limits.ts';

export const loginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(authConstraints.emailMaxLength)
    .pipe(z.email({ error: 'invalid_email' })),
  password: z
    .string()
    .min(authConstraints.passwordMinLength)
    .max(authConstraints.passwordMaxLength),
  /** "Remember me": the cookie gets a Max-Age instead of dying with the browser. */
  rememberMe: z.boolean().default(false),
});

/** `input` and not `infer`: to the client `rememberMe` is optional, since it has a default. */
export type LoginRequest = z.input<typeof loginRequestSchema>;
export type LoginCommand = z.output<typeof loginRequestSchema>;

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const sessionSchema = z.object({
  user: authUserSchema,
  expiresAt: z.iso.datetime(),
});

export type Session = z.infer<typeof sessionSchema>;
