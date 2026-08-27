/**
 * Sign-in form limits. No dependencies on purpose: the zod schema downstream reads
 * its values from here, and the frontend reuses the same numbers for client-side
 * validation without pulling zod into the bundle. One source, two ways to apply it.
 */
export const authConstraints = {
  passwordMinLength: 8,
  passwordMaxLength: 128,
  emailMaxLength: 320,
} as const;
