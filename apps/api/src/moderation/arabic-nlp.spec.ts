// Cross-package spec — we drive @majlis/arabic-nlp through the API's Jest
// runner to keep CI simple. Once arabic-nlp grows its own suite we'll move
// these there.

import { classify, containsProfanity, normalizeArabic } from '../../../../packages/arabic-nlp/src';

describe('normalizeArabic', () => {
  it('strips diacritics', () => {
    expect(normalizeArabic('مَرْحَبًا')).toBe('مرحبا');
  });

  it('unifies alef variants', () => {
    expect(normalizeArabic('أَيْنَ')).toBe('اين');
    expect(normalizeArabic('إنسان')).toBe('انسان');
    expect(normalizeArabic('آمن')).toBe('امن');
  });

  it('maps taa-marbuta and alef-maqsura', () => {
    expect(normalizeArabic('قهوة')).toBe('قهوه');
    expect(normalizeArabic('مصطفى')).toBe('مصطفي');
  });

  it('collapses runs of 3+ repeats', () => {
    expect(normalizeArabic('كسسسس')).toBe('كسس');
  });
});

describe('containsProfanity', () => {
  it('flags obvious profanity', () => {
    expect(containsProfanity('يا كلب')).toBe(true);
  });

  it('handles obfuscation with separators', () => {
    expect(containsProfanity('ك ل ب')).toBe(true);
    expect(containsProfanity('كـلـب')).toBe(true);
  });

  it('does not flag clean text', () => {
    expect(containsProfanity('مرحبا كيف حالك؟')).toBe(false);
    expect(containsProfanity('العب لودو معي')).toBe(false);
  });

  it('does not flag legitimate compound words containing a root substring', () => {
    // "كلاسيكي" shouldn't trigger كلب.
    expect(containsProfanity('هذا كلاسيكي')).toBe(false);
  });
});

describe('classify', () => {
  it('scores clean text at 0 and returns ok=true', () => {
    const r = classify('أهلا وسهلا');
    expect(r.ok).toBe(true);
    expect(r.score).toBe(0);
    expect(r.categories).toEqual([]);
  });

  it('scores threats higher than profanity alone', () => {
    const threat = classify('هموتك');
    const profanity = classify('يا حمار');
    expect(threat.score).toBeGreaterThan(profanity.score);
  });
});
