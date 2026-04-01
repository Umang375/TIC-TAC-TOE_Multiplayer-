import { useState, useCallback, useEffect, useRef } from 'react';
import type { Session, Socket } from '@heroiclabs/nakama-js';
import { getClient } from '../nakama/client';
import {
  OpCode,
  type GameStartData,
  type GameUpdateData,
  type GameDoneData,
  type TimerUpdateData,
  type MatchResponse,
  type PlayerInfo,
} from '../nakama/types';

interface UseMatchReturn {
  // State
  board: number[];
  currentTurn: string;
  myMark: number;
  players: PlayerInfo[];
  matchId: string | null;
  isMyTurn: boolean;
  gameOver: boolean;
  winner: string | null;
  winnerReason: string | null;
  winningLine: number[] | null;
  timedMode: boolean;
  timeRemaining: number;
  isSearching: boolean;
  isInMatch: boolean;
  opponentLeft: boolean;

  // Actions
  findMatch: (timedMode: boolean) => Promise<void>;
  createMatch: (timedMode: boolean) => Promise<string>;
  joinMatch: (matchId: string) => Promise<void>;
  makeMove: (position: number) => void;
  leaveMatch: () => void;
  resetMatch: () => void;
}

export function useMatch(
  session: Session | null,
  socket: Socket | null,
  userId: string | null
): UseMatchReturn {
  const [board, setBoard] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [currentTurn, setCurrentTurn] = useState<string>('');
  const [myMark, setMyMark] = useState<number>(0);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [winnerReason, setWinnerReason] = useState<string | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [timedMode, setTimedMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isInMatch, setIsInMatch] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);

  const matchIdRef = useRef<string | null>(null);
  const matchmakerTicketRef = useRef<string | null>(null);

  const isMyTurn = currentTurn === userId;

  // Set up socket listeners
  useEffect(() => {
    if (!socket || !userId) return;

    // Handle match data
    socket.onmatchdata = (matchData) => {
      const data = matchData.data
        ? JSON.parse(new TextDecoder().decode(matchData.data as Uint8Array))
        : null;

      switch (matchData.op_code) {
        case OpCode.START: {
          const startData = data as GameStartData;
          setBoard(startData.board);
          setCurrentTurn(startData.currentTurn);
          setTimedMode(startData.timedMode);
          setPlayers(startData.players);
          setIsSearching(false);
          setIsInMatch(true);

          // Find my mark
          const me = startData.players.find(p => p.userId === userId);
          if (me) setMyMark(me.mark);

          if (startData.timedMode) {
            setTimeRemaining(startData.turnTimeLimit);
          }
          break;
        }

        case OpCode.UPDATE: {
          const updateData = data as GameUpdateData;
          setBoard(updateData.board);
          setCurrentTurn(updateData.currentTurn);

          if (updateData.turnDeadline) {
            const now = Math.floor(Date.now() / 1000);
            setTimeRemaining(Math.max(0, updateData.turnDeadline - now));
          }
          break;
        }

        case OpCode.DONE: {
          const doneData = data as GameDoneData;
          setBoard(doneData.board);
          setGameOver(true);
          setWinner(doneData.winner);
          setWinnerReason(doneData.reason);
          setWinningLine(doneData.winningLine);
          break;
        }

        case OpCode.TIMER_UPDATE: {
          const timerData = data as TimerUpdateData;
          setTimeRemaining(Math.max(0, timerData.remaining));
          break;
        }

        case OpCode.REJECTED: {
          console.warn('Move rejected:', data?.reason);
          break;
        }
      }
    };

    // Handle presence changes
    socket.onmatchpresence = (presenceEvent) => {
      if (presenceEvent.leaves && presenceEvent.leaves.length > 0) {
        setOpponentLeft(true);
      }
    };

    // Handle matchmaker matched
    socket.onmatchmakermatched = async (matched) => {
      if (!matched.match_id) return;
      try {
        const match = await socket.joinMatch(matched.match_id);
        matchIdRef.current = match.match_id;
        setMatchId(match.match_id);
        setIsSearching(false);
        setIsInMatch(true);
      } catch (err) {
        console.error('Failed to join match from matchmaker:', err);
        setIsSearching(false);
      }
    };

    return () => {
      socket.onmatchdata = () => {};
      socket.onmatchpresence = () => {};
      socket.onmatchmakermatched = () => {};
    };
  }, [socket, userId]);

  // Find or create a match via RPC
  const findMatch = useCallback(async (timed: boolean) => {
    if (!socket || !session) return;

    setIsSearching(true);
    setGameOver(false);
    setWinner(null);
    setWinnerReason(null);
    setWinningLine(null);
    setOpponentLeft(false);
    setBoard([0, 0, 0, 0, 0, 0, 0, 0, 0]);

    try {
      // Use matchmaker for automatic pairing
      const ticket = await socket.addMatchmaker(
        timed ? '+properties.mode:timed' : '+properties.mode:classic',
        2,
        2,
        { mode: timed ? 'timed' : 'classic' },
        {}
      );
      matchmakerTicketRef.current = ticket.ticket;

      // Also try RPC to find an existing open match as fallback
      const client = getClient();
      const rpcResult = await client.rpc(session, 'find_match', { timedMode: timed });
      if (rpcResult.payload) {
        const payloadData = typeof rpcResult.payload === 'string' ? JSON.parse(rpcResult.payload) : rpcResult.payload;
        const result = payloadData as MatchResponse;

        // If match found via RPC, remove from matchmaker and join directly
        if (matchmakerTicketRef.current) {
          try {
            await socket.removeMatchmaker(matchmakerTicketRef.current);
          } catch {
            // Might fail if already matched
          }
        }

        const match = await socket.joinMatch(result.matchId);
        matchIdRef.current = match.match_id;
        setMatchId(match.match_id);
        setIsInMatch(true);

        // Don't set isSearching false yet — wait for START
        if (!result.created) {
          // Joined existing match, game might start soon
        }
      }
    } catch (err) {
      console.error('Failed to find match:', err);
      setIsSearching(false);
    }
  }, [socket, session]);

  // Create a private match
  const createMatch = useCallback(async (timed: boolean): Promise<string> => {
    if (!socket || !session) throw new Error('Not connected');

    setGameOver(false);
    setWinner(null);
    setWinnerReason(null);
    setWinningLine(null);
    setOpponentLeft(false);
    setBoard([0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const client = getClient();
    const rpcResult = await client.rpc(session, 'create_match', { timedMode: timed });
    const payloadData = typeof rpcResult.payload === 'string' ? JSON.parse(rpcResult.payload) : rpcResult.payload;
    const result = payloadData as MatchResponse;

    const match = await socket.joinMatch(result.matchId);
    matchIdRef.current = match.match_id;
    setMatchId(match.match_id);
    setIsInMatch(true);
    setIsSearching(true); // Waiting for opponent
    setTimedMode(timed);

    return result.matchId;
  }, [socket, session]);

  // Join a specific match by ID
  const joinMatch = useCallback(async (id: string) => {
    if (!socket) throw new Error('Not connected');

    setGameOver(false);
    setWinner(null);
    setWinnerReason(null);
    setWinningLine(null);
    setOpponentLeft(false);
    setBoard([0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const match = await socket.joinMatch(id);
    matchIdRef.current = match.match_id;
    setMatchId(match.match_id);
    setIsInMatch(true);
  }, [socket]);

  // Send a move
  const makeMove = useCallback((position: number) => {
    if (!socket || !matchIdRef.current || gameOver || !isMyTurn) return;

    socket.sendMatchState(
      matchIdRef.current,
      OpCode.MOVE,
      JSON.stringify({ position })
    );
  }, [socket, gameOver, isMyTurn]);

  // Leave the current match
  const leaveMatch = useCallback(() => {
    if (socket && matchIdRef.current) {
      socket.leaveMatch(matchIdRef.current);
    }
    resetMatch();
  }, [socket]);

  // Reset all match state
  const resetMatch = useCallback(() => {
    matchIdRef.current = null;
    setMatchId(null);
    setBoard([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    setCurrentTurn('');
    setMyMark(0);
    setPlayers([]);
    setGameOver(false);
    setWinner(null);
    setWinnerReason(null);
    setWinningLine(null);
    setTimedMode(false);
    setTimeRemaining(0);
    setIsSearching(false);
    setIsInMatch(false);
    setOpponentLeft(false);
  }, []);

  return {
    board,
    currentTurn,
    myMark,
    players,
    matchId,
    isMyTurn,
    gameOver,
    winner,
    winnerReason,
    winningLine,
    timedMode,
    timeRemaining,
    isSearching,
    isInMatch,
    opponentLeft,
    findMatch,
    createMatch,
    joinMatch,
    makeMove,
    leaveMatch,
    resetMatch,
  };
}
