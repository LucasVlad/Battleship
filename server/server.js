const express = require("express");
const app = express();
const port = 3000;

app.use(express.json());

app.listen(port, () => {
  console.log(`Battleship server running on port ${port}`);
});

const active_games = new Map();
const active_players = new Set();

const GAME_STATES = {
  WAITING: "waiting",
  PLACING_SHIPS: "placing_ships",
  IN_PROGRESS: "in_progress",
  FINISHED: "finished",
};

function genGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function genPlayerId() {
  let player_id;
  do {
    player_id =
      "player_" + Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (active_players.has(player_id));
  active_players.add(player_id);
  return player_id;
}

app.post("/create-game", (_req, res) => {
  const player_id = genPlayerId();
  const game_code = genGameCode();

  const new_game = {
    gameCode: game_code,
    player1: {
      id: player_id,
      board: null,
      ready: false,
    },
    player2: null,
    status: GAME_STATES.WAITING,
    currentTurn: null,
    winner: null,
  };

  active_games.set(game_code, new_game);

  res.json({
    success: true,
    gameCode: game_code,
    playerId: player_id,
  });
});

app.post("/join-game", (req, res) => {
  const game_code = req.body.gameCode;
  const game = active_games.get(game_code);

  if (!game) {
    return res.status(404).json({
      success: false,
      message: "Game not found",
    });
  }

  if (game.player2) {
    return res.status(400).json({
      success: false,
      message: "Game is full",
    });
  }

  const player_id = genPlayerId();

  game.player2 = {
    id: player_id,
    board: null,
    ready: false,
  };

  res.json({
    success: true,
    gameCode: game_code,
    playerId: player_id,
  });
});

app.post("/submit-board", (req, res) => {
  const { gameCode, playerId, board } = req.body;
  const game = active_games.get(gameCode);

  if (!game) {
    return res.status(404).json({
      success: false,
      message: "Game not found",
    });
  }

  if (game.player1.id !== playerId && game.player2?.id !== playerId) {
    return res.status(403).json({
      success: false,
      message: "Player not in this game",
    });
  }

  if (game.player1.id === playerId) {
    game.player1.board = board;
    game.player1.ready = true;
  } else {
    game.player2.board = board;
    game.player2.ready = true;
  }

  if (game.player1.ready && game.player2?.ready) {
    game.status = GAME_STATES.IN_PROGRESS;
    game.currentTurn = game.player1.id;
  }

  res.json({
    success: true,
    gameState: {
      status: game.status,
      currentTurn: game.currentTurn,
      player1Ready: game.player1.ready,
      player2Ready: game.player2.ready,
    },
  });
});
