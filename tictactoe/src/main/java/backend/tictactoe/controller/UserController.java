package backend.tictactoe.controller;

import backend.tictactoe.dto.UpdateNameRequest;
import backend.tictactoe.model.User;
import backend.tictactoe.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
@CrossOrigin
public class UserController {

    private final UserService userService;

    @PutMapping("/displayname")
    public ResponseEntity<User> updateDisplayName(
            @AuthenticationPrincipal User authenticatedUser,
            @RequestBody UpdateNameRequest request) {

        if (request.getDisplayName() == null || request.getDisplayName().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        // Authenticated user UUID is automatically loaded by the Security Context Filter
        User updatedUser = userService.updateDisplayName(authenticatedUser.getId(), request.getDisplayName());
        return ResponseEntity.ok(updatedUser);
    }
}
