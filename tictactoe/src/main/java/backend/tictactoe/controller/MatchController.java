package backend.tictactoe.controller;

import backend.tictactoe.dto.MatchResponse;
import backend.tictactoe.model.GameRoom;
import backend.tictactoe.model.User;
import backend.tictactoe.service.MatchmakingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/match")
@RequiredArgsConstructor
@CrossOrigin
public class MatchController {

    private final MatchmakingService matchmakingService;

    @PostMapping("/find")
    public ResponseEntity<MatchResponse> findMatch(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> payload) {
        
        boolean timedMode = payload != null && Boolean.TRUE.equals(payload.get("timedMode"));
        
        GameRoom room = matchmakingService.findOrCreateRoom(user, timedMode);
        boolean created = room.getPlayers().size() == 1;

        MatchResponse response = MatchResponse.builder()
                .matchId(room.getRoomId())
                .created(created)
                .build();

        return ResponseEntity.ok(response);
    }

    @PostMapping("/create")
    public ResponseEntity<MatchResponse> createMatch(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> payload) {

        boolean timedMode = payload != null && Boolean.TRUE.equals(payload.get("timedMode"));

        GameRoom room = matchmakingService.createPrivateRoom(user, null, timedMode);

        MatchResponse response = MatchResponse.builder()
                .matchId(room.getRoomId())
                .created(true)
                .build();

        return ResponseEntity.ok(response);
    }
}
