/** No dependencies on purpose: the frontend validates against these numbers without pulling zod into the bundle. */
export const authConstraints = {
  passwordMinLength: 8,
  passwordMaxLength: 128,
  emailMaxLength: 320,
} as const;
