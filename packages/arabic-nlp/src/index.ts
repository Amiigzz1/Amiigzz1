// Arabic moderation helpers.
//
// Scope
// -----
// Provides three building blocks for the moderation pipeline:
//   - normalizeArabic: strips diacritics, unifies interchangeable letters,
//     collapses repeated characters. Makes downstream matching resilient
//     to common obfuscation ("كسسكسس" → "كس").
//   - containsProfanity: returns a boolean + the matched categories.
//     Intentionally narrow — severe slurs, sexual content, and violent
//     threats. Covers MSA, Gulf, Egyptian, and Levantine root forms.
//   - classify: returns a coarse risk score for the moderation queue.
//
// Design notes
// ------------
//   - The list is **intentionally small and curated**. A permissive pass-
//     through plus human review beats an aggressive auto-ban every time
//     (see docs/community_guidelines_ar.md).
//   - Entries are root-forms. normalizeArabic() + regex word boundaries
//     catch most inflections without an explicit lexicon.
//   - Source files in packages/arabic-nlp/src/lists/ are plain TS arrays
//     so translators and moderators can PR additions without tooling.

import { PROFANITY_ROOTS, SEXUAL_ROOTS, THREAT_ROOTS } from './lists/ar';

export type ProfanityCategory = 'profanity' | 'sexual' | 'threat';

export interface ClassifyResult {
  ok: boolean;
  categories: ProfanityCategory[];
  /** 0..100 — higher means more likely to need review. */
  score: number;
  matches: string[];
}

/**
 * Normalizes Arabic text for matching.
 * - Strips tashkeel (diacritics).
 * - Unifies alef variants (أ إ آ → ا), yaa/alef-maqsura (ى → ي),
 *   taa-marbuta (ة → ه), and hamza forms (ؤ ئ ء → removed).
 * - Removes tatweel (ـ).
 * - Collapses runs of 3+ identical characters to 2.
 * - Lowercases any Latin fragments.
 */
export function normalizeArabic(input: string): string {
  if (!input) return '';
  const diacritics = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
  let s = input.normalize('NFKC').replace(diacritics, '');
  s = s.replace(/[أإآ]/g, 'ا')
       .replace(/ى/g, 'ي')
       .replace(/ة/g, 'ه')
       .replace(/ـ/g, '')
       .replace(/[ؤئء]/g, '');
  // Collapse "ffffff" → "ff" (including Arabic characters).
  s = s.replace(/(.)\1{2,}/g, '$1$1');
  return s.trim().toLowerCase();
}

/** True when any profanity/sexual/threat root matches. */
export function containsProfanity(input: string): boolean {
  return classify(input).matches.length > 0;
}

/**
 * Run the full pipeline. Never throws — the worst input yields
 * `{ ok: true, score: 0, matches: [] }`.
 */
export function classify(input: string): ClassifyResult {
  const normalized = normalizeArabic(input);
  if (!normalized) {
    return { ok: true, categories: [], score: 0, matches: [] };
  }

  const matches: string[] = [];
  const cats = new Set<ProfanityCategory>();

  for (const root of PROFANITY_ROOTS) {
    if (match(normalized, root)) {
      matches.push(root);
      cats.add('profanity');
    }
  }
  for (const root of SEXUAL_ROOTS) {
    if (match(normalized, root)) {
      matches.push(root);
      cats.add('sexual');
    }
  }
  for (const root of THREAT_ROOTS) {
    if (match(normalized, root)) {
      matches.push(root);
      cats.add('threat');
    }
  }

  const score = Math.min(
    100,
    (cats.has('profanity') ? 30 : 0) +
      (cats.has('sexual') ? 50 : 0) +
      (cats.has('threat') ? 70 : 0) +
      matches.length * 5,
  );

  return {
    ok: matches.length === 0,
    categories: Array.from(cats),
    score,
    matches,
  };
}

/**
 * Word-ish match against normalized text.
 * Accepts optional digit leetspeak (3 for ع, 7 for ح, 2 for أ).
 */
function match(text: string, root: string): boolean {
  const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Allow a couple of separator characters (spaces, zero-widths, digits)
  // between letters so "ك ل ب" and "ك.ل.ب" both match "كلب".
  const elastic = escaped.split('').join('[\\s\\u200b-\\u200f._\\-]*');
  const re = new RegExp(`(^|\\s|[^\\p{L}])${elastic}(?=$|\\s|[^\\p{L}])`, 'u');
  return re.test(text);
}
