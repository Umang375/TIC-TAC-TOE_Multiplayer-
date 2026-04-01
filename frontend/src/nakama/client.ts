import { Client, Session } from '@heroiclabs/nakama-js';
import type { Socket } from '@heroiclabs/nakama-js';

const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || '127.0.0.1';
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || '7350';
const NAKAMA_KEY = import.meta.env.VITE_NAKAMA_KEY || 'defaultkey';
const NAKAMA_USE_SSL = import.meta.env.VITE_NAKAMA_USE_SSL === 'true';

// Singleton Nakama client
let client: Client | null = null;

export function getClient(): Client {
  if (!client) {
    client = new Client(NAKAMA_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_USE_SSL);
  }
  return client;
}

// Generate or retrieve device ID
function getDeviceId(): string {
  const KEY = 'ttt_device_id';
  let deviceId = localStorage.getItem(KEY);
  if (!deviceId) {
    deviceId = 'device-' + crypto.randomUUID();
    localStorage.setItem(KEY, deviceId);
  }
  return deviceId;
}

// Authenticate with device ID
export async function authenticate(): Promise<Session> {
  const c = getClient();
  const deviceId = getDeviceId();

  // Try to restore session
  const savedToken = localStorage.getItem('ttt_session_token');
  const savedRefreshToken = localStorage.getItem('ttt_refresh_token');

  if (savedToken && savedRefreshToken) {
    let session = Session.restore(savedToken, savedRefreshToken);
    // Check if session is still valid (not expired or about to expire)
    if (!session.isexpired(Date.now() / 1000 + 300)) {
      return session;
    }
    // Try to refresh
    try {
      session = await c.sessionRefresh(session);
      saveSession(session);
      return session;
    } catch {
      // Refresh failed, re-authenticate
    }
  }

  const session = await c.authenticateDevice(deviceId, true);
  saveSession(session);
  return session;
}

function saveSession(session: Session): void {
  localStorage.setItem('ttt_session_token', session.token);
  localStorage.setItem('ttt_refresh_token', session.refresh_token);
}

// Create and connect WebSocket
export async function createSocket(session: Session): Promise<Socket> {
  const c = getClient();
  const socket = c.createSocket(NAKAMA_USE_SSL, false);
  await socket.connect(session, true);
  return socket;
}

// Update display name
export async function updateDisplayName(session: Session, displayName: string): Promise<void> {
  const c = getClient();
  await c.updateAccount(session, { display_name: displayName });
}

export { type Session, type Socket };
