// todo
import "./style.css";
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leafletWorkaround.ts";

const APP_NAME = "Geocoin";
const app: HTMLDivElement = document.querySelector("#app")!;
const header = document.createElement("h1");
header.innerHTML = APP_NAME;
app.append(header);

//Create map of Oake's College
const map = leaflet.map("map", { zoomControl: false }).setView([
  36.9895,
  -122.06278,
], 19);
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  minZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

//Set player location in Oakes College classroom
const player = leaflet.marker([36.9895, -122.06278]).addTo(map);
player.bindTooltip("You are here", {
  permanent: false,
  direction: "center",
});
