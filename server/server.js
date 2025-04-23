const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const port = 3000;

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());
app.use(cors());

const playerSockets = new Map();
io.on("connection", (socket) => {
  console.log("New Client Connected");

  socket.on("register", ({ playerId, gameCode }) => {
    playerSockets.set(playerId, gameCode);
    socket.join(gameCode);
    console.log(`Player ${playerId} registered for game ${gameCode}`);
  });

  socket.on("disconnect", () => {
    for (const [playerId, playerSocket] of playerSockets.entries()) {
      if (playerSocket === socket) {
        playerSockets.delete(playerId);
        break;
      }
    }
  });
});

httpServer.listen(port, () => {
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

// creates a game; doesn't need anything passed in order to work.
// sends the players id and game code to the client in the response.
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

// used to join an already existing game.
// requires the game code to be sent in the request body.
// responds with player id and success message if the game was found and joined.
// if not it responds with game not found or game is full error messages.
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

/*
Board should be sent as a 2D-array of strings.
 - "1" should represent a part of ship in that spot
 - "0" should represent an empty spot
 - "h" should represent a hit
 - "m" should represent a miss

example board
[
  ["0", "1", "h", "1", "0", "0", "0", "0", "0", "0"],
  ["0", "0", "0", "0", "0", "m", "0", "0", "0", "0"],
  ["0", "0", "1", "0", "0", "1", "1", "1", "1", "0"],
  ["0", "0", "1", "0", "0", "0", "0", "0", "0", "0"],
  ["0", "0", "1", "0", "0", "0", "0", "0", "0", "0"],
  ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
  ["0", "0", "0", "m", "1", "h", "1", "0", "m", "0"],
  ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
  ["1", "h", "0", "0", "0", "0", "0", "0", "m", "0"],
  ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0"]
]
*/
app.post("/place-ships", (req, res) => {
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

app.post("/take-shot", (req, res) => {
  // row and col get passed as the standard battleship format.
  // i.e. row: "A" and col: 1
  const { gameCode, playerId, row, col } = req.body;
  const game = active_games.get(gameCode);

  if (!game) {
    return res.status(404).json({
      success: false,
      message: "Game not found",
    });
  }

  if (game.status !== GAME_STATES.IN_PROGRESS) {
    return res.status(400).json({
      success: false,
      message: "Game is not in progress",
    });
  }

  if (game.currentTurn !== playerId) {
    return res.status(400).json({
      success: false,
      message: "Not your turn",
    });
  }

  row = row.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
  col = parseInt(col) - 1;

  if (row < 0 || row >= 10 || col < 0 || col >= 10) {
    return res.status(400).json({
      success: false,
      message: "Shot out of bounds",
    });
  }

  const is_player1_shooting = playerId === game.player1.id;
  const target_player = is_player1_shooting ? game.player2 : game.player1;

  const target_board = target_player.board;
  const target_cell = target_board[row][col];

  let result;
  if (target_cell === "1") {
    // hit
    target_board[row][col] = "h";
    result = "hit";
  } else if (target_cell === "0") {
    target_board[row][col] = "m";
    result = "miss";
  } else {
    return res.status(400).json({
      success: false,
      message: "This cell has alread been shot",
    });
  }

  game.currentTurn = is_player1_shooting ? game.player2.id : game.player1.id;

  const is_game_over = target_board.every((row) =>
    row.every((cell) => cell !== "1"),
  );

  if (is_game_over) {
    game.status = GAME_STATES.FINISHED;
    game.winner = playerId;
  }

  io.to(gameCode).emit("gameUpdate", {
    status: game.status,
    currentTurn: game.currentTurn,
    shotResult: {
      row: String.fromCharCode(rowNum + "A".charCodeAt(0)),
      col: (colNum + 1).toString(),
      result: result,
    },
  });

  res.json({
    success: true,
    result: result,
    gameState: {
      status: game.status,
      currentTurn: game.currentTurn,
      winner: game.winner,
      shotLocation: {
        row: String.fromCharCode(rowNum + "A".charCodeAt(0)),
        col: (colNum + 1).toString(),
      },
    },
  });
});

/* ** sorta kinda how to implement this on the frontend **

<script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
const socket = io('http://localhost:3000');


// ** register player after creating/joining a game **
function registerPlayer(playerId, gameCode) {
    socket.emit('register', { playerId, gameCode });
}


// Listen for game updates
socket.on('gameUpdate', (data) => {
    const { status, currentTurn, shotResult } = data;

    // Update the UI based on the game state
    if (shotResult) {
        // Display the shot result (hit/miss)
        console.log(`Shot at ${shotResult.row}${shotResult.col} was a ${shotResult.result}`);
    }

    // Update whose turn it is
    if (currentTurn === myPlayerId) {
        // Enable shooting controls
        console.log("It's your turn!");
    } else {
        // Disable shooting controls
        console.log("Waiting for opponent...");
    }
});

// Error handling
socket.on('connect_error', (error) => {
    console.log('Connection error:', error);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});
*/
