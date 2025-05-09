// Imposta l'URL del server WebSocket (modifica con il tuo dominio e porta)
let socket;
// Solo se non disabilitato E se siamo in un contesto multiplayer (es. esiste #lobbyOptionsSection)
if (!window.disableWebSocket && document.getElementById('lobbyOptionsSection')) {
    socket = new WebSocket("wss://lustu.fwh.is:8080");

    // Gestione della connessione
    socket.onopen = () => {
      console.log("Connesso al server WebSocket");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if(data.type === 'lobbyUpdate') {
        // Aggiorna l'elenco dei giocatori della lobby
        lobbyPlayers = data.lobby.players;
        updateLobbyInfo(); // La funzione che aggiorna il DOM della lobby
      } else if(data.type === 'gameStarted') {
        // Avvia la partita in modalità multiplayer
        // In questo caso, i giocatori della lobby vengono copiati nell'array players
        players = lobbyPlayers.slice();
        numPlayers = players.length;
        deck = createDeck();
        dealerIndex = Math.floor(Math.random() * numPlayers);
        startHand();
      }
    };

    socket.onerror = (error) => {
      console.error("Errore WebSocket:", error);
    };
} else {
    console.log("WebSocket disabilitato o non necessario per questa pagina");
}

// Funzione per avviare il gioco dalla landing page
function startGame() {
  // Verifica se siamo nella pagina principale o nella pagina multiplayer
  const landingElement = document.getElementById("landing");
  const gameElement = document.getElementById("game");
  
  if (landingElement && gameElement) {
    // Siamo nella pagina principale
    landingElement.style.display = "none";
    document.body.style.background = "#001d06";
    gameElement.style.display = "block";
    
    // Avvia il gioco: se esiste la funzione startNewGame() del gioco attuale, chiamala
    if (typeof startNewGame === "function") {
      startNewGame();
    }
  } else if (gameElement) {
    // Siamo nella pagina multiplayer
    gameElement.style.display = "block";
    
    // Avvia il gioco: se esiste la funzione startNewGame() del gioco attuale, chiamala
    if (typeof startNewGame === "function") {
      startNewGame();
    }
  }
  // Se non troviamo gli elementi necessari, non fare nulla
}

/* ==================== DATI E INIZIALIZZAZIONE ==================== */
const CARD_NAMES = [
  "Matto", "Rattaculo", "Mascherone", "Secchia", "Nulla",
  "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "VIIII", "X",
  "Casa", "Gnaf", "Salta", "Bum", "Cucco"
];
const CARD_RANKS = {
  "Matto": 1,
  "Rattaculo": 2,
  "Mascherone": 3,
  "Secchia": 4,
  "Nulla": 5,
  "I": 6,
  "II": 7,
  "III": 8,
  "IIII": 9,
  "V": 10,
  "VI": 11,
  "VII": 12,
  "VIII": 13,
  "VIIII": 14,
  "X": 15,
  "Casa": 16,
  "Gnaf": 17,
  "Salta": 18,
  "Bum": 19,
  "Cucco": 20
};
const TOP_FIVE = ["Casa", "Gnaf", "Salta", "Bum", "Cucco"];
const cardImages = {
  "Matto": "immagini/matto.png",
  "Rattaculo": "immagini/rattaculo.png",
  "Mascherone": "immagini/mascherone.png",
  "Secchia": "immagini/secchia.png",
  "Nulla": "immagini/nulla.png",
  "I": "immagini/I.png",
  "II": "immagini/II.png",
  "III": "immagini/III.png",
  "IIII": "immagini/IIII.png",
  "V": "immagini/V.png",
  "VI": "immagini/VI.png",
  "VII": "immagini/VII.png",
  "VIII": "immagini/VIII.png",
  "VIIII": "immagini/VIIII.png",
  "X": "immagini/X.png",
  "Casa": "immagini/casa.png",
  "Gnaf": "immagini/gnaf.png",
  "Salta": "immagini/salta.png",
  "Bum": "immagini/bum.png",
  "Cucco": "immagini/cucco.png"
};
const cardBack = "immagini/dorso.png";

// Rendi cardImages disponibile globalmente
window.cardImages = cardImages;
window.cardBack = cardBack;

let players = [];
let deck = [];
let dealerIndex = 0;
let currentTurnIndex = 0;
let gamePhase = "";
let handFinished = false;
let numPlayers = 0;
let gameOver = false;

// Nuove variabili globali per la modalità multiplayer
let isMultiplayer = false;
let isLobbyCreator = false;
let lobbyPlayers = [];

const bulletImg = `<img src="immagini/cuoricino.svg" alt="cuoricino" style="width:12px; height:12px; vertical-align:middle;">`;

