// Curated lists of root forms used by the moderation pipeline.
//
// Policy: keep these short, targeted, and reviewed by a native speaker.
// The goal is to flag obvious violations for *human review*, not to
// automatically ban. False positives are far more costly than false
// negatives in the Arab social-gaming context.
//
// Normalization already strips diacritics + unifies letter variants, so
// list entries use the bare root. See `normalizeArabic` for details.

/** Severe Arabic profanity — Gulf, Egyptian, Levantine. */
export const PROFANITY_ROOTS: readonly string[] = [
  'كلب',        // general insult
  'حمار',       // stupid, insult
  'خنزير',      // pig
  'قواد',       // pimp
  'قحبه',       // whore
  'زاني',       // adulterer
  'عرص',        // cuckold / pimp (Levantine/EG)
  'منيوك',      // sexual insult
  'يلعن',       // curse
  'ابن الكلب',  // compound insult
  'ابن الحرام', // bastard
  'ابن الزنا',  // bastard (MSA)
];

/** Sexual / explicit content roots. */
export const SEXUAL_ROOTS: readonly string[] = [
  'نيك',        // f-word equivalent
  'زب',         // vulgar anatomy
  'طيز',        // vulgar anatomy
  'كس',         // vulgar anatomy
  'مص',         // sexual act
  'جنس',        // sex (broad — only flags with surrounding verbs in the pipeline)
  'عاهره',      // prostitute
  'ساقطه',      // derogatory sexual
];

/** Threats, violent incitement. */
export const THREAT_ROOTS: readonly string[] = [
  'اقتل',
  'اذبح',
  'ارميك',
  'هموتك',
  'هكسرك',
  'هدبحك',
  'هموت',
  'اقطعك',
];
