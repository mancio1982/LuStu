<?php
header('Content-Type: application/json');

$lobbyFile = 'lobby.json';

// Se il file non esiste, lo creiamo con una struttura iniziale vuota
if (!file_exists($lobbyFile)) {
    $initialData = array(
        'lobbyId' => "",
        'players' => array(),
        'gameStarted' => false,
        'currentTurn' => 0,
        'gameState' => array()
    );
    file_put_contents($lobbyFile, json_encode($initialData));
}

// Funzione per leggere il file JSON con lock condiviso
function readLobbyData($lobbyFile) {
    $fp = fopen($lobbyFile, "r");
    if (!$fp) {
        return false;
    }
    if (flock($fp, LOCK_SH)) {
        $data = stream_get_contents($fp);
        flock($fp, LOCK_UN);
    } else {
        fclose($fp);
        return false;
    }
    fclose($fp);
    return json_decode($data, true);
}

// Funzione per scrivere il file JSON con lock esclusivo
function writeLobbyData($lobbyFile, $data) {
    $fp = fopen($lobbyFile, "c+");
    if (!$fp) {
        return false;
    }
    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);  // Svuota il file
        fwrite($fp, json_encode($data));
        fflush($fp);
        flock($fp, LOCK_UN);
    } else {
        fclose($fp);
        return false;
    }
    fclose($fp);
    return true;
}

// Funzione per pulire i file delle lobby inattive
function cleanupInactiveLobbies() {
    $lobbyFiles = glob('lobby_*.json');
    $now = time();
    $inactiveThreshold = 30 * 60; // 30 minuti di inattività
    
    foreach ($lobbyFiles as $file) {
        if (file_exists($file)) {
            $lastModified = filemtime($file);
            if ($now - $lastModified > $inactiveThreshold) {
                unlink($file);
            }
        }
    }
}

// Funzione per cancellare una lobby specifica
function deleteLobby($lobbyId) {
    $lobbyFile = "lobby_{$lobbyId}.json";
    if (file_exists($lobbyFile)) {
        unlink($lobbyFile);
    }
}

// Esegui la pulizia delle lobby inattive
cleanupInactiveLobbies();

// Leggi lo stato attuale della lobby
$lobbyData = readLobbyData($lobbyFile);
if ($lobbyData === false) {
    echo json_encode(array('error' => 'Impossibile leggere il file della lobby.'));
    exit;
}

// --- Gestione delle richieste GET ---
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['lobby'])) {
        $requestedLobbyId = $_GET['lobby'];
        
        // Se il file non è ancora inizializzato o ha un lobbyId vuoto, impostalo
        if (!isset($lobbyData['lobbyId']) || $lobbyData['lobbyId'] === "") {
            $lobbyData['lobbyId'] = $requestedLobbyId;
            writeLobbyData($lobbyFile, $lobbyData);
        }
        // Se il lobbyId richiesto è diverso da quello nel file, crea un nuovo file
        else if ($lobbyData['lobbyId'] !== $requestedLobbyId) {
            // Verifica se esiste già un file per questa lobby
            $lobbySpecificFile = 'lobby_' . $requestedLobbyId . '.json';
            if (file_exists($lobbySpecificFile)) {
                $lobbyData = readLobbyData($lobbySpecificFile);
                if ($lobbyData === false) {
                    // Se non riesce a leggere il file specifico, crea una nuova lobby
                    $lobbyData = array(
                        'lobbyId' => $requestedLobbyId,
                        'players' => array(),
                        'gameStarted' => false,
                        'currentTurn' => 0,
                        'gameState' => array()
                    );
                    writeLobbyData($lobbySpecificFile, $lobbyData);
                }
            } else {
                // Crea un nuovo file per questa lobby
                $lobbyData = array(
                    'lobbyId' => $requestedLobbyId,
                    'players' => array(),
                    'gameStarted' => false,
                    'currentTurn' => 0,
                    'gameState' => array()
                );
                writeLobbyData($lobbySpecificFile, $lobbyData);
            }
        }
        
        // Se la lobby non esiste o è vuota, cancella il file
        if (!isset($lobbyData['players']) || empty($lobbyData['players'])) {
            deleteLobby($requestedLobbyId);
            echo json_encode(['error' => 'Lobby non trovata o vuota']);
            exit;
        }
    }
    echo json_encode($lobbyData);
    exit;
}

