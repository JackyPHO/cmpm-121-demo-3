// todo
import "./style.css";

const APP_NAME = "Geocoin";
const app = document.querySelector<HTMLDivElement>("#app")!;
document.title = APP_NAME;

const button = document.createElement("button");
button.textContent = "Click Me";
app.appendChild(button);
button.addEventListener("click", function () {
  alert("you clicked the button!");
});