function generateLobbyId(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

let generatedLobbyId = generateLobbyId();

// Funzione per avviare la modalità VS CPU (modalità attuale)
function startVsCpu() {
  isMultiplayer = false;
  const landingElement = document.getElementById("landing");
  const gameElement = document.getElementById("game");
  
  if (landingElement && gameElement) {
    landingElement.style.display = "none";
    document.body.style.background = "#001d06";
    gameElement.style.display = "block";
    startNewGame();
  } else {
    console.error("Required elements not found for VS CPU mode");
  }
}

// Funzione per avviare la modalità VS AMICI (multiplayer)
function startVsAmici() {
  isMultiplayer = true;
  isLobbyCreator = true;
  
  const landingElement = document.getElementById("landing");
  const lobbyElement = document.getElementById("lobby");
  const lobbyFormElement = document.getElementById("lobby-form");
  const lobbyInfoElement = document.getElementById("lobby-info");
  
  if (landingElement && lobbyElement && lobbyFormElement && lobbyInfoElement) {
    // Il creatore apre la lobby
    landingElement.style.display = "none";
    lobbyElement.style.display = "block";
    // Mostra il modulo per il creatore (può anche essere già precompilato se vuoi)
    lobbyFormElement.style.display = "block";
    lobbyInfoElement.style.display = "none";
  } else {
    console.error("Required elements not found for VS Friends mode");
  }
  // Inizializza il lobbyPlayers con il creatore (dopo che lui si unirà)
}

// Funzione per far partecipare un giocatore alla lobby (sia creatore sia amici che si uniscono)
function joinLobby() {
  const lobbyNameElement = document.getElementById("lobbyName");
  if (!lobbyNameElement) {
    console.error("Lobby name input element not found");
    return;
  }
  
  let name = lobbyNameElement.value.trim();
  if (name === "") {
    alert("Inserisci il tuo nome");
    return;
  }

  // Se generatedLobbyId è già impostato (cioè, l'utente arriva tramite link), non lo rigenerare.
  // Altrimenti, generalo (questo caso dovrebbe essere per il creatore)
  if (!generatedLobbyId) {
    generatedLobbyId = generateLobbyId();
    isLobbyCreator = true;
  } else {
    isLobbyCreator = false;
  }

  // Genera un ID univoco per il giocatore
  let playerId = generateLobbyId(4);

  // Aggiungi il giocatore all'array locale della lobby (per aggiornare immediatamente l'interfaccia)
  lobbyPlayers.push({
    id: lobbyPlayers.length,
    playerId: playerId,
    name: name,
    isHuman: true,
    lives: 4,
    card: null,
    passed: false,
    revealed: false,
    stoppedByCasa: false,
    stoppedByCasaTarget: null
  });

  updateLobbyInfo();

  // Nascondi il modulo di join e mostra le info della lobby
  const lobbyFormElement = document.getElementById("lobby-form");
  const lobbyInfoElement = document.getElementById("lobby-info");
  
  if (lobbyFormElement && lobbyInfoElement) {
    lobbyFormElement.style.display = "none";
    lobbyInfoElement.style.display = "block";
  }

  // Invia una richiesta POST a lobby.php per aggiornare lo stato della lobby
  fetch('lobby.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'joinLobby',
      lobbyId: generatedLobbyId,
      playerId: playerId,
      name: name
    })
  })
    .then(response => response.json())
    .then(data => {
      console.log('Lobby aggiornata:', data);
      // Puoi anche aggiornare lobbyPlayers in base alla risposta se necessario
    })
    .catch(error => {
      console.error('Errore durante l\'unione alla lobby:', error);
    });
}

// Modifica la funzione updateLobbyInfo per gestire il caso multiplayer
function updateLobbyInfo() {
  // Verifica se siamo nella pagina multiplayer
  const playerListElement = document.getElementById("playerList");
  if (!playerListElement) {
    // Non siamo nella pagina multiplayer, esci
    return;
  }
  
  // Siamo nella pagina multiplayer, aggiorna la lista dei giocatori
  playerListElement.innerHTML = '';
  lobbyPlayers.forEach(player => {
    const li = document.createElement('li');
    li.className = 'player-item';
    li.textContent = player.name;
    playerListElement.appendChild(li);
  });
  
  // Abilita il pulsante "Inizia Partita" se ci sono almeno 2 giocatori
  const startGameBtn = document.getElementById('startGameBtn');
  if (startGameBtn) {
    startGameBtn.disabled = lobbyPlayers.length < 2;
  }
}

// Funzione per il creatore per avviare la partita multiplayer
function startMultiplayerGame() {
  if(lobbyPlayers.length < 2) {
    alert("Devi avere almeno un amico per iniziare la partita!");
    return;
  }
  
  if (socket) {
    socket.send(JSON.stringify({
      type: 'startGame',
      lobbyId: generatedLobbyId
    }));
  }
  
  // Nascondi la lobby e mostra il gioco
  const lobbyElement = document.getElementById("lobby");
  const gameElement = document.getElementById("game");
  
  if (lobbyElement && gameElement) {
    lobbyElement.style.display = "none";
    gameElement.style.display = "block";
  } else {
    console.error("Required elements not found for starting multiplayer game");
  }
  
  // La logica di avvio della partita (copia dei giocatori, deck, ecc.) avviene nel messaggio 'gameStarted'
}

/* ==================== FUNZIONI DI LOG ==================== */
function logMessage(message) {
  const messagesDiv = document.getElementById("messages");
  if (!messagesDiv) {
    console.error("Il contenitore dei messaggi non esiste!");
    return;
  }

  // Aggiorna tutti i messaggi esistenti: rimuovi il grassetto e imposta il colore a grigio (#bbbbbb)
  for (let i = 0; i < messagesDiv.children.length; i++) {
    messagesDiv.children[i].style.fontWeight = "normal";
    messagesDiv.children[i].style.color = "#bbbbbb";
  }

  // Crea il nuovo messaggio: impostalo in grassetto e in colore bianco (oppure un colore a tua scelta)
  const p = document.createElement("p");
  p.innerHTML = message;
  p.style.fontWeight = "bold";
  p.style.color = "#ffffff";  // oppure lascia il colore di default se preferisci

  messagesDiv.appendChild(p);

  // Mantieni solo gli ultimi 3 messaggi
  while (messagesDiv.children.length > 3) {
    messagesDiv.removeChild(messagesDiv.firstChild);
  }
}

function logLossMessage(message) {
  logMessage(`<strong style="color:yellow;">${message}</strong>`);
}

