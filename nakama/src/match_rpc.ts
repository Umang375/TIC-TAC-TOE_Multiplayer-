// RPC endpoints for match creation, finding, and management

function findMatchRpc(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  let request: { timedMode?: boolean } = {};
  if (payload && payload.length > 0) {
    try {
      request = JSON.parse(payload);
    } catch (e) {
      // Use defaults
    }
  }

  const timedMode = request.timedMode || false;

  // First, try to find an existing open match
  const matches = nk.matchList(10, true, null, null, 1, JSON.stringify({
    open: 1,
    timed_mode: timedMode,
  }));

  if (matches && matches.length > 0) {
    // Join the first available match
    const match = matches[0];
    logger.info('Found existing match: %s', match.matchId);
    return JSON.stringify({ matchId: match.matchId, created: false });
  }

  // No open match found, create a new one
  const matchId = nk.matchCreate('tic-tac-toe', {
    timed_mode: timedMode ? 'true' : 'false',
  });

  logger.info('Created new match: %s (timed: %s)', matchId, timedMode);
  return JSON.stringify({ matchId, created: true });
}

function createMatchRpc(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  let request: { timedMode?: boolean } = {};
  if (payload && payload.length > 0) {
    try {
      request = JSON.parse(payload);
    } catch (e) {
      // Use defaults
    }
  }

  const timedMode = request.timedMode || false;

  const matchId = nk.matchCreate('tic-tac-toe', {
    timed_mode: timedMode ? 'true' : 'false',
  });

  logger.info('Created private match: %s (timed: %s)', matchId, timedMode);
  return JSON.stringify({ matchId, created: true });
}

// Matchmaker matched callback: creates an authoritative match when 2 players are paired
function onMatchmakerMatched(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  entries: nkruntime.MatchmakerResult[]
): string | void {
  if (!entries || entries.length < 2) {
    logger.warn('Matchmaker matched with less than 2 entries');
    return;
  }

  // Check if timed mode was requested (from string properties)
  let timedMode = false;
  for (const entry of entries) {
    if (entry.properties && entry.properties.stringProperties && entry.properties.stringProperties['mode'] === 'timed') {
      timedMode = true;
      break;
    }
  }

  const matchId = nk.matchCreate('tic-tac-toe', {
    timed_mode: timedMode ? 'true' : 'false',
  });

  logger.info('Matchmaker created match: %s for %d players (timed: %s)', matchId, entries.length, timedMode);
  return matchId;
}

export { findMatchRpc, createMatchRpc, onMatchmakerMatched };
