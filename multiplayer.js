// multiplayer.js
// Check if multiplayerGame already exists to avoid redeclaration
if (typeof multiplayerGame === 'undefined') {
    var multiplayerGame = {
        playerId: null,
        lobbyId: null,
        gameState: null,
        isMyTurn: false,
        
        initialize: function() {
            console.log('Initializing multiplayer game...');
            this.playerId = window.playerId;
            this.lobbyId = document.getElementById('lobbyIdDisplay').textContent;
            
            console.log('Player ID:', this.playerId);
            console.log('Lobby ID:', this.lobbyId);
            
            if (!this.playerId || !this.lobbyId) {
                console.error('Missing player ID or lobby ID');
                return;
            }
            
            // Aggiungi gli event listener per i pulsanti
            const keepCardBtn = document.getElementById('keepCardBtn');
            const passCardBtn = document.getElementById('passCardBtn');
            const nextTurnBtn = document.getElementById('nextTurnBtn');
            
            if (keepCardBtn) {
                keepCardBtn.addEventListener('click', () => this.makeMove('keepCard'));
            }
            
            if (passCardBtn) {
                passCardBtn.addEventListener('click', () => this.makeMove('passCard'));
            }
            
            if (nextTurnBtn) {
                nextTurnBtn.addEventListener('click', () => this.makeMove('nextTurn'));
            }
            
            // Avvia il polling per gli aggiornamenti del gioco
            this.startGamePolling();
            
            // Crea l'interfaccia del gioco
            this.createGameUI();
        },
        
        createGameUI: function() {
            console.log('Creating game UI...');
            
            // Create the main container
            const gameContainer = document.createElement('div');
            gameContainer.id = 'gameContainer';
            gameContainer.className = 'game-container';
            
            // Create the turn indicator
            const turnIndicator = document.createElement('div');
            turnIndicator.id = 'turnIndicator';
            turnIndicator.className = 'turn-indicator';
            turnIndicator.textContent = 'In attesa che la partita inizi...';
            gameContainer.appendChild(turnIndicator);
            
            // Create the table (initially hidden)
            const table = document.createElement('div');
            table.id = 'table';
            table.className = 'table';
            table.style.display = 'none'; // Hide the table initially
            gameContainer.appendChild(table);
            
            // Create action buttons
            const actionButtons = document.createElement('div');
            actionButtons.id = 'actionButtons';
            actionButtons.className = 'action-buttons';
            
            // Keep Card button
            const keepCardBtn = document.createElement('button');
            keepCardBtn.id = 'keepCardBtn';
            keepCardBtn.textContent = 'Sto';
            keepCardBtn.onclick = () => this.makeMove('keepCard');
            keepCardBtn.style.display = 'none'; // Initially hidden
            actionButtons.appendChild(keepCardBtn);
            
            // Pass Card button
            const passCardBtn = document.createElement('button');
            passCardBtn.id = 'passCardBtn';
            passCardBtn.textContent = 'Passa';
            passCardBtn.onclick = () => this.makeMove('passCard');
            passCardBtn.style.display = 'none'; // Initially hidden
            actionButtons.appendChild(passCardBtn);
            
            // Start Game button
            const startGameBtn = document.createElement('button');
            startGameBtn.id = 'startGameBtn';
            startGameBtn.textContent = 'Inizia partita';
            startGameBtn.onclick = () => this.startGame();
            startGameBtn.style.display = this.gameState.creatorId === this.playerId ? 'inline-block' : 'none';
            actionButtons.appendChild(startGameBtn);
            
            // Add a button to copy the lobby ID
            const copyLobbyIdBtn = document.createElement('button');
            copyLobbyIdBtn.textContent = 'Copia ID Lobby';
            copyLobbyIdBtn.onclick = () => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(this.lobbyId).then(() => {
                        alert('ID della lobby copiato negli appunti!');
                    }).catch(err => {
                        console.error('Failed to copy: ', err);
                    });
                } else {
                    // Fallback for older browsers
                    const textarea = document.createElement('textarea');
                    textarea.value = this.lobbyId;
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                        document.execCommand('copy');
                        alert('ID della lobby copiato negli appunti!');
                    } catch (err) {
                        console.error('Fallback: Oops, unable to copy', err);
                    }
                    document.body.removeChild(textarea);
                }
            };
            gameContainer.appendChild(copyLobbyIdBtn);
            
            gameContainer.appendChild(actionButtons);
            
            // Create the player list
            const playerList = document.createElement('div');
            playerList.id = 'playerList';
            playerList.className = 'player-list';
            
            // Add players to the list
            if (this.gameState && this.gameState.players) {
                this.gameState.players.forEach(player => {
                    const playerElement = document.createElement('div');
                    playerElement.className = 'player-item';
                    playerElement.textContent = player.name;
                    if (player.playerId === this.gameState.creatorId) {
                        playerElement.textContent += ' (Creatore)';
                    }
                    playerList.appendChild(playerElement);
                });
            }
            
            gameContainer.appendChild(playerList);
            
            // Add the container to the body
            document.body.appendChild(gameContainer);
            
            // Show the game section
            const gameSection = document.getElementById('gameSection');
            if (gameSection) {
                gameSection.style.display = 'block';
            }
            
            // Hide the active lobby section
            const activeLobbySection = document.getElementById('activeLobbySection');
            if (activeLobbySection) {
                activeLobbySection.classList.add('hidden');
            }
            
            // Update the lobby ID display
            const lobbyIdDisplay = document.getElementById('lobbyIdDisplay');
            if (lobbyIdDisplay) {
                lobbyIdDisplay.textContent = this.lobbyId;
            }
            
            console.log('Game UI created');
        },
        
        startGamePolling: function() {
            console.log('Starting game polling...');
            
            // Polling ogni 2 secondi
            setInterval(() => {
                this.updateGameState();
            }, 2000);
        },
        
        updateGameState: function() {
            if (!this.lobbyId) {
                console.error('No lobby ID available');
                return;
            }
            
            console.log('Updating game state for lobby:', this.lobbyId);
            fetch('lobby.php?lobby=' + this.lobbyId)
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        console.error('Error updating game state:', data.error);
                        return;
                    }
                    
                    console.log('Game state updated:', data);
                    
                    // Check if lobbyData exists, otherwise use the data directly
                    if (data.lobbyData) {
                        this.gameState = data.lobbyData; // Set the game state from the response
                    } else {
                        this.gameState = data; // Use the data directly if lobbyData is not present
                    }
                    
                    // Update the player list
                    this.updatePlayerList(); // Ensure this is called after setting gameState
                    
                    // Debug: Check if players are present in the game state
                    if (this.gameState.players) {
                        console.log('Players in game state:', this.gameState.players);
                    } else {
                        console.log('No players found in game state:', this.gameState);
                    }
                    
                    // Update the UI
                    this.updateUI();
                })
                .catch(error => {
                    console.error('Error updating game state:', error);
                });
        },
        
        updatePlayerList: function() {
            const playerList = document.getElementById('playerList');
            if (playerList) {
                playerList.innerHTML = ''; // Clear the existing list
                this.gameState.players.forEach(player => {
                    const playerElement = document.createElement('div');
                    playerElement.className = 'player-item';
                    playerElement.textContent = player.name;
                    if (player.playerId === this.gameState.creatorId) {
                        playerElement.textContent += ' (Creatore)';
                    }
                    playerList.appendChild(playerElement);
                });
            } else {
                console.error('Player list element not found');
            }
        },
        
        updateUI: function() {
            if (!this.gameState) {
                console.log('Game state not available yet, waiting for initialization');
                return;
            }

            // Aggiorna l'indicatore del turno
            const turnIndicator = document.getElementById('turnIndicator');
            if (turnIndicator) {
                if (this.gameState.gameStarted) {
                    const currentPlayer = this.gameState.players.find(p => p.playerId === this.gameState.currentTurn);
                    turnIndicator.textContent = currentPlayer ? `Turno di ${currentPlayer.name}` : 'Attendi il tuo turno...';
                } else {
                    turnIndicator.textContent = 'In attesa che la partita inizi...';
                }
            }

            // Gestisci i pulsanti di azione
            const actionButtons = document.getElementById('actionButtons');
            if (actionButtons) {
                if (this.gameState.gameStarted) {
                    // Se la partita è iniziata, mostra i pulsanti di azione solo se è il turno del giocatore
                    const isMyTurn = this.gameState.currentTurn === this.playerId;
                    actionButtons.style.display = isMyTurn ? 'block' : 'none';
                    
                    // Aggiorna lo stato dei pulsanti
                    const keepCardBtn = document.getElementById('keepCardBtn');
                    const passCardBtn = document.getElementById('passCardBtn');
                    const startGameBtn = document.getElementById('startGameBtn');
                    
                    if (keepCardBtn) keepCardBtn.style.display = isMyTurn ? 'inline-block' : 'none';
                    if (passCardBtn) passCardBtn.style.display = isMyTurn ? 'inline-block' : 'none';
                    if (startGameBtn) startGameBtn.style.display = 'none';
                } else {
                    // Se la partita non è iniziata, mostra il pulsante di inizio solo al creatore della lobby
                    actionButtons.style.display = 'block';
                    const startGameBtn = document.getElementById('startGameBtn');
                    const keepCardBtn = document.getElementById('keepCardBtn');
                    const passCardBtn = document.getElementById('passCardBtn');
                    
                    if (startGameBtn) {
                        startGameBtn.style.display = this.gameState.creatorId === this.playerId ? 'inline-block' : 'none';
                    }
                    if (keepCardBtn) keepCardBtn.style.display = 'none';
                    if (passCardBtn) passCardBtn.style.display = 'none';
                }
            }

            // Aggiorna le posizioni dei giocatori
            this.updatePlayerPositions();
        },
        
        updatePlayerPositions: function() {
            if (!this.gameState || !this.gameState.players) {
                console.log('Game state or players not available yet, waiting for initialization');
                return;
            }
            
            const table = document.getElementById('table');
            if (!table) {
                console.error('Table element not found');
                return;
            }
            
            const players = this.gameState.players;
            const playerCount = players.length;
            
            // Rimuovi i giocatori esistenti
            const existingPlayers = table.querySelectorAll('.player');
            existingPlayers.forEach(player => player.remove());
            
            // Calcola le dimensioni del tavolo e il centro
            const w = table.offsetWidth;
            const h = table.offsetHeight;
            const centerX = w / 2;
            const centerY = h / 2;
            
            // Definisci il rettangolo per posizionare i giocatori (80% delle dimensioni del tavolo)
            const rectWidth = w * 0.8;
            const rectHeight = h * 0.8;
            
            // Calcola il perimetro e lo spacing tra i giocatori
            const P = 2 * (rectWidth + rectHeight);
            const spacing = P / playerCount;
            
            // Posiziona ogni giocatore lungo il perimetro del rettangolo
            let playerIndex = 0;
            for (const player of players) {
                const t = playerIndex * spacing;
                
                // Calcola la posizione sul rettangolo
                let x, y;
                if (t < rectWidth) {
                    // Lato superiore
                    x = t;
                    y = 0;
                } else if (t < rectWidth + rectHeight) {
                    // Lato destro
                    x = rectWidth;
                    y = t - rectWidth;
                } else if (t < 2 * rectWidth + rectHeight) {
                    // Lato inferiore
                    x = rectWidth - (t - rectWidth - rectHeight);
                    y = rectHeight;
                } else {
                    // Lato sinistro
                    x = 0;
                    y = rectHeight - (t - 2 * rectWidth - rectHeight);
                }
                
                // Crea l'elemento del giocatore
                const playerElement = document.createElement('div');
                playerElement.className = 'player';
                playerElement.textContent = player.name;
                playerElement.style.left = `${x}px`;
                playerElement.style.top = `${y}px`;
                table.appendChild(playerElement);
                
                playerIndex++;
            }
        },
        
        // Crea HTML per le vite usando l'immagine del cuore
        getLivesHTML: function(lives) {
            // Crea HTML per le vite usando l'immagine del cuore
            const heartImg = '<img src="immagini/cuoricino.svg" style="width: 20px; height: 20px; margin: 0 2px;">';
            return heartImg.repeat(lives);
        },
        
        async makeMove(moveType) {
            try {
                console.log('Making move:', moveType);
                const response = await fetch('lobby.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'makeMove',
                        lobbyId: this.lobbyId,
                        playerId: this.playerId,
                        moveType: moveType
                    })
                });
                
                const data = await response.json();
                console.log('Move response:', data);
                
                if (data.error) {
                    console.error('Error making move:', data.error);
                    return;
                }
                
                // Update game state
                this.gameState = data;
                
                // Aggiorna i pulsanti delle azioni
                const actionButtons = document.getElementById('actionButtons');
                if (actionButtons) {
                    if (this.isMyTurn && !this.gameState.gameState.cardsRevealed) {
                        actionButtons.style.display = 'block';
                        // Mostra i pulsanti "Sto" e "Passa"
                        const keepCardBtn = document.getElementById('keepCardBtn');
                        const passCardBtn = document.getElementById('passCardBtn');
                        const nextTurnBtn = document.getElementById('nextTurnBtn');
                        
                        if (keepCardBtn) keepCardBtn.style.display = 'inline-block';
                        if (passCardBtn) passCardBtn.style.display = 'inline-block';
                        if (nextTurnBtn) nextTurnBtn.style.display = 'none';
                    } else {
                        actionButtons.style.display = 'none';
                    }
                }
                
                this.updateUI();
            } catch (error) {
                console.error('Error making move:', error);
            }
        },
        
        async startGame() {
            try {
                console.log('Starting game...');
                console.log('Player ID:', this.playerId);
                console.log('Lobby ID:', this.lobbyId);
                console.log('Game State:', this.gameState);
                console.log('Creator ID:', this.gameState.creatorId);
                
                if (!this.gameState) {
                    throw new Error('Game state not available');
                }
                
                if (!this.gameState.creatorId) {
                    throw new Error('Creator ID not available in game state');
                }
                
                // Check if the player is the creator
                if (this.gameState.creatorId !== this.playerId) {
                    console.error('Player is not creator. Player ID:', this.playerId, 'Creator ID:', this.gameState.creatorId);
                    throw new Error('Solo il creatore della lobby può avviare la partita');
                }
                
                const response = await fetch('lobby.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'startGame',
                        lobbyId: this.lobbyId,
                        playerId: this.playerId
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                console.log('Start game response:', data);

                if (data.error) {
                    throw new Error(data.error);
                }

                // Update game state
                this.gameState = {
                    ...this.gameState,
                    gameState: data.gameState
                };
                
                console.log('Updated game state:', this.gameState);
                this.updateUI();
            } catch (error) {
                console.error('Error starting game:', error);
                alert('Errore durante l\'avvio della partita: ' + error.message);
            }
        },
        
        async startNextRound() {
            try {
                const response = await fetch('lobby.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'startNextRound',
                        lobbyId: this.lobbyId,
                        playerId: this.playerId
                    })
                });
                
                const data = await response.json();
                if (data.error) {
                    console.error('Error starting next round:', data.error);
                    return;
                }
                
                this.gameState = data;
                this.updateUI();
            } catch (error) {
                console.error('Error starting next round:', error);
            }
        },
        
        async joinLobby(lobbyId, playerName) {
            try {
                console.log('Joining lobby:', lobbyId, 'as', playerName);
                const response = await fetch('lobby.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'joinLobby',
                        lobbyId: lobbyId,
                        playerId: this.playerId,
                        name: playerName
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const responseText = await response.text();
                console.log('Raw response:', responseText);

                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    console.error('Error parsing JSON:', e);
                    console.error('Response text:', responseText);
                    throw new Error('Invalid JSON response from server');
                }

                console.log('Parsed response:', data);

                if (data.error) {
                    throw new Error(data.error);
                }

                if (!data.success) {
                    throw new Error('Failed to join lobby');
                }

                this.lobbyId = lobbyId;
                this.gameState = data.lobbyData;
                console.log('Game state after joining:', this.gameState);
                console.log('Creator ID:', this.gameState.creatorId);
                console.log('Player ID:', this.playerId);
                this.createGameUI();
                this.updateUI();
                this.startGamePolling();
            } catch (error) {
                console.error('Error joining lobby:', error);
                alert('Errore durante l\'accesso alla lobby: ' + error.message);
            }
        }
    };
}

// Funzione per inizializzare il gioco multiplayer
function initializeMultiplayerGame() {
    console.log('Initializing multiplayer game...');
    multiplayerGame.initialize();
} 