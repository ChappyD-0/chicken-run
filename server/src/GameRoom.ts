import { EventEmitter } from 'events';
import {
  Item, ItemType, PlayerStatus, PlayerPublicState, GameState, PlayerView,
  LANES, WIN_DISTANCE, TICK_MS, INITIAL_SPEED, SPEED_INCREMENT,
  VIEW_AHEAD, COLLISION_WINDOW, OBSTACLE_GAP_MIN, OBSTACLE_GAP_MAX,
  VIRUS_SLOW_MS, VITAMIN_SHIELD_MS, VITAMIN_BOOST_MS, HIT_GRACE_MS,
  VIRUS_SPEED_MULT, VITAMIN_SPEED_MULT,
} from './types';

// ── Internal player state (server only) ──────────────────────────────────────
interface PlayerState {
  id: string;
  name: string;
  skin: string;
  status: PlayerStatus;

  // Race fields (reset on each race)
  distance: number;
  baseSpeed: number;
  lane: number;
  active: boolean;
  finished: boolean;
  disqualified: boolean;

  // Effect timestamps (0 = not active)
  shieldUntil:   number;
  boostUntil:    number;
  slowUntil:     number;
  hitGraceUntil: number;
}

/**
 * GameRoom — authoritative server-side race room.
 *
 * Emitted internal events (consumed by server.ts):
 *  'stateUpdate'          → broadcast race:update (phase / player list changed)
 *  'tick'                 → broadcast race:update + per-player race:view
 *  'countdown' (n)        → broadcast race:countdown
 *  'raceFinished' (state) → broadcast race:finished + race:winner
 */
export class GameRoom extends EventEmitter {
  private players    = new Map<string, PlayerState>();
  private items:      Item[] = [];
  private consumed   = new Set<number>();
  private gameState: GameState = {
    phase: 'waiting', players: [], countdown: 0, winner: null, winnerName: null,
  };
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private nextItemId = 0;
  private startTime  = 0;

  constructor() {
    super();
    this.generateItems(0, WIN_DISTANCE + 600);
  }

