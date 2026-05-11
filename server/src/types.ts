// ─── Shared constants ────────────────────────────────────────────────────────
export const LANES           = 3;
export const WIN_DISTANCE    = 2000;  // units to finish the race
export const TICK_MS         = 50;    // server tick rate (20 Hz)
export const INITIAL_SPEED   = 150;   // units / second
export const SPEED_INCREMENT = 8;     // units/s added every 10 s of race time
export const VIEW_AHEAD      = 550;   // units sent ahead to client
export const COLLISION_WINDOW = 28;   // distance tolerance for hit detection
export const OBSTACLE_GAP_MIN = 100;
export const OBSTACLE_GAP_MAX = 200;

// Effect durations (ms)
export const VIRUS_SLOW_MS      = 4000;  // how long speed debuff lasts
export const VITAMIN_SHIELD_MS  = 8000;  // how long shield lasts
export const VITAMIN_BOOST_MS   = 5000;  // how long speed boost lasts
export const HIT_GRACE_MS       = 1800;  // brief window after any hit to prevent double-hits

// Speed multipliers
export const VIRUS_SPEED_MULT   = 0.45;  // speed factor while virus-slowed
export const VITAMIN_SPEED_MULT = 1.50;  // speed factor while vitamin-boosted

// ─── Item types ───────────────────────────────────────────────────────────────
export type ItemType = 'obstacle' | 'virus' | 'vitamin';

export interface Item {
  id: number;
  lane: number;
  distance: number;
  type: ItemType;
}

// ─── Public state broadcast to ALL players (leaderboard) ─────────────────────
export interface PlayerPublicState {
  id: string;
  name: string;
  distance: number;
  active: boolean;       // false = can no longer advance (disqualified or finished)
  finished: boolean;     // reached WIN_DISTANCE
  disqualified: boolean; // hit an obstacle without a shield
  shielded: boolean;     // currently protected by a vitamin
}

// ─── Full game state ──────────────────────────────────────────────────────────
export interface GameState {
  phase: 'waiting' | 'countdown' | 'running' | 'finished';
  players: PlayerPublicState[];
  countdown: number;
  winner: string | null;
  winnerName: string | null;
}

// ─── Private per-player view (sent only to that player) ──────────────────────
export interface MyState {
  distance: number;
  lane: number;
  speed: number;
  shielded: boolean;     // has vitamin protection
  slowed: boolean;       // virus effect active
  boosted: boolean;      // vitamin speed boost active
  disqualified: boolean;
  hitGrace: boolean;     // brief post-hit invincibility window
}

export interface PlayerView {
  myState: MyState;
  items: Item[];
  game: GameState;
}
