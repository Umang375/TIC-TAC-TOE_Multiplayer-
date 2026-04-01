// Nakama server module entry point
// Registers all match handlers, RPCs, and initializes leaderboards

import matchHandler from './match_handler';
import { findMatchRpc, createMatchRpc, onMatchmakerMatched } from './match_rpc';
import { setupLeaderboard, getLeaderboardRpc } from './leaderboard';

function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
) {
  // Register the authoritative match handler
  initializer.registerMatch('tic-tac-toe', matchHandler);

  // Register RPC endpoints
  initializer.registerRpc('find_match', findMatchRpc);
  initializer.registerRpc('create_match', createMatchRpc);
  initializer.registerRpc('get_leaderboard', getLeaderboardRpc);

  // Register matchmaker matched callback
  initializer.registerMatchmakerMatched(onMatchmakerMatched);

  // Initialize leaderboards
  setupLeaderboard(nk, logger);

  logger.info('Tic-Tac-Toe module loaded successfully!');
}

// Prevent the function from being tree-shaken by the bundler
!InitModule && InitModule.bind(null);
