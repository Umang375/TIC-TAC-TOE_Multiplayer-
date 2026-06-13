package backend.tictactoe.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GameRoom {

    private String roomId;
    
    // In-memory board state: 9 cells (0 = Empty, 1 = X, 2 = O)
    private final int[] board = new int[9];
    
    // Maps player User ID -> User object
    private final Map<String, User> players = new ConcurrentHashMap<>();
    
    // Maps player User ID -> active WebSocket session for real-time broadcasts
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    
    // List tracking join order (X goes first, O goes second)
    private final List<String> playerOrder = new ArrayList<>();
    
    private String currentTurn;
    private boolean gameOver = false;
    private String winner = null; // Contains user ID, or "draw" / null
    private int[] winningLine = null; // Elements mapping to winning combinations (e.g. [0,1,2])
    
    private boolean timedMode;
    private int turnTimeLimit = 30; // 30 seconds per turn in timed mode
    private long turnDeadline;      // Epoch timestamp in seconds

    // Helper: Checks if the board contains a winning configuration for a given mark
    public int[] checkWin(int mark) {
        int[][] winningLines = {
            {0, 1, 2}, {3, 4, 5}, {6, 7, 8}, // Rows
            {0, 3, 6}, {1, 4, 7}, {2, 5, 8}, // Columns
            {0, 4, 8}, {2, 4, 6}             // Diagonals
        };

        for (int[] line : winningLines) {
            if (board[line[0]] == mark && board[line[1]] == mark && board[line[2]] == mark) {
                return line;
            }
        }
        return null;
    }

    // Helper: Checks if the board is completely filled (indicating a draw if no one has won)
    public boolean isBoardFull() {
        for (int cell : board) {
            if (cell == 0) return false;
        }
        return true;
    }
}
