// Add this constant at the very top of main.js
const GAME_STATES = {
  WAITING: "waiting",
  PLACING_SHIPS: "placing_ships",
  IN_PROGRESS: "in_progress",
  FINISHED: "finished",
};


function createGrid(containerId) {
  const container = document.getElementById(containerId);
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cell = document.createElement("div");
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.dataset.coord = `${String.fromCharCode(65 + row)}${col + 1}`; // Add data-coord
      container.appendChild(cell);
    }
  }
}

const socket = io("http://localhost:3000"); // Connect via Socket.IO

function registerPlayer(playerId, gameCode) {
  socket.emit("register", { playerId, gameCode });
}

window.onload = () => {
  createGrid("your-grid");
  createGrid("opponent-grid");

  const startButton = document.getElementById("start-game");
  const joinButton = document.getElementById("join-game");
  const input = document.getElementById("game-code-input");
  const display = document.getElementById("game-code-display");

  startButton.onclick = async () => {
    const res = await fetch("http://localhost:3000/create-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (data.success) {
      display.textContent = `Game Code: ${data.gameCode}`;
      localStorage.setItem("playerId", data.playerId);
      localStorage.setItem("gameCode", data.gameCode);

      registerPlayer(data.playerId, data.gameCode); // Register player with Socket.IO
    }
    const opponentGrid = document.getElementById("opponent-grid");
    opponentGrid.addEventListener("click", (e) => {
      const cell = e.target;
      if (!cell.dataset.row || !cell.dataset.col) return;

      if (cell.classList.contains("hit") || cell.classList.contains("miss")) {
        console.log("Already fired at this cell.");
        return;
      }

      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      sendShot(row, col);
    });

    

    document.getElementById("ready-button").onclick = () => {
      console.log("🟡 Ready button clicked");
      console.log("Sending ships to server...");
      sendShipLayout(); // also from placement.js
    };
  };

  joinButton.onclick = async () => {
    const gameCode = input.value.trim().toUpperCase();
    const res = await fetch("http://localhost:3000/join-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameCode }),
    });
    const data = await res.json();
    if (data.success) {
      display.textContent = `Joined Game: ${data.gameCode}`;
      localStorage.setItem("playerId", data.playerId);
      localStorage.setItem("gameCode", data.gameCode);

      registerPlayer(data.playerId, data.gameCode);
    } else {
      display.textContent = data.message || "Join failed";
    }
  };

  const yourGrid = document.getElementById("your-grid");
  yourGrid.addEventListener("click", (e) => {
    const cell = e.target;
    if (!cell.dataset.row || !cell.dataset.col) return;

    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    placeShip(row, col); // this function is defined in placement.js
  });

  const opponentGrid = document.getElementById("opponent-grid");
  opponentGrid.addEventListener("click", (e) => {
    const cell = e.target;
    if (!cell.dataset.row || !cell.dataset.col) return;

    if (cell.classList.contains("hit") || cell.classList.contains("miss")) {
      console.log("Already fired at this cell.");
      return;
    }

    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    sendShot(row, col);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "r") {
      isVertical = !isVertical;
      console.log(`Orientation: ${isVertical ? "Vertical" : "Horizontal"}`);
      updateShipUI();
    }
  });

  document.getElementById("ready-button").onclick = () => {
    console.log("🟡 Ready button clicked");
    console.log("Sending ships to server...");
    sendShipLayout(); // also from placement.js
  };
};

async function sendShot(row, col) {
  const gameCode = localStorage.getItem("gameCode");
  const playerId = localStorage.getItem("playerId");

  const rowLetter = String.fromCharCode(65 + row); // 0 → A, 1 → B...
  const colNumber = col + 1; // Make 1-based (1–10)

  try {
    const response = await fetch("http://localhost:3000/take-shot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameCode,
        playerId,
        row: rowLetter,
        col: colNumber,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      console.log("Shot rejected:", data.message);
      return;
    }

    console.log(`Shot at ${rowLetter}${colNumber} submitted`);
    allowShooting = false; // prevent rapid double fire until gameUpdate comes back
  } catch (err) {
    console.error("Error sending shot:", err);
  }
}

let allowShooting = false;
let myPlayerId = localStorage.getItem("playerId");

