import { Leaderboard } from '../components/Leaderboard';
import type { Session } from '@heroiclabs/nakama-js';

interface LeaderboardPageProps {
  session: Session | null;
  onBack: () => void;
}

export function LeaderboardPage({ session, onBack }: LeaderboardPageProps) {
  return (
    <div className="page">
      <div style={{
        width: '100%',
        maxWidth: 600,
        animation: 'fadeInUp 0.5s ease-out',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-xl)',
        }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack} id="back-from-leaderboard">
            ← Back
          </button>
          <h1 className="heading-lg">
            🏆 <span className="text-gradient-cyan">Leaderboard</span>
          </h1>
        </div>
        <div className="glass-card" style={{
          padding: 'var(--space-xl)',
        }}>
          <Leaderboard session={session} compact={false} />
        </div>
      </div>
    </div>
  );
}
