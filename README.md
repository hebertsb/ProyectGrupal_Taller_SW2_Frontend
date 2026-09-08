# Frontend — Brazo Robótico de Ajedrez

React 19 + Vite + TypeScript + Tailwind CSS v4. Consume la API del backend FastAPI (por
defecto en `http://127.0.0.1:8000`, proxeada en desarrollo — ver `vite.config.ts`).

## Setup

Requiere Node.js 20+.

```bash
npm install
npm run dev       # desarrollo, en http://localhost:5173
npm run build     # genera frontend/dist — el backend lo sirve automáticamente en "/"
```

## Pantallas

- **Sala de Control** — tablero en vivo contra Stockfish, feed de cámara y análisis del motor.
- **Razonamiento Neuronal** — visualización de la evaluación de posición (mapa de atención
  completo es alcance de tesis, ver `PLAN_IMPLEMENTACION_COMPLETO.md`).
- **Registro de Partidas** — historial de partidas (depende de persistencia, HU8/HU11).
- **Administración** — configuración del sistema, sesiones (alcance de tesis, HU10/HU11).
