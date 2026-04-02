# Multiplayer Tic-Tac-Toe App

A server-authoritative multiplayer Tic-Tac-Toe application built with a React/Vite frontend and a Nakama backend.

## Architecture

This project strictly adheres to a client-server architecture where the server acts as the source of truth for all game state.

### Tech Stack
*   **Frontend:** React 18, TypeScript, Vite, `@heroiclabs/nakama-js`, Vanilla CSS.
*   **Backend:** Heroic Labs Nakama (Game Server), PostgreSQL (Database).
*   **Infrastructure:** Docker, Docker Compose, Nginx.

### Design Decisions
*   **Server-Authoritative Logic:** The client only sends intent (OpCode 3: MOVE). The backend validates the move, checks for win/draw conditions, and broadcasts the updated state (OpCode 2: UPDATE or OpCode 4: DONE). This pattern entirely mitigates client-side cheating.
*   **TypeScript to ES5 Transpilation:** Nakama's embedded JavaScript runtime (Goja) requires ES5. The backend code is written in modern TypeScript and bundled via Rollup using the `@rollup/plugin-typescript` target set to ES5.
*   **WebSocket OpCodes:** Network payloads are minimized by utilizing integer OpCodes instead of verbose string events.
    *   `1`: `START`
    *   `2`: `UPDATE`
    *   `3`: `MOVE`
    *   `4`: `DONE`
    *   `5`: `TIMER_UPDATE`

## Installation

### Prerequisites
*   Node.js (v18+)
*   Docker & Docker Compose

### Start the Backend
Spin up the PostgreSQL database and the Nakama server.
```bash
# From the root of the project
docker-compose up --build -d
```
*   **Healthcheck:** `GET http://localhost:7350/healthcheck`
*   **Nakama Console:** `http://localhost:7351` (admin/password)

### Start the Frontend
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
The frontend will be available at `http://localhost:5173`.

## Testing Multiplayer Locally

To simulate two distinct players on the same machine:
1. Open `http://localhost:5173` in a standard browser window.
2. Open `http://localhost:5173` in an Incognito/Private window.
3. Verify both clients display the green **Live** connection badge.
4. Click **Quick Match** simultaneously on both clients to hit the Nakama matchmaker pool.
5. Once paired, test moves, timeouts, and win conditions. Leaderboard entries will automatically persist to the Postgres database upon a win.

## Deployment

A full deployment walk-through using AWS EC2, Let's Encrypt (Certbot), Nginx, and Vercel is available.
> See **[DEPLOYMENT.md](DEPLOYMENT.md)** for detailed provisioning instructions.

### Frontend Environment Variables
When deploying the frontend to production, ensure the following environment variables are supplied to the Vite build process:
*   `VITE_NAKAMA_HOST`: The domain or IP pointing to the Nakama server.
*   `VITE_NAKAMA_PORT`: `443` (Assuming SSL is configured).
*   `VITE_NAKAMA_KEY`: The `NAKAMA_SERVER_KEY` set in the backend environment.
*   `VITE_NAKAMA_USE_SSL`: `true` (Required if hosted on HTTPS like Vercel).