/* ==================== FUNZIONI DI UTILITÀ ==================== */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createDeck() {
  let d = [];
  for (let i = 0; i < 2; i++) d = d.concat(CARD_NAMES);
  shuffle(d);
  return d;
}
// Funzione per creare i giocatori
function createPlayers(n, humanName) {
  players = [];
  // Array dei nomi per le CPU
  const cpuNames = [
    "Obbetto",
    "Prichicchia",
    "Marika",
    "Giuann Patell",
    "Pallotta",
    "Il Presidente",
    "Bruno blabla",
    "Teodoro",
    "Papiele"
  ];

  for (let i = 0; i < n; i++) {
    let playerName;
    if (i === 0) {
      playerName = humanName;
    } else {
      if (cpuNames.length > 0) {
        const randomIndex = Math.floor(Math.random() * cpuNames.length);
        playerName = cpuNames[randomIndex];
        cpuNames.splice(randomIndex, 1);
      } else {
        playerName = "CPU " + i;
      }
    }

    players.push({
      id: i,
      name: playerName,
      isHuman: (i === 0),
      lives: 4,
      card: null,
      passed: false,
      revealed: false,
      stoppedByCasa: false,
      stoppedByCasaTarget: null
    });
  }
}

function getCardRank(card) {
  return (card in CARD_RANKS) ? CARD_RANKS[card] : null;
}
function getPassingOrder(playerIndex) {
  return ((dealerIndex - playerIndex - 1 + numPlayers) % numPlayers);
}

// Funzione che, dato un valore t lungo il perimetro, restituisce le coordinate sul rettangolo
function getPointOnRectangle(t, rectWidth, rectHeight, centerX, centerY) {
  const P = 2 * (rectWidth + rectHeight);
  t = t % P;
  const left = centerX - rectWidth / 2;
  const top = centerY - rectHeight / 2;

  if (t < rectWidth / 2) {
    // Segmento 1: dal centro del bordo inferiore al bordo sinistro
    // Quando t = 0: punto = (centerX, top+rectHeight)
    // Quando t = rectWidth/2: punto = (left, top+rectHeight)
    return { x: centerX - t, y: top + rectHeight };
  } else if (t < rectWidth / 2 + rectHeight) {
    // Segmento 2: dal bordo inferiore sinistro al bordo superiore sinistro
    let t2 = t - (rectWidth / 2);
    // Quando t2 = 0: punto = (left, top+rectHeight)
    // Quando t2 = rectHeight: punto = (left, top)
    return { x: left, y: top + rectHeight - t2 };
  } else if (t < rectWidth / 2 + rectHeight + rectWidth) {
    // Segmento 3: dal bordo superiore sinistro al bordo superiore destro
    let t3 = t - (rectWidth / 2 + rectHeight);
    // Quando t3 = 0: punto = (left, top)
    // Quando t3 = rectWidth: punto = (left+rectWidth, top)
    return { x: left + t3, y: top };
  } else if (t < rectWidth / 2 + rectHeight + rectWidth + rectHeight) {
    // Segmento 4: dal bordo superiore destro al bordo inferiore destro
    let t4 = t - (rectWidth / 2 + rectHeight + rectWidth);
    // Quando t4 = 0: punto = (left+rectWidth, top)
    // Quando t4 = rectHeight: punto = (left+rectWidth, top+rectHeight)
    return { x: left + rectWidth, y: top + t4 };
  } else {
    // Segmento 5: dal bordo inferiore destro ritorna al centro del bordo inferiore
    let t5 = t - (rectWidth / 2 + rectHeight + rectWidth + rectHeight);
    // Quando t5 = 0: punto = (left+rectWidth, top+rectHeight)
    // Quando t5 = rectWidth/2: punto = (centerX, top+rectHeight)
    return { x: left + rectWidth - t5, y: top + rectHeight };
  }
}

/* ==================== ANIMAZIONE DELLO SCAMBIO CARTA ==================== */
function animateCardSwap(sourceIndex, targetIndex, callback) {
  const tableDiv = document.getElementById("table");
  const sourcePlayerEl = tableDiv.querySelector(`.player[data-player-id="${sourceIndex}"]`);
  const targetPlayerEl = tableDiv.querySelector(`.player[data-player-id="${targetIndex}"]`);
  if (!sourcePlayerEl || !targetPlayerEl) {
    callback();
    return;
  }
  const sourceCardContainer = sourcePlayerEl.querySelector(".card");
  const targetCardContainer = targetPlayerEl.querySelector(".card");
  const tableRect = tableDiv.getBoundingClientRect();
  const sourceRect = sourceCardContainer.getBoundingClientRect();
  const targetRect = targetCardContainer.getBoundingClientRect();
  const sourcePos = {
    left: sourceRect.left - tableRect.left,
    top: sourceRect.top - tableRect.top
  };
  const targetPos = {
    left: targetRect.left - tableRect.left,
    top: targetRect.top - tableRect.top
  };
  const sourceCardEl = sourceCardContainer.querySelector("img");
  const targetCardEl = targetCardContainer.querySelector("img");
  const sourceClone = sourceCardEl.cloneNode(true);
  const targetClone = targetCardEl.cloneNode(true);

  // Imposta il fattore di scala in base alla larghezza della viewport:
  // su smartphone (es. <600px) riduci al 75% della scala attuale (0.27), altrimenti usa 0.24.
  const scaleFactor = window.innerWidth < 600 ? 0.2 : 0.2;

  [sourceClone, targetClone].forEach(clone => {
    clone.style.position = "absolute";
    clone.style.transition = "left 800ms ease, top 800ms ease";
    clone.style.zIndex = 1000;
    clone.style.transform = "scale(" + scaleFactor + ")";
    clone.style.transformOrigin = "top left";
  });

  sourceClone.style.left = sourcePos.left + "px";
  sourceClone.style.top = sourcePos.top + "px";
  targetClone.style.left = targetPos.left + "px";
  targetClone.style.top = targetPos.top + "px";
  tableDiv.appendChild(sourceClone);
  tableDiv.appendChild(targetClone);
  sourceCardEl.style.visibility = "hidden";
  targetCardEl.style.visibility = "hidden";
  requestAnimationFrame(() => {
    sourceClone.style.left = targetPos.left + "px";
    sourceClone.style.top = targetPos.top + "px";
    targetClone.style.left = sourcePos.left + "px";
    targetClone.style.top = sourcePos.top + "px";
  });
  setTimeout(() => {
    tableDiv.removeChild(sourceClone);
    tableDiv.removeChild(targetClone);
    sourceCardEl.style.visibility = "visible";
    targetCardEl.style.visibility = "visible";
    callback();
  }, 600);
}

