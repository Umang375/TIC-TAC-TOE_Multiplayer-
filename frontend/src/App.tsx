import { useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { useNakama } from './hooks/useNakama';
import { useMatch } from './hooks/useMatch';
import { Home } from './pages/Home';
import { Game } from './pages/Game';
import { LeaderboardPage } from './pages/LeaderboardPage';

type Page = 'home' | 'game' | 'leaderboard';

function App() {
  const { session, socket, isConnected, isLoading, error, userId, username, setUsername } = useNakama();
  const match = useMatch(session, socket, userId);
  const [page, setPage] = useState<Page>('home');

  // Show loading screen while connecting
  if (isLoading) {
    return (
      <>
        <div className="page" style={{ justifyContent: 'center', alignItems: 'center', gap: 'var(--space-xl)' }}>
          <div className="loading-spinner" style={{ width: 60, height: 60 }} />
          <p style={{ color: 'var(--text-secondary)', animation: 'pulse 1.5s ease-in-out infinite' }}>
            Connecting to server...
          </p>
        </div>
        <Analytics />
      </>
    );
  }

  // Show error screen
  if (error) {
    return (
      <>
        <div className="page" style={{ justifyContent: 'center', alignItems: 'center', gap: 'var(--space-xl)' }}>
          <div style={{ fontSize: '3rem' }}>😵</div>
          <h2 className="heading-md" style={{ color: 'var(--accent-magenta)' }}>Connection Failed</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 400 }}>
            {error}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', maxWidth: 400 }}>
            Make sure the Nakama server is running on localhost:7350
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()} id="retry-connection">
            🔄 Retry
          </button>
        </div>
        <Analytics />
      </>
    );
  }

  // When in an active match, show the game page
  if (match.isInMatch && !match.isSearching && match.players.length > 0) {
    return (
      <>
        <nav className="nav">
          <div className="nav-logo">
            <span className="text-gradient-cyan">✕◯</span>
            <span>Tic-Tac-Toe</span>
          </div>
          <div className="nav-links">
            {isConnected && (
              <span className="status-badge status-connected">
                <span className="status-dot" />
                Live
              </span>
            )}
          </div>
        </nav>
        <Game
          board={match.board}
          currentTurn={match.currentTurn}
          myMark={match.myMark}
          players={match.players}
          isMyTurn={match.isMyTurn}
          gameOver={match.gameOver}
          winner={match.winner}
          winnerReason={match.winnerReason}
          winningLine={match.winningLine}
          timedMode={match.timedMode}
          timeRemaining={match.timeRemaining}
          userId={userId}
          onMove={match.makeMove}
          onLeave={() => { match.leaveMatch(); setPage('home'); }}
          onPlayAgain={() => { match.resetMatch(); setPage('home'); }}
        />
        <Analytics />
      </>
    );
  }

  // Leaderboard page
  if (page === 'leaderboard') {
    return (
      <>
        <nav className="nav">
          <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => setPage('home')}>
            <span className="text-gradient-cyan">✕◯</span>
            <span>Tic-Tac-Toe</span>
          </div>
          <div className="nav-links">
            {isConnected && (
              <span className="status-badge status-connected">
                <span className="status-dot" />
                Live
              </span>
            )}
          </div>
        </nav>
        <LeaderboardPage
          session={session}
          onBack={() => setPage('home')}
        />
        <Analytics />
      </>
    );
  }

  // Home / Lobby
  return (
    <>
      <nav className="nav">
        <div className="nav-logo">
          <span className="text-gradient-cyan">✕◯</span>
          <span>Tic-Tac-Toe</span>
        </div>
        <div className="nav-links">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage('leaderboard')}
            id="nav-leaderboard"
          >
            🏆 Leaderboard
          </button>
          {isConnected && (
            <span className="status-badge status-connected">
              <span className="status-dot" />
              Live
            </span>
          )}
        </div>
      </nav>
      <Home
        session={session}
        socket={socket}
        username={username}
        onSetUsername={setUsername}
        onFindMatch={async (timed) => { await match.findMatch(timed); }}
        onCreateMatch={match.createMatch}
        onJoinMatch={match.joinMatch}
        isSearching={match.isSearching}
      />
      <Analytics />
    </>
  );
}

export default App;
