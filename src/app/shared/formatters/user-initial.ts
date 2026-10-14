/** The avatar letter: first letter of the name, or of the e-mail without one. */
export function userInitial(user: {
  readonly displayName: string;
  readonly email: string;
}): string {
  const source = user.displayName.trim() || user.email.trim();
  return source.charAt(0).toLocaleUpperCase('pt-BR');
}