function swapCardsAnimated(sourceIndex, targetIndex) {
  // Riproduzione del suono per lo scambio di carte
  var swapSound = new Audio("audio/passaggio.mp3");
  swapSound.play().catch(function(error) {
    console.error("Errore nella riproduzione del suono di scambio:", error);
  });
  return new Promise(resolve => {
    animateCardSwap(sourceIndex, targetIndex, () => {
      let temp = players[sourceIndex].card;
      players[sourceIndex].card = players[targetIndex].card;
      players[targetIndex].card = temp;
      renderTable();
      resolve();
    });
  });
}

function animateBlockedPass(sourceIndex, targetIndex) {
  return new Promise(resolve => {
    const tableDiv = document.getElementById("table");
    const sourcePlayerEl = tableDiv.querySelector(`.player[data-player-id="${sourceIndex}"]`);
    const targetPlayerEl = tableDiv.querySelector(`.player[data-player-id="${targetIndex}"]`);
    if (!sourcePlayerEl || !targetPlayerEl) {
      resolve();
      return;
    }
    const sourceCardContainer = sourcePlayerEl.querySelector(".card");
    const targetCardContainer = targetPlayerEl.querySelector(".card");
    const tableRect = tableDiv.getBoundingClientRect();
    const sourceRect = sourceCardContainer.getBoundingClientRect();
    const targetRect = targetCardContainer.getBoundingClientRect();
    // Posizione di partenza (source)
    const sourcePos = {
      left: sourceRect.left - tableRect.left,
      top: sourceRect.top - tableRect.top
    };
    // Calcola la posizione a metà strada tra source e target
    const halfwayPos = {
      left: (sourceRect.left + targetRect.left) / 2 - tableRect.left,
      top: (sourceRect.top + targetRect.top) / 2 - tableRect.top
    };
    const sourceCardEl = sourceCardContainer.querySelector("img");
    const clone = sourceCardEl.cloneNode(true);
    clone.style.position = "absolute";
    clone.style.transition = "left 800ms ease, top 800ms ease";
    clone.style.zIndex = 1000;
    clone.style.transform = "scale(0.2)"; // stesso valore usato negli swap
    clone.style.transformOrigin = "top left";
    clone.style.left = sourcePos.left + "px";
    clone.style.top = sourcePos.top + "px";
    tableDiv.appendChild(clone);
    // Nascondi l'originale per l'animazione
    sourceCardEl.style.visibility = "hidden";
    // Muovi il clone a metà strada
    requestAnimationFrame(() => {
      clone.style.left = halfwayPos.left + "px";
      clone.style.top = halfwayPos.top + "px";
    });
    // Dopo 300ms, torna indietro al punto di partenza
    setTimeout(() => {
      clone.style.transition = "left 800ms ease, top 800ms ease";
      clone.style.left = sourcePos.left + "px";
      clone.style.top = sourcePos.top + "px";
      setTimeout(() => {
        tableDiv.removeChild(clone);
        sourceCardEl.style.visibility = "visible";
        resolve();
      }, 300);
    }, 300);
  });
}

function dealerSwapWith(playerIndex) {
  let temp = players[dealerIndex].card;
  players[dealerIndex].card = players[playerIndex].card;
  players[playerIndex].card = temp;

  if (players[dealerIndex].card === undefined) {
      console.error("Errore: il mazziere ha ottenuto una carta undefined dopo lo scambio!");
      players[dealerIndex].card = deck.length > 0 ? deck.pop() : temp; // Recupera una carta valida
  }
}

