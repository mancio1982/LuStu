const socket = io();

let playerId = Math.random().toString(36).substring(7);
let playerName = prompt("Inserisci il tuo nome:");
let lobbyId;

function createLobby() {
  lobbyId = Math.random().toString(36).substring(7);
  socket.emit("joinLobby", { playerId, name: playerName, lobbyId });
}

function joinLobby() {
  lobbyId = prompt("Inserisci l'ID della Lobby:");
  socket.emit("joinLobby", { playerId, name: playerName, lobbyId });
}

function startGame() {
  socket.emit("startGame");
}

socket.on("lobbyUpdate", (lobby) => {
  document.getElementById("landing").style.display = "none";
  document.getElementById("lobby").style.display = "block";

  const playersDiv = document.getElementById("players");
  playersDiv.innerHTML = "";

  lobby.players.forEach((player) => {
    const p = document.createElement("p");
    p.textContent = `${player.name}`;
    playersDiv.appendChild(p);
  });
});

socket.on("gameStarted", () => {
  alert("La partita è iniziata!");
});