socket.on("gameUpdate", (data) => {
  const { status, currentTurn, shotResult, player1Ready, player2Ready, message, winner } = data;
  const myPlayerId = localStorage.getItem("playerId");

  if (player1Ready !== undefined && player2Ready !== undefined) {
    const statusMessage = document.getElementById("status-message");
    if (player1Ready && player2Ready) {
      statusMessage.textContent = "Both players ready! Game starting...";
    } else {
      statusMessage.textContent = "Waiting for other player...";
    }
  }

  if (status === "in_progress") {
    const statusMessage = document.getElementById("status-message");
    statusMessage.textContent =
      message ||
      (currentTurn === myPlayerId ? "Your turn!" : "Opponent's turn!");
    allowShooting = currentTurn === myPlayerId;
  }

  // New code to handle game over
  if (status === "finished") {
    const statusMessage = document.getElementById("status-message");
    
    // In Battleship, the last person to shoot when the game ends is the winner
    if (shotResult && shotResult.shooter === myPlayerId) {
      statusMessage.textContent = "Congratulations! You won the game!";
      statusMessage.style.color = "#2c7";  // Green color
      celebrateWin();
    } else {
      statusMessage.textContent = "Game over. Your opponent won.";
      statusMessage.style.color = "#e44";  // Red color
    }
    
    // Disable further shooting
    allowShooting = false;
    
    // Add a "Play Again" button
    const playAgainBtn = document.createElement("button");
    playAgainBtn.textContent = "Play Again";
    playAgainBtn.onclick = resetGame;
    playAgainBtn.id = "play-again-btn";
    
    // Only add the button if it doesn't already exist
    if (!document.getElementById("play-again-btn")) {
      document.body.appendChild(playAgainBtn);
    }
  }

  if (shotResult) {
    // Debug what we're receiving
    console.log("Shot result received:", shotResult);
    
    // Use the coordinates directly from the server
    const coord = `${shotResult.row}${shotResult.col}`;
    console.log("Looking for coordinate:", coord);
    
    if (shotResult.shooter === myPlayerId) {
      // I am the shooter - update MY opponent grid (to show where I fired)
      const opponentGridCell = document.querySelector(
        `#opponent-grid div[data-coord="${coord}"]`
      );
      console.log("Opponent grid cell found:", opponentGridCell);
      if (opponentGridCell) {
        opponentGridCell.classList.add(
          shotResult.result === "hit" ? "hit" : "miss"
        );
      }
      console.log(`You fired at opponent's grid at ${coord}: ${shotResult.result}`);
    } else {
      // I am the defender - update MY grid (to show where I was hit)
      const yourGridCell = document.querySelector(
        `#your-grid div[data-coord="${coord}"]`
      );
      console.log("Your grid cell found:", yourGridCell);
      if (yourGridCell) {
        yourGridCell.classList.add(
          shotResult.result === "hit" ? "hit" : "miss"
        );
      }
      console.log(`Opponent fired at your grid at ${coord}: ${shotResult.result}`);
    }
  }

  if (currentTurn === myPlayerId) {
    console.log("It's your turn!");
    allowShooting = true;
  } else {
    console.log("Waiting for opponent...");
    allowShooting = false;
  }
});

// Add these helper functions after the gameUpdate handler
function celebrateWin() {
  // Simple celebration effect
  const yourGrid = document.getElementById("your-grid");
  const opponentGrid = document.getElementById("opponent-grid");
  
  yourGrid.classList.add("winner");
  opponentGrid.classList.add("winner");
  
  // Remove the effect after 3 seconds
  setTimeout(() => {
    yourGrid.classList.remove("winner");
    opponentGrid.classList.remove("winner");
  }, 3000);
}

function resetGame() {
  // Clear the grids
  const yourGrid = document.getElementById("your-grid");
  const opponentGrid = document.getElementById("opponent-grid");
  
  // Remove all ship, hit, and miss classes
  yourGrid.querySelectorAll("div").forEach(cell => {
    cell.classList.remove("ship", "hit", "miss");
  });
  
  opponentGrid.querySelectorAll("div").forEach(cell => {
    cell.classList.remove("hit", "miss");
  });
  
  // Reset game state
  currentShipIndex = 0;
  placedShips = [];
  
  // Remove the play again button
  const playAgainBtn = document.getElementById("play-again-btn");
  if (playAgainBtn) {
    playAgainBtn.remove();
  }
  
  // Redirect to start screen or restart the process
  window.location.reload(); // Simple solution - just reload the page
}