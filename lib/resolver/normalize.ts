/**
 * P1 · issue #7 · docs/architecture.md §5.1
 * NFKC → lowercase → fold diacritics and Kazakh letters (ә ғ қ ң ө ұ ү һ і) → strip punctuation
 * and filler words (университет, university, univer, uni) → collapse spaces.
 */
export type NormalizeQuery = (query: string) => string;

/** Kazakh-specific letters folded to their closest Russian/Latin counterparts (ı: dotless i of the Kazakh Latin alphabet). */
const KAZAKH_LETTERS = pairs("ә:а ғ:г қ:к ң:н ө:о ұ:у ү:у һ:х і:и ı:i");

const FILLER_WORDS = new Set([
  "university",
  "universities",
  "univ",
  "univer",
  "uni",
  "университет",
  "университета",
  "университете",
  "университетом",
  "университеты",
  "универ",
  "университети", // kk "университеті" after folding
]);

/** Lowercase, Kazakh letters and diacritics folded, punctuation → spaces. Keeps filler words. */
export function foldText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[әғқңөұүһіı]/g, (letter) => KAZAKH_LETTERS[letter] ?? letter)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export const normalizeQuery: NormalizeQuery = (query) => {
  const words = foldText(query).split(" ").filter(Boolean);
  const meaningful = words.filter((word) => !FILLER_WORDS.has(word));
  // "University" alone is still a query: keep the words rather than returning an empty string.
  return (meaningful.length > 0 ? meaningful : words).join(" ");
};

/** The normalized query plus a Cyrillic↔Latin transliteration variant, deduplicated. */
export type QueryVariants = (query: string) => string[];

export const queryVariants: QueryVariants = (query) => {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  const transliterated = /\p{Script=Cyrillic}/u.test(normalized)
    ? cyrillicToLatin(normalized)
    : latinToCyrillic(normalized);
  return [...new Set([normalized, normalizeQuery(transliterated)])].filter(Boolean);
};

const CYRILLIC_TO_LATIN = pairs(
  "а:a б:b в:v г:g д:d е:e ж:zh з:z и:i к:k л:l м:m н:n о:o п:p р:r с:s т:t у:u ф:f х:kh ц:ts ч:ch ш:sh щ:shch ъ: ы:y ь: э:e ю:yu я:ya",
);

export function cyrillicToLatin(text: string): string {
  return [...text].map((char) => CYRILLIC_TO_LATIN[char] ?? char).join("");
}

const LATIN_DIGRAPHS = Object.entries(pairs("shch:щ sh:ш ch:ч zh:ж kh:х ts:ц yu:ю ya:я yo:е"));

const LATIN_TO_CYRILLIC = pairs(
  "a:а b:б c:к d:д e:е f:ф g:г h:х i:и j:дж k:к l:л m:м n:н o:о p:п q:к r:р s:с t:т u:у v:в w:в x:кс z:з",
);

/** "a:b c:d" → { a: "b", c: "d" } — compact letter tables. */
function pairs(table: string): Record<string, string> {
  return Object.fromEntries(table.split(" ").map((pair) => pair.split(":") as [string, string]));
}

export function latinToCyrillic(text: string): string {
  let out = "";
  for (let i = 0; i < text.length;) {
    const digraph = LATIN_DIGRAPHS.find(([latin]) => text.startsWith(latin, i));
    if (digraph) {
      out += digraph[1];
      i += digraph[0].length;
      continue;
    }
    const char = text[i];
    // "y" after a vowel is "й" (Nazarbayev → Назарбайев), otherwise "ы" (Kyzylorda → Кызылорда).
    out += char === "y" ? (/[aeiou]/.test(text[i - 1] ?? "") ? "й" : "ы") : (LATIN_TO_CYRILLIC[char] ?? char);
    i += 1;
  }
  return out;
}
