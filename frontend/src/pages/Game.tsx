import { Board } from '../components/Board';
import { PlayerCard } from '../components/PlayerCard';
import { Timer } from '../components/Timer';
import type { PlayerInfo } from '../nakama/types';

interface GameProps {
  board: number[];
  currentTurn: string;
  myMark: number;
  players: PlayerInfo[];
  isMyTurn: boolean;
  gameOver: boolean;
  winner: string | null;
  winnerReason: string | null;
  winningLine: number[] | null;
  timedMode: boolean;
  timeRemaining: number;
  userId: string | null;
  onMove: (position: number) => void;
  onLeave: () => void;
  onPlayAgain: () => void;
}

export function Game({
  board,
  currentTurn,
  myMark,
  players,
  isMyTurn,
  gameOver,
  winner,
  winnerReason,
  winningLine,
  timedMode,
  timeRemaining,
  userId,
  onMove,
  onLeave,
  onPlayAgain,
}: GameProps) {
  const myPlayer = players.find(p => p.userId === userId);
  const opponent = players.find(p => p.userId !== userId);

  const didWin = winner === userId;
  const isDraw = winner === 'draw';

  let statusText = '';
  if (gameOver) {
    if (isDraw) statusText = "It's a draw!";
    else if (didWin) statusText = 'You won!';
    else statusText = 'You lost!';
  } else {
    statusText = isMyTurn ? 'Your turn' : "Opponent's turn";
  }

  return (
    <div className="page" style={{ justifyContent: 'center', gap: 'var(--space-lg)' }}>
      {/* Match Status */}
      <div className="match-status" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        {myPlayer && (
          <PlayerCard
            player={myPlayer}
            isActive={currentTurn === myPlayer.userId && !gameOver}
            isMe
          />
        )}
        <div className="match-vs">VS</div>
        {opponent ? (
          <PlayerCard
            player={opponent}
            isActive={currentTurn === opponent.userId && !gameOver}
            isMe={false}
          />
        ) : (
          <div className="player-card" style={{ opacity: 0.5 }}>
            <div className="player-avatar" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
              ?
            </div>
            <div className="player-info">
              <div className="player-name" style={{ color: 'var(--text-muted)' }}>Waiting...</div>
            </div>
          </div>
        )}
      </div>

      {/* Timer (if timed mode) */}
      {timedMode && !gameOver && (
        <div style={{ animation: 'fadeInUp 0.4s ease-out 0.1s both' }}>
          <Timer
            timeRemaining={timeRemaining}
            totalTime={30}
            isMyTurn={isMyTurn}
          />
        </div>
      )}

      {/* Turn Status */}
      <div style={{
        textAlign: 'center',
        animation: 'fadeInUp 0.4s ease-out 0.15s both',
      }}>
        <div style={{
          fontSize: '1.1rem',
          fontWeight: 600,
          color: gameOver
            ? (isDraw ? 'var(--accent-yellow)' : (didWin ? 'var(--accent-cyan)' : 'var(--accent-magenta)'))
            : (isMyTurn ? 'var(--accent-cyan)' : 'var(--text-secondary)'),
        }}>
          {statusText}
        </div>
      </div>

      {/* Game Board */}
      <div style={{ animation: 'scaleIn 0.5s ease-out 0.2s both' }}>
        <Board
          board={board}
          winningLine={winningLine}
          isMyTurn={isMyTurn}
          myMark={myMark}
          gameOver={gameOver}
          onCellClick={onMove}
        />
      </div>

      {/* Game Over Actions */}
      {gameOver && (
        <div style={{
          display: 'flex',
          gap: 'var(--space-md)',
          animation: 'fadeInUp 0.4s ease-out 0.3s both',
        }}>
          <button className="btn btn-primary" onClick={onPlayAgain} id="play-again">
            🎮 Play Again
          </button>
          <button className="btn btn-ghost" onClick={onLeave} id="back-home">
            🏠 Home
          </button>
        </div>
      )}

      {/* Leave (during game) */}
      {!gameOver && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={onLeave}
          id="forfeit"
          style={{
            opacity: 0.6,
            animation: 'fadeInUp 0.4s ease-out 0.4s both',
          }}
        >
          🚪 Leave Match
        </button>
      )}

      {/* Result Overlay */}
      {gameOver && (
        <div className="result-overlay" onClick={e => e.currentTarget === e.target && undefined}>
          <div className="result-card glass-card" style={{ minWidth: 280 }}>
            <div className="result-emoji">
              {isDraw ? '🤝' : didWin ? '🎉' : '😔'}
            </div>
            <div className="result-title" style={{
              color: isDraw ? 'var(--accent-yellow)' : didWin ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
            }}>
              {isDraw ? "It's a Draw!" : didWin ? 'You Won!' : 'You Lost'}
            </div>
            <div className="result-subtitle">
              {winnerReason === 'forfeit' && 'Opponent left the match'}
              {winnerReason === 'timeout' && (didWin ? 'Opponent ran out of time' : 'You ran out of time')}
              {winnerReason === 'win' && (didWin ? 'Great strategy!' : 'Better luck next time')}
              {winnerReason === 'draw' && 'Well played by both sides'}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={onPlayAgain} id="overlay-play-again">
                Play Again
              </button>
              <button className="btn btn-ghost" onClick={onLeave} id="overlay-home">
                Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
