// Arabic NLP helpers used by the moderation pipeline.
// Lands in Phase 5. This stub keeps the workspace resolvable.

/** Normalizes Arabic text: strips diacritics, unifies alef/yaa/taa-marbuta. */
export function normalizeArabic(input: string): string {
  // TODO(phase-5): full normalization + dialect mapping.
  return input.trim();
}

/** Returns true if the input matches any entry in the (to-be-populated) profanity list. */
export function containsProfanity(_input: string): boolean {
  // TODO(phase-5): wire up Gulf / Egyptian / Levantine dialect lists + regex.
  return false;
}
