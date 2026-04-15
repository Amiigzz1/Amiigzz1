// Bridge between the Flutter WebView host and the Phaser game.
//
// The host launches us at something like:
//   http://localhost:8090/ludo/index.html#token=...&gameId=...&userId=...&api=...&ws=...
//
// We parse the hash once at boot, then proxy game-state fetches to the
// NestJS + realtime services directly. No hot-reload channel yet; state
// is polled every second (good enough for a 4-player turn-based game).

export interface BridgeConfig {
  accessToken: string;
  gameId: string;
  userId: string;
  apiBaseUrl: string;
  realtimeWsUrl: string;
}

export function readBridgeConfig(): BridgeConfig {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return {
    accessToken: params.get('token') ?? '',
    gameId: params.get('gameId') ?? '',
    userId: params.get('userId') ?? '',
    apiBaseUrl: params.get('api') ?? 'http://localhost:3000',
    realtimeWsUrl: params.get('ws') ?? 'ws://localhost:8080',
  };
}

/** Post a game action back to the Flutter host via postMessage. */
export function postToHost(message: Record<string, unknown>): void {
  (window as unknown as { parent?: Window }).parent?.postMessage(
    JSON.stringify({ source: 'majlis-ludo', ...message }),
    '*',
  );
}
