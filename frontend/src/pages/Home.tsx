import { useState } from 'react';
import { Leaderboard } from '../components/Leaderboard';
import type { Session, Socket } from '@heroiclabs/nakama-js';

interface HomeProps {
  session: Session | null;
  socket: Socket | null;
  username: string | null;
  onSetUsername: (name: string) => Promise<void>;
  onFindMatch: (timedMode: boolean) => Promise<void>;
  onCreateMatch: (timedMode: boolean) => Promise<string>;
  onJoinMatch: (matchId: string) => Promise<void>;
  isSearching: boolean;
}

export function Home({
  session,
  username,
  onSetUsername,
  onFindMatch,
  onCreateMatch,
  onJoinMatch,
  isSearching,
}: HomeProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(username || '');
  const [joinInput, setJoinInput] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSaveName = async () => {
    if (nameInput.trim()) {
      await onSetUsername(nameInput.trim());
      setEditingName(false);
    }
  };

  const handleCreateMatch = async (timed: boolean) => {
    const matchId = await onCreateMatch(timed);
    setCreatedMatchId(matchId);
  };

  const handleCopyMatchId = () => {
    if (createdMatchId) {
      navigator.clipboard.writeText(createdMatchId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoinMatch = async () => {
    if (joinInput.trim()) {
      await onJoinMatch(joinInput.trim());
    }
  };

  if (isSearching) {
    return (
      <div className="page" style={{ justifyContent: 'center', gap: 'var(--space-xl)' }}>
        <div className="loading-spinner" style={{ width: 60, height: 60 }} />
        <h2 className="heading-md" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
          {createdMatchId ? 'Waiting for opponent...' : 'Finding opponent...'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
          {createdMatchId
            ? 'Share the match ID with a friend to play together'
            : 'Looking for a worthy challenger'}
        </p>

        {createdMatchId && (
          <div className="glass-card" style={{ padding: 'var(--space-lg)', textAlign: 'center', maxWidth: 400 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Match ID
            </div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: 'var(--accent-cyan)',
              wordBreak: 'break-all',
              padding: 'var(--space-sm)',
              background: 'rgba(6, 214, 160, 0.05)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-md)',
            }}>
              {createdMatchId}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleCopyMatchId} id="copy-match-id">
              {copied ? '✓ Copied!' : '📋 Copy ID'}
            </button>
          </div>
        )}

        <button
          className="btn btn-ghost"
          onClick={() => window.location.reload()}
          id="cancel-search"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Hero Section */}
      <div style={{
        textAlign: 'center',
        marginBottom: 'var(--space-3xl)',
        animation: 'fadeInUp 0.6s ease-out',
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: 'var(--space-md)',
          animation: 'float 3s ease-in-out infinite',
        }}>
          ✕◯
        </div>
        <h1 className="heading-xl" style={{ marginBottom: 'var(--space-md)' }}>
          <span className="text-gradient-cyan">Tic</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 0.3em' }}>•</span>
          <span className="text-gradient-magenta">Tac</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 0.3em' }}>•</span>
          <span className="text-gradient-cyan">Toe</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 400, margin: '0 auto' }}>
          Real-time multiplayer with server-authoritative gameplay
        </p>
      </div>

      {/* Username */}
      <div className="glass-card" style={{
        padding: 'var(--space-lg)',
        marginBottom: 'var(--space-xl)',
        width: '100%',
        maxWidth: 420,
        animation: 'fadeInUp 0.6s ease-out 0.1s both',
      }}>
        {editingName ? (
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <input
              className="input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              autoFocus
              id="username-input"
            />
            <button className="btn btn-primary btn-sm" onClick={handleSaveName} id="save-username">
              Save
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                Playing as
              </div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {username || 'Anonymous'}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setEditingName(true); setNameInput(username || ''); }}
              id="edit-username"
            >
              ✏️ Edit
            </button>
          </div>
        )}
      </div>

      {/* Quick Play Buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
        width: '100%',
        maxWidth: 420,
        marginBottom: 'var(--space-xl)',
        animation: 'fadeInUp 0.6s ease-out 0.2s both',
      }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => onFindMatch(false)}
          id="quick-match"
          style={{ width: '100%' }}
        >
          ⚡ Quick Match
        </button>
        <button
          className="btn btn-secondary btn-lg"
          onClick={() => onFindMatch(true)}
          id="timed-match"
          style={{ width: '100%' }}
        >
          ⏱️ Timed Match (30s)
        </button>
      </div>

      {/* Private Room Buttons */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-md)',
        width: '100%',
        maxWidth: 420,
        marginBottom: 'var(--space-3xl)',
        animation: 'fadeInUp 0.6s ease-out 0.3s both',
      }}>
        <button
          className="btn btn-ghost"
          onClick={() => handleCreateMatch(false)}
          id="create-room"
          style={{ flex: 1 }}
        >
          🏠 Create Room
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => setShowJoin(!showJoin)}
          id="join-room-toggle"
          style={{ flex: 1 }}
        >
          🔗 Join Room
        </button>
      </div>

      {/* Join Room Input */}
      {showJoin && (
        <div className="glass-card" style={{
          padding: 'var(--space-lg)',
          width: '100%',
          maxWidth: 420,
          marginBottom: 'var(--space-xl)',
          animation: 'fadeInUp 0.3s ease-out',
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <input
              className="input"
              value={joinInput}
              onChange={e => setJoinInput(e.target.value)}
              placeholder="Enter match ID"
              onKeyDown={e => e.key === 'Enter' && handleJoinMatch()}
              id="join-match-input"
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleJoinMatch}
              disabled={!joinInput.trim()}
              id="join-match-btn"
            >
              Join
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard Preview */}
      <div style={{
        width: '100%',
        maxWidth: 500,
        animation: 'fadeInUp 0.6s ease-out 0.4s both',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-md)',
        }}>
          <h2 className="heading-md">
            🏆 <span className="text-gradient-cyan">Leaderboard</span>
          </h2>
        </div>
        <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
          <Leaderboard session={session} compact />
        </div>
      </div>
    </div>
  );
}
