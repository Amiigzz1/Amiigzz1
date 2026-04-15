import type { Country, Language } from '@prisma/client';

/** Public shape of a user returned by `/users/me` and related endpoints. */
export interface UserResponse {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  country: Country | null;
  language: Language;
  birthdate: string | null; // ISO date, no time component
  createdAt: string;
  profile: {
    bio: string | null;
    favoriteGames: string[];
    badges: string[];
    frameId: string | null;
    nameplateId: string | null;
  };
}
