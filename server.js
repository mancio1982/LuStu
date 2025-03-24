// server.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// Configura Express e il server HTTP
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Stato della lobby (puoi estendere questa struttura per supportare più lobby)
let lobby = {
  id: null,
  players: [],
  gameStarted: false,
};

// Servire i file statici (HTML, CSS, JS)
app.use(express.static("public"));

// Gestione delle connessioni WebSocket
io.on("connection", (socket) => {
  console.log(`Nuovo client connesso: ${socket.id}`);

  // Un giocatore si unisce alla lobby
  socket.on("joinLobby", (data) => {
    if (!lobby.id) {
      lobby.id = data.lobbyId;
    }

    if (!lobby.players.find((p) => p.playerId === data.playerId)) {
      lobby.players.push({
        playerId: data.playerId,
        name: data.name,
        lives: 3,
        card: null,
        action: null,
      });
    }

    io.emit("lobbyUpdate", lobby); // Aggiorna tutti i client con lo stato della lobby
    console.log(`Giocatore ${data.name} aggiunto alla lobby.`);
  });

  // Il creatore avvia la partita
  socket.on("startGame", () => {
    if (lobby.players.length < 2) {
      socket.emit("error", "Non ci sono abbastanza giocatori per iniziare.");
      return;
    }

    lobby.gameStarted = true;
    io.emit("gameStarted", lobby);
    console.log("Partita iniziata!");
  });

  // Un giocatore esegue un'azione (tieni o passa)
  socket.on("playerAction", (data) => {
    const player = lobby.players.find((p) => p.playerId === data.playerId);
    if (player) {
      player.action = data.action;
      console.log(`Giocatore ${player.name} ha scelto: ${data.action}`);
    }

    // Controlla se tutti i giocatori hanno completato la loro azione
    const allActed = lobby.players.every((p) => p.action !== null);
    if (allActed) {
      io.emit("handResolved", resolveHand());
      resetActions();
    }
  });

  // Gestione della disconnessione del client
  socket.on("disconnect", () => {
    console.log(`Client disconnesso: ${socket.id}`);
  });
});

// Funzione per risolvere la mano corrente
function resolveHand() {
  const highestCardPlayer = lobby.players.reduce((highest, player) => {
    if (player.action === "keep" && (!highest || player.card > highest.card)) {
      return player;
    }
    return highest;
  }, null);

  if (highestCardPlayer) {
    console.log(`Il vincitore della mano è ${highestCardPlayer.name}`);
  }

  return { winner: highestCardPlayer };
}

// Resetta le azioni dei giocatori per la prossima mano
function resetActions() {
  lobby.players.forEach((player) => {
    player.action = null;
    player.card = null; // Puoi anche distribuire nuove carte qui
  });
}

// Avvia il server sulla porta specificata
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server in esecuzione sulla porta ${PORT}`);
});