// --- Gestione delle richieste POST ---
$input = file_get_contents('php://input');
$data = json_decode($input, true);
if (!$data) {
    echo json_encode(array('error' => 'Dati non validi'));
    exit;
}

// Se il POST contiene un lobbyId, controlla che corrisponda a quello nel file
if (isset($data['lobbyId'])) {
    $lobbyId = $data['lobbyId'];
    $lobbySpecificFile = 'lobby_' . $lobbyId . '.json';
    
    // Se esiste già un file per questa lobby, usalo
    if (file_exists($lobbySpecificFile)) {
        $lobbyData = readLobbyData($lobbySpecificFile);
        if ($lobbyData === false) {
            // Se non riesce a leggere il file specifico, crea una nuova lobby
            $lobbyData = array(
                'lobbyId' => $lobbyId,
                'players' => array(),
                'gameStarted' => false,
                'currentTurn' => 0,
                'gameState' => array()
            );
        }
    } else {
        // Crea un nuovo file per questa lobby
        $lobbyData = array(
            'lobbyId' => $lobbyId,
            'players' => array(),
            'gameStarted' => false,
            'currentTurn' => 0,
            'gameState' => array()
        );
    }
    
    // Aggiorna il file della lobby corrente
    $lobbyFile = $lobbySpecificFile;
}

