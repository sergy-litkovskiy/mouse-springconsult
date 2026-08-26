import { z } from 'zod';

/**
 * The single error shape of the API. The backend emits it from the error handler in
 * `src/api.ts`; the frontend branches on `code` — user-facing text is the UI's job, not the server's.
 *
 * The codes themselves live in `error-codes.ts` without dependencies: see the note there.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
