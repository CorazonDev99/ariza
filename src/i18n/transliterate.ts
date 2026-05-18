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

function isCyrLetter(ch: string): boolean {
  return /[А-ЯЁЎҚҲҒа-яёўқҳғ]/u.test(ch);
}

function capitalizeFirst(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * For an uppercase Cyrillic char at `i`, decide whether the Latin
 * digraph (yo/sh/ch/...) should be fully uppercased (ALL-CAPS word)
 * or just title-cased (mixed-case word). Looks at the nearest
 * Cyrillic letter in the same word — next first, then previous.
 */
function neighborIsUpper(chars: string[], i: number): boolean {
  for (let j = i + 1; j < chars.length; j++) {
    const c = chars[j]!;
    if (isCyrLetter(c)) return isUpperCyr(c);
    if (!/\p{L}/u.test(c)) break;
  }
  for (let j = i - 1; j >= 0; j--) {
    const c = chars[j]!;
    if (isCyrLetter(c)) return isUpperCyr(c);
    if (!/\p{L}/u.test(c)) break;
  }
  return false;
}

export function cyrillicToLatin(text: string): string {
  const chars = Array.from(text);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const lower = ch.toLowerCase();
    const replacement = MAP_LOWER[lower];
    if (replacement === undefined) {
      out += ch;
      continue;
    }
    if (!isUpperCyr(ch)) {
      out += replacement;
      continue;
    }
    out += neighborIsUpper(chars, i)
      ? replacement.toUpperCase()
      : capitalizeFirst(replacement);
  }
  return out;
}
