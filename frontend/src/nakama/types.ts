// Op codes for client-server communication — must match server
export const OpCode = {
  START: 1,
  UPDATE: 2,
  MOVE: 3,
  DONE: 4,
  TIMER_UPDATE: 5,
  REJECTED: 6,
} as const;

export const Mark = {
  EMPTY: 0,
  X: 1,
  O: 2,
} as const;

export interface PlayerInfo {
  userId: string;
  mark: number;
  username: string;
}

export interface GameStartData {
  board: number[];
  marks: { [userId: string]: number };
  currentTurn: string;
  timedMode: boolean;
  turnTimeLimit: number;
  turnDeadline: number;
  players: PlayerInfo[];
}

export interface GameUpdateData {
  board: number[];
  currentTurn: string;
  turnDeadline: number;
  lastMove: {
    position: number;
    mark: number;
    userId: string;
  };
}

export interface GameDoneData {
  board: number[];
  winner: string;
  winningLine: number[] | null;
  reason: 'win' | 'draw' | 'forfeit' | 'timeout';
  lastMove?: {
    position: number;
    mark: number;
    userId: string;
  };
}

export interface TimerUpdateData {
  currentTurn: string;
  turnDeadline: number;
  remaining: number;
}

export interface LeaderboardRecord {
  rank: number;
  userId: string;
  username: string;
  wins: number;
  updatedAt: string;
}

export interface LeaderboardResponse {
  records: LeaderboardRecord[];
  total: number;
}

export interface MatchResponse {
  matchId: string;
  created: boolean;
}
