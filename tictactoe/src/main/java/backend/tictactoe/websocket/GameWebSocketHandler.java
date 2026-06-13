package backend.tictactoe.websocket;

import backend.tictactoe.model.GameRoom;
import backend.tictactoe.model.User;
import backend.tictactoe.security.JWTService;
import backend.tictactoe.service.MatchmakingService;
import backend.tictactoe.service.UserService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.util.*;
import java.util.concurrent.*;

@Configuration
@RequiredArgsConstructor
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final JWTService jwtService;
    private final UserService userService;
    private final MatchmakingService matchmakingService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Maps User ID -> active WebSocket session
    private final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();
    
    // Maps Room ID -> Active Scheduler Futures for turn timers
    private final Map<String, ScheduledFuture<?>> roomTimers = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    // OpCodes mirroring original Nakama protocol
    private static final int OP_START = 1;
    private static final int OP_UPDATE = 2;
    private static final int OP_MOVE = 3;
    private static final int OP_DONE = 4;
    private static final int OP_TIMER_UPDATE = 5;
    private static final int OP_REJECTED = 6;

    // Custom Matchmaking Client Ops
    private static final int OP_MATCHMAKER_ADD = 10;
    private static final int OP_CREATE_ROOM = 11;
    private static final int OP_JOIN_ROOM = 12;
    private static final int OP_LEAVE_ROOM = 13;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        // Enforce JWT handshake security validation
        URI uri = session.getUri();
        if (uri == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        String query = uri.getQuery();
        if (query == null || !query.startsWith("token=")) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        String token = query.split("token=")[1];
        try {
            UUID userId = jwtService.getUserIdFromToken(token);
            User user = userService.getUserById(userId);
            if (user == null) {
                session.close(CloseStatus.BAD_DATA);
                return;
            }

            // Save user model in session attributes for easy injection during transactions
            session.getAttributes().put("user", user);
            userSessions.put(user.getId().toString(), session);
        } catch (Exception e) {
            session.close(CloseStatus.BAD_DATA);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        User user = (User) session.getAttributes().get("user");
        if (user == null) return;

        JsonNode root = objectMapper.readTree(message.getPayload());
        int op = root.path("op_code").asInt();
        JsonNode data = root.path("data");

        switch (op) {
            case OP_MATCHMAKER_ADD:
                boolean timed = data.path("timedMode").asBoolean();
                GameRoom room = matchmakingService.findMatch(user, session, timed);
                if (room != null) {
                    broadcastGameStart(room);
                }
                break;

            case OP_CREATE_ROOM:
                boolean privateTimed = data.path("timedMode").asBoolean();
                GameRoom privateRoom = matchmakingService.createPrivateRoom(user, session, privateTimed);
                // Return room ID to creator so they can share it
                sendEnvelope(session, OP_CREATE_ROOM, Map.of("matchId", privateRoom.getRoomId()));
                break;

            case OP_JOIN_ROOM:
                String targetRoomId = data.path("matchId").asText();
                GameRoom joinedRoom = matchmakingService.joinPrivateRoom(targetRoomId, user, session);
                if (joinedRoom != null) {
                    // Send back confirmation to joiner
                    sendEnvelope(session, OP_JOIN_ROOM, Map.of("matchId", joinedRoom.getRoomId()));
                    if (joinedRoom.getPlayers().size() == 2) {
                        broadcastGameStart(joinedRoom);
                    }
                } else {
                    sendEnvelope(session, OP_REJECTED, Map.of("reason", "Room is full or does not exist"));
                }
                break;

            case OP_MOVE:
                String roomId = root.path("roomId").asText();
                int position = data.path("position").asInt();
                handlePlayerMove(user.getId().toString(), roomId, position);
                break;

            case OP_LEAVE_ROOM:
                String leaveRoomId = root.path("roomId").asText();
                handlePlayerForfeit(user.getId().toString(), leaveRoomId, "forfeit");
                break;
        }
    }

    private void broadcastGameStart(GameRoom room) throws IOException {
        String firstPlayerId = room.getPlayerOrder().get(0);
        room.setCurrentTurn(firstPlayerId);

        List<Map<String, Object>> playerInfos = new ArrayList<>();
        int mark = 1; // 1 = X, 2 = O
        for (String id : room.getPlayerOrder()) {
            User u = room.getPlayers().get(id);
            playerInfos.add(Map.of(
                "userId", id,
                "mark", mark++,
                "username", u.getUsername()
            ));
        }

        long deadline = room.isTimedMode() ? (System.currentTimeMillis() / 1000 + room.getTurnTimeLimit()) : 0;
        room.setTurnDeadline(deadline);

        Map<String, Object> payload = new HashMap<>();
        payload.put("board", room.getBoard());
        payload.put("currentTurn", room.getCurrentTurn());
        payload.put("timedMode", room.isTimedMode());
        payload.put("turnTimeLimit", room.getTurnTimeLimit());
        payload.put("turnDeadline", deadline);
        payload.put("players", playerInfos);

        broadcast(room, OP_START, payload);

        if (room.isTimedMode()) {
            startTurnTimer(room);
        }
    }

    private void handlePlayerMove(String userId, String roomId, int position) throws IOException {
        GameRoom room = matchmakingService.getRoom(roomId);
        if (room == null || room.isGameOver()) return;

        // Authoritative Turn & Board validation
        if (!userId.equals(room.getCurrentTurn())) {
            sendEnvelope(room.getSessions().get(userId), OP_REJECTED, Map.of("reason", "Not your turn"));
            return;
        }

        if (position < 0 || position > 8 || room.getBoard()[position] != 0) {
            sendEnvelope(room.getSessions().get(userId), OP_REJECTED, Map.of("reason", "Invalid cell position"));
            return;
        }

        // Apply Move
        int playerMark = room.getPlayerOrder().get(0).equals(userId) ? 1 : 2; // 1 = X, 2 = O
        room.getBoard()[position] = playerMark;

        // Check for Win
        int[] winLine = room.checkWin(playerMark);
        if (winLine != null) {
            endMatch(room, userId, winLine, "win");
            return;
        }

        // Check for Draw
        if (room.isBoardFull()) {
            endMatch(room, "draw", null, "draw");
            return;
        }

        // Switch Turn
        String nextPlayerId = room.getPlayerOrder().get(0).equals(userId) ? room.getPlayerOrder().get(1) : room.getPlayerOrder().get(0);
        room.setCurrentTurn(nextPlayerId);

        long deadline = room.isTimedMode() ? (System.currentTimeMillis() / 1000 + room.getTurnTimeLimit()) : 0;
        room.setTurnDeadline(deadline);

        Map<String, Object> updateData = Map.of(
            "board", room.getBoard(),
            "currentTurn", room.getCurrentTurn(),
            "turnDeadline", deadline
        );
        broadcast(room, OP_UPDATE, updateData);

        if (room.isTimedMode()) {
            startTurnTimer(room);
        }
    }

    private void startTurnTimer(GameRoom room) {
        // Cancel existing timer task for this room
        ScheduledFuture<?> activeTimer = roomTimers.remove(room.getRoomId());
        if (activeTimer != null) {
            activeTimer.cancel(false);
        }

        // Schedule 1Hz ticking task running on thread pool
        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            try {
                if (room.isGameOver()) {
                    roomTimers.remove(room.getRoomId()).cancel(false);
                    return;
                }

                long now = System.currentTimeMillis() / 1000;
                long remaining = room.getTurnDeadline() - now;

                if (remaining <= 0) {
                    roomTimers.remove(room.getRoomId()).cancel(false);
                    // Current player timed out; forfeit match
                    String opponentId = room.getPlayerOrder().get(0).equals(room.getCurrentTurn())
                            ? room.getPlayerOrder().get(1) : room.getPlayerOrder().get(0);
                    handlePlayerForfeit(room.getCurrentTurn(), room.getRoomId(), "timeout");
                } else {
                    broadcast(room, OP_TIMER_UPDATE, Map.of(
                        "currentTurn", room.getCurrentTurn(),
                        "remaining", remaining
                    ));
                }
            } catch (Exception e) {
                // Timer logging error
            }
        }, 1, 1, TimeUnit.SECONDS);

        roomTimers.put(room.getRoomId(), future);
    }

    private void handlePlayerForfeit(String forfeitingPlayerId, String roomId, String reason) throws IOException {
        GameRoom room = matchmakingService.getRoom(roomId);
        if (room == null || room.isGameOver()) return;

        String winningPlayerId = room.getPlayerOrder().stream()
                .filter(id -> !id.equals(forfeitingPlayerId))
                .findFirst().orElse(null);

        if (winningPlayerId != null) {
            endMatch(room, winningPlayerId, null, reason);
        }
    }

    private void endMatch(GameRoom room, String winnerId, int[] winningLine, String reason) throws IOException {
        room.setGameOver(true);
        room.setWinner(winnerId);
        room.setWinningLine(winningLine);

        // Cancel Active Timers
        ScheduledFuture<?> timer = roomTimers.remove(room.getRoomId());
        if (timer != null) {
            timer.cancel(false);
        }

        // Database Write: Record persistent wins if game resolved with a winner
        if (!"draw".equals(winnerId) && winnerId != null) {
            try {
                userService.incrementWins(UUID.fromString(winnerId));
            } catch (Exception e) {
                // Fail-safe logging for database writes
            }
        }

        Map<String, Object> doneData = Map.of(
            "board", room.getBoard(),
            "winner", winnerId != null ? winnerId : "draw",
            "winningLine", winningLine != null ? winningLine : new int[]{},
            "reason", reason
        );
        broadcast(room, OP_DONE, doneData);

        // Terminate match and remove room memory after 10 seconds grace period
        scheduler.schedule(() -> {
            matchmakingService.removeRoom(room.getRoomId());
        }, 10, TimeUnit.SECONDS);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        User user = (User) session.getAttributes().get("user");
        if (user == null) return;

        String userId = user.getId().toString();
        userSessions.remove(userId);
        matchmakingService.removePlayerFromQueue(userId);

        // Scan active rooms and forfeit match if player disconnected mid-game
        for (String key : roomTimers.keySet()) {
            GameRoom room = matchmakingService.getRoom(key);
            if (room != null && room.getPlayers().containsKey(userId) && !room.isGameOver()) {
                handlePlayerForfeit(userId, room.getRoomId(), "forfeit");
            }
        }
    }

    // Helper: Sends a JSON envelope to a specific session
    private void sendEnvelope(WebSocketSession session, int opCode, Object data) throws IOException {
        if (session != null && session.isOpen()) {
            Map<String, Object> envelope = Map.of(
                "op_code", opCode,
                "data", data
            );
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(envelope)));
        }
    }

    // Helper: Broadcasts an envelope to all players in a room
    private void broadcast(GameRoom room, int opCode, Object data) throws IOException {
        for (WebSocketSession session : room.getSessions().values()) {
            sendEnvelope(session, opCode, data);
        }
    }
}
