import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from '../constants';

/**
 * BootScene — runs before GameScene.
 * Shows a loading bar while Phaser loads all assets, then starts GameScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createLoadingUI();

    // ── Load all game assets ──────────────────────────────────────────────
    this.load.image('chicken',  'chicken/chicken-run.png');
    this.load.image('obstacle', 'obstaculo/obstaculo.png');
    this.load.image('virus',    'penalizaciones/virus.png');
    this.load.image('vitamin',  'poderes/vitamina.png');
    this.load.image('pollito',  'skins/pollito.png');
  }

  create(): void {
    // Small delay so the player can see "100%" before transitioning
    this.time.delayedCall(400, () => {
      this.scene.start('GameScene');
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private createLoadingUI(): void {
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;

    // Dark background
    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x0a0a14).setOrigin(0);

    // Chicken logo
    this.add.text(cx, cy - 110, '🐔', { fontSize: '72px' }).setOrigin(0.5);

    // Title
    this.add.text(cx, cy - 30, 'RUN CHICKEN!', {
      fontSize: '24px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Loading label
    const loadingText = this.add.text(cx, cy + 20, 'Cargando…', {
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Progress bar background
    const barW = 220;
    const barH = 18;
    const barX = cx - barW / 2;
    const barY = cy + 48;

    this.add.rectangle(barX, barY, barW, barH, 0x333344).setOrigin(0);

    const bar = this.add.rectangle(barX, barY, 0, barH, 0xffd700).setOrigin(0);

    // Percentage text
    const pctText = this.add.text(cx, barY + barH + 10, '0%', {
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5);

    // Wire up Phaser loader events
    this.load.on('progress', (value: number) => {
      bar.width = barW * value;
      pctText.setText(`${Math.round(value * 100)}%`);
    });

    this.load.on('fileprogress', (file: { key: string }) => {
      loadingText.setText(`Cargando: ${file.key}`);
    });

    this.load.on('complete', () => {
      loadingText.setText('¡Listo!');
      pctText.setText('100%');
    });
  }
}

