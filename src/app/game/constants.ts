// Shared game types (mirrored from server/src/types.ts)
export type GamePhase = 'waiting' | 'countdown' | 'running' | 'finished';
export type ItemType  = 'obstacle' | 'virus' | 'vitamin';

export interface Item {
  id: number;
  lane: number;
  distance: number;
  type: ItemType;
}

export interface PlayerPublicState {
  id: string;
  name: string;
  distance: number;
  active: boolean;
  finished: boolean;
  disqualified: boolean;
  shielded: boolean;
}

export interface GameState {
  phase: GamePhase;
  players: PlayerPublicState[];
  countdown: number;
  winner: string | null;
  winnerName: string | null;
}

export interface MyState {
  distance: number;
  lane: number;
  speed: number;
  shielded: boolean;
  slowed: boolean;
  boosted: boolean;
  disqualified: boolean;
  hitGrace: boolean;
}

export interface PlayerView {
  myState: MyState;
  items: Item[];
  game: GameState;
}

// ── Game constants (must match server) ────────────────────────────────────────
export const LANES        = 3;
export const WIN_DISTANCE = 2000;

// ── Phaser / render constants ─────────────────────────────────────────────────
export const CANVAS_W       = 360;
export const CANVAS_H       = 640;
export const PLAYER_SCREEN_Y = 530;   // chicken feet y position
export const LANE_X         = [80, 180, 280];
export const SCALE          = 1;      // 1 distance-unit == 1 pixel
