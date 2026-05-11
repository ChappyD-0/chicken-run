/**
 * race.types.ts
 *
 * All domain types for the Run-Chicken race.
 * Shared between RaceService, GameStateService and the Phaser scenes.
 * No Angular or Phaser imports here — pure TypeScript.
 */

// ─── Skin ─────────────────────────────────────────────────────────────────────

/** A playable character skin. Add entries to SKINS to unlock more. */
export interface Skin {
  /** Unique identifier used as Phaser texture key and sent to the server */
  id: string;
  /** Display name shown in the skin picker */
  name: string;
  /** Path relative to /public, e.g. '/skins/pollito.png' */
  image: string;
}

// ─── Item types ───────────────────────────────────────────────────────────────

/** All possible game item types that can appear on a lane */
export type GameItemType = 'obstacle' | 'virus' | 'vitamin';

/** A single item (obstacle / virus / vitamin) visible on the track */
export interface GameItem {
  /** Server-assigned unique id for this item instance */
  id: number;
  /** Lane index: 0 = left, 1 = center, 2 = right */
  lane: number;
  /** Distance from start where the item sits */
  distance: number;
  /** What kind of item it is */
  type: GameItemType;
}

// ─── Player ───────────────────────────────────────────────────────────────────

/**
 * Full lifecycle status of a single player.
 *
 * waiting      → joined the room, has NOT pressed Ready yet
 * ready        → pressed Ready, waiting for host to start
 * running      → race active, moving at normal speed
 * slowed       → virus debuff active (45 % speed)
 * boosted      → vitamin speed boost active (150 % speed)
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

/**
 * Public info about a player — broadcast to ALL clients on every update.
 * Used in the progress panel and the lobby player list.
 */
export interface Player {
  /** Socket ID assigned by the server */
  id: string;
  name: string;
  /** Skin id chosen during setup */
  skin: string;
  status: PlayerStatus;
  /** Distance covered (metres, rounded) */
  distance: number;
  /** Still advancing — false when disqualified or finished */
  active: boolean;
  finished: boolean;
  disqualified: boolean;
  /** Currently protected by a vitamin shield */
  shielded: boolean;
}

/**
 * Private state sent ONLY to the owner of the socket.
 * Contains real-time physics data needed for Phaser rendering.
 */
export interface PlayerState {
  distance: number;
  /** Current lane index */
  lane: number;
  /** Effective speed in units/second after all multipliers */
  speed: number;
  status: PlayerStatus;
  shielded: boolean;
  /** Virus debuff is active */
  slowed: boolean;
  /** Vitamin speed boost is active */
  boosted: boolean;
  disqualified: boolean;
  /** Brief post-hit invincibility window (prevents double-hits) */
  hitGrace: boolean;
}

// ─── Race ─────────────────────────────────────────────────────────────────────

/** Phase of the overall race room */
export type RacePhase = 'waiting' | 'countdown' | 'running' | 'finished';

/**
 * Full race state broadcast to every connected client.
 * Drives the Angular overlays (waiting room, countdown, leaderboard).
 */
export interface RaceState {
  phase: RacePhase;
  /** All connected players (public data) */
  players: Player[];
  /** Seconds remaining in the countdown (0 when race starts) */
  countdown: number;
  /** Socket id of the winner (null until someone finishes) */
  winner: string | null;
  /** Display name of the winner */
  winnerName: string | null;
}

/**
 * Per-tick update sent to every socket.
 * Combines the public race state + the private player view.
 * Phaser reads myState + items; Angular reads race.
 */
export interface RaceUpdate {
  /** Public race state (all players, phase, winner) */
  race: RaceState;
  /** Private data for the receiving player */
  myState: PlayerState;
  /** Items currently visible ahead of this player */
  items: GameItem[];
}

// ─── Events ───────────────────────────────────────────────────────────────────

/** Payload the server sends back after a successful player:join */
export interface JoinedPayload {
  playerId: string;
  isHost: boolean;
  raceState: RaceState;
}

/** Payload of a race:countdown event */
export interface CountdownPayload {
  value: number;
}

/** Payload of a race:winner event */
export interface WinnerPayload {
  id: string;
  name: string | null;
}

/** Payload of a player:collision event sent to the affected socket */
export interface CollisionPayload {
  /** What the player hit */
  itemType: GameItemType;
  /** What happened as a result */
  result: 'disqualified' | 'shielded' | 'slowed' | 'protected';
}

