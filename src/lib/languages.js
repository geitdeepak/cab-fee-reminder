// The two message languages a driver can choose. The Hindi label is written in Devanagari.
export const LANGUAGE_LABEL = { hindi: 'हिंदी', english: 'English' };

/** Older data may still say 'hinglish' (the Latin-script Hindi this app used before). */
export function normalizeLanguage(value) {
  if (value === 'english') return 'english';
  return 'hindi';
}
