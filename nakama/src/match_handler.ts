// Op codes for client-server communication
const OpCode = {
  START: 1,       // Server -> Client: game started, includes initial state
  UPDATE: 2,      // Server -> Client: board state update after valid move
  MOVE: 3,        // Client -> Server: player move attempt
  DONE: 4,        // Server -> Client: game over (win/draw/forfeit)
  TIMER_UPDATE: 5,// Server -> Client: timer sync
  REJECTED: 6,    // Server -> Client: move was rejected
};

// Marks
const Mark = {
  EMPTY: 0,
  X: 1,
  O: 2,
};

// Winning line combinations
const WINNING_LINES = [
  [0, 1, 2], // rows
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6], // columns
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8], // diagonals
  [2, 4, 6],
];

interface MatchState {
  board: number[];
  marks: { [userId: string]: number };
  playerOrder: string[];
  currentTurn: string;
  winner: string | null;
  winningLine: number[] | null;
  gameOver: boolean;
  turnDeadline: number;
  timedMode: boolean;
  turnTimeLimit: number;
  presences: { [userId: string]: nkruntime.Presence };
  connectedCount: number;
  gameStarted: boolean;
}

function matchInit(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: nkruntime.MatchState; tickRate: number; label: string } {
  const timedMode = params['timed_mode'] === 'true';
  const turnTimeLimit = timedMode ? 30 : 0; // 30 seconds per turn in timed mode

  const state: MatchState = {
    board: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    marks: {},
    playerOrder: [],
    currentTurn: '',
    winner: null,
    winningLine: null,
    gameOver: false,
    turnDeadline: 0,
    timedMode,
    turnTimeLimit,
    presences: {},
    connectedCount: 0,
    gameStarted: false,
  };

  const label = JSON.stringify({
    open: 1,
    timed_mode: timedMode,
  });

  logger.info('Match created. Timed mode: %s', timedMode ? 'ON' : 'OFF');

  // Tick rate: 1 tick/sec for timer, or 1 tick/sec for checking state
  return { state: state as unknown as nkruntime.MatchState, tickRate: 1, label };
}

function matchJoinAttempt(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
): { state: nkruntime.MatchState; accept: boolean; rejectMessage?: string } {
  const s = state as unknown as MatchState;

  // Reject if match already has 2 players
  if (s.connectedCount >= 2) {
    return { state: s as unknown as nkruntime.MatchState, accept: false, rejectMessage: 'Match is full' };
  }

  // Reject if game is already over
  if (s.gameOver) {
    return { state: s as unknown as nkruntime.MatchState, accept: false, rejectMessage: 'Game is already over' };
  }

  return { state: s as unknown as nkruntime.MatchState, accept: true };
}

function matchJoin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  const s = state as unknown as MatchState;

  for (const presence of presences) {
    s.presences[presence.userId] = presence;
    s.connectedCount++;

    // Assign marks: first player is X, second is O
    if (!s.marks[presence.userId]) {
      if (s.playerOrder.length === 0) {
        s.marks[presence.userId] = Mark.X;
        s.playerOrder.push(presence.userId);
        logger.info('Player %s joined as X', presence.userId);
      } else if (s.playerOrder.length === 1) {
        s.marks[presence.userId] = Mark.O;
        s.playerOrder.push(presence.userId);
        logger.info('Player %s joined as O', presence.userId);
      }
    }
  }

  // Update match label to closed when 2 players have joined
  if (s.playerOrder.length >= 2) {
    const label = JSON.stringify({
      open: 0,
      timed_mode: s.timedMode,
    });
    dispatcher.matchLabelUpdate(label);
  }

  // Start game when 2 players are connected
  if (s.connectedCount === 2 && !s.gameStarted) {
    s.gameStarted = true;
    s.currentTurn = s.playerOrder[0]; // X goes first

    if (s.timedMode) {
      s.turnDeadline = Math.floor(Date.now() / 1000) + s.turnTimeLimit;
    }

    // Broadcast game start to all players
    const startMessage = JSON.stringify({
      board: s.board,
      marks: s.marks,
      currentTurn: s.currentTurn,
      timedMode: s.timedMode,
      turnTimeLimit: s.turnTimeLimit,
      turnDeadline: s.turnDeadline,
      players: s.playerOrder.map(userId => ({
        userId,
        mark: s.marks[userId],
        username: s.presences[userId]?.username || 'Unknown',
      })),
    });

    dispatcher.broadcastMessage(OpCode.START, startMessage, null, null, true);
    logger.info('Game started! %s vs %s', s.playerOrder[0], s.playerOrder[1]);
  }

  return { state: s as unknown as nkruntime.MatchState };
}

