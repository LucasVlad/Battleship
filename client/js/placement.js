const shipsToPlace = [
    { name: "Carrier", size: 5 },
    { name: "Battleship", size: 4 },
    { name: "Destroyer", size: 3 },
    { name: "Submarine", size: 3 },
    { name: "Patrol Boat", size: 2 }
  ];
  
  let currentShipIndex = 0;
  let isVertical = false;
  let placedShips = [];
  
  function placeShip(row, col) {
    if (currentShipIndex >= shipsToPlace.length) return;
  
    const ship = shipsToPlace[currentShipIndex];
    const cells = [];
  
    for (let i = 0; i < ship.size; i++) {
      const r = isVertical ? row + i : row;
      const c = isVertical ? col : col + i;
      if (r >= 10 || c >= 10) return;
  
      const cell = document.querySelector(`#your-grid div[data-row='${r}'][data-col='${c}']`);
      if (!cell || cell.classList.contains("ship")) return;
  
      cells.push(cell);
    } 

    function updateShipUI() {
      const statusText = document.getElementById("ship-status");
      const orientationText = document.getElementById("orientation-status");
      const shipList = document.getElementById("ship-list");
    
      if (currentShipIndex < shipsToPlace.length) {
        const currentShip = shipsToPlace[currentShipIndex];
        statusText.textContent = `Click a grid cell to place: ${currentShip.name} (${currentShip.size})`;
      } else {
        statusText.textContent = "All ships placed!";
      }
    
      orientationText.textContent = `Orientation: ${isVertical ? "Vertical" : "Horizontal"} (Press R to rotate)`;
    
      // Optional: strike-through ships that have been placed
      const shipItems = shipList.getElementsByTagName("li");
      for (let i = 0; i < shipItems.length; i++) {
        shipItems[i].style.textDecoration = i < currentShipIndex ? "line-through" : "none";
      }
    }
    
    cells.forEach(cell => {
      cell.classList.add("ship");
      cell.style.backgroundColor = "#444";
    });
  
    placedShips.push({
      name: ship.name,
      size: ship.size,
      row,
      col,
      isVertical
    });
  
    currentShipIndex++;
    updateShipUI();
  
    if (currentShipIndex === shipsToPlace.length) {
      console.log("All ships placed!");
      console.log("Ship layout:", placedShips);
      document.getElementById("ready-button").style.display = "inline-block";
    }
  }
  
  async function sendShipLayout() {
    const gameCode = localStorage.getItem("gameCode");
    const playerId = localStorage.getItem("playerId");
  
    const response = await fetch("http://localhost:3000/place-ships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameCode: gameCode,
        playerId: playerId,
        ships: placedShips
      })
    });
  
    const data = await response.json();
    console.log("Server response:", data);
  }
  