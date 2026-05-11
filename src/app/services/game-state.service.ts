import { Injectable, signal, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { SocketService } from './socket.service';
import { GameState, PlayerView } from '../game/constants';
import { JoinedEvent } from '../core/types/socket-events';

@Injectable({ providedIn: 'root' })
export class GameStateService implements OnDestroy {
  readonly gameState = signal<GameState | null>(null);
  readonly playerView = signal<PlayerView | null>(null);
  readonly playerId = signal<string | null>(null);
  readonly isHost = signal<boolean>(false);
  readonly playerName = signal<string>('');

  private subs: Subscription[] = [];

  constructor(private socket: SocketService) {}

  init(name: string): void {
    this.playerName.set(name);
    this.socket.connect();

    this.subs.push(
      this.socket.on<'joined'>('joined')
        .subscribe((data: JoinedEvent) => {
          this.playerId.set(data.playerId);
          this.isHost.set(data.isHost);
          this.gameState.set(data.gameState);
        }),

      this.socket.on<'gameState'>('gameState')
        .subscribe(state => this.gameState.set(state)),

      this.socket.on<'playerView'>('playerView')
        .subscribe(view => this.playerView.set(view)),
    );

    this.socket.emit('joinGame', { name });
  }

  startGame(): void {
    this.socket.emit('startGame');
  }

  movePlayer(lane: number): void {
    this.socket.emit('movePlayer', { lane: lane as 0 | 1 | 2 });
  }

  restartGame(): void {
    this.socket.emit('restartGame');
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}