  // ── Item generation ───────────────────────────────────────────────────────
  private generateItems(from: number, to: number): void {
    let dist = Math.max(from, 200);
    while (dist < to) {
      const gap  = OBSTACLE_GAP_MIN + Math.random() * (OBSTACLE_GAP_MAX - OBSTACLE_GAP_MIN);
      dist += gap;
      const lane = Math.floor(Math.random() * LANES);
      const roll = Math.random();
      // 55% obstacles · 25% virus · 20% vitamin
      const type: ItemType = roll < 0.55 ? 'obstacle' : roll < 0.80 ? 'virus' : 'vitamin';
      this.items.push({ id: this.nextItemId++, lane, distance: dist, type });
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** player:join → register player in waiting state */
  addPlayer(id: string, name: string, skin = 'pollito'): void {
    if (this.gameState.phase !== 'waiting') return;
    this.players.set(id, {
      id, name, skin,
      status: 'waiting',
      distance: 0, baseSpeed: INITIAL_SPEED,
      lane: 1, active: true, finished: false, disqualified: false,
      shieldUntil: 0, boostUntil: 0, slowUntil: 0, hitGraceUntil: 0,
    });
    this.syncPublic();
    this.emit('stateUpdate');
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    this.syncPublic();
    this.emit('stateUpdate');
    if (this.players.size === 0) this.stopTick();
  }

  /** player:ready → mark player as ready; returns true if player existed */
  setPlayerReady(id: string): boolean {
    const p = this.players.get(id);
    if (!p || this.gameState.phase !== 'waiting') return false;
    p.status = 'ready';
    this.syncPublic();
    this.emit('stateUpdate');
    return true;
  }

  /** player:input (lane change) — ignored if player is not active/running */
  setPlayerLane(id: string, lane: number): void {
    const p = this.players.get(id);
    if (p && p.active && !p.disqualified && !p.finished) {
      p.lane = Math.max(0, Math.min(LANES - 1, lane));
    }
  }

  /** race:start (host triggers) — requires at least 1 ready player */
  startCountdown(): void {
    if (this.gameState.phase !== 'waiting') return;
    const readyCount = [...this.players.values()].filter(p => p.status === 'ready').length;
    if (readyCount < 1) return;

    this.gameState.phase    = 'countdown';
    this.gameState.countdown = 3;
    this.syncPublic();
    this.emit('countdown', 3);

    const iv = setInterval(() => {
      this.gameState.countdown--;
      this.syncPublic();
      this.emit('countdown', this.gameState.countdown);
      if (this.gameState.countdown <= 0) { clearInterval(iv); this.startRace(); }
    }, 1000);
  }

  reset(): void {
    this.stopTick();
    this.gameState = { phase: 'waiting', players: [], countdown: 0, winner: null, winnerName: null };
    this.items     = [];
    this.consumed.clear();
    this.nextItemId = 0;
    this.generateItems(0, WIN_DISTANCE + 600);
    for (const p of this.players.values()) this.resetPlayerState(p);
    this.syncPublic();
    this.emit('stateUpdate');
  }

  getGameState(): GameState   { return this.gameState; }
  getPlayerCount(): number    { return this.players.size; }
  isHost(id: string): boolean { return this.players.keys().next().value === id; }

  getPlayerView(id: string): PlayerView | null {
    const p = this.players.get(id);
    if (!p) return null;
    const now = Date.now();
    const visible = this.items.filter(item =>
      !this.consumed.has(item.id) &&
      item.distance >= p.distance - 20 &&
      item.distance <= p.distance + VIEW_AHEAD
    );
    return {
      myState: {
        distance:     Math.round(p.distance),
        lane:         p.lane,
        speed:        Math.round(this.effectiveSpeed(p, now)),
        status:       p.status,
        shielded:     now < p.shieldUntil,
        slowed:       now < p.slowUntil,
        boosted:      now < p.boostUntil,
        disqualified: p.disqualified,
        hitGrace:     now < p.hitGraceUntil,
      },
      items: visible,
      game:  this.gameState,
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private startRace(): void {
    this.gameState.phase = 'running';
    this.startTime = Date.now();
    for (const p of this.players.values()) this.resetPlayerState(p);
    this.consumed.clear();
    this.syncPublic();
    this.emit('stateUpdate');
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTick(): void {
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
  }

  private resetPlayerState(p: PlayerState): void {
    p.distance      = 0;
    p.baseSpeed     = INITIAL_SPEED;
    p.lane          = 1;
    p.active        = true;
    p.finished      = false;
    p.disqualified  = false;
    p.status        = 'waiting';
    p.shieldUntil   = 0;
    p.boostUntil    = 0;
    p.slowUntil     = 0;
    p.hitGraceUntil = 0;
  }

  /** Computes effective speed considering virus/vitamin effects */
  private effectiveSpeed(p: PlayerState, now: number): number {
    const elapsed = (now - this.startTime) / 1000;
    p.baseSpeed = INITIAL_SPEED + Math.floor(elapsed / 10) * SPEED_INCREMENT;
    let mult = 1;
    if (now < p.slowUntil)  mult *= VIRUS_SPEED_MULT;
    if (now < p.boostUntil) mult *= VITAMIN_SPEED_MULT;
    return p.baseSpeed * mult;
  }

  /** Derive the display status of an active running player based on active effects */
  private raceStatus(p: PlayerState, now: number): PlayerStatus {
    if (p.disqualified) return 'disqualified';
    if (p.finished)     return 'finished';
    if (now < p.shieldUntil) return 'protected';
    if (now < p.boostUntil)  return 'boosted';
    if (now < p.slowUntil)   return 'slowed';
    return 'running';
  }

  private tick(): void {
    const now = Date.now();
    const dt  = TICK_MS / 1000;
    let anyActive = false;

    for (const p of this.players.values()) {
      if (!p.active || p.finished || p.disqualified) continue;
      anyActive = true;

      // Advance position
      p.distance += this.effectiveSpeed(p, now) * dt;
      p.status    = this.raceStatus(p, now);

      // ── Win check ─────────────────────────────────────────────────────
      if (p.distance >= WIN_DISTANCE) {
        p.finished  = true;
        p.active    = false;
        p.status    = 'finished';
        if (!this.gameState.winner) {
          this.gameState.winner     = p.id;
          this.gameState.winnerName = p.name;
        }
        continue;
      }

      // ── Collision detection (skip during hit grace window) ─────────────
      if (now < p.hitGraceUntil) continue;

      const hits = this.items.filter(item =>
        !this.consumed.has(item.id) &&
        item.lane === p.lane &&
        Math.abs(item.distance - p.distance) < COLLISION_WINDOW
      );

      for (const item of hits) {
        this.consumed.add(item.id);

        switch (item.type) {
          case 'obstacle':
            if (now < p.shieldUntil) {
              // Shield absorbs hit
              p.shieldUntil   = 0;
              p.hitGraceUntil = now + HIT_GRACE_MS;
              this.emit('playerCollision', p.id, 'obstacle', 'shielded');
            } else {
              // No shield → disqualified
              p.disqualified  = true;
              p.active        = false;
              p.status        = 'disqualified';
              this.emit('playerCollision', p.id, 'obstacle', 'disqualified');
            }
            break;

          case 'virus':
            p.slowUntil     = now + VIRUS_SLOW_MS;
            p.hitGraceUntil = now + 800;
            p.status        = 'slowed';
            this.emit('playerCollision', p.id, 'virus', 'slowed');
            break;

          case 'vitamin':
            p.shieldUntil   = now + VITAMIN_SHIELD_MS;
            p.boostUntil    = now + VITAMIN_BOOST_MS;
            p.hitGraceUntil = now + 600;
            p.status        = 'protected';
            this.emit('playerCollision', p.id, 'vitamin', 'protected');
            break;
        }
      }
    }

    // ── End-of-race checks ────────────────────────────────────────────────
    if (this.gameState.winner && this.gameState.phase === 'running') {
      this.gameState.phase = 'finished';
      this.stopTick();
      this.syncPublic();
      this.emit('raceFinished', this.gameState);
      return;
    }

    if (!anyActive && this.players.size > 0 && this.gameState.phase === 'running') {
      // Everyone eliminated without anyone finishing
      this.gameState.phase = 'finished';
      this.gameState.winner     = null;
      this.gameState.winnerName = null;
      this.stopTick();
      this.syncPublic();
      this.emit('raceFinished', this.gameState);
      return;
    }

    this.syncPublic();
    this.emit('tick');
  }

  private syncPublic(): void {
    const now = Date.now();
    this.gameState.players = Array.from(this.players.values()).map(p => ({
      id:           p.id,
      name:         p.name,
      skin:         p.skin,
      status:       p.status,
      distance:     Math.round(p.distance),
      active:       p.active,
      finished:     p.finished,
      disqualified: p.disqualified,
      shielded:     now < p.shieldUntil,
    } satisfies PlayerPublicState));
  }
}
