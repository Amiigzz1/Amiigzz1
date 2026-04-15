import type { Country, RoomCategory } from '@prisma/client';

import type { AgoraJoinToken } from '../../agora/agora.service';

/** Public room summary — returned by list + create. */
export interface RoomSummary {
  id: string;
  name: string;
  description: string | null;
  category: RoomCategory;
  country: Country | null;
  maxSeats: number;
  locked: boolean;
  listenersLive: number;
  speakersLive: number;
  owner: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
}

/** Detail response, includes the Agora token for the caller. */
export interface RoomDetail extends RoomSummary {
  agoraChannel: string;
  join: AgoraJoinToken;
  realtimeWsUrl: string;
}

export interface PaginatedRooms {
  items: RoomSummary[];
  page: number;
  pageSize: number;
  total: number;
}