function matchLeave(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  const s = state as unknown as MatchState;

  for (const presence of presences) {
    delete s.presences[presence.userId];
    s.connectedCount--;
    logger.info('Player %s left', presence.userId);
  }

  // If game was in progress and a player left, the other player wins by forfeit
  if (s.gameStarted && !s.gameOver && s.connectedCount < 2) {
    s.gameOver = true;

    // Find the remaining player
    const remainingUserId = Object.keys(s.presences)[0];
    if (remainingUserId) {
      s.winner = remainingUserId;

      const doneMessage = JSON.stringify({
        board: s.board,
        winner: s.winner,
        winningLine: null,
        reason: 'forfeit',
      });
      dispatcher.broadcastMessage(OpCode.DONE, doneMessage, null, null, true);
      logger.info('Player %s wins by forfeit', remainingUserId);

      // Update leaderboard
      recordWin(nk, logger, remainingUserId, s.presences[remainingUserId]?.username || 'Unknown');
    }
  }

  // If no one is left, terminate
  if (s.connectedCount <= 0 && s.gameStarted) {
    return null; // Terminates the match
  }

  return { state: s as unknown as nkruntime.MatchState };
}

function matchLoop(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[]
): { state: nkruntime.MatchState } | null {
  const s = state as unknown as MatchState;

  if (s.gameOver) {
    // Keep the match alive for a few seconds after game over
    // so clients can show results, then terminate
    if (tick % 10 === 0) {
      return null; // Terminate after ~10 seconds
    }
    return { state: s as unknown as nkruntime.MatchState };
  }

  if (!s.gameStarted) {
    return { state: s as unknown as nkruntime.MatchState };
  }

  // Check timer expiry in timed mode
  if (s.timedMode && s.turnDeadline > 0) {
    const now = Math.floor(Date.now() / 1000);
    if (now >= s.turnDeadline) {
      // Current player forfeits due to timeout
      s.gameOver = true;
      const otherPlayer = s.playerOrder.filter(id => id !== s.currentTurn)[0];
      if (otherPlayer) {
        s.winner = otherPlayer;
        const doneMessage = JSON.stringify({
          board: s.board,
          winner: s.winner,
          winningLine: null,
          reason: 'timeout',
        });
        dispatcher.broadcastMessage(OpCode.DONE, doneMessage, null, null, true);
        logger.info('Player %s wins due to timeout', otherPlayer);
        recordWin(nk, logger, otherPlayer, s.presences[otherPlayer]?.username || 'Unknown');
      }
      return { state: s as unknown as nkruntime.MatchState };
    }

    // Broadcast timer updates every tick in timed mode
    const timerMessage = JSON.stringify({
      currentTurn: s.currentTurn,
      turnDeadline: s.turnDeadline,
      remaining: s.turnDeadline - now,
    });
    dispatcher.broadcastMessage(OpCode.TIMER_UPDATE, timerMessage, null, null, true);
  }

  // Process incoming move messages
  for (const message of messages) {
    if (message.opCode !== OpCode.MOVE) {
      continue;
    }

    const senderId = message.sender.userId;

    // Validate: is it this player's turn?
    if (senderId !== s.currentTurn) {
      const rejectMsg = JSON.stringify({ reason: 'Not your turn' });
      dispatcher.broadcastMessage(OpCode.REJECTED, rejectMsg, [message.sender], null, true);
      logger.warn('Player %s tried to move out of turn', senderId);
      continue;
    }

    // Parse move data
    let moveData: { position: number };
    try {
      moveData = JSON.parse(nk.binaryToString(message.data));
    } catch (e) {
      const rejectMsg = JSON.stringify({ reason: 'Invalid move data' });
      dispatcher.broadcastMessage(OpCode.REJECTED, rejectMsg, [message.sender], null, true);
      continue;
    }

    const pos = moveData.position;

    // Validate: position in bounds
    if (pos < 0 || pos > 8) {
      const rejectMsg = JSON.stringify({ reason: 'Position out of bounds' });
      dispatcher.broadcastMessage(OpCode.REJECTED, rejectMsg, [message.sender], null, true);
      continue;
    }

    // Validate: cell is empty
    if (s.board[pos] !== Mark.EMPTY) {
      const rejectMsg = JSON.stringify({ reason: 'Cell is already occupied' });
      dispatcher.broadcastMessage(OpCode.REJECTED, rejectMsg, [message.sender], null, true);
      continue;
    }

    // Apply the valid move
    const playerMark = s.marks[senderId];
    s.board[pos] = playerMark;
    logger.info('Player %s placed %s at position %d', senderId, playerMark === Mark.X ? 'X' : 'O', pos);

    // Check for win
    const winLine = checkWin(s.board, playerMark);
    if (winLine) {
      s.gameOver = true;
      s.winner = senderId;
      s.winningLine = winLine;

      const doneMessage = JSON.stringify({
        board: s.board,
        winner: s.winner,
        winningLine: winLine,
        reason: 'win',
        lastMove: { position: pos, mark: playerMark, userId: senderId },
      });
      dispatcher.broadcastMessage(OpCode.DONE, doneMessage, null, null, true);
      logger.info('Player %s wins!', senderId);
      recordWin(nk, logger, senderId, s.presences[senderId]?.username || 'Unknown');
      return { state: s as unknown as nkruntime.MatchState };
    }

    // Check for draw
    if (s.board.every(cell => cell !== Mark.EMPTY)) {
      s.gameOver = true;
      s.winner = 'draw';

      const doneMessage = JSON.stringify({
        board: s.board,
        winner: 'draw',
        winningLine: null,
        reason: 'draw',
        lastMove: { position: pos, mark: playerMark, userId: senderId },
      });
      dispatcher.broadcastMessage(OpCode.DONE, doneMessage, null, null, true);
      logger.info('Game ended in a draw');
      return { state: s as unknown as nkruntime.MatchState };
    }

    // Switch turns
    s.currentTurn = s.playerOrder.filter(id => id !== senderId)[0] || s.currentTurn;

    // Reset timer for the new turn
    if (s.timedMode) {
      s.turnDeadline = Math.floor(Date.now() / 1000) + s.turnTimeLimit;
    }

    // Broadcast updated state
    const updateMessage = JSON.stringify({
      board: s.board,
      currentTurn: s.currentTurn,
      turnDeadline: s.turnDeadline,
      lastMove: { position: pos, mark: playerMark, userId: senderId },
    });
    dispatcher.broadcastMessage(OpCode.UPDATE, updateMessage, null, null, true);
  }

  return { state: s as unknown as nkruntime.MatchState };
}

function matchTerminate(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  graceSeconds: number
): { state: nkruntime.MatchState } | null {
  logger.info('Match terminated');
  return null;
}

function matchSignal(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  data: string
): { state: nkruntime.MatchState; data?: string } | null {
  logger.info('Match signal received: %s', data);
  return { state, data: 'signal received' };
}

// Helper: check if a mark has won
function checkWin(board: number[], mark: number): number[] | null {
  for (const line of WINNING_LINES) {
    if (board[line[0]] === mark && board[line[1]] === mark && board[line[2]] === mark) {
      return line;
    }
  }
  return null;
}

// Helper: record a win to the leaderboard
function recordWin(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string, username: string): void {
  try {
    nk.leaderboardRecordWrite('tic_tac_toe_wins', userId, username, 1, 0);
    logger.info('Recorded win for player %s', userId);
  } catch (error) {
    logger.error('Failed to record win: %s', error);
  }
}

// Export the match handler
const matchHandler: nkruntime.MatchHandler = {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchTerminate,
  matchSignal,
};

export default matchHandler;
export { OpCode, Mark };
