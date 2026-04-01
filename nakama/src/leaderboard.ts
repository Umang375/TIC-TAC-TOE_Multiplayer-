// Leaderboard management for Tic-Tac-Toe

const LEADERBOARD_ID = 'tic_tac_toe_wins';

function setupLeaderboard(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger
): void {
  try {
    // Create the wins leaderboard
    // Sort descending (most wins first), operator "incr" (increment on write),
    // no reset schedule (persistent), not authoritative (server writes directly)
    nk.leaderboardCreate(
      LEADERBOARD_ID,
      false,           // authoritative
      nkruntime.SortOrder.DESCENDING,
      nkruntime.Operator.INCREMENTAL,
      undefined,       // resetSchedule (never resets)
      { title: 'Tic-Tac-Toe Wins' }
    );
    logger.info('Leaderboard "%s" created/verified', LEADERBOARD_ID);
  } catch (error) {
    // Leaderboard may already exist — that's fine
    logger.info('Leaderboard setup: %s', error);
  }
}

function getLeaderboardRpc(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  let limit = 20;

  if (payload && payload.length > 0) {
    try {
      const request = JSON.parse(payload);
      if (request.limit && typeof request.limit === 'number') {
        limit = Math.min(request.limit, 100);
      }
    } catch (e) {
      // Use defaults
    }
  }

  try {
    const result = nk.leaderboardRecordsList(
      LEADERBOARD_ID,
      [],     // ownerIds - empty means get all
      limit,
      undefined, // cursor
      0       // expiry override
    );

    const records = (result.records || []).map((record: nkruntime.LeaderboardRecord) => ({
      rank: record.rank,
      userId: record.ownerId,
      username: record.username || 'Anonymous',
      wins: record.score,
      updatedAt: record.updateTime,
    }));

    return JSON.stringify({
      records,
      total: records.length,
    });
  } catch (error) {
    logger.error('Failed to get leaderboard: %s', error);
    return JSON.stringify({ records: [], total: 0 });
  }
}

export { setupLeaderboard, getLeaderboardRpc, LEADERBOARD_ID };
