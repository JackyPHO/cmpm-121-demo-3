// todo
import "./style.css";
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

const app = document.querySelector("#app")!;
const playerInfo = document.createElement("h3");
const playerCoins: Coin[] = [];
playerInfo.innerHTML = `Player Money: ${playerCoins.length}`;
app.append(playerInfo);

//Variables
let PLAYER_LAT = 36.9895;
let PLAYER_LON = -122.06278;
const CELL_SIZE = 0.0001;
const GRID_RADIUS = 8; // 8 steps out from the center in each direction
const savedCaches = new Map<string, string>();
const currentCells = new Map<string, Cell>();
let playerPoints: number[][] = [[PLAYER_LAT, PLAYER_LON]];
let playerPath: leaflet.Polyline | null = null;
let autoPosition: boolean = false;
let geoWatchId: number | null = null; // Store geolocation watch ID

//Interfaces
interface Coin {
  i: number;
  j: number;
  serial: number;
  identity: string;
}
interface Cell {
  latitude: number;
  longitude: number;
}
interface Cache {
  data: Cell;
  coins: Coin[];
}

//Create map of Oake's College
const map = leaflet.map("map", {
  zoomControl: false,
  dragging: false,
  doubleClickZoom: false,
}).setView([
  PLAYER_LAT,
  PLAYER_LON,
], 18);
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  minZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

//Set player location in Oakes College classroom
const player = leaflet.marker([PLAYER_LAT, PLAYER_LON]).addTo(map);
player.bindTooltip("You are here", {
  permanent: false,
  direction: "center",
});

//Cell functions
function cellBounds(cache: Cell) {
  const startLat = cache.latitude - (CELL_SIZE / 2);
  const startLong = cache.longitude - (CELL_SIZE / 2);
  const endLat = cache.latitude + (CELL_SIZE / 2);
  const endLong = cache.longitude + (CELL_SIZE / 2);
  return [[startLat, startLong], [endLat, endLong]];
}

//Flyweight patterns
function checkCell(
  location: Cell,
  knownCells: Map<string, Cell>,
) {
  const i = Math.floor(location.latitude / CELL_SIZE); // Row index
  const j = Math.floor(location.longitude / CELL_SIZE); // Column index
  const key = `${i},${j}`;
  if (!knownCells.has(key)) {
    knownCells.set(key, {
      latitude: location.latitude,
      longitude: location.longitude,
    });
  }
  return knownCells.get(key)!;
}
//Momento Pattern
function toMomento(keyCache: Cache) {
  return JSON.stringify(keyCache);
}
function fromMomento(memento: string): Cache {
  return JSON.parse(memento) as Cache; // Restore the cache from JSON
}

//Grid and Cache Functions
function createGrid(
  playerLat: number,
  playerLon: number,
  cellSize: number,
  gridRadius: number,
): Cache[] {
  const visibleGrid: Cache[] = []; // To store visible cells for rendering

  for (let rowOffset = -gridRadius; rowOffset <= gridRadius; rowOffset++) {
    for (let colOffset = -gridRadius; colOffset <= gridRadius; colOffset++) {
      const cellLat = playerLat + rowOffset * cellSize;
      const cellLon = playerLon + colOffset * cellSize;
      const key = `${Math.floor(cellLat / cellSize)},${
        Math.floor(cellLon / cellSize)
      }`;

      if (savedCaches.has(key)) {
        const existingCache = fromMomento(savedCaches.get(key)!);
        visibleGrid.push(existingCache);
        continue; // Skip any new coin generation for this cache
      }

      // Generate a new cache if it doesn't already exist
      if (luck(`${key}`) < 0.1) { // 10% chance for new cache
        const cell = checkCell(
          { latitude: cellLat, longitude: cellLon },
          currentCells,
        );

        const randomCoins: Coin[] = [];
        const coinCount = Math.floor(luck(`${key}-coins`) * 20) + 1;

        for (let i = 0; i < coinCount; i++) {
          randomCoins.push({
            i: Math.floor(cell.latitude / CELL_SIZE),
            j: Math.floor(cell.longitude / CELL_SIZE),
            serial: i,
            identity: `${Math.floor(cell.latitude / CELL_SIZE)}:${
              Math.floor(cell.longitude / CELL_SIZE)
            }#${i}`,
          });
        }

        const newCache: Cache = {
          data: cell,
          coins: randomCoins,
        };

        // Save the new cache in savedCaches
        savedCaches.set(key, toMomento(newCache));
        visibleGrid.push(newCache);
      }
    }
  }
  return visibleGrid; // Return visible grid for rendering
}
function drawCachesOnMap(grid: Cache[]) {
  grid.forEach((item) => {
    const bounds = cellBounds(item.data);
    const rectangle = leaflet.rectangle(bounds).addTo(map);
    rectangle.on("click", function () {
      const detail = updatePopup(item);
      rectangle.bindPopup(detail, { autoPan: false }).openPopup();
    });
  });
}

