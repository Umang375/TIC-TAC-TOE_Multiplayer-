import { useState, useEffect, useCallback, useRef } from 'react';
import { authenticate, createSocket, updateDisplayName } from '../nakama/client';
import type { Session, Socket } from '@heroiclabs/nakama-js';

interface UseNakamaReturn {
  session: Session | null;
  socket: Socket | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  userId: string | null;
  username: string | null;
  setUsername: (name: string) => Promise<void>;
}

export function useNakama(): UseNakamaReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsernameState] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        setIsLoading(true);
        setError(null);

        const sess = await authenticate();
        if (cancelled) return;
        setSession(sess);
        setUsernameState(sess.username || null);

        const sock = await createSocket(sess);
        if (cancelled) return;
        socketRef.current = sock;
        setSocket(sock);
        setIsConnected(true);

        // Handle disconnect
        sock.ondisconnect = () => {
          if (!cancelled) {
            setIsConnected(false);
          }
        };
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to connect');
          console.error('Nakama connection error:', err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect(false);
        socketRef.current = null;
      }
    };
  }, []);

  const setUsername = useCallback(async (name: string) => {
    if (!session) return;
    try {
      await updateDisplayName(session, name);
      setUsernameState(name);
    } catch (err) {
      console.error('Failed to update username:', err);
    }
  }, [session]);

  return {
    session,
    socket,
    isConnected,
    isLoading,
    error,
    userId: session?.user_id || null,
    username,
    setUsername,
  };
}
