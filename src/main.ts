// todo
import "./style.css";
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

const APP_NAME = "Geocoin";
const app: HTMLDivElement = document.querySelector("#app")!;
const header = document.createElement("h1");
const playerCoins = document.createElement("h3");
let coinCount: number = 0; 
header.innerHTML = APP_NAME;
playerCoins.innerHTML = `Player Money: ${coinCount}`;

app.append(header);
app.append(playerCoins);


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
function cellBounds(cache: Cell){
  const startLat = cache.latitude - (CELL_SIZE/2);
  const startLong = cache.longitude - (CELL_SIZE/2);
  const endLat = cache.latitude + (CELL_SIZE/2);
  const endLong = cache.longitude + (CELL_SIZE/2);
  return [[startLat,startLong],[endLat,endLong]]
}

interface Cache{
  data: Cell;
  coin: number;
  RNG: boolean;
}

function createGrid(
  startLat: number,
  startLon: number,
  cellSize: number,
  gridRadius: number
): Cache[] {
  const grid: Cache[] = [];
  for (let row = -gridRadius; row <= gridRadius; row++) {
    for (let col = -gridRadius; col <= gridRadius; col++) {
      const cellLat = startLat + row * cellSize;
      const cellLon = startLon + col * cellSize;
      const newCell = { latitude: cellLat, longitude: cellLon }
      const coins = Math.floor(luck(`${row},${col}-coins`) * 20) + 1; // Random 1–10 coins
      const probability = luck(`${row},${col}`) < 0.1;
      const newCache = {data: newCell, coin: coins, RNG: probability}
      grid.push(newCache);
    }
  }
  return grid;
}
function newButton(name: string) {
  const button = document.createElement("button");
  button.textContent = name;
  return button;
}
function drawCachesOnMap(grid: Cache[]){
  grid.forEach((item) => {
    if(item.RNG){
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
        <p>Coins: ${item.coin}`;
        container.appendChild(coinInfo);

        const collectButton = newButton("Collect")
        container.appendChild(collectButton);
        collectButton.addEventListener("click", function () {
          if (item.coin > 0) { 
            item.coin--;
            coinCount++;
            updateText(playerCoins, coinInfo, item);
            refreshButtons();
          }
        });
        const depositButton = newButton("Deposit")
        container.appendChild(depositButton);
        depositButton.addEventListener("click", function () {
        if (coinCount > 0) {
          item.coin++;
          coinCount--;
          updateText(playerCoins, coinInfo, item);
          refreshButtons();
          }
        });

        // Function to handle enabling/disabling buttons dynamically
        const refreshButtons = () => {
          collectButton.disabled = item.coin <= 0; // Disable if cache coins are 0 or less
          depositButton.disabled = coinCount <= 0; // Disable if player has no coins
        };
        refreshButtons();
        // Rebind the popup with the updated content
        rectangle.bindPopup(container).openPopup();
      };

      // Initialize the first popup rendering
      updatePopup();
    }
  });
}
function updateText (playerCoin: HTMLHeadingElement, cacheCoin: HTMLHeadingElement, cache: Cache){
  playerCoin.innerHTML = `Player Money: ${coinCount}`;
  cacheCoin.innerHTML = `
    Cache Details
    <p>Latitude: ${cache.data.latitude.toFixed(4)}</p> 
    <p>Longitude: ${cache.data.longitude.toFixed(4)}</p> 
    <p>Coins: ${cache.coin}`;
}

const GRID_RADIUS = 8; // 8 steps out from the center in each direction
const grid = createGrid(PLAYER_LAT, PLAYER_LON, CELL_SIZE, GRID_RADIUS);
drawCachesOnMap(grid);