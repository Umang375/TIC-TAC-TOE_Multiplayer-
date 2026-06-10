package backend.tictactoe.controller;

import backend.tictactoe.dto.LeaderboardResponse;
import backend.tictactoe.model.User;
import backend.tictactoe.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
@CrossOrigin
public class LeaderboardController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<LeaderboardResponse> getLeaderboard(
            @RequestParam(value = "limit", defaultValue = "20") int limit) {

        List<User> users = userService.getLeaderboard(limit);
        List<LeaderboardResponse.Record> records = new ArrayList<>();

        for (int i = 0; i < users.size(); i++) {
            User user = users.get(i);
            records.add(LeaderboardResponse.Record.builder()
                    .rank(i + 1)
                    .userId(user.getId().toString())
                    .username(user.getUsername())
                    .wins(user.getWins())
                    .build());
        }

        LeaderboardResponse response = LeaderboardResponse.builder()
                .records(records)
                .total(records.size())
                .build();

        return ResponseEntity.ok(response);
    }
}
