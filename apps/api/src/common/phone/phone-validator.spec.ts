import { BadRequestException } from '@nestjs/common';

import { ALLOWED_COUNTRIES, PhoneValidator } from './phone-validator';

describe('PhoneValidator', () => {
  const v = new PhoneValidator();

  describe('accepts valid numbers from allow-listed countries', () => {
    // Valid example numbers per libphonenumber's metadata.
    const cases: Array<[string, string, (typeof ALLOWED_COUNTRIES)[number]]> = [
      ['+966512345678', '+966512345678', 'SA'],
      ['0512345678', '+966512345678', 'SA'],
      ['+971501234567', '+971501234567', 'AE'],
      ['+201012345678', '+201012345678', 'EG'],
      ['+96550123456', '+96550123456', 'KW'],
      ['+96892123456', '+96892123456', 'OM'],
      ['+97336001234', '+97336001234', 'BH'],
      ['+97433123456', '+97433123456', 'QA'],
      ['+962790123456', '+962790123456', 'JO'],
    ];

    it.each(cases)('%s → %s (%s)', (input, expected, country) => {
      const hint = input.startsWith('+') ? undefined : country;
      const out = v.normalize(input, hint);
      expect(out.e164).toBe(expected);
      expect(out.country).toBe(country);
    });
  });

  it('rejects numbers outside the allow-list', () => {
    expect(() => v.normalize('+14155552671')).toThrow(BadRequestException); // US
    expect(() => v.normalize('+442071838750')).toThrow(BadRequestException); // UK
    expect(() => v.normalize('+905331234567')).toThrow(BadRequestException); // TR
  });

  it('rejects empty input', () => {
    expect(() => v.normalize('')).toThrow(BadRequestException);
    expect(() => v.normalize('   ')).toThrow(BadRequestException);
  });

  it('rejects obvious garbage', () => {
    expect(() => v.normalize('not a phone')).toThrow(BadRequestException);
    expect(() => v.normalize('+9')).toThrow(BadRequestException);
  });
});
