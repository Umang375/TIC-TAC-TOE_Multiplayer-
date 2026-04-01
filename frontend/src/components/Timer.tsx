import { useEffect, useState } from 'react';

interface TimerProps {
  timeRemaining: number;
  totalTime: number;
  isMyTurn: boolean;
}

export function Timer({ timeRemaining, totalTime, isMyTurn }: TimerProps) {
  const [displayTime, setDisplayTime] = useState(timeRemaining);

  useEffect(() => {
    setDisplayTime(timeRemaining);
  }, [timeRemaining]);

  // Client-side countdown between server ticks
  useEffect(() => {
    if (displayTime <= 0) return;

    const interval = setInterval(() => {
      setDisplayTime(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const progress = totalTime > 0 ? displayTime / totalTime : 0;
  const dashOffset = circumference * (1 - progress);

  const isUrgent = displayTime <= 5;

  let strokeColor = '#06d6a0'; // green
  if (displayTime <= 10) strokeColor = '#ffd166'; // yellow
  if (displayTime <= 5) strokeColor = '#ef476f'; // red

  return (
    <div className={`timer-container ${isUrgent ? 'timer-urgent' : ''}`} id="timer">
      <svg className="timer-svg" viewBox="0 0 80 80">
        <circle className="timer-bg" cx="40" cy="40" r={radius} />
        <circle
          className="timer-progress"
          cx="40"
          cy="40"
          r={radius}
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="timer-text" style={{ color: strokeColor }}>
        {displayTime}
      </div>
      <div style={{
        position: 'absolute',
        bottom: -6,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '0.6rem',
        color: isMyTurn ? '#06d6a0' : 'var(--text-muted)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        {isMyTurn ? 'YOUR TURN' : 'WAITING'}
      </div>
    </div>
  );
}
