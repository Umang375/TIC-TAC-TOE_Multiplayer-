package backend.tictactoe.service;

import backend.tictactoe.model.User;
import backend.tictactoe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.PageRequest;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService, UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public User getUserById(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));
    }

    @Override
    public User loginOrCreate(String deviceId) {
        return userRepository.findByDeviceId(deviceId)
                .orElseGet(() -> {
                    String defaultUsername = "Guest_" + UUID.randomUUID().toString().substring(0, 6);
                    User newUser = User.builder()
                            .deviceId(deviceId)
                            .username(defaultUsername)
                            .wins(0)
                            .build();
                    return userRepository.save(newUser);
                });
    }

    @Override
    public User updateDisplayName(UUID userId, String displayName) {
        User user = getUserById(userId);
        user.setUsername(displayName);
        return userRepository.save(user);
    }

    @Override
    public List<User> getLeaderboard(int limit) {
        return userRepository.findByOrderByWinsDesc(PageRequest.of(0, limit));
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // Handled via custom device authentication; basic username loading is not used.
        return null;
    }
}
