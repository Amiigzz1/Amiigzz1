import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CountryCode,
  isValidPhoneNumber,
  parsePhoneNumberWithError,
} from 'libphonenumber-js';

/**
 * Countries Majlis accepts for phone signups.
 * Explicitly allow-listed to reduce fraud and align with payment coverage.
 */
export const ALLOWED_COUNTRIES: readonly CountryCode[] = [
  'SA', // Saudi Arabia
  'AE', // United Arab Emirates
  'EG', // Egypt
  'KW', // Kuwait
  'OM', // Oman
  'BH', // Bahrain
  'QA', // Qatar
  'JO', // Jordan
] as const;

export interface NormalizedPhone {
  /** E.164, e.g. +9665XXXXXXXX */
  e164: string;
  country: (typeof ALLOWED_COUNTRIES)[number];
}

@Injectable()
export class PhoneValidator {
  /**
   * Parses and validates a user-submitted phone number.
   * Accepts E.164 (+9665…) or national formats when a `country` hint is provided.
   *
   * @throws BadRequestException if invalid or not in the allow-list.
   */
  normalize(input: string, countryHint?: string): NormalizedPhone {
    const raw = (input ?? '').trim();
    if (!raw) {
      throw new BadRequestException('phone is required');
    }

    const hint = countryHint?.toUpperCase() as CountryCode | undefined;

    let parsed;
    try {
      parsed = parsePhoneNumberWithError(raw, hint);
    } catch {
      throw new BadRequestException('phone is not a valid number');
    }

    if (!parsed.isValid() || !isValidPhoneNumber(parsed.number)) {
      throw new BadRequestException('phone is not a valid number');
    }

    const country = parsed.country;
    if (!country || !ALLOWED_COUNTRIES.includes(country)) {
      throw new BadRequestException(
        `phone country is not supported (allowed: ${ALLOWED_COUNTRIES.join(', ')})`,
      );
    }

    return { e164: parsed.number, country };
  }
}
