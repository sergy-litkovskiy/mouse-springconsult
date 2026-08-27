import { z } from 'zod';
import { authConstraints } from './auth-limits.ts';

/**
 * Contracts of the auth module. The backend validates incoming payloads with them in
 * `auth.routes.ts`, the frontend imports types via the `@contracts/*` alias — one description.
 */
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

/** What the client sends (rememberMe is optional — it has a default). */
export type LoginRequest = z.input<typeof loginRequestSchema>;
/** What the backend sees after validation. */
export type LoginCommand = z.output<typeof loginRequestSchema>;

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const sessionSchema = z.object({
  user: authUserSchema,
  /** ISO 8601, UTC. Formatting is the client's job. */
  expiresAt: z.iso.datetime(),
});

export type Session = z.infer<typeof sessionSchema>;
