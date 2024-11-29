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
      // Create a container for popup content
      const container = document.createElement("div");
      const coinInfo = document.createElement("h4");
      coinInfo.innerHTML = `
      Cache Details
      <p>Latitude: ${item.data.latitude.toFixed(4)}</p> 
      <p>Longitude: ${item.data.longitude.toFixed(4)}</p> 
      <p>Coins: ${item.coins.length}
      <p>Coin Data: ${item.coins[item.coins.length - 1].identity}</p>`;
      container.appendChild(coinInfo);

      const collectButton = newButton("Collect");
      container.appendChild(collectButton);
      collectButton.addEventListener("click", function () {
        if (item.coins.length > 0) {
          const collectCoin = item.coins.pop();
          if (collectCoin) {
            playerCoins.push(collectCoin);
          }
          updateText(playerInfo, coinInfo, item, playerCoins);
        }
      });
      const depositButton = newButton("Deposit");
      container.appendChild(depositButton);
      depositButton.addEventListener("click", function () {
        if (playerCoins.length > 0) {
          const depositCoin = playerCoins.pop();
          if (depositCoin) {
            item.coins.push(depositCoin);
          }
          updateText(playerInfo, coinInfo, item, playerCoins);
        }
      });
      // Rebind the popup with the updated content
      rectangle.bindPopup(container).openPopup();
    };

    // Initialize the first popup rendering
    updatePopup();
  });
}
function updateText(
  playerCoin: HTMLHeadingElement,
  cacheCoin: HTMLHeadingElement,
  cache: Cache,
  moneyCount: Coin[],
) {
  playerCoin.innerHTML = `Player Money: ${moneyCount.length}`;
  const coinDetails = cache.coins.length > 0
    ? `<p>Coin Data: ${cache.coins[cache.coins.length - 1].identity}</p>`
    : `<p>No coins left in this cache</p>`;
  cacheCoin.innerHTML = `
    Cache Details
    <p>Latitude: ${cache.data.latitude.toFixed(4)}</p> 
    <p>Longitude: ${cache.data.longitude.toFixed(4)}</p> 
    <p>Coins: ${cache.coins.length}</p>
    <p>${coinDetails}</p>
    `;
}

const GRID_RADIUS = 8; // 8 steps out from the center in each direction
const grid = createGrid(PLAYER_LAT, PLAYER_LON, CELL_SIZE, GRID_RADIUS);
drawCachesOnMap(grid);
