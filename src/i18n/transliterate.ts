/**
 * Uzbek Cyrillic -> Uzbek Latin transliteration.
 * Used to derive uz_latin document content from the original
 * uz_cyrillic source text in the templates.
 */
const MAP_LOWER: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
  'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i',
  'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
  'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 's', 'ч': 'ch',
  'ш': 'sh', 'щ': 'sh', 'ъ': "’", 'ы': 'i', 'ь': '',
  'э': 'e', 'ю': 'yu', 'я': 'ya',
  // Uzbek-specific
  'ў': "o‘", 'қ': 'q', 'ҳ': 'h', 'ғ': "g‘",
};

function isUpperCyr(ch: string): boolean {
  return ch.length === 1 && ch.toLowerCase() !== ch && /[А-ЯЁЎҚҲҒ]/u.test(ch);
}

function capitalizeFirst(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function cyrillicToLatin(text: string): string {
  let out = '';
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const replacement = MAP_LOWER[lower];
    if (replacement === undefined) {
      out += ch;
    } else {
      out += isUpperCyr(ch) ? capitalizeFirst(replacement) : replacement;
    }
  }
  return out;
}