/* ==================== FUNZIONI INTERFACCIA ==================== */
function renderTable(revealAll = false) {
  const tableDiv = document.getElementById("table");

  // Recupera (o crea) il contenitore dei messaggi e conserva i messaggi esistenti
  let messagesDiv = document.getElementById("messages");
  if (!messagesDiv) {
    messagesDiv = document.createElement("div");
    messagesDiv.id = "messages";
    tableDiv.appendChild(messagesDiv);
  }
  let savedMessages = messagesDiv.innerHTML;

  // Svuota il tavolo, ma reinserisci il contenitore dei messaggi con i messaggi salvati
  tableDiv.innerHTML = "";
  tableDiv.appendChild(messagesDiv);
  messagesDiv.innerHTML = savedMessages;

  // Calcola le dimensioni del tavolo e il centro
  const w = tableDiv.offsetWidth;
  const h = tableDiv.offsetHeight;
  const centerX = w / 2;
  const centerY = (h / 2) - 10;

  // Definisci il rettangolo per posizionare i giocatori (80% delle dimensioni del tavolo)
  let rectWidth = w * 0.75;
  let rectHeight = h * 0.83;

  // Calcola il perimetro e lo spacing tra i giocatori
  const P = 2 * (rectWidth + rectHeight);
  const spacing = P / numPlayers;

  // Leggi la dimensione dei giocatori dalla variabile CSS
  const playerSizeStr = getComputedStyle(document.documentElement)
                           .getPropertyValue('--player-size');
  const playerSize = parseFloat(playerSizeStr);

  // Posiziona ogni giocatore lungo il perimetro del rettangolo
  for (let i = 0; i < numPlayers; i++) {
    let player = players[i];
    const t = i * spacing;
    const pos = getPointOnRectangle(t, rectWidth, rectHeight, centerX, centerY);

    let playerDiv = document.createElement("div");
    playerDiv.className = "player" + (i === dealerIndex ? " dealer" : "");
    playerDiv.setAttribute("data-player-id", i);
    playerDiv.style.position = "absolute";
    playerDiv.style.width = playerSize + "px";
    playerDiv.style.height = playerSize + "px";
    playerDiv.style.left = (pos.x - playerSize / 2) + "px";
    playerDiv.style.top = (pos.y - playerSize / 2) + "px";

    let infoDiv = document.createElement("div");
    infoDiv.className = "info";
    if (player.isHuman) {
      // Se è il turno del giocatore umano, mantieni lo sfondo attuale (ad es. verde)
      if (i === currentTurnIndex) {
        infoDiv.style.background = "#9fc640";
      } else {
        infoDiv.style.background = "yellow";
      }
      // Il nome viene mostrato in grassetto e in verde
      infoDiv.innerHTML = `<strong style="color:green;">${player.name}</strong><br>${bulletImg.repeat(player.lives)}`;
    } else {
      // Per gli altri giocatori usa la logica esistente
      infoDiv.style.background = (i === currentTurnIndex) ? "#9fc640" : "rgba(255,255,255,0.8)";
      infoDiv.innerHTML = `<strong>${player.name}</strong><br>${bulletImg.repeat(player.lives)}`;
    }
    playerDiv.appendChild(infoDiv);

    let cardDiv = document.createElement("div");
    cardDiv.className = "card";
    let img = document.createElement("img");
    if (player.isHuman || revealAll || player.revealed) {
      if (player.card in cardImages) {
        img.src = cardImages[player.card];
      } else {
        img.alt = player.card;
      }
    } else {
      img.src = cardBack;
    }
    // img.style.width = "80%";
    cardDiv.appendChild(img);
    playerDiv.appendChild(cardDiv);

    tableDiv.appendChild(playerDiv);
  }
}

function renderControls(html) {
  document.getElementById("controls").innerHTML = html;
}
function renderNextTurnButton() {
  if (!handFinished)
    renderControls(`<button class="button" onclick="advanceTurn()">Prossimo Turno</button>`);
}
function renderNextHandButton() {
  renderControls(`<button class="button" onclick="prepareNextHand()">Nuova Mano</button>`);
}
function advanceTurn() {
  nextTurn();
}
/* ==================== GESTIONE DEL GIOCO ==================== */
// Modifica la funzione startNewGame per gestire solo la modalità VS CPU
function startNewGame() {
  if (!isMultiplayer) {
    gameOver = false;
    handFinished = false;
    logMessage("<hr>Nuova partita iniziata!");
    numPlayers = parseInt(prompt("Inserisci il numero di giocatori (2-10):", "4"));
    if (isNaN(numPlayers) || numPlayers < 2 || numPlayers > 10) {
      alert("Numero di giocatori non valido!");
      return;
    }
    let humanName = prompt("Inserisci il tuo nome:", "");
    createPlayers(numPlayers, humanName);
    deck = createDeck();
    dealerIndex = Math.floor(Math.random() * numPlayers);
    startHand();
  }
}

