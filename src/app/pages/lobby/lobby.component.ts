import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GameStateService } from '../../services/game-state.service';
import { SocketService } from '../../services/socket.service';
import { GameState } from '../../game/constants';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.css',
})
export class LobbyComponent implements OnInit, OnDestroy {
  name = '';
  error = signal('');
  joining = signal(false);

  /** Live game state from the server (before joining) */
  serverState = signal<GameState | null>(null);

  /** Computed player list for the template */
  connectedPlayers = computed(() => this.serverState()?.players ?? []);
  serverPhase = computed(() => this.serverState()?.phase ?? 'waiting');

  private sub: Subscription | null = null;

  constructor(
    private gameState: GameStateService,
    private socket: SocketService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Connect as observer to show live player list without joining yet
    this.socket.connect();
    this.sub = this.socket.on<'gameState'>('gameState')
      .subscribe(state => this.serverState.set(state));
  }

  join(): void {
    const n = this.name.trim();
    if (!n) { this.error.set('Ingresa tu nombre'); return; }
    if (this.serverPhase() !== 'waiting') {
      this.error.set('La partida ya está en curso. Espera a que termine.');
      return;
    }
    this.sub?.unsubscribe(); // hand off socket ownership to GameStateService
    this.joining.set(true);
    this.gameState.init(n);
    this.router.navigate(['/game']);
  }

  ngOnDestroy(): void {
    // Only disconnect if we never joined (joining transfers socket ownership)
    if (!this.joining()) this.socket.disconnect();
    this.sub?.unsubscribe();
  }
}

