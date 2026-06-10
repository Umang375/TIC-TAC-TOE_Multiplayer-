package backend.tictactoe.repository;

import backend.tictactoe.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    // Custom finder method to locate a user profile by their unique device identifier
    Optional<User> findByDeviceId(String deviceId);

    // Retrieves users sorted by wins descending, sliced by page limit
    List<User> findByOrderByWinsDesc(Pageable pageable);
}