//Cache Detail
function updatePopup(item: Cache) {
  const container = document.createElement("div");
  const coinInfo = document.createElement("h4");
  // Cache details in the popup
  coinInfo.innerHTML = `
      Cache Details
      <p>Latitude: ${item.data.latitude.toFixed(4)}</p>
      <p>Longitude: ${item.data.longitude.toFixed(4)}</p>
      <p>Coins: ${item.coins.length}</p>`;
  container.appendChild(coinInfo);

  const popup = document.createElement("coinHover");
  document.body.appendChild(popup); // Add popup to the document body

  // Create and configure the Collect button
  const collectButton = newButton("Collect");
  container.appendChild(collectButton);

  buttonMechanic(
    collectButton,
    popup,
    item.coins,
    playerCoins,
    playerInfo,
    coinInfo,
    item.data,
  );

  // Create and configure the Deposit button
  const depositButton = newButton("Deposit");
  container.appendChild(depositButton);

  buttonMechanic(
    depositButton,
    popup,
    playerCoins,
    item.coins,
    playerInfo,
    coinInfo,
    item.data,
  );
  return container;
}
function clearMap() {
  map.eachLayer((layer: leaflet.Layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });
}

//UI Elements Functions
function updateHover(box: HTMLElement, coins: Coin[], action: string) {
  let emptyMessage: string = "";
  if (action == "Collect") {
    emptyMessage = `No coins left in this cache`;
  }
  if (action == "Deposit") {
    emptyMessage = `No coins left for the player`;
  }
  const coinDetails = coins.length > 0
    ? `<p>Coin Data: ${coins[coins.length - 1].identity}</p>`
    : `<p>${emptyMessage}</p>`;
  box.innerHTML = `<p>${coinDetails}</p>`;
}
function updateText(
  playerInfo: HTMLHeadingElement,
  cacheInfo: HTMLHeadingElement,
  coins: Coin[],
  otherCoins: Coin[],
  cellData: Cell,
  action: string,
) {
  if (action == "Collect") {
    playerInfo.innerHTML = `Player Money: ${otherCoins.length}`;
    cacheInfo.innerHTML = `
      Cache Details
      <p>Latitude: ${cellData.latitude.toFixed(4)}</p>
      <p>Longitude: ${cellData.longitude.toFixed(4)}</p>
      <p>Coins: ${coins.length}</p>`;
  }
  if (action == "Deposit") {
    playerInfo.innerHTML = `Player Money: ${coins.length}`;
    cacheInfo.innerHTML = `
      Cache Details
      <p>Latitude: ${cellData.latitude.toFixed(4)}</p>
      <p>Longitude: ${cellData.longitude.toFixed(4)}</p>
      <p>Coins: ${otherCoins.length}</p>`;
  }
}

//Button Functions
function newButton(name: string) {
  const button = document.createElement("button");
  button.textContent = name;
  return button;
}
function buttonMechanic(
  button: HTMLButtonElement,
  displayCoin: HTMLElement,
  coins: Coin[],
  otherCoins: Coin[],
  playerInfo: HTMLHeadingElement,
  cacheInfo: HTMLHeadingElement,
  cellData: Cell,
) {
  button.addEventListener("mouseover", function () {
    if (button.textContent) updateHover(displayCoin, coins, button.textContent);
    displayCoin.style.display = "block";
  });

  button.addEventListener("mousemove", function (event) {
    // Update popup position to follow mouse cursor
    displayCoin.style.left = `${event.pageX + 10}px`;
    displayCoin.style.top = `${event.pageY + 10}px`;
  });

  button.addEventListener("mouseout", function () {
    // Hide the popup when the mouse leaves
    displayCoin.style.display = "none";
  });

  button.addEventListener("click", function () {
    if (coins.length > 0) {
      const currentCoin = coins.pop();
      if (currentCoin) otherCoins.push(currentCoin);
      if (button.textContent) {
        updateHover(displayCoin, coins, button.textContent);
        updateText(
          playerInfo,
          cacheInfo,
          coins,
          otherCoins,
          cellData,
          button.textContent,
        );
      }
    }
  });
}

