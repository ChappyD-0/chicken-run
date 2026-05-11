// ─── Shared constants ────────────────────────────────────────────────────────
export const LANES           = 3;
export const WIN_DISTANCE    = 2000;
export const TICK_MS         = 50;
export const INITIAL_SPEED   = 150;
export const SPEED_INCREMENT = 8;
export const VIEW_AHEAD      = 550;
export const COLLISION_WINDOW = 28;
export const OBSTACLE_GAP_MIN = 100;
export const OBSTACLE_GAP_MAX = 200;

// Effect durations (ms)
export const VIRUS_SLOW_MS      = 4000;
export const VITAMIN_SHIELD_MS  = 8000;
export const VITAMIN_BOOST_MS   = 5000;
export const HIT_GRACE_MS       = 1800;

// Speed multipliers
export const VIRUS_SPEED_MULT   = 0.45;
export const VITAMIN_SPEED_MULT = 1.50;

// ─── Player status ────────────────────────────────────────────────────────────
/**
 * waiting      → joined the room, has NOT pressed Ready yet
 * ready        → pressed Ready, waiting for host to start
 * running      → race in progress, moving normally
 * slowed       → virus debuff active
 * boosted      → vitamin speed boost active
 * protected    → vitamin shield active (absorbs one obstacle hit)
 * disqualified → hit an obstacle without a shield
 * finished     → crossed the finish line
 */
export type PlayerStatus =
  | 'waiting'
  | 'ready'
  | 'running'
  | 'slowed'
  | 'boosted'
  | 'protected'
  | 'disqualified'
  | 'finished';

// ─── Race phase ───────────────────────────────────────────────────────────────
export type RacePhase = 'waiting' | 'countdown' | 'running' | 'finished';

// ─── Item types ───────────────────────────────────────────────────────────────
export type ItemType = 'obstacle' | 'virus' | 'vitamin';

export interface Item {
  id: number;
  lane: number;
  distance: number;
  type: ItemType;
}

// ─── Public state broadcast to ALL players ────────────────────────────────────
export interface PlayerPublicState {
  id:           string;
  name:         string;
  skin:         string;
  status:       PlayerStatus;
  distance:     number;
  active:       boolean;
  finished:     boolean;
  disqualified: boolean;
  shielded:     boolean;
}

// ─── Full race state ──────────────────────────────────────────────────────────
export interface GameState {
  phase:      RacePhase;
  players:    PlayerPublicState[];
  countdown:  number;
  winner:     string | null;
  winnerName: string | null;
}

// ─── Private per-player view ──────────────────────────────────────────────────
export interface MyState {
  distance:     number;
  lane:         number;
  speed:        number;
  status:       PlayerStatus;
  shielded:     boolean;
  slowed:       boolean;
  boosted:      boolean;
  disqualified: boolean;
  hitGrace:     boolean;
}

export interface PlayerView {
  myState: MyState;
  items:   Item[];
  game:    GameState;
}
