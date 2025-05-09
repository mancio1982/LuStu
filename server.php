<?php
// server.php
require __DIR__ . '/vendor/autoload.php';

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

class CardGameServer implements MessageComponentInterface
{
    protected $clients;
    protected $lobbies = [];

    public function __construct()
    {
        $this->clients = new \SplObjectStorage;
        echo "Server avviato!\n";
    }

    public function onOpen(ConnectionInterface $conn)
    {
        $this->clients->attach($conn);
        $conn->lobby = null;
        $conn->playerId = null;
        echo "Nuova connessione! ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        $data = json_decode($msg, true);

        if (!$data || !isset($data['type'])) {
            echo "Messaggio non valido ricevuto\n";
            return;
        }

        echo "Ricevuto messaggio tipo: {$data['type']}\n";

        switch ($data['type']) {
            case 'joinLobby':
                $this->handleJoinLobby($from, $data);
                break;

            case 'startGame':
                $this->handleStartGame($from, $data);
                break;

            case 'playerAction':
                $this->handlePlayerAction($from, $data);
                break;

            case 'nextHand':
                $this->handleNextHand($from, $data);
                break;
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        $this->clients->detach($conn);

        if ($conn->lobby !== null && isset($this->lobbies[$conn->lobby])) {
            // Rimuovi il giocatore dalla lobby
            $playerId = $conn->playerId;
            if ($playerId) {
                $players = &$this->lobbies[$conn->lobby]['players'];
                foreach ($players as $key => $player) {
                    if ($player['playerId'] === $playerId) {
                        unset($players[$key]);
                        break;
                    }
                }
                $players = array_values($players); // Reindex array

                if (empty($players)) {
                    unset($this->lobbies[$conn->lobby]);
                } else {
                    $this->broadcastLobbyUpdate($conn->lobby);
                }
            }
        }

        echo "Connessione {$conn->resourceId} chiusa\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        echo "Errore: {$e->getMessage()}\n";
        $conn->close();
    }

    protected function handleJoinLobby(ConnectionInterface $conn, $data)
    {
        $lobbyId = $data['lobbyId'];
        $playerId = $data['playerId'];
        $name = $data['name'];

        $conn->playerId = $playerId;
        $conn->lobby = $lobbyId;

        if (!isset($this->lobbies[$lobbyId])) {
            $this->lobbies[$lobbyId] = [
                'id' => $lobbyId,
                'players' => [],
                'gameStarted' => false,
                'currentTurn' => 0,
                'dealer' => 0,
                'deck' => [],
                'handFinished' => false
            ];
        }

        // Controlla se il giocatore è già nella lobby
        $playerExists = false;
        foreach ($this->lobbies[$lobbyId]['players'] as $player) {
            if ($player['playerId'] === $playerId) {
                $playerExists = true;
                break;
            }
        }

        if (!$playerExists) {
            $this->lobbies[$lobbyId]['players'][] = [
                'playerId' => $playerId,
                'name' => $name,
                'lives' => 3,
                'card' => null,
                'action' => null
            ];
        }

        $this->broadcastLobbyUpdate($lobbyId);
    }

    protected function handleStartGame(ConnectionInterface $from, $data)
    {
        $lobbyId = $data['lobbyId'];

        if (!isset($this->lobbies[$lobbyId]) || count($this->lobbies[$lobbyId]['players']) < 2) {
            return;
        }

        $this->lobbies[$lobbyId]['gameStarted'] = true;
        $this->lobbies[$lobbyId]['deck'] = $this->createDeck();
        $this->lobbies[$lobbyId]['dealer'] = mt_rand(0, count($this->lobbies[$lobbyId]['players']) - 1);

        // Distribuisci carte ai giocatori
        $this->dealCards($lobbyId);

        // Imposta il turno corrente
        $this->lobbies[$lobbyId]['currentTurn'] = 0;

        $this->broadcastToLobby($lobbyId, [
            'type' => 'gameStarted',
            'lobby' => $this->getLobbyStateForClient($lobbyId)
        ]);
    }

    protected function handlePlayerAction(ConnectionInterface $from, $data)
    {
        $lobbyId = $data['lobbyId'];
        $playerId = $data['playerId'];
        $action = $data['action']; // "keep" o "pass"

        if (!isset($this->lobbies[$lobbyId]) || !$this->lobbies[$lobbyId]['gameStarted']) {
            return;
        }

        // Trova il giocatore
        $playerIndex = -1;
        foreach ($this->lobbies[$lobbyId]['players'] as $index => $player) {
            if ($player['playerId'] === $playerId) {
                $playerIndex = $index;
                break;
            }
        }

        if ($playerIndex === -1) return;

        // Registra l'azione del giocatore
        $this->lobbies[$lobbyId]['players'][$playerIndex]['action'] = $action;

        // Invia aggiornamento a tutti
        $this->broadcastToLobby($lobbyId, [
            'type' => 'playerActionUpdate',
            'playerId' => $playerId,
            'action' => $action
        ]);

        // Controlla se tutti i giocatori hanno agito
        $allActed = true;
        foreach ($this->lobbies[$lobbyId]['players'] as $player) {
            if ($player['action'] === null) {
                $allActed = false;
                break;
            }
        }

        if ($allActed) {
            $this->resolveHand($lobbyId);
        }
    }

    protected function handleNextHand(ConnectionInterface $from, $data)
    {
        $lobbyId = $data['lobbyId'];

        if (!isset($this->lobbies[$lobbyId]) || !$this->lobbies[$lobbyId]['gameStarted']) {
            return;
        }

        // Verifica che la mano precedente sia terminata
        if (!$this->lobbies[$lobbyId]['handFinished']) {
            return;
        }

        // Reimposta lo stato della mano
        $this->lobbies[$lobbyId]['handFinished'] = false;

        // Filtra i giocatori eliminati
        $this->lobbies[$lobbyId]['players'] = array_filter(
            $this->lobbies[$lobbyId]['players'],
            function($player) {
                return $player['lives'] > 0;
            }
        );
        $this->lobbies[$lobbyId]['players'] = array_values($this->lobbies[$lobbyId]['players']);

        // Se rimane un solo giocatore, termina il gioco
        if (count($this->lobbies[$lobbyId]['players']) <= 1) {
            $this->broadcastToLobby($lobbyId, [
                'type' => 'gameOver',
                'winner' => count($this->lobbies[$lobbyId]['players']) === 1 ?
                    $this->lobbies[$lobbyId]['players'][0]['playerId'] : null
            ]);
            return;
        }

        // Passa al dealer successivo
        $this->lobbies[$lobbyId]['dealer'] = ($this->lobbies[$lobbyId]['dealer'] + 1) %
            count($this->lobbies[$lobbyId]['players']);

        // Distribuisci le carte per la nuova mano
        $this->dealCards($lobbyId);

        // Reset delle azioni
        foreach ($this->lobbies[$lobbyId]['players'] as &$player) {
            $player['action'] = null;
        }

        // Invia lo stato aggiornato
        $this->broadcastToLobby($lobbyId, [
            'type' => 'newHand',
            'lobby' => $this->getLobbyStateForClient($lobbyId)
        ]);
    }

    protected function createDeck()
    {
        $cardNames = [
            "Matto", "Rattaculo", "Mascherone", "Secchia", "Nulla",
            "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "VIIII", "X",
            "Casa", "Gnaf", "Salta", "Bum", "Cucco"
        ];

        $deck = $cardNames;
        shuffle($deck);
        return $deck;
    }

    protected function dealCards($lobbyId)
    {
        $lobby = &$this->lobbies[$lobbyId];

        // Se il mazzo è vuoto o ha poche carte, creane uno nuovo
        if (count($lobby['deck']) < count($lobby['players'])) {
            $lobby['deck'] = $this->createDeck();
        }

        // Distribuisci una carta a ogni giocatore
        foreach ($lobby['players'] as $index => &$player) {
            $player['card'] = array_shift($lobby['deck']);
        }
    }

    protected function resolveHand($lobbyId)
    {
        $lobby = &$this->lobbies[$lobbyId];

        // Identifica il valore più alto tra le carte tenute
        $highestCard = null;
        $highestRank = -1;
        $cardRanks = $this->getCardRanks();

        foreach ($lobby['players'] as $player) {
            if ($player['action'] === 'keep' && $cardRanks[$player['card']] > $highestRank) {
                $highestRank = $cardRanks[$player['card']];
                $highestCard = $player['card'];
            }
        }

        // Applica le penalità ai giocatori
        foreach ($lobby['players'] as &$player) {
            // Se il giocatore ha tenuto la carta più alta, nessuna penalità
            if ($player['action'] === 'keep' && $player['card'] === $highestCard) {
                continue;
            }

            // Se il giocatore ha tenuto una carta che non è la più alta, perde una vita
            if ($player['action'] === 'keep') {
                $player['lives']--;
            }

            // Regole speciali per carte particolari possono essere aggiunte qui
        }

        $lobby['handFinished'] = true;

        // Invia il risultato della mano
        $this->broadcastToLobby($lobbyId, [
            'type' => 'handResult',
            'highestCard' => $highestCard,
            'players' => array_map(function($player) {
                return [
                    'playerId' => $player['playerId'],
                    'name' => $player['name'],
                    'card' => $player['card'],
                    'action' => $player['action'],
                    'lives' => $player['lives']
                ];
            }, $lobby['players'])
        ]);
    }

    protected function getCardRanks()
    {
        return [
            "Matto" => 1, "Rattaculo" => 2, "Mascherone" => 3, "Secchia" => 4, "Nulla" => 5,
            "I" => 6, "II" => 7, "III" => 8, "IIII" => 9, "V" => 10,
            "VI" => 11, "VII" => 12, "VIII" => 13, "VIIII" => 14, "X" => 15,
            "Casa" => 16, "Gnaf" => 17, "Salta" => 18, "Bum" => 19, "Cucco" => 20
        ];
    }

    protected function getLobbyStateForClient($lobbyId)
    {
        $lobby = $this->lobbies[$lobbyId];
        $result = [
            'id' => $lobby['id'],
            'gameStarted' => $lobby['gameStarted'],
            'dealer' => $lobby['dealer'],
            'currentTurn' => $lobby['currentTurn'],
            'handFinished' => $lobby['handFinished'],
            'players' => []
        ];

        foreach ($lobby['players'] as $player) {
            $playerData = [
                'playerId' => $player['playerId'],
                'name' => $player['name'],
                'lives' => $player['lives']
            ];

            // Invia le informazioni sulle carte solo ai rispettivi proprietari
            if (isset($player['card'])) {
                $playerData['card'] = $player['card'];
                error_log("Sending card info for player {$player['name']}: {$player['card']}");
            } else {
                error_log("No card info for player {$player['name']}");
            }
            
            $result['players'][] = $playerData;
        }

        return $result;
    }

    protected function broadcastLobbyUpdate($lobbyId)
    {
        $this->broadcastToLobby($lobbyId, [
            'type' => 'lobbyUpdate',
            'lobby' => $this->getLobbyStateForClient($lobbyId)
        ]);
    }

    protected function broadcastToLobby($lobbyId, $message)
    {
        $encodedMessage = json_encode($message);
        foreach ($this->clients as $client) {
            if ($client->lobby === $lobbyId) {
                $client->send($encodedMessage);
            }
        }
    }
}

// Avvia il server WebSocket
$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new CardGameServer()
        )
    ),
    8080
);

echo "Server CardGame avviato sulla porta 8080\n";
$server->run();