//Functions for the player movement
function movePlayer(lat: number, lon: number) {
  PLAYER_LAT = lat;
  PLAYER_LON = lon;
  console.log(PLAYER_LAT, PLAYER_LON);
  playerPoints.push([PLAYER_LAT, PLAYER_LON]);
  if (playerPath) {
    playerPath.setLatLngs(playerPoints); // Update the existing polyline's points
  } else {
    // Create the polyline if it doesn't exist yet
    playerPath = leaflet.polyline(playerPoints, { color: "blue" }).addTo(map);
  }
  player.setLatLng([PLAYER_LAT, PLAYER_LON]);
  map.setView([PLAYER_LAT, PLAYER_LON]);
  clearMap();
  const newGrid = createGrid(PLAYER_LAT, PLAYER_LON, CELL_SIZE, GRID_RADIUS);
  drawCachesOnMap(newGrid);
  saveGameState();
}

document.getElementById("north")!.addEventListener(
  "click",
  () => movePlayer(PLAYER_LAT + CELL_SIZE, PLAYER_LON),
);
document.getElementById("south")!.addEventListener(
  "click",
  () => movePlayer(PLAYER_LAT - CELL_SIZE, PLAYER_LON),
);
document.getElementById("east")!.addEventListener(
  "click",
  () => movePlayer(PLAYER_LAT, PLAYER_LON + CELL_SIZE),
);
document.getElementById("west")!.addEventListener(
  "click",
  () => movePlayer(PLAYER_LAT, PLAYER_LON - CELL_SIZE),
);

//First Initialization of the Caches
const playerGrid = createGrid(PLAYER_LAT, PLAYER_LON, CELL_SIZE, GRID_RADIUS);
drawCachesOnMap(playerGrid);

document.getElementById("geo")!.addEventListener("click", () => {
  if (autoPosition) {
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId); // Stop geolocation updates
    }
    autoPosition = false; // Disable tracking
  } else {
    // Start geolocation tracking
    if ("geolocation" in navigator) {
      geoWatchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          // Call function to update the game state with new geolocation data
          movePlayer(latitude, longitude);
        },
        (error) => {
          console.error("Geolocation error:", error.message);
        },
        {
          enableHighAccuracy: true, // Use GPS for higher accuracy
        },
      );
      console.log("Geolocation tracking started.");
      autoPosition = true; // Enable tracking
    } else {
      console.error("Geolocation is not available on this device.");
    }
  }
});

//Reset the game
document.getElementById("reset")!.addEventListener("click", () => {
  while (playerCoins.length > 0) {
    playerCoins.pop();
  }
  playerInfo.innerHTML = `Player Money: ${playerCoins.length}`;
  savedCaches.clear();
  playerPoints.length = 0; // Remove all movement history
  if (playerPath) {
    map.removeLayer(playerPath); // Remove the polyline from the map
    playerPath = null; // Reset the polyline reference
    playerPoints = [[PLAYER_LAT, PLAYER_LON]];
  }

  // Reset the player's position
  PLAYER_LAT = 36.9895;
  PLAYER_LON = -122.06278;
  player.setLatLng([PLAYER_LAT, PLAYER_LON]);
  map.setView([PLAYER_LAT, PLAYER_LON], 18);

  // Clear and recreate the grid
  clearMap();
  const newGrid = createGrid(PLAYER_LAT, PLAYER_LON, CELL_SIZE, GRID_RADIUS);
  drawCachesOnMap(newGrid);
});

//Save the game even after the browser window closes
function saveGameState() {
  const gameState = {
    playerPosition: { lat: PLAYER_LAT, lon: PLAYER_LON },
    playerPoints: playerPoints, // Movement history (player path)
    playerCoins: playerCoins, // Collected coins
    savedCaches: Array.from(savedCaches.entries()), // Convert Map to array for JSON storage
  };
  localStorage.setItem("gameState", JSON.stringify(gameState));
}
