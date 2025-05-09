// server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

/* Stato della lobby.
   In un caso reale, potresti gestire più lobby,
   qui usiamo una struttura semplice per una lobby globale. */
let lobby = {
  id: null,
  players: []
};

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('Messaggio JSON non valido:', e);
      return;
    }
    // Gestiamo diversi tipi di messaggio
    if(data.type === 'joinLobby') {
      // Se la lobby non è ancora creata, impostiamo l'ID
      if(!lobby.id) {
        lobby.id = data.lobbyId;
      }
      // Aggiungiamo il giocatore se non è già presente
      if(!lobby.players.find(p => p.playerId === data.playerId)) {
        lobby.players.push({
          playerId: data.playerId,
          name: data.name
        });
      }
      broadcastLobbyUpdate();
    }
    else if(data.type === 'startGame') {
      // Inizia la partita, invia un messaggio a tutti i client
      broadcastMessage({ type: 'gameStarted', lobby });
    }
    // Puoi aggiungere altri tipi di messaggio (ad es. rifiuto di invito)
  });
});

function broadcastLobbyUpdate() {
  // Invia il nuovo stato della lobby a tutti i client connessi
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'lobbyUpdate', lobby }));
    }
  });
}

function broadcastMessage(message) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

console.log("Server WebSocket in esecuzione sulla porta 8080");
