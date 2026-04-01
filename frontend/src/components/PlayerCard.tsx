import { Mark } from '../nakama/types';
import type { PlayerInfo } from '../nakama/types';

interface PlayerCardProps {
  player: PlayerInfo;
  isActive: boolean;
  isMe: boolean;
}

export function PlayerCard({ player, isActive, isMe }: PlayerCardProps) {
  const isX = player.mark === Mark.X;
  const markLabel = isX ? 'X' : 'O';

  let cardClass = 'player-card';
  if (isActive) cardClass += ' player-card-active';
  if (!isX) cardClass += ' player-o';

  const initials = player.username
    .split(/[\s_-]+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <div className={cardClass} id={`player-${isMe ? 'me' : 'opponent'}`}>
      <div className={`player-avatar ${isX ? 'player-avatar-x' : 'player-avatar-o'}`}>
        {initials}
      </div>
      <div className="player-info">
        <div className="player-name">
          {player.username || 'Anonymous'}
          {isMe && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 6 }}>(you)</span>}
        </div>
        <div className="player-mark" style={{ color: isX ? 'var(--accent-cyan)' : 'var(--accent-magenta)' }}>
          Playing as {markLabel}
        </div>
      </div>
    </div>
  );
}