if (isset($data['type'])) {
    switch ($data['type']) {
        case 'joinLobby':
            $playerId = $data['playerId'];
            $playerName = $data['name'];
            
            // Debug logging
            error_log("Joining lobby - Player ID: " . $playerId . ", Name: " . $playerName);
            
            if (!file_exists($lobbyFile)) {
                // Se il file non esiste, crea una nuova lobby
                $lobbyData = [
                    'lobbyId' => $lobbyId,
                    'creatorId' => $playerId,
                    'players' => [],
                    'gameStarted' => false,
                    'currentTurn' => null,
                    'gameState' => null
                ];
                error_log("Created new lobby with creator ID: " . $playerId);
            } else {
                $lobbyData = readLobbyData($lobbyFile);
                if ($lobbyData === false) {
                    $response = ['error' => 'Impossibile leggere il file della lobby'];
                    echo json_encode($response);
                    exit;
                }
                error_log("Existing lobby - Creator ID: " . $lobbyData['creatorId']);
            }
            
            // Verifica se il giocatore è già nella lobby
            $playerExists = false;
            foreach ($lobbyData['players'] as &$player) {
                if ($player['playerId'] === $playerId) {
                    $playerExists = true;
                    break;
                }
            }
            
            if (!$playerExists) {
                // Aggiungi il nuovo giocatore
                $lobbyData['players'][] = [
                    'playerId' => $playerId,
                    'name' => $playerName
                ];
            }
            
            // Salva i dati aggiornati
            if (!writeLobbyData($lobbyFile, $lobbyData)) {
                $response = ['error' => 'Errore durante il salvataggio della lobby'];
                echo json_encode($response);
                exit;
            }
            
            // Restituisci la risposta
            $response = [
                'success' => true,
                'lobbyData' => $lobbyData
            ];
            echo json_encode($response);
            exit;
            break;
            
        case 'startGame':
            if (!file_exists($lobbyFile)) {
                echo json_encode(['error' => 'Lobby non trovata']);
                exit;
            }
            
            $lobbyData = readLobbyData($lobbyFile);
            if ($lobbyData === false) {
                echo json_encode(['error' => 'Impossibile leggere il file della lobby']);
                exit;
            }
            
            // Debug logging
            error_log("Starting game - Player ID: " . $playerId . ", Creator ID: " . $lobbyData['creatorId']);
            error_log("Lobby data: " . json_encode($lobbyData));
            
            // Verifica se il giocatore è il creatore della lobby
            if (!isset($lobbyData['creatorId'])) {
                error_log("Creator ID not set in lobby data");
                echo json_encode(['error' => 'Errore: ID creatore non impostato']);
                exit;
            }
            
            if ($lobbyData['creatorId'] != $playerId) {
                error_log("Player is not creator - Player ID: " . $playerId . ", Creator ID: " . $lobbyData['creatorId']);
                echo json_encode(['error' => 'Solo il creatore della lobby può avviare la partita']);
                exit;
            }
            
            if (count($lobbyData['players']) < 2) {
                echo json_encode(['error' => 'Non ci sono abbastanza giocatori per iniziare la partita']);
                exit;
            }
            
            // Inizializza lo stato del gioco
            $lobbyData['gameState'] = [
                'started' => true,
                'currentTurn' => $lobbyData['players'][0]['playerId'],
                'players' => [],
                'deck' => [],
                'cardsRevealed' => false,
                'roundEnded' => false
            ];
            
            // Crea il mazzo di carte
            $cardTypes = ['asso', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'fante', 'donna', 're'];
            $deck = [];
            foreach ($cardTypes as $type) {
                $deck[] = $type;
                $deck[] = $type;
            }
            shuffle($deck);
            
            // Assegna una carta a ogni giocatore
            foreach ($lobbyData['players'] as &$player) {
                $lobbyData['gameState']['players'][] = [
                    'playerId' => $player['playerId'],
                    'name' => $player['name'],
                    'card' => array_pop($deck),
                    'lives' => 3
                ];
            }
            
            // Salva il mazzo rimanente
            $lobbyData['gameState']['deck'] = $deck;
            
            // Salva i dati aggiornati
            writeLobbyData($lobbyFile, $lobbyData);
            
            echo json_encode([
                'success' => true,
                'gameState' => $lobbyData['gameState']
            ]);
            break;
            
        case 'updateGameState':
            if ($lobbyData['gameStarted']) {
                $playerId = $data['playerId'];
                if ($lobbyData['gameState']['currentPlayer'] === $playerId) {
                    $lobbyData['gameState'] = array_merge($lobbyData['gameState'], $data['gameState']);
                    // Passa al turno successivo
                    $currentIndex = array_search($playerId, array_column($lobbyData['players'], 'playerId'));
                    $nextIndex = ($currentIndex + 1) % count($lobbyData['players']);
                    $lobbyData['gameState']['currentPlayer'] = $lobbyData['players'][$nextIndex]['playerId'];
                }
            }
            break;
            
        case 'makeMove':
            $playerId = $data['playerId'];
            $lobbyId = $data['lobbyId'];
            $moveType = $data['moveType'];
            $lobbyFile = "lobby_{$lobbyId}.json";
            
            if (file_exists($lobbyFile)) {
                $lobbyData = readLobbyData($lobbyFile);
                if ($lobbyData === false) {
                    $response['error'] = 'Impossibile leggere il file della lobby';
                    break;
                }
                
                // Verifica che il gioco sia iniziato
                if (!$lobbyData['gameStarted']) {
                    $response['error'] = 'La partita non è ancora iniziata';
                    break;
                }
                
                // Verifica che sia il turno del giocatore
                if ($lobbyData['currentTurn'] !== $playerId) {
                    $response['error'] = 'Non è il tuo turno';
                    break;
                }
                
                // Trova l'indice del giocatore corrente
                $currentPlayerIndex = -1;
                foreach ($lobbyData['gameState']['players'] as $index => $player) {
                    if ($player['playerId'] === $playerId) {
                        $currentPlayerIndex = $index;
                        break;
                    }
                }
                
                if ($currentPlayerIndex === -1) {
                    $response['error'] = 'Giocatore non trovato';
                    break;
                }
                
                // Gestisci la mossa
                if ($moveType === 'keepCard') {
                    // Il giocatore tiene la sua carta
                    $lobbyData['gameState']['players'][$currentPlayerIndex]['keptCard'] = true;
                } elseif ($moveType === 'passCard') {
                    if ($currentPlayerIndex === 0) { // Se è il mazziere
                        // Il mazziere scambia la sua carta con quella in cima al mazzo
                        if (!empty($lobbyData['gameState']['deck'])) {
                            $topCard = array_pop($lobbyData['gameState']['deck']);
                            $tempCard = $lobbyData['gameState']['players'][$currentPlayerIndex]['card'];
                            $lobbyData['gameState']['players'][$currentPlayerIndex]['card'] = $topCard;
                            array_push($lobbyData['gameState']['deck'], $tempCard);
                        }
                    } else {
                        // Trova l'indice del prossimo giocatore
                        $nextPlayerIndex = ($currentPlayerIndex + 1) % count($lobbyData['gameState']['players']);
                        
                        // Scambia le carte solo se il prossimo giocatore non ha già tenuto la sua carta
                        if (!$lobbyData['gameState']['players'][$nextPlayerIndex]['keptCard']) {
                            $tempCard = $lobbyData['gameState']['players'][$currentPlayerIndex]['card'];
                            $lobbyData['gameState']['players'][$currentPlayerIndex]['card'] = $lobbyData['gameState']['players'][$nextPlayerIndex]['card'];
                            $lobbyData['gameState']['players'][$nextPlayerIndex]['card'] = $tempCard;
                        }
                    }
                } elseif ($moveType === 'nextTurn') {
                    // Passa al prossimo turno
                    $nextPlayerIndex = ($currentPlayerIndex + 1) % count($lobbyData['gameState']['players']);
                    $lobbyData['currentTurn'] = $lobbyData['gameState']['players'][$nextPlayerIndex]['playerId'];
                }
                
                // Se è il mazziere e ha fatto la sua mossa, rivelare le carte e calcolare chi perde
                if ($currentPlayerIndex === 0) {
                    // Rivelare tutte le carte
                    $lobbyData['gameState']['cardsRevealed'] = true;
                    
                    // Calcola chi ha la carta più bassa
                    $lowestCard = null;
                    $lowestValue = PHP_INT_MAX; // Inizializza con il valore più alto possibile
                    $cardValues = [
                        "Matto" => 0, "Rattaculo" => 1, "Mascherone" => 2, "Secchia" => 3, "Nulla" => 4,
                        "I" => 5, "II" => 6, "III" => 7, "IIII" => 8, "V" => 9, "VI" => 10, 
                        "VII" => 11, "VIII" => 12, "VIIII" => 13, "X" => 14,
                        "Casa" => 15, "Gnaf" => 16, "Salta" => 17, "Bum" => 18, "Cucco" => 19
                    ];
                    
                    // Trova la carta più bassa
                    $playersWithLowestCard = [];
                    foreach ($lobbyData['gameState']['players'] as $player) {
                        $cardValue = $cardValues[$player['card']] ?? 0;
                        if ($cardValue < $lowestValue) {
                            $lowestValue = $cardValue;
                            $lowestCard = $player['card'];
                            $playersWithLowestCard = [$player['playerId']];
                        } elseif ($cardValue === $lowestValue) {
                            $playersWithLowestCard[] = $player['playerId'];
                        }
                    }
                    
                    // Chi ha la carta più bassa perde una vita
                    foreach ($lobbyData['gameState']['players'] as &$player) {
                        if (in_array($player['playerId'], $playersWithLowestCard)) {
                            $player['lives']--;
                        }
                    }
                    
                    // Controlla se qualcuno ha perso tutte le vite
                    $gameOver = false;
                    foreach ($lobbyData['gameState']['players'] as $player) {
                        if ($player['lives'] <= 0) {
                            $gameOver = true;
                            break;
                        }
                    }
                    
                    if ($gameOver) {
                        $lobbyData['gameState']['gameOver'] = true;
                    } else {
                        // Prepara il prossimo giro
                        $lobbyData['gameState']['roundEnded'] = true;
                        $lobbyData['gameState']['cardsRevealed'] = false;
                        
                        // Mescola il mazzo per il prossimo giro
                        shuffle($lobbyData['gameState']['deck']);
                        
                        // Distribuisci nuove carte
                        foreach ($lobbyData['gameState']['players'] as &$player) {
                            $player['card'] = array_pop($lobbyData['gameState']['deck']);
                            $player['keptCard'] = false;
                        }
                    }
                }
                
                // Salva lo stato aggiornato
                if (!writeLobbyData($lobbyFile, $lobbyData)) {
                    $response['error'] = 'Errore durante il salvataggio della lobby';
                    break;
                }
                
                // Restituisci lo stato aggiornato
                $response = $lobbyData;
            } else {
                $response['error'] = 'Lobby non trovata';
            }
            break;
            
        case 'leaveLobby':
            $lobbyId = $data['lobbyId'];
            $playerId = $data['playerId'];
            
            $lobbyFile = "lobby_{$lobbyId}.json";
            if (file_exists($lobbyFile)) {
                $lobbyData = json_decode(file_get_contents($lobbyFile), true);
                
                if (isset($lobbyData['players'][$playerId])) {
                    unset($lobbyData['players'][$playerId]);
                    
                    // Se non ci sono più giocatori, cancella la lobby
                    if (empty($lobbyData['players'])) {
                        deleteLobby($lobbyId);
                        echo json_encode(['success' => true, 'message' => 'Lobby cancellata']);
                    } else {
                        file_put_contents($lobbyFile, json_encode($lobbyData));
                        echo json_encode(['success' => true, 'message' => 'Giocatore rimosso dalla lobby']);
                    }
                } else {
                    echo json_encode(['error' => 'Giocatore non trovato nella lobby']);
                }
            } else {
                echo json_encode(['error' => 'Lobby non trovata']);
            }
            exit;
            
        case 'startNextRound':
            $playerId = $data['playerId'];
            $lobbyId = $data['lobbyId'];
            $lobbyFile = "lobby_{$lobbyId}.json";
            
            if (file_exists($lobbyFile)) {
                $lobbyData = readLobbyData($lobbyFile);
                if ($lobbyData === false) {
                    $response['error'] = 'Impossibile leggere il file della lobby';
                    break;
                }
                
                // Verifica che il gioco sia iniziato
                if (!$lobbyData['gameStarted']) {
                    $response['error'] = 'La partita non è ancora iniziata';
                    break;
                }
                
                // Verifica che il round sia finito
                if (!$lobbyData['gameState']['roundEnded']) {
                    $response['error'] = 'Il round non è ancora finito';
                    break;
                }
                
                // Prepara il prossimo round
                $lobbyData['gameState']['roundEnded'] = false;
                $lobbyData['gameState']['cardsRevealed'] = false;
                
                // Mescola il mazzo per il prossimo round
                shuffle($lobbyData['gameState']['deck']);
                
                // Distribuisci nuove carte
                foreach ($lobbyData['gameState']['players'] as &$player) {
                    $player['card'] = array_pop($lobbyData['gameState']['deck']);
                    $player['keptCard'] = false;
                }
                
                // Il mazziere inizia il nuovo round
                $lobbyData['currentTurn'] = $lobbyData['gameState']['players'][0]['playerId'];
                
                // Salva lo stato aggiornato
                if (!writeLobbyData($lobbyFile, $lobbyData)) {
                    $response['error'] = 'Errore durante il salvataggio della lobby';
                    break;
                }
                
                // Restituisci lo stato aggiornato
                $response = $lobbyData;
            } else {
                $response['error'] = 'Lobby non trovata';
            }
            break;
            
        default:
            break;
    }
    
    if (!writeLobbyData($lobbyFile, $lobbyData)) {
        echo json_encode(array('error' => 'Impossibile scrivere il file della lobby.'));
        exit;
    }
    echo json_encode($lobbyData);
    exit;
}

