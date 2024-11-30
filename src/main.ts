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

      // Check whether the cache exists in savedCaches
      if (!savedCaches.has(key)) {
        if (luck(`${key}`) < 0.1) { // 10% chance for new cache
          const cell = checkCell(
            { latitude: cellLat, longitude: cellLon },
            currentCells,
          );

          const randomCoins: Coin[] = [];
          const coinCount = Math.floor(luck(`${key}-coins`) * 20) + 1;

          for (let i = 0; i < coinCount; i++) {
            randomCoins.push({
              i: cell.latitude,
              j: cell.longitude,
              serial: i,
              identity: `${cell.latitude}:${cell.longitude}#${i}`,
            });
          }

          const newCache: Cache = {
            data: cell,
            coins: randomCoins,
          };

          // Save memento of the cache instead of the object itself
          savedCaches.set(key, toMomento(newCache));
        }
      }

      // Push to visibleGrid if the cache exists in savedCaches
      if (savedCaches.has(key)) {
        const memento = savedCaches.get(key)!; // Get the memento
        const restoredCache = fromMomento(memento); // Restore the full Cache
        visibleGrid.push(restoredCache);
      }
    }
  }

  return visibleGrid; // Return visible grid for rendering
}
function drawCachesOnMap(grid: Cache[]) {
  grid.forEach((item) => {
    const bounds = cellBounds(item.data);
    const rectangle = leaflet.rectangle(bounds).addTo(map);
    const updatePopup = () => {
      // Create elements for the popup
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

      // Rebind the popup
      rectangle.bindPopup(container, { autoPan: false }).openPopup();
    };

    // Initialize the first popup rendering
    updatePopup();
  });
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
function movePlayer(moveLat: number, moveLon: number) {
  // Update player location
  PLAYER_LAT += moveLat;
  PLAYER_LON += moveLon;
  player.setLatLng([PLAYER_LAT, PLAYER_LON]);
  map.setView([PLAYER_LAT, PLAYER_LON]);

  clearMap();

  const newGrid = createGrid(PLAYER_LAT, PLAYER_LON, CELL_SIZE, GRID_RADIUS);
  drawCachesOnMap(newGrid);
}
document.getElementById("north")!.addEventListener(
  "click",
  () => movePlayer(CELL_SIZE, 0),
);
document.getElementById("south")!.addEventListener(
  "click",
  () => movePlayer(-CELL_SIZE, 0),
);
document.getElementById("east")!.addEventListener(
  "click",
  () => movePlayer(0, CELL_SIZE),
);
document.getElementById("west")!.addEventListener(
  "click",
  () => movePlayer(0, -CELL_SIZE),
);

//Momento Pattern Functions
function toMomento(keyCache: Cache) {
  return JSON.stringify(keyCache);
}
function fromMomento(memento: string): Cache {
  return JSON.parse(memento) as Cache; // Restore the cache from JSON
}

const playerGrid = createGrid(PLAYER_LAT, PLAYER_LON, CELL_SIZE, GRID_RADIUS);
drawCachesOnMap(playerGrid);
