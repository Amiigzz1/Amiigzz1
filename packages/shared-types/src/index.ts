// Cross-app types. Kept intentionally minimal for Phase 0.
// Domain types will land alongside their feature phase.

export type UUID = string;
export type ISOTimestamp = string;

export type SupportedLanguage = 'ar' | 'en';
export type SupportedCountry =
  | 'SA'
  | 'AE'
  | 'EG'
  | 'KW'
  | 'OM'
  | 'BH'
  | 'QA'
  | 'JO';

export interface HealthPayload {
  status: 'ok';
  service: string;
  uptimeSeconds: number;
  timestamp: ISOTimestamp;
}
