/**
 * Strongly-typed Socket.IO event contracts.
 * Keeps client and server in sync — if you change an event shape,
 * TypeScript will catch every usage that needs updating.
 */

import { GameState, PlayerView } from '../../game/constants';

// ── Events emitted BY the CLIENT → server ─────────────────────────────────────

export interface JoinGamePayload {
  name: string;
}

export interface MovePlayerPayload {
  lane: 0 | 1 | 2;
}

/** Union of all events the client can emit */
export interface ClientToServerEvents {
  joinGame: (payload: JoinGamePayload) => void;
  startGame: () => void;
  movePlayer: (payload: MovePlayerPayload) => void;
  restartGame: () => void;
}

// ── Events emitted BY the SERVER → client ────────────────────────────────────

export interface JoinedEvent {
  playerId: string;
  isHost: boolean;
  gameState: GameState;
}

/** Union of all events the client can receive */
export interface ServerToClientEvents {
  joined: (payload: JoinedEvent) => void;
  gameState: (state: GameState) => void;
  playerView: (view: PlayerView) => void;
}

// ── Typed emit / on helpers used by SocketService ────────────────────────────

/** Keys of events the client sends */
export type ClientEventName = keyof ClientToServerEvents;

/** Keys of events the client receives */
export type ServerEventName = keyof ServerToClientEvents;

/** Payload type for a given client-emitted event */
export type ClientPayload<E extends ClientEventName> =
  Parameters<ClientToServerEvents[E]>[0];

/** Payload type for a given server-emitted event */
export type ServerPayload<E extends ServerEventName> =
  Parameters<ServerToClientEvents[E]>[0];

