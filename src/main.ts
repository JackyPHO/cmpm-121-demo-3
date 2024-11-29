// todo
import "./style.css";
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

const APP_NAME = "Geocoin";
const app: HTMLDivElement = document.querySelector("#app")!;
const header = document.createElement("h1");
const playerInfo = document.createElement("h3");
const playerCoins: Coin[] = [];
header.innerHTML = APP_NAME;
playerInfo.innerHTML = `Player Money: ${playerCoins.length}`;

app.append(header);
app.append(playerInfo);

//Create map of Oake's College
const PLAYER_LAT = 36.9895;
const PLAYER_LON = -122.06278;
const map = leaflet.map("map", { zoomControl: false }).setView([
  PLAYER_LAT,
  PLAYER_LON,
], 19);
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

const CELL_SIZE = 0.0001; // Each cell is 0.0001° wide
interface Cell {
  latitude: number;
  longitude: number;
}
function cellBounds(cache: Cell) {
  const startLat = cache.latitude - (CELL_SIZE / 2);
  const startLong = cache.longitude - (CELL_SIZE / 2);
  const endLat = cache.latitude + (CELL_SIZE / 2);
  const endLong = cache.longitude + (CELL_SIZE / 2);
  return [[startLat, startLong], [endLat, endLong]];
}
const currentCells = new Map<string, { i: number; j: number }>();
function gridCells(
  location: Cell,
  knownCells: Map<string, { i: number; j: number }>,
) {
  const i = Math.floor(location.latitude / CELL_SIZE); // Row index
  const j = Math.floor(location.longitude / CELL_SIZE); // Column index
  const key = `${i},${j}`;
  if (!knownCells.has(key)) {
    knownCells.set(key, { i, j });
  }

  return knownCells.get(key)!;
}

interface Cache {
  data: Cell;
  coins: Coin[];
}
interface Coin {
  i: number;
  j: number;
  serial: number;
  identity: string;
}

function createGrid(
  startLat: number,
  startLon: number,
  cellSize: number,
  gridRadius: number,
): Cache[] {
  const grid: Cache[] = [];
  for (let row = -gridRadius; row <= gridRadius; row++) {
    for (let col = -gridRadius; col <= gridRadius; col++) {
      const cellLat = startLat + row * cellSize;
      const cellLon = startLon + col * cellSize;
      const newCell = { latitude: cellLat, longitude: cellLon };
      const coordinates = gridCells(newCell, currentCells);
      const probability = luck(`${row},${col}`) < 0.1;
      if (probability) {
        const randomNumber = Math.floor(luck(`${row},${col}-coins`) * 20) + 1; // Random 1–10 coins
        const cellCoins: Coin[] = [];
        for (let i = 0; i < randomNumber; i++) {
          const newCoin = {
            i: coordinates.i,
            j: coordinates.j,
            serial: i,
            identity: `${coordinates.i}:${coordinates.j}#${i}`,
          };
          cellCoins.push(newCoin);
        }
        const newCache = { data: newCell, coins: cellCoins };
        grid.push(newCache);
      }
    }
  }
  return grid;
}
function newButton(name: string) {
  const button = document.createElement("button");
  button.textContent = name;
  return button;
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
        <p>Latitude: ${item.data.latitude}</p>
        <p>Longitude: ${item.data.longitude}</p>
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
      rectangle.bindPopup(container).openPopup();
    };

    // Initialize the first popup rendering
    updatePopup();
  });
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
      <p>Latitude: ${cellData.latitude}</p>
      <p>Longitude: ${cellData.longitude}</p>
      <p>Coins: ${coins.length}</p>`;
  }
  if (action == "Deposit") {
    playerInfo.innerHTML = `Player Money: ${coins.length}`;
    cacheInfo.innerHTML = `
      Cache Details
      <p>Latitude: ${cellData.latitude}</p>
      <p>Longitude: ${cellData.longitude}</p>
      <p>Coins: ${otherCoins.length}</p>`;
  }
}

const GRID_RADIUS = 8; // 8 steps out from the center in each direction
const grid = createGrid(PLAYER_LAT, PLAYER_LON, CELL_SIZE, GRID_RADIUS);
drawCachesOnMap(grid);
