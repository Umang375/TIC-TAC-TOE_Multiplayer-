package backend.tictactoe.service;

import java.util.List;
import java.util.UUID;
import backend.tictactoe.model.User;

public interface UserService {
    
    User getUserById(UUID id);
    
    User loginOrCreate(String deviceId);
    
    User updateDisplayName(UUID userId, String displayName);

    List<User> getLeaderboard(int limit);

    void incrementWins(UUID userId);
}
