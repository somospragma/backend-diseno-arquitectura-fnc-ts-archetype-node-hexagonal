/**
 * Enmascarado de datos sensibles (PII) para logs y respuestas (DSC-O-003).
 * El email nunca se expone completo.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '****';
  return `****${email.slice(at)}`;
}

export function maskAccount<T extends { email?: string }>(account: T): T {
  if (!account.email) return account;
  return { ...account, email: maskEmail(account.email) };
}
