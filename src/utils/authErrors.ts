export const EMAIL_IN_USE_MESSAGE =
  'An account with that email already exists. Try signing in or resetting your password.';

type SupabaseAuthError = {
  message?: string;
  error_description?: string;
};

const EMAIL_ALREADY_REGISTERED_HINTS = [
  'already registered',
  'already been registered',
  'already in use',
  'already taken',
  'user exists',
];

export function mapSupabaseSignUpError(error: unknown): string {
  if (typeof error === 'string') {
    return error || 'Failed to sign up';
  }

  if (!error || typeof error !== 'object') {
    return 'Failed to sign up';
  }

  const { message, error_description: errorDescription } = error as SupabaseAuthError;

  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  const normalizedDescription = typeof errorDescription === 'string' ? errorDescription.trim() : '';
  const combined = `${normalizedMessage} ${normalizedDescription}`.toLowerCase();

  const looksLikeEmailCollision = EMAIL_ALREADY_REGISTERED_HINTS.some((hint) => combined.includes(hint));

  if (looksLikeEmailCollision) {
    return EMAIL_IN_USE_MESSAGE;
  }

  if (normalizedMessage) {
    return normalizedMessage;
  }

  if (normalizedDescription) {
    return normalizedDescription;
  }

  return 'Failed to sign up';
}
