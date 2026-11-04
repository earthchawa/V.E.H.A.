/** Shape returned by server actions used with useActionState. */
export type FormState = {
  error?: string;
  success?: string;
  /** Free-form payload, e.g. generated temporary passwords to show once. */
  data?: unknown;
} | undefined;
