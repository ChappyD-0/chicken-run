import Phaser from 'phaser';
import {
  CANVAS_W, CANVAS_H, PLAYER_SCREEN_Y, LANE_X, SCALE, WIN_DISTANCE,
  PlayerView,
} from '../constants';

export interface SceneBridge {
  view: PlayerView | null;
  onMove: (lane: number) => void;
}

// ── Road layout ───────────────────────────────────────────────────────────────
const ROAD_X      = 30;
const ROAD_W      = CANVAS_W - 60;
const GRASS_COLOR = 0x5a9e3a;
const DIRT_COLOR  = 0xb5854a;
const DIRT_DARK   = 0x9e6e35;
const SKY_TOP     = 0x87ceeb;
const SKY_BOT     = 0xd4edda;

export class GameScene extends Phaser.Scene {
  bridge!: SceneBridge;

  // ── Layers ────────────────────────────────────────────────────────────────
  private bgStatic!:  Phaser.GameObjects.Graphics;
  private scrollGfx!: Phaser.GameObjects.Graphics;
  private fxGfx!:     Phaser.GameObjects.Graphics; // shield / effect rings

  // ── Chicken ───────────────────────────────────────────────────────────────
  private chicken!: Phaser.GameObjects.Image;
  private shadow!:  Phaser.GameObjects.Ellipse;
  private bobTween!:  Phaser.Tweens.Tween;
  private swayTween!: Phaser.Tweens.Tween;

  // ── Items ─────────────────────────────────────────────────────────────────
  private readonly itemSprites = new Map<number, Phaser.GameObjects.Image>();

  // ── HUD ───────────────────────────────────────────────────────────────────
  private livesRow!:  Phaser.GameObjects.Text;
  private distText!:  Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private fxText!:    Phaser.GameObjects.Text; // ⚡ BOOST / 🦠 SLOW status
  private msgText!:   Phaser.GameObjects.Text; // big center message

  // ── State ─────────────────────────────────────────────────────────────────
  private scrollY     = 0;
  private currentLane = 1;
  private flashTimer  = 0;
  private leanAngle   = 0;
  private postOffsets: number[] = [];
  private isDisqualified = false;

  constructor() {
    super({ key: 'GameScene' });
    this.bridge = { view: null, onMove: () => {} };
  }

  preload(): void { /* assets loaded by BootScene */ }

