package backend.tictactoe.service;

import backend.tictactoe.model.GameRoom;
import backend.tictactoe.model.User;
import backend.tictactoe.model.MatchmakerEntry;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Service
public class MatchmakingService {

    // Thread-safe queues for players searching for matches
    private final Queue<MatchmakerEntry> classicQueue = new ConcurrentLinkedQueue<>();
    private final Queue<MatchmakerEntry> timedQueue = new ConcurrentLinkedQueue<>();

    // In-memory map of all active game rooms
    private final Map<String, GameRoom> activeRooms = new ConcurrentHashMap<>();

    // Handles Quick Match matchmaking: returns a GameRoom if paired, or null if placed in queue
    public synchronized GameRoom findMatch(User user, WebSocketSession session, boolean timedMode) {
        Queue<MatchmakerEntry> targetQueue = timedMode ? timedQueue : classicQueue;

        // Clean up any stale entries for this user in the queues first
        removePlayerFromQueue(user.getId().toString());

        // Check if there is an opponent waiting in the queue
        MatchmakerEntry opponent = targetQueue.poll();
        if (opponent != null) {
            // Found a match! Create a new game room
            String roomId = UUID.randomUUID().toString();
            GameRoom room = new GameRoom();
            room.setRoomId(roomId);
            room.setTimedMode(timedMode);
            room.setTurnTimeLimit(timedMode ? 30 : 0);

            // Add Opponent (X goes first)
            room.getPlayers().put(opponent.getUserId(), opponent.getUser());
            room.getSessions().put(opponent.getUserId(), opponent.getSession());
            room.getPlayerOrder().add(opponent.getUserId());

            // Add Current Player (O goes second)
            room.getPlayers().put(user.getId().toString(), user);
            room.getSessions().put(user.getId().toString(), session);
            room.getPlayerOrder().add(user.getId().toString());

            // Register room in active list
            activeRooms.put(roomId, room);
            return room;
        } else {
            // No one is waiting. Add this user to the queue
            targetQueue.add(new MatchmakerEntry(user.getId().toString(), user, session));
            return null;
        }
    }

    // Creates a private match room waiting for an opponent to join manually via Room ID
    public GameRoom createPrivateRoom(User user, WebSocketSession session, boolean timedMode) {
        String roomId = UUID.randomUUID().toString().substring(0, 8).toUpperCase(); // Short readable code
        GameRoom room = new GameRoom();
        room.setRoomId(roomId);
        room.setTimedMode(timedMode);
        room.setTurnTimeLimit(timedMode ? 30 : 0);

        // Add Creator (X)
        room.getPlayers().put(user.getId().toString(), user);
        room.getSessions().put(user.getId().toString(), session);
        room.getPlayerOrder().add(user.getId().toString());

        activeRooms.put(roomId, room);
        return room;
    }

    // Joins a specific private lobby by ID
    public GameRoom joinPrivateRoom(String roomId, User user, WebSocketSession session) {
        GameRoom room = activeRooms.get(roomId);
        if (room == null) {
            return null; // Room does not exist
        }
        
        synchronized (room) {
            if (room.getPlayers().size() >= 2) {
                return null; // Room is full
            }
            if (room.getPlayers().containsKey(user.getId().toString())) {
                room.getSessions().put(user.getId().toString(), session);
                return room; // Already joined
            }

            // Add Player (O)
            room.getPlayers().put(user.getId().toString(), user);
            room.getSessions().put(user.getId().toString(), session);
            room.getPlayerOrder().add(user.getId().toString());
        }

        return room;
    }

    // Retrieves an active game room state
    public GameRoom getRoom(String roomId) {
        return activeRooms.get(roomId);
    }

    // Removes a game room from active memory when terminated
    public void removeRoom(String roomId) {
        activeRooms.remove(roomId);
    }

    // Looks for an existing open room (with 1 player). If not found, creates a new one.
    public synchronized GameRoom findOrCreateRoom(User user, boolean timedMode) {
        for (GameRoom room : activeRooms.values()) {
            synchronized (room) {
                if (room.getPlayers().size() == 1 && room.isTimedMode() == timedMode) {
                    return room;
                }
            }
        }
        return createPrivateRoom(user, null, timedMode);
    }

    // Removes a player from the waiting queue if they disconnect
    public void removePlayerFromQueue(String userId) {
        classicQueue.removeIf(entry -> entry.getUserId().equals(userId));
        timedQueue.removeIf(entry -> entry.getUserId().equals(userId));
    }
}
