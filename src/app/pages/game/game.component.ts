import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, ChangeDetectionStrategy,
  ChangeDetectorRef, effect,
} from '@angular/core';
import { Router } from '@angular/router';
import Phaser from 'phaser';
import { GameStateService } from '../../services/game-state.service';
import { GameScene, SceneBridge } from '../../game/scenes/GameScene';
import { BootScene } from '../../game/scenes/BootScene';
import { CANVAS_W, CANVAS_H, WIN_DISTANCE, PlayerPublicState } from '../../game/constants';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLDivElement>;

  private phaserGame: Phaser.Game | null = null;
  private gameScene: GameScene | null = null;

  readonly WIN_DISTANCE = WIN_DISTANCE;

  // Bridge created here so it's accessible in the constructor's injection context
  private readonly bridge: SceneBridge = {
    view: null,
    onMove: (lane: number) => this.gs.movePlayer(lane),
  };

  constructor(
    readonly gs: GameStateService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    // Re-render Angular overlay whenever signals change
    effect(() => {
      gs.gameState();
      gs.playerView();
      cdr.markForCheck();
    });
    // Keep bridge.view in sync with latest playerView signal
    effect(() => {
      this.bridge.view = this.gs.playerView();
    });
  }

  ngOnInit(): void {
    // Guard: if no playerId, redirect to lobby
    if (!this.gs.playerId()) {
      this.router.navigate(['/']);
    }
  }

  ngAfterViewInit(): void {
    this.initPhaser();
  }

  private initPhaser(): void {
    const bridge = this.bridge;

    const scene = new GameScene();
    this.gameScene = scene;

    // Attach bridge to the scene instance before Phaser uses it
    scene.bridge = bridge;

    this.phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: '#1a1a2e',
      parent: this.canvasRef.nativeElement,
      // BootScene runs first (loads assets + shows progress bar), then starts GameScene
      scene: [new BootScene(), scene] as any,
      physics: { default: 'arcade' },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
  }

  get players(): PlayerPublicState[] {
    return this.gs.gameState()?.players ?? [];
  }

  get phase() { return this.gs.gameState()?.phase; }
  get countdown() { return this.gs.gameState()?.countdown; }
  get winnerName() { return this.gs.gameState()?.winnerName; }
  get myId() { return this.gs.playerId(); }
  get isHost() { return this.gs.isHost(); }
  get myShielded() { return this.gs.playerView()?.myState.shielded ?? false; }
  get myDist() { return this.gs.playerView()?.myState.distance ?? 0; }

  startGame(): void { this.gs.startGame(); }
  restartGame(): void { this.gs.restartGame(); }

  progressPercent(dist: number): number {
    return Math.min(100, Math.round((dist / WIN_DISTANCE) * 100));
  }

  backToLobby(): void {
    this.phaserGame?.destroy(true);
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    this.gameScene?.cleanUp();
    this.phaserGame?.destroy(true);
  }
}