function startHand() {
  handFinished = false;
  players.forEach(p => {
    p.passed = false;
    p.revealed = false;
    p.stoppedByCasa = false;
    p.stoppedByCasaTarget = null;
  });
  if (deck.length < numPlayers) deck = createDeck();
  for (let p of players) p.card = deck.pop();
  gamePhase = "passaggio";
  currentTurnIndex = (dealerIndex - 1 + numPlayers) % numPlayers;
  logMessage(`<hr>Nuova mano,<br>${players[dealerIndex].name} dà le carte`);
  renderTable();
  renderNextTurnButton();
}
async function nextTurn() {
  if (handFinished) return;
  if (currentTurnIndex === dealerIndex) {
   if (players[dealerIndex].isHuman) {
// In tutti i casi (incluso quando si ha il Matto) si mostra la scelta
renderControls(`<button class="button" onclick="dealerKeep()">STO</button>
                <button class="button" onclick="dealerPass()">PASSO</button>`);
logMessage("È il tuo turno");
return;
}
else {
      let r = getCardRank(players[dealerIndex].card);
      if (r < 7) {
        logMessage(`${players[dealerIndex].name} passa.`);
        dealerPass();
      } else {
        logMessage(`${players[dealerIndex].name} sta`);
        dealerKeep();
      }
    }
    renderNextTurnButton();
    return;
  }
  let currentPlayer = players[currentTurnIndex];
  if (currentPlayer.passed) {
    currentTurnIndex = (currentTurnIndex - 1 + numPlayers) % numPlayers;
    renderNextTurnButton();
    return;
  }
  if (currentPlayer.isHuman) {
    renderControls(`<button class="button" onclick="humanKeep()">STO</button>
                    <button class="button" onclick="humanPass()">PASSO</button>`);
    logMessage("È il tuo turno");
    return;
  } else {
    let r = getCardRank(currentPlayer.card);
    if (currentPlayer.card === "Matto") {
      logMessage(`${currentPlayer.name} passa`);
      await aiPass();
      return;
    }
    if (TOP_FIVE.includes(currentPlayer.card)) {
      logMessage(`${currentPlayer.name} sta`);
      var knockSound = new Audio("audio/knock.mp3");
      knockSound.play().catch(function(error) {
        console.error("Errore nella riproduzione del suono knock:", error);
      });
      currentPlayer.passed = true;
    } else {
      if (r < 7) {
        logMessage(`${currentPlayer.name} passa`);
        await aiPass();
        return;
      } else {
        logMessage(`${currentPlayer.name} sta`);
        var knockSound = new Audio("audio/knock.mp3");
        knockSound.play().catch(function(error) {
          console.error("Errore nella riproduzione del suono knock:", error);
        });
        currentPlayer.passed = true;
      }
    }
  }
  currentTurnIndex = (currentTurnIndex - 1 + numPlayers) % numPlayers;
  renderTable();
  renderNextTurnButton();
}
function humanKeep() {
  var knockSound = new Audio("audio/knock.mp3");
  knockSound.play().catch(function(error) {
    console.error("Errore nella riproduzione del suono knock:", error);
  });
  players[currentTurnIndex].passed = true;
  // logMessage("Hai deciso di tenere la tua carta."); //
  renderControls("");
  currentTurnIndex = (currentTurnIndex - 1 + numPlayers) % numPlayers;
  renderTable();
  renderNextTurnButton();
}
async function humanPass() {
  let targetIndex = (currentTurnIndex - 1 + numPlayers) % numPlayers;
  await processPass(currentTurnIndex, targetIndex);
}
async function aiPass() {
  let source = currentTurnIndex;
  let target = (currentTurnIndex - 1 + numPlayers) % numPlayers;
  await processPass(source, target);
}
function dealerKeep() {
  var knockSound = new Audio("audio/knock.mp3");
  knockSound.play().catch(function(error) {
    console.error("Errore nella riproduzione del suono knock:", error);
  });
  players[dealerIndex].passed = true;
  renderControls("");
  finishPassingPhase();
}
function dealerPass() {
  if (deck.length > 0) {
      players[dealerIndex].card = deck.pop();
  } else {
      console.warn("Tentativo di passare una carta, ma il mazzo è vuoto.");
      // Se il mazzo è vuoto, il mazziere mantiene la sua carta attuale
  }
  players[dealerIndex].passed = true;
  // logMessage(`${players[dealerIndex].name} (mazziere) passa al mazzo.`);
  renderControls("");
  finishPassingPhase();
}
// Funzione aggiornata per gestire lo Gnaf con la catena inversa
async function handleGnaf(sourceIndex, targetIndex) {
  players[sourceIndex].lives--;
  logLossMessage(`${players[sourceIndex].name} prende una Gnaffata!`);
  if (players[sourceIndex].lives <= 0) {
    currentTurnIndex = (targetIndex - 1 + numPlayers) % numPlayers;
    renderTable();
    renderNextTurnButton();
    return;
  }
  const primoGiocatore = (dealerIndex - 1 + numPlayers) % numPlayers;
  if (sourceIndex === primoGiocatore) {
    logMessage(`${players[sourceIndex].name} è il primo giocatore e non può scambiare ulteriormente.`);
    currentTurnIndex = (targetIndex - 1 + numPlayers) % numPlayers;
    renderTable();
    renderNextTurnButton();
    return;
  }
  // Inizio della catena inversa
  const firstPlayer = (dealerIndex + numPlayers) % numPlayers;
  let chainStart = (targetIndex + 1) % numPlayers;
  //logMessage(`Inizio della catena inversa`);
  let nextIndex = (chainStart + 1) % numPlayers;
  let blockIndex = null;
  while (true) {
    if (nextIndex === firstPlayer) {
      blockIndex = nextIndex;
      break;
    }
    if (players[nextIndex].card === "Salta") {
  // Se il giocatore con "Salta" è il primo della mano, blocca la carta
  if (nextIndex === firstPlayer) {
    blockIndex = nextIndex;
    break;
  } else {
    // Altrimenti, passa la carta al giocatore successivo nella catena inversa
    let forcedIndex = (nextIndex + 1) % numPlayers;
    logMessage(`${players[nextIndex].name} scopre Salta!`);
    await swapCardsAnimated(sourceIndex, forcedIndex);
    // Aggiorna la sorgente per la prossima iterazione
    sourceIndex = forcedIndex;
    // Avanza di due posizioni per saltare il giocatore che ha rivelato il "Salta"
    nextIndex = (nextIndex + 2) % numPlayers;
    continue;
  }
}

    if (["Casa", "Gnaf", "Bum", "Cucco"].includes(players[nextIndex].card)) {
      players[nextIndex].revealed = true;
      blockIndex = nextIndex;
      logMessage(`${players[nextIndex].name} rivela ${players[nextIndex].card}`);
      if (players[nextIndex].card === "Bum" || players[nextIndex].card === "Gnaf") {
        let penaltyIndex = (nextIndex - 1 + numPlayers) % numPlayers;
        players[penaltyIndex].lives--;
        if (players[nextIndex].card === "Bum") {
  logLossMessage(`${players[penaltyIndex].name} prende una Bummata!`);
} else {
  logLossMessage(`${players[penaltyIndex].name} prende una Gnaffata`);
}
      }
      break;
    }
    // logMessage(`${players[chainStart].name} scambia la sua carta con quella di ${players[nextIndex].name}`);
    await swapCardsAnimated(chainStart, nextIndex);
    chainStart = nextIndex;
    nextIndex = (chainStart + 1) % numPlayers;
  }
  // logMessage("Catena inversa completata.");
  if (targetIndex === dealerIndex) {
    // logMessage("Il target è il mazziere. La mano finisce.");
    finishPassingPhase();
  } else {
    let resumeIndex = (targetIndex - 1 + numPlayers) % numPlayers;
    logMessage(`Si riparte da ${players[resumeIndex].name}`);
    currentTurnIndex = resumeIndex;
    renderTable();
    renderNextTurnButton();
  }
}

