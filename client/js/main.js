function createGrid(containerId) {
    const container = document.getElementById(containerId);
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const cell = document.createElement('div');
        cell.dataset.row = row;
        cell.dataset.col = col;
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
    };
  
    joinButton.onclick = async () => {
      const gameCode = input.value.trim().toUpperCase();
      const res = await fetch("http://localhost:3000/join-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameCode })
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

    document.addEventListener("keydown", (e) => {
      if (e.key === "r") {
        isVertical = !isVertical;
        console.log(`Orientation: ${isVertical ? "Vertical" : "Horizontal"}`);
        updateShipUI()
      }
    });

    document.getElementById("ready-button").onclick = () => {
      console.log("Sending ships to server...");
      sendShipLayout(); // also from placement.js
    };
  };

  let allowShooting = false;
let myPlayerId = localStorage.getItem("playerId");

socket.on("gameUpdate", (data) => {
  const { status, currentTurn, shotResult } = data;

  if (shotResult) {
    const coord = `${shotResult.row}${shotResult.col}`;
    const opponentGridCell = document.querySelector(
      `#opponent-grid div[data-coord="${coord}"]`
    );

    if (opponentGridCell) {
      opponentGridCell.classList.add(
        shotResult.result === "hit" ? "hit" : "miss"
      );
    }

    console.log(`Shot at ${coord} was a ${shotResult.result}`);
  }

  if (currentTurn === myPlayerId) {
    console.log("It's your turn!");
    allowShooting = true;
  } else {
    console.log("Waiting for opponent...");
    allowShooting = false;
  }
});
  
