# 🐔 Run Chicken! — Multiplayer Local Race

Prototipo de juego multijugador en red local usando **Angular + Phaser + Socket.IO**.

---

## Arquitectura

```
┌─────────────────────────────────────┐
│  PC Host (servidor)                 │
│  ┌───────────────┐ ┌─────────────┐  │
│  │ Node.js       │ │ Angular     │  │
│  │ Socket.IO     │ │ ng serve    │  │
│  │ :3000         │ │ :4200       │  │
│  └───────────────┘ └─────────────┘  │
└─────────────────────────────────────┘
          ▲ WiFi local
  ┌───────┴───────┐
  │  Teléfonos    │  http://192.168.x.x:4200
  │  (jugadores)  │
  └───────────────┘
```

**El servidor es autoritativo**: decide progreso, colisiones, vidas, ganador. El cliente solo renderiza y envía inputs.

---

## Inicio rápido

### 1. Instalar dependencias

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

### 2. Iniciar el servidor (backend)

```bash
cd server
npm run dev
# → http://0.0.0.0:3000
```

### 3. Iniciar Angular (frontend)

```bash
# En la raíz del proyecto
npm start
# → http://0.0.0.0:4200
```

### 4. Conectar jugadores desde teléfonos

Averigua la IP local del PC host:
```bash
ip addr show | grep "inet " | grep -v 127
# ej: 192.168.1.50
```

Los jugadores abren en su navegador: **`http://192.168.1.50:4200`**

---

## Mecánicas del juego

| Elemento | Efecto |
|----------|--------|
| 🧱 Obstáculo | Pierde 1 vida + 2s de invencibilidad |
| 🦠 Virus | Reduce velocidad temporalmente |
| 💊 Vitamina | Boost de velocidad + 1.5s invencibilidad |
| ❤️ Vidas | 3 vidas iniciales. Sin vidas → eliminado |
| 🏁 Meta | 2000 unidades de distancia |

- **3 carriles** (izquierda / centro / derecha)
- Velocidad **aumenta con el tiempo** (~8 u/s cada 10 seg)
- Panel lateral muestra el progreso de **todos los jugadores** en tiempo real

### Controles

| Dispositivo | Acción |
|-------------|--------|
| Móvil | Toca lado izquierdo → carril izq; lado derecho → carril der |
| Teclado | ← → flechas |
| Swipe | Desliza izquierda/derecha |

---

## Estructura del proyecto

```
run-chicken/
├── server/                  ← Backend Node.js
│   ├── src/
│   │   ├── server.ts        ← Express + Socket.IO
│   │   ├── GameRoom.ts      ← Lógica autoritativa del juego
│   │   └── types.ts         ← Tipos compartidos
│   └── package.json
│
└── src/app/                 ← Frontend Angular
    ├── game/
    │   ├── constants.ts     ← Constantes compartidas + tipos
    │   └── scenes/
    │       └── GameScene.ts ← Escena Phaser principal
    ├── pages/
    │   ├── lobby/           ← Pantalla de entrada
    │   └── game/            ← Vista del juego
    └── services/
        ├── socket.service.ts      ← Wrapper Socket.IO
        └── game-state.service.ts  ← Estado global reactivo
```

---

## Eventos Socket.IO

### Cliente → Servidor
| Evento | Datos |
|--------|-------|
| `joinGame` | `{ name: string }` |
| `startGame` | _(solo host)_ |
| `movePlayer` | `{ lane: 0 \| 1 \| 2 }` |
| `restartGame` | _(solo host)_ |

### Servidor → Cliente
| Evento | Datos |
|--------|-------|
| `joined` | `{ playerId, isHost, gameState }` |
| `gameState` | Estado público de todos los jugadores |
| `playerView` | Vista personalizada (mis obstáculos, mis stats) |