async function processPass(sourceIndex, targetIndex) {
let source = players[sourceIndex];
let target = players[targetIndex];

// Caso in cui il destinatario sia il mazziere
if (targetIndex === dealerIndex) {
if (players[dealerIndex].card === "Matto") {
  if (players[dealerIndex].isHuman) {
    renderControls(`<button class="button" onclick="dealerKeep()">STO</button>
                    <button class="button" onclick="dealerPass()">PASSO</button>`);
    logMessage("È il tuo turno");
    return;
  } else {
    logMessage(`${players[dealerIndex].name} (mazziere) passa`);
    dealerPass();
    return;
  }
}
if (players[dealerIndex].card === "Salta") {
  players[dealerIndex].revealed = true;
  logMessage(`${players[dealerIndex].name} scopre Salta! ${players[(dealerIndex - 1 + numPlayers) % numPlayers].name} passa al mazzo.`);
  // In questo caso il mazziere ha Salta: la logica speciale rimane invariata
  source.card = deck.pop();
  source.passed = true;
  currentTurnIndex = sourceIndex;
  renderTable();
  renderNextTurnButton();
  return;
} else if (TOP_FIVE.includes(players[dealerIndex].card)) {
  // Caso speciale: il mazziere ha una carta tra Casa, Bum, Cucco o Gnaf
  players[dealerIndex].revealed = true;
  logMessage(`${players[dealerIndex].name} scopre ${players[dealerIndex].card}!`);
  switch (players[dealerIndex].card) {
    case "Casa":
      await animateBlockedPass(sourceIndex, targetIndex);
      logMessage(`${source.name} viene bloccato`);
      source.stoppedByCasa = true;
      source.stoppedByCasaTarget = targetIndex;
      break;
    case "Gnaf":
      await handleGnaf(sourceIndex, targetIndex);
      return;
    case "Bum":
      await animateBlockedPass(sourceIndex, targetIndex);
      source.lives--;
      logLossMessage(`${source.name} prende una Bummata!`);
      break;
    case "Cucco":
      await animateBlockedPass(sourceIndex, targetIndex);
      logMessage(`${source.name} deve tenere la sua carta!`);
      break;
    default:
      break;
  }
  players[dealerIndex].passed = true;
  source.passed = true;
  finishPassingPhase();
  return;
} else {
  // Caso normale: il mazziere non ha una carta speciale.
  // Esegui lo swap con animazione tra il giocatore (source) e il mazziere
  await swapCardsAnimated(sourceIndex, dealerIndex);
  // Imposta il turno sul mazziere in modo che poi (tramite nextTurn)
  // il mazziere possa decidere se tenere o passare la nuova carta ricevuta.
  currentTurnIndex = dealerIndex;
  renderTable();
  renderNextTurnButton();
  return;
}
}

// Caso in cui il target (non mazziere) abbia una carta alta (TOP_FIVE)
else if (TOP_FIVE.includes(target.card)) {
  target.revealed = true;
  renderTable(); // Aggiorna subito il tavolo per mostrare la carta rivelata
  logMessage(`${target.name} scopre ${target.card}!`);
  switch (target.card) {
    case "Casa":
      await animateBlockedPass(sourceIndex, targetIndex);
      logMessage(`${source.name} viene bloccato`);
      source.stoppedByCasa = true;
      source.stoppedByCasaTarget = targetIndex;
      break;
    case "Gnaf":
      await handleGnaf(sourceIndex, targetIndex);
      return;
    case "Bum":
      await animateBlockedPass(sourceIndex, targetIndex);
      source.lives--;
      logLossMessage(`${source.name} prende una Bummata!`);
      break;
    case "Cucco":
      await animateBlockedPass(sourceIndex, targetIndex);
      logMessage(`${source.name} deve tenere la sua carta!`);
      break;
    case "Salta":
      {
        target.revealed = true;
        target.passed = true;
        let newTarget = (targetIndex - 1 + numPlayers) % numPlayers;
        await processPass(sourceIndex, newTarget);
        currentTurnIndex = sourceIndex;
        renderTable();
        renderNextTurnButton();
        return;
      }
      break;
    default:
      break;
  }
  // Passa direttamente al giocatore successivo
  currentTurnIndex = (targetIndex + 1) % numPlayers;
  target.passed = true;
  source.passed = true;
}
// Caso normale: lo swap tra due giocatori senza carte speciali
else {
  let oldTargetCard = target.card;
  await swapCardsAnimated(sourceIndex, targetIndex);
  source.passed = true;
  if (!target.isHuman) {
    if (oldTargetCard === "Matto") {
      if (target.card === "Matto" || getCardRank(target.card) > getCardRank("I")) {
        logMessage(`${target.name} sta`);
        target.passed = true;
      }
    } else {
      if (getCardRank(target.card) >= getCardRank(oldTargetCard)) {
        logMessage(`${target.name} sta`);
        target.passed = true;
      }
    }
  }
  currentTurnIndex = targetIndex;
}

renderTable();
renderNextTurnButton();
}

