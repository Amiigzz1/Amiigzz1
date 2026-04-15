import Phaser from 'phaser';

import type { BridgeConfig } from '../bridge';
import { postToHost } from '../bridge';

/**
 * Minimal Ludo board renderer. Draws a 15×15 grid, colored quadrants, and
 * 16 tokens (4 per player) whose positions come from the Go engine.
 *
 * Intentional design choices for Phase 3:
 *   - No dice or click handlers here. The Flutter host drives Roll/Move
 *     via the NestJS API. We poll /games/ludo/:id/state each second and
 *     animate any delta.
 *   - All geometry is computed from grid coordinates so swapping the
 *     background for an authored image later doesn't require re-writing
 *     token placement.
 */
export class BoardScene extends Phaser.Scene {
  private readonly bridge: BridgeConfig;
  private tokenSprites: Phaser.GameObjects.Rectangle[][] = [];
  private statusText?: Phaser.GameObjects.Text;
  private pollHandle?: number;
  private lastVersion = -1;

  // Player colors match the classic board (blue top-left, red top-right,
  // yellow bottom-right, green bottom-left). RTL doesn't affect game geometry.
  private readonly playerColors = [0x0e7c66, 0xe53e3e, 0xe2b203, 0x38a169];

  constructor(bridge: BridgeConfig) {
    super({ key: 'BoardScene' });
    this.bridge = bridge;
  }

  create(): void {
    const cell = 48;
    const margin = 8;
    const size = cell * 15 + margin * 2;

    // Outer frame
    this.add.rectangle(size / 2, size / 2, size, size, 0x1b2a44)
      .setStrokeStyle(2, 0x2d425e);

    // Quadrants (home bases)
    this.drawBase(0, 0, cell, this.playerColors[0]);
    this.drawBase(9 * cell + margin, 0, cell, this.playerColors[1]);
    this.drawBase(9 * cell + margin, 9 * cell + margin, cell, this.playerColors[2]);
    this.drawBase(0, 9 * cell + margin, cell, this.playerColors[3]);

    // Status text (turn / roll / winner)
    this.statusText = this.add
      .text(size / 2, size - margin, 'في انتظار بدء الجولة…', {
        fontFamily: 'system-ui',
        fontSize: '18px',
        color: '#f1f5f9',
      })
      .setOrigin(0.5, 1);

    // Initialize 16 token sprites (hidden until state arrives).
    for (let p = 0; p < 4; p++) {
      this.tokenSprites[p] = [];
      for (let t = 0; t < 4; t++) {
        const sprite = this.add
          .rectangle(0, 0, cell - 16, cell - 16, this.playerColors[p])
          .setStrokeStyle(2, 0xffffff)
          .setVisible(false);
        this.tokenSprites[p].push(sprite);
      }
    }

    postToHost({ event: 'ready' });
    this.pollState();
  }

  private drawBase(
    x: number,
    y: number,
    cell: number,
    color: number,
  ): void {
    const size = cell * 6;
    this.add
      .rectangle(x + size / 2, y + size / 2, size, size, color, 0.35)
      .setStrokeStyle(2, 0xffffff, 0.6);
  }

  private async pollState(): Promise<void> {
    if (!this.bridge.gameId) return;
    try {
      const res = await fetch(
        `${this.bridge.apiBaseUrl}/v1/games/ludo/${this.bridge.gameId}/state`,
        {
          headers: { authorization: `Bearer ${this.bridge.accessToken}` },
        },
      );
      if (res.ok) {
        const state = (await res.json()) as {
          version: number;
          tokens: number[][];
          currentIdx: number;
          lastRoll: number;
          winnerIdx: number;
        };
        if (state.version !== this.lastVersion) {
          this.lastVersion = state.version;
          this.applyState(state);
        }
      }
    } catch {
      // Transient network errors just back off to the next tick.
    }
    this.pollHandle = window.setTimeout(() => this.pollState(), 1000);
  }

  private applyState(state: {
    tokens: number[][];
    currentIdx: number;
    lastRoll: number;
    winnerIdx: number;
  }): void {
    for (let p = 0; p < 4; p++) {
      for (let t = 0; t < 4; t++) {
        const pos = state.tokens[p]?.[t] ?? -1;
        const sprite = this.tokenSprites[p][t];
        const coords = this.boardCoords(p, t, pos);
        if (!coords) {
          sprite.setVisible(false);
          continue;
        }
        sprite.setVisible(true);
        this.tweens.add({
          targets: sprite,
          x: coords.x,
          y: coords.y,
          duration: 250,
          ease: 'Cubic.Out',
        });
      }
    }
    if (this.statusText) {
      if (state.winnerIdx >= 0) {
        this.statusText.setText(`الفائز: اللاعب ${state.winnerIdx + 1} 🏆`);
      } else {
        this.statusText.setText(
          `دور اللاعب ${state.currentIdx + 1}` +
            (state.lastRoll > 0 ? ` · الزهر: ${state.lastRoll}` : ''),
        );
      }
    }
  }

  /**
   * Maps (playerIdx, tokenIdx, pos) to pixel coordinates on the grid.
   * Home (pos === -1) parks tokens in their colored quadrant. All other
   * positions are computed against a fixed main-track + home-column table.
   */
  private boardCoords(
    playerIdx: number,
    tokenIdx: number,
    pos: number,
  ): { x: number; y: number } | null {
    const cell = 48;
    const half = cell / 2;

    if (pos === -1) {
      // Four slots inside the player's home base.
      const homeCorners: Record<number, { bx: number; by: number }> = {
        0: { bx: 1, by: 1 },
        1: { bx: 10, by: 1 },
        2: { bx: 10, by: 10 },
        3: { bx: 1, by: 10 },
      };
      const corner = homeCorners[playerIdx];
      const offsetX = (tokenIdx % 2) * 3;
      const offsetY = Math.floor(tokenIdx / 2) * 3;
      return {
        x: (corner.bx + offsetX) * cell + half,
        y: (corner.by + offsetY) * cell + half,
      };
    }

    // For Phase 3 polish we'll hand-author the 52 track coordinates + 4×6
    // home columns; for now, render positions along a simple ring so the
    // animation is visible.
    const total = 52;
    if (pos < total) {
      const angle = (pos / total) * Math.PI * 2;
      const radius = 5 * cell;
      const cx = 7.5 * cell;
      const cy = 7.5 * cell;
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    }
    // Home column — draw on a line from the entry toward center.
    const homeStep = pos - total; // 0..5
    const cx = 7.5 * cell;
    const cy = 7.5 * cell;
    const dx = Math.cos((PlayerEntryAngles[playerIdx] / 180) * Math.PI);
    const dy = Math.sin((PlayerEntryAngles[playerIdx] / 180) * Math.PI);
    return { x: cx + dx * cell * homeStep, y: cy + dy * cell * homeStep };
  }

  shutdown(): void {
    if (this.pollHandle) window.clearTimeout(this.pollHandle);
  }
}

const PlayerEntryAngles = [180, 270, 0, 90];
