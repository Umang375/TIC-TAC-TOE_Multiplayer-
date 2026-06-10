package backend.tictactoe.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeaderboardResponse {
    
    private List<Record> records;
    private int total;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Record {
        private int rank;
        private String userId;
        private String username;
        private int wins;
    }
}