  create(): void {
    // ── Static BG ─────────────────────────────────────────────────────────
    this.bgStatic = this.add.graphics();
    this.drawStaticBg();

    this.scrollGfx = this.add.graphics().setDepth(1);
    this.fxGfx     = this.add.graphics().setDepth(9);

    for (let i = 0; i < 8; i++) this.postOffsets.push((i / 8) * CANVAS_H);

    // ── Shadow + chicken ──────────────────────────────────────────────────
    this.shadow = this.add
      .ellipse(LANE_X[1], PLAYER_SCREEN_Y + 28, 52, 14, 0x000000, 0.25)
      .setDepth(8);

    this.chicken = this.add
      .image(LANE_X[1], PLAYER_SCREEN_Y, 'chicken')
      .setDisplaySize(68, 68)
      .setOrigin(0.5, 1)
      .setDepth(10);

    // ── Running tweens ────────────────────────────────────────────────────
    this.bobTween = this.tweens.add({
      targets: this.chicken,
      y: { from: PLAYER_SCREEN_Y, to: PLAYER_SCREEN_Y - 7 },
      duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.swayTween = this.tweens.add({
      targets: this.chicken,
      angle: { from: -4, to: 4 },
      duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── HUD ───────────────────────────────────────────────────────────────
    const s = { fontSize: '15px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 };
    this.distText  = this.add.text(8,  8,  '📍 0 m',  s).setDepth(20);
    this.speedText = this.add.text(8, 28, '⚡ 150',   s).setDepth(20);
    this.livesRow  = this.add.text(8, 48, '',         s).setDepth(20);
    this.fxText    = this.add.text(CANVAS_W / 2, 8,  '', {
      fontSize: '13px', color: '#FFD700', stroke: '#000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 0).setDepth(20);

    this.msgText = this.add.text(CANVAS_W / 2, CANVAS_H / 2, '', {
      fontSize: '32px', color: '#FFD700', stroke: '#000', strokeThickness: 5,
      align: 'center', wordWrap: { width: 300 },
    }).setOrigin(0.5).setDepth(30).setVisible(false);

    // ── Input ─────────────────────────────────────────────────────────────
    let startX = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { startX = p.x; });
    this.input.on('pointerup',   (p: Phaser.Input.Pointer) => {
      if (this.isDisqualified) return;
      const dx = p.x - startX;
      this.changeLane(Math.abs(dx) > 35 ? (dx < 0 ? -1 : 1) : (p.x < CANVAS_W / 2 ? -1 : 1));
    });
    this.input.keyboard?.on('keydown-LEFT',  () => !this.isDisqualified && this.changeLane(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => !this.isDisqualified && this.changeLane(1));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private changeLane(dir: number): void {
    const next = Phaser.Math.Clamp(this.currentLane + dir, 0, 2);
    if (next === this.currentLane) return;
    this.currentLane = next;
    this.bridge.onMove(next);
    this.leanAngle = dir * 18;
    this.tweens.add({
      targets: { v: this.leanAngle }, v: 0, duration: 350, ease: 'Back.easeOut',
      onUpdate: (tw) => { this.leanAngle = (tw.targets[0] as { v: number }).v; },
    });
  }

  private drawStaticBg(): void {
    const g = this.bgStatic;
    g.clear();
    g.fillStyle(SKY_TOP);  g.fillRect(0, 0, CANVAS_W, CANVAS_H * 0.35);
    g.fillStyle(SKY_BOT);  g.fillRect(0, CANVAS_H * 0.35, CANVAS_W, CANVAS_H * 0.65);
    g.fillStyle(GRASS_COLOR); g.fillRect(0, 0, ROAD_X, CANVAS_H);
    g.fillStyle(GRASS_COLOR); g.fillRect(ROAD_X + ROAD_W, 0, CANVAS_W - ROAD_X - ROAD_W, CANVAS_H);
    g.fillStyle(DIRT_COLOR);  g.fillRect(ROAD_X, 0, ROAD_W, CANVAS_H);
    g.fillStyle(DIRT_DARK, 0.3); g.fillRect(CANVAS_W / 2 - 4, 0, 8, CANVAS_H);
    g.lineStyle(2, 0xffffff, 0.5);
    g.beginPath(); g.moveTo(ROAD_X, 0); g.lineTo(ROAD_X, CANVAS_H); g.strokePath();
    g.beginPath(); g.moveTo(ROAD_X + ROAD_W, 0); g.lineTo(ROAD_X + ROAD_W, CANVAS_H); g.strokePath();
  }

  private drawScrolling(speed: number): void {
    const g = this.scrollGfx;
    g.clear();

    // Lane dashes
    g.lineStyle(2, 0xffffff, 0.45);
    for (let lane = 1; lane < 3; lane++) {
      const x = LANE_X[lane - 1] + (LANE_X[lane] - LANE_X[lane - 1]) / 2;
      for (let y = -40 + (this.scrollY % 40); y < CANVAS_H + 40; y += 40) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 22); g.strokePath();
      }
    }

    // Fence posts
    g.fillStyle(0x8b5e3c);
    for (const py of this.postOffsets) {
      g.fillRect(ROAD_X - 14, py - 18, 6, 36);
      g.fillStyle(0xffffff, 0.6); g.fillRect(ROAD_X - 18, py - 2, 14, 3);
      g.fillStyle(0x8b5e3c);
      g.fillRect(ROAD_X + ROAD_W + 8, py - 18, 6, 36);
      g.fillStyle(0xffffff, 0.6); g.fillRect(ROAD_X + ROAD_W + 4, py - 2, 14, 3);
      g.fillStyle(0x8b5e3c);
    }

    // Pebbles
    g.fillStyle(0x9a6f3a, 0.45);
    for (let i = 0; i < 14; i++) {
      const px = ROAD_X + 8 + ((i * 73 + 17) % (ROAD_W - 16));
      const py = ((i * 113 + this.scrollY * 0.5) % CANVAS_H + CANVAS_H) % CANVAS_H;
      g.fillRect(px, py, 3, 2);
    }

    void speed; // consumed via scrollY increment in update()
  }

  /**
   * Draw effect rings around the chicken:
   *  - Shield: pulsing cyan ring
   *  - Boosted: golden sparkle ring
   *  - Slowed: purple ring
   */
  private drawFx(shielded: boolean, boosted: boolean, slowed: boolean, time: number): void {
    const g = this.fxGfx;
    g.clear();
    const cx = this.chicken.x;
    const cy = this.chicken.y - 34; // vertical centre of sprite

    if (shielded) {
      const pulse = 1 + Math.sin(time / 250) * 0.1;
      g.lineStyle(3, 0x00e5ff, 0.85);
      g.strokeCircle(cx, cy, 42 * pulse);
      g.lineStyle(1, 0x00e5ff, 0.35);
      g.strokeCircle(cx, cy, 50 * pulse);
    }
    if (boosted && !shielded) {
      g.lineStyle(2, 0xffd700, 0.7 + Math.sin(time / 150) * 0.3);
      g.strokeCircle(cx, cy, 40);
    }
    if (slowed) {
      g.lineStyle(2, 0xcc44ff, 0.6);
      g.strokeCircle(cx, cy, 38);
    }
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  override update(time: number, delta: number): void {
    const view  = this.bridge?.view;
    const speed = view?.myState.speed ?? 150;

    // Scroll
    this.scrollY = (this.scrollY + speed * delta * 0.001 * 60) % (CANVAS_H * 2);
    for (let i = 0; i < this.postOffsets.length; i++) {
      this.postOffsets[i] = (this.postOffsets[i] + speed * delta * 0.001) % CANVAS_H;
    }
    this.drawScrolling(speed);

    if (!view) return;
    const { myState, items, game } = view;

    // ── Disqualified state ────────────────────────────────────────────────
    if (myState.disqualified && !this.isDisqualified) {
      this.isDisqualified = true;
      this.bobTween.pause();
      this.swayTween.pause();
      this.chicken.angle = 90;        // fall over
      this.chicken.setTint(0xff4444);
      this.showMessage('💥 DESCALIFICADO', '#ff4444');
    }

    // ── Lane sync ─────────────────────────────────────────────────────────
    if (myState.lane !== this.currentLane) this.currentLane = myState.lane;
    const targetX = LANE_X[myState.lane];
    this.chicken.x = Phaser.Math.Linear(this.chicken.x, targetX, 0.22);
    this.shadow.x  = this.chicken.x;

    // ── Lean during lane change ───────────────────────────────────────────
    if (!this.isDisqualified) {
      if (Math.abs(this.leanAngle) > 0.5) {
        this.swayTween.pause();
        this.chicken.angle = this.leanAngle;
      } else {
        this.swayTween.resume();
      }
    }

    // ── Chicken tint based on active effects ──────────────────────────────
    if (!this.isDisqualified) {
      if (myState.slowed)        this.chicken.setTint(0xcc44ff); // purple = virus
      else if (myState.boosted)  this.chicken.setTint(0xffe066); // gold  = vitamin boost
      else                       this.chicken.clearTint();
    }

    // ── Hit-grace flash ───────────────────────────────────────────────────
    this.flashTimer += delta;
    if (myState.hitGrace && !this.isDisqualified) {
      this.chicken.alpha = Math.sin(this.flashTimer / 80) > 0 ? 1 : 0.25;
    } else if (!this.isDisqualified) {
      this.chicken.alpha = 1;
      this.flashTimer = 0;
    }

    // ── Shadow bob sync ───────────────────────────────────────────────────
    const bobOff = PLAYER_SCREEN_Y - this.chicken.y;
    this.shadow.scaleX = 1 - bobOff * 0.04;
    this.shadow.y      = PLAYER_SCREEN_Y + 28 - bobOff * 0.15;

    // ── Effect rings ──────────────────────────────────────────────────────
    this.drawFx(myState.shielded, myState.boosted, myState.slowed, time);

    // ── Item sprites ──────────────────────────────────────────────────────
    const activeIds = new Set<number>();
    for (const item of items) {
      activeIds.add(item.id);
      const screenY = PLAYER_SCREEN_Y - (item.distance - myState.distance) * SCALE;
      if (screenY < -60 || screenY > CANVAS_H + 60) continue;
      let sp = this.itemSprites.get(item.id);
      if (!sp) {
        const size = item.type === 'obstacle' ? 58 : 50;
        sp = this.add.image(LANE_X[item.lane], screenY, item.type)
          .setDisplaySize(size, size).setDepth(5);
        this.itemSprites.set(item.id, sp);
      }
      sp.x = LANE_X[item.lane];
      sp.y = screenY;
    }
    for (const [id, sp] of this.itemSprites) {
      if (!activeIds.has(id)) { sp.destroy(); this.itemSprites.delete(id); }
    }

    // ── HUD ───────────────────────────────────────────────────────────────
    this.distText.setText(`📍 ${myState.distance} / ${WIN_DISTANCE} m`);
    this.speedText.setText(`⚡ ${myState.speed} u/s`);

    const badges: string[] = [];
    if (myState.shielded)  badges.push('🛡 ESCUDO');
    if (myState.boosted)   badges.push('🚀 BOOST');
    if (myState.slowed)    badges.push('🦠 LENTO');
    this.livesRow.setText(badges.length ? badges.join('  ') : '');
    this.fxText.setText('');

    // ── Phase messages ────────────────────────────────────────────────────
    if (game.phase === 'countdown') {
      this.showMessage(game.countdown > 0 ? String(game.countdown) : '¡CORRE!', '#FFD700');
    } else if (game.phase === 'finished' && !myState.disqualified) {
      const msg = game.winnerName ? `🏆 ${game.winnerName}\n¡GANÓ!` : '¡Fin!';
      this.showMessage(msg, '#FFD700');
      this.bobTween.pause(); this.swayTween.pause();
    } else if (game.phase === 'running' && !myState.disqualified) {
      this.msgText.setVisible(false);
    }
  }

  private showMessage(text: string, color: string): void {
    this.msgText.setText(text).setColor(color).setVisible(true);
  }

  cleanUp(): void {
    this.bobTween?.destroy(); this.swayTween?.destroy();
    this.itemSprites.forEach(s => s.destroy());
    this.itemSprites.clear();
  }
}
