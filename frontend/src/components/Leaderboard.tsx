import { useState, useEffect } from 'react';
import { getClient } from '../nakama/client';
import type { Session } from '@heroiclabs/nakama-js';
import type { LeaderboardRecord, LeaderboardResponse } from '../nakama/types';

interface LeaderboardProps {
  session: Session | null;
  compact?: boolean;
}

export function Leaderboard({ session, compact = false }: LeaderboardProps) {
  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;

    async function fetchLeaderboard() {
      try {
        setLoading(true);
        const client = getClient();
        const result = await client.rpc(session!, 'get_leaderboard', {
          limit: compact ? 5 : 20,
        });
        if (result.payload) {
          const payloadData = typeof result.payload === 'string' ? JSON.parse(result.payload) : result.payload;
          const data = payloadData as LeaderboardResponse;
          setRecords(data.records);
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [session, compact]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xl)' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
        No records yet. Play a game to get on the leaderboard!
      </div>
    );
  }

  return (
    <table className="leaderboard-table" id="leaderboard">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>Wins</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record) => {
          const rankClass = record.rank <= 3 ? `rank-${record.rank}` : '';
          const badgeClass = record.rank <= 3 ? `rank-badge rank-badge-${record.rank}` : 'rank-badge';

          return (
            <tr key={record.userId}>
              <td>
                <span className={badgeClass} style={record.rank > 3 ? {
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-secondary)',
                } : undefined}>
                  {record.rank <= 3 ? ['🥇', '🥈', '🥉'][record.rank - 1] : record.rank}
                </span>
              </td>
              <td className={rankClass} style={{ fontWeight: record.rank <= 3 ? 600 : 400 }}>
                {record.username}
              </td>
              <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                {record.wins}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
