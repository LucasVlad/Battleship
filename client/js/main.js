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
  const {
    status,
    currentTurn,
    shotResult,
    player1Ready,
    player2Ready,
    message,
  } = data;

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

  if (shotResult) {
    const coord = `${shotResult.row}${shotResult.col}`;

    // ✅ 1. If YOU fired, update Opponent Grid only
    if (shotResult.shooter === myPlayerId) {
      const opponentGridCell = document.querySelector(
        `#opponent-grid div[data-coord="${coord}"]`
      );

      if (opponentGridCell) {
        opponentGridCell.classList.add(
          shotResult.result === "hit" ? "hit" : "miss"
        );
      }

      console.log(`Your shot at ${coord} was a ${shotResult.result}`);
    }
    // ✅ 2. If OPPONENT fired, update Your Grid only
    else {
      const yourGridCell = document.querySelector(
        `#your-grid div[data-coord="${coord}"]`
      );

      if (yourGridCell) {
        yourGridCell.classList.add(
          shotResult.result === "hit" ? "hit" : "miss"
        );
      }

      console.log(`Opponent's shot at ${coord} was a ${shotResult.result}`);
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
