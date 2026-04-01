import { Mark } from '../nakama/types';

interface CellProps {
  value: number;
  index: number;
  isWinning: boolean;
  isMyTurn: boolean;
  myMark: number;
  disabled: boolean;
  onClick: (index: number) => void;
}

export function Cell({ value, index, isWinning, isMyTurn, myMark, disabled, onClick }: CellProps) {
  const isEmpty = value === Mark.EMPTY;
  const isDisabled = disabled || !isEmpty || !isMyTurn;

  let cellClass = 'cell';
  if (!isEmpty) cellClass += ' cell-filled';
  if (isDisabled && isEmpty) cellClass += ' cell-disabled';
  if (isWinning) cellClass += ' cell-winning';

  return (
    <button
      id={`cell-${index}`}
      className={cellClass}
      onClick={() => !isDisabled && onClick(index)}
      disabled={isDisabled}
      aria-label={`Cell ${index}, ${value === Mark.X ? 'X' : value === Mark.O ? 'O' : 'empty'}`}
    >
      {value === Mark.X && (
        <svg viewBox="0 0 100 100" className="mark-x">
          <line x1="20" y1="20" x2="80" y2="80" />
          <line x1="80" y1="20" x2="20" y2="80" />
        </svg>
      )}
      {value === Mark.O && (
        <svg viewBox="0 0 100 100" className="mark-o">
          <circle cx="50" cy="50" r="35" />
        </svg>
      )}
      {isEmpty && isMyTurn && !disabled && (
        <svg viewBox="0 0 100 100" className="cell-ghost" style={{ opacity: 0, transition: 'opacity 0.2s' }}>
          {myMark === Mark.X ? (
            <g className="mark-x" style={{ opacity: 0.15 }}>
              <line x1="20" y1="20" x2="80" y2="80" style={{ strokeDashoffset: 0, animation: 'none' }} />
              <line x1="80" y1="20" x2="20" y2="80" style={{ strokeDashoffset: 0, animation: 'none' }} />
            </g>
          ) : (
            <g className="mark-o" style={{ opacity: 0.15 }}>
              <circle cx="50" cy="50" r="35" style={{ strokeDashoffset: 0, animation: 'none' }} />
            </g>
          )}
        </svg>
      )}
    </button>
  );
}
