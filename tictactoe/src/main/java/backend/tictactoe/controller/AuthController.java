package backend.tictactoe.controller;

import backend.tictactoe.dto.AuthRequest;
import backend.tictactoe.dto.AuthResponse;
import backend.tictactoe.model.User;
import backend.tictactoe.security.JWTService;
import backend.tictactoe.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin
public class AuthController {

    private final UserService userService;
    private final JWTService jwtService;

    @PostMapping("/device")
    public ResponseEntity<AuthResponse> loginByDevice(@RequestBody AuthRequest request) {
        if (request.getDeviceId() == null || request.getDeviceId().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        // Authenticate or register the device ID through our user service layer (Model interaction)
        User user = userService.loginOrCreate(request.getDeviceId());
        
        // Generate our custom JWT access token signed by the server key
        String token = jwtService.generateAccessToken(user);

        // Build our response object carrying the session details
        AuthResponse response = AuthResponse.builder()
                .token(token)
                .userId(user.getId().toString())
                .username(user.getUsername())
                .build();

        return ResponseEntity.ok(response);
    }
}