echo json_encode(array('error' => 'Metodo non supportato'));

function revealCardsAndUpdateLives(&$lobbyData) {
    // Rivelare tutte le carte
    $lobbyData['gameState']['cardsRevealed'] = true;
    
    // Trova la carta più alta
    $highestCard = null;
    $highestValue = -1;
    $cardValues = [
        'asso' => 1,
        'due' => 2,
        'tre' => 3,
        'quattro' => 4,
        'cinque' => 5,
        'sei' => 6,
        'sette' => 7,
        'fante' => 8,
        'cavallo' => 9,
        're' => 10
    ];
    
    foreach ($lobbyData['gameState']['players'] as $player) {
        $cardValue = $cardValues[$player['card']] ?? 0;
        if ($cardValue > $highestValue) {
            $highestValue = $cardValue;
            $highestCard = $player['card'];
        }
    }
    
    // Chi ha la carta più alta perde una vita
    foreach ($lobbyData['gameState']['players'] as &$player) {
        if ($player['card'] === $highestCard) {
            $player['lives'] = max(0, ($player['lives'] ?? 3) - 1);
        }
    }
    
    // Controlla se qualcuno ha perso tutte le vite
    $gameOver = false;
    foreach ($lobbyData['gameState']['players'] as $player) {
        if ($player['lives'] <= 0) {
            $gameOver = true;
            break;
        }
    }
    
    if ($gameOver) {
        $lobbyData['gameState']['gameOver'] = true;
    }
}
?>
