import { Cell } from './Cell';

interface BoardProps {
  board: number[];
  winningLine: number[] | null;
  isMyTurn: boolean;
  myMark: number;
  gameOver: boolean;
  onCellClick: (index: number) => void;
}

export function Board({ board, winningLine, isMyTurn, myMark, gameOver, onCellClick }: BoardProps) {
  return (
    <div className="board-container" id="game-board">
      {board.map((value, index) => (
        <Cell
          key={index}
          value={value}
          index={index}
          isWinning={winningLine?.includes(index) ?? false}
          isMyTurn={isMyTurn}
          myMark={myMark}
          disabled={gameOver}
          onClick={onCellClick}
        />
      ))}
    </div>
  );
}
