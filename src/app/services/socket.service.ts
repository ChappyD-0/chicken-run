import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ClientEventName,
  ClientPayload,
  ServerEventName,
  ServerPayload,
} from '../core/types/socket-events';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: AppSocket | null = null;

  connect(): void {
    if (this.socket?.connected) return;
    this.socket = io(environment.serverUrl, { transports: ['websocket'] });
    this.socket.on('connect', () => console.log('Socket connected:', this.socket?.id));
    this.socket.on('disconnect', () => console.log('Socket disconnected'));
  }

  /** Emit a typed client event */
  emit<E extends ClientEventName>(event: E, data?: ClientPayload<E>): void {
    // socket.io-client accepts (event, ...args) — cast needed for optional payload
    (this.socket as Socket | null)?.emit(event, data as never);
  }

  /** Subscribe to a typed server event */
  on<E extends ServerEventName>(event: E): Observable<ServerPayload<E>> {
    return new Observable(observer => {
      const handler = (data: ServerPayload<E>) => observer.next(data);
      // Cast to any to avoid Socket.IO's strict overload matching
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.socket?.on(event as any, handler as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return () => this.socket?.off(event as any, handler as any);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}