function finishPassingPhase() {
  handFinished = true;
  gamePhase = "rivelazione";
  renderTable(true);
  let lossEvents = [];
  let hand = players.filter(p => p.lives > 0).map(p => ({ player: p, card: p.card }));

  let mattoPlayers = hand.filter(item => item.card === "Matto");
  if (mattoPlayers.length === 1) {
    mattoPlayers[0].player.lives--;
    lossEvents.push(`${mattoPlayers[0].player.name} perde 1 vita (Matto)`);
  } else if (mattoPlayers.length === 2) {
    mattoPlayers.forEach(item => {
      item.player.lives++;
      lossEvents.push(`${item.player.name} rigode! (2 matti)`);
    });
  }

  let nonMatto = hand.filter(item => item.card !== "Matto");
  if (nonMatto.length > 0) {
    nonMatto.sort((a, b) => {
      let cmp = getCardRank(a.card) - getCardRank(b.card);
      if (cmp === 0) {
        return getPassingOrder(a.player.id) - getPassingOrder(b.player.id);
      }
      return cmp;
    });
    let loser = nonMatto[0].player;
    if (loser.card === "Nulla" && loser.stoppedByCasa) {
      let casaHolder = players[loser.stoppedByCasaTarget];
      casaHolder.lives--;
      lossEvents.push(`${casaHolder.name} aveva la Casa e perde 1 vita al posto di ${loser.name}.`);
    } else {
      loser.lives--;
      lossEvents.push(`${loser.name} perde 1 vita (${loser.card})`);
    }
  }

  if (lossEvents.length > 0) {
    lossEvents.forEach(event => logLossMessage(event));
  } else {
    logMessage("Nessun giocatore ha perso vita in questa mano.");
  }
  renderTable(true);
  checkGameOver();
  if (!gameOver) {
    renderNextHandButton();
  } else {
    renderControls(`<button class="button" onclick="startNewGame()">Nuova partita</button>`);
  }
}

function checkGameOver() {
  let active = players.filter(p => p.lives > 0);
  let humanLost = players[0].lives <= 0;

  if (active.length <= 1) {
    gameOver = true;
    let winner = active[0] || { name: "Nessuno" };
    logMessage(`<hr>Partita terminata! <strong style="color: cyan;">Vincitore: ${winner.name}</strong>`);
  }

  if (humanLost) {
    // Aggiunge il pulsante "Nuova partita" SOLO se il giocatore ha perso
    let controlsDiv = document.getElementById("controls");
    let newGameButton = document.createElement("button");
    newGameButton.className = "button";
    newGameButton.innerText = "Nuova partita";
    newGameButton.onclick = startNewGame;

    // Evita di aggiungere più pulsanti se già presente
    if (!document.getElementById("new-game-button")) {
      newGameButton.id = "new-game-button";
      controlsDiv.appendChild(newGameButton);
    }
  }
}

function prepareNextHand() {
  dealerIndex = (dealerIndex - 1 + numPlayers) % numPlayers;
  players = players.filter(p => p.lives > 0);
  numPlayers = players.length;
  if (numPlayers < 2) {
    gameOver = true;
    renderControls(`<button class="button" onclick="startNewGame()">Nuova partita</button>`);
    return;
  }
  startHand();
}
function playerDecision(sourceIndex, targetIndex) {
  let sourceCard = players[sourceIndex].card;
  let targetCard = players[targetIndex].card;
  if (cardValue(targetCard) >= cardValue(sourceCard)) {
    logMessage(`${players[targetIndex].name} decide di tenere ${targetCard} e rifiuta ${sourceCard}.`);
    return;
  }
  logMessage(`${players[targetIndex].name} scambia ${targetCard} con ${sourceCard}.`);
  [players[sourceIndex].card, players[targetIndex].card] = [players[targetIndex].card, players[sourceIndex].card];
}
function cardValue(card) {
  const valueMap = {
    "Matto": 99,
    "Re": 10,
    "Regina": 9,
    "Fante": 8,
    "10": 7,
    "9": 6,
    "8": 5,
    "7": 4,
    "6": 3,
    "5": 2,
    "4": 1,
    "Gnaf": 0,
    "Bum": 0,
    "Cucco": 0,
    "Salta": 0,
    "Casa": 0
  };
  return valueMap[card] || 0;
}

function pollLobby() {
  // Esegui solo se siamo in un contesto multiplayer
  if (!document.getElementById('lobbyOptionsSection')) {
    // console.log("Polling non necessario su questa pagina.");
    return;
  }

  if (!generatedLobbyId) {
    // Verifica se siamo nella pagina multiplayer
    if (window.disableWebSocket) {
      // Non fare polling nella pagina multiplayer
      return;
    }
    
    // Se non c'è un ID lobby, non fare polling
    if (!generatedLobbyId) {
      return;
    }
  }
  
  // Invia una richiesta al server per ottenere lo stato della lobby
  fetch(`lobby.php?lobby=${generatedLobbyId}`)
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        console.error("Polling error:", data.error);
        return;
      }
      
      // Aggiorna l'array dei giocatori
      lobbyPlayers = data.players;
      
      // Aggiorna l'interfaccia
      updateLobbyInfo();
      
      // Se il gioco è iniziato, avvia la partita
      if (data.gameStarted) {
        startMultiplayerGame();
      }
    })
    .catch(error => {
      console.error("Polling error:", error);
    });
}

// Avvia il polling solo se non siamo nella pagina multiplayer
if (!window.disableWebSocket) {
  // Avvia il polling ogni 3 secondi (3000 ms)
  setInterval(pollLobby, 3000);
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  
  // Check if we're in the main page or multiplayer page
  const landingElement = document.getElementById("landing");
  const lobbyElement = document.getElementById("lobby");
  
  if (landingElement && lobbyElement) {
    // We're in the main page
    if (params.has("lobby")) {
      generatedLobbyId = params.get("lobby");
      landingElement.style.cssText = "display: none !important;";
      landingElement.style.display = "none";
      lobbyElement.style.display = "flex";
    } else {
      generatedLobbyId = generateLobbyId();
      landingElement.style.display = "flex";
      lobbyElement.style.display = "none";
    }
    renderControls(""); // Pulisce eventuali controlli
  } else {
    // We're in the multiplayer page
    console.log("Multiplayer page detected, skipping main page initialization");
  }
});
