// multi-play.js

import {
  doc,
  onSnapshot,
  updateDoc,
  runTransaction,
  arrayRemove,
  arrayUnion,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class MultiplayerGameManager {
  constructor(db, roomId, myNickname, gameCallbacks) {
    this.db = db;
    this.roomId = roomId;
    this.myNickname = myNickname;
    this.gameCallbacks = gameCallbacks; // Functions from liars-roulette.js to update UI/game
    this.roomRef = doc(db, "liar_rooms", roomId);
    this.unsubscribeGame = null;
    this.localPlayers = []; // Local copy of players array, including charIndex
    this.myPlayerIndex = -1; // My position in the game (0-3)
    this.isMyTurn = false;
  }

  // Initialize game state listener
  init() {
    console.log(
      "MultiplayerGameManager: Initializing game listener for room",
      this.roomId,
    );
    this.unsubscribeGame = onSnapshot(this.roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const gameData = docSnap.data();
        console.log(
          "MultiplayerGameManager: Received game state update:",
          gameData,
        );
        this.handleGameUpdate(gameData);
      } else {
        console.warn("MultiplayerGameManager: Room does not exist anymore.");
        this.gameCallbacks.showGameMessage("방이 사라졌습니다.", 200);
        this.gameCallbacks.returnToLobby(); // Go back to lobby/start screen
      }
    });
  }

  // Stop listening for game updates
  stop() {
    if (this.unsubscribeGame) {
      this.unsubscribeGame();
      this.unsubscribeGame = null;
      console.log("MultiplayerGameManager: Game listener stopped.");
    }
  }

  // Handle incoming game state from Firestore
  handleGameUpdate(gameData) {
    // Update local players array and myPlayerIndex
    this.localPlayers = gameData.players;
    this.myPlayerIndex = this.localPlayers.findIndex(
      (p) => p.nickname === this.myNickname,
    );

    // Update game state in liars-roulette.js
    this.gameCallbacks.updatePlayers(gameData.players); // Update players array in liars-roulette.js
    this.gameCallbacks.updateGameState(gameData); // Update core gameState object

    // Check if it's my turn
    this.isMyTurn = gameData.turnIndex === this.myPlayerIndex;
    this.gameCallbacks.setMyTurn(this.isMyTurn); // Enable/disable UI elements

    // Render game elements based on new state
    // this.gameCallbacks.renderGame(gameData); // The draw loop already handles this

    // Specific actions based on game phase
    if (gameData.status === "playing") {
      if (gameData.phase === "DEALING" && !this.gameCallbacks.isDealing()) {
        // If dealing hasn't started locally, initiate it
        this.gameCallbacks.startDealing();
      } else if (gameData.phase === "PLAYING") {
        // Handle turn-based actions
        this.gameCallbacks.updateGameStatus(); // Update status text
        // Check if it's an AI turn and I am the host
        if (this.gameCallbacks.checkAiTurn) {
          this.gameCallbacks.checkAiTurn();
        }
      } else if (gameData.phase === "RESOLVING") {
        // Challenge resolution
        // This part might need more specific callbacks if liars-roulette.js needs to show specific animations
        // For now, the general game state update should suffice for rendering
        this.gameCallbacks.triggerChallengeResolutionUI(
          gameData.challengerIndex,
          gameData.submitterIndex,
          gameData.isLie,
        );
      } else if (gameData.phase === "ROULETTE") {
        // Roulette animation
        if (gameData.victimIndices && gameData.victimIndices.length > 0) {
          this.gameCallbacks.triggerRoulette(gameData.victimIndices);
        }
      }
    } else if (gameData.status === "game_over") {
      this.gameCallbacks.showGameOverScreen(gameData.winner);
      this.stop(); // Game ended, stop listening
    }
  }

  // --- Player Actions (called from liars-roulette.js UI) ---

  async submitCards(playerIndex, cardIndices) {
    if (!this.isMyTurn) {
      this.gameCallbacks.showGameMessage("당신의 턴이 아닙니다.", 100);
      return;
    }

    try {
      await runTransaction(this.db, async (transaction) => {
        const roomDoc = await transaction.get(this.roomRef);
        if (!roomDoc.exists()) throw "Room does not exist.";
        const gameData = roomDoc.data();

        if (gameData.turnIndex !== playerIndex) throw "It's not your turn.";
        if (gameData.phase !== "PLAYING") throw "Game is not in PLAYING phase.";

        // Validate cards (e.g., ensure player has these cards)
        const playerHand = gameData.players[playerIndex].hand;
        const cardsToPlay = cardIndices.map((idx) => playerHand[idx]);
        // Basic validation: check if cards are actually in hand
        if (cardsToPlay.length !== cardIndices.length)
          throw "Invalid card selection.";

        // Devil card rule validation
        const hasDevil = cardsToPlay.some((c) => c.type === "D");
        const onlyDevil = cardsToPlay.every((c) => c.type === "D");
        if (hasDevil && !onlyDevil) {
          this.gameCallbacks.showGameMessage(
            "데빌 카드는 다른 카드와 함께 낼 수 없습니다.",
            150,
          );
          throw "Devil card cannot be played with other cards.";
        }

        // Update player's hand (remove played cards)
        const newPlayerHand = playerHand.filter(
          (_, idx) => !cardIndices.includes(idx),
        );
        gameData.players[playerIndex].hand = newPlayerHand;

        // Add cards to table
        gameData.tableCards = [
          ...gameData.tableCards,
          ...cardsToPlay.map((c) => ({ ...c, faceUp: false })),
        ];
        gameData.lastPlayedBatch = {
          playerIndex,
          cards: cardsToPlay.map((c) => c.type),
        };

        // Check for "last one playing cards" condition
        // If the current player has no cards left, and all *other* living players also have no cards,
        // then the current player is the loser (as they couldn't challenge).
        if (newPlayerHand.length === 0) {
          const livingPlayers = gameData.players.filter((p) => !p.isDead);
          const othersWithCards = livingPlayers.filter(
            (p, idx) => idx !== playerIndex && p.hand.length > 0,
          );

          if (othersWithCards.length === 0) {
            // This player is the last one to play cards, and all others also have no cards.
            // This player loses.
            gameData.phase = "RESOLVING"; // Set phase to resolving to trigger roulette
            gameData.loserIndex = playerIndex;
            gameData.isLie = false; // Not a lie, just a consequence of the rule
            gameData.challengerIndex = -1; // No challenger, just a game rule
            gameData.submitterIndex = playerIndex; // The player who submitted is the loser
            gameData.lastPlayedBatch = null; // Clear batch
            transaction.update(this.roomRef, gameData);
            return; // Exit transaction, roulette will be triggered by handleGameUpdate
          }
        }

        // Determine next turn
        let nextTurnIndex = gameData.turnIndex;
        let loopCount = 0;
        do {
          nextTurnIndex = (nextTurnIndex - 1 + 4) % 4; // Counter-clockwise
          loopCount++;
        } while (
          (gameData.players[nextTurnIndex].isDead ||
            (gameData.players[nextTurnIndex].hand.length === 0 &&
              gameData.players[nextTurnIndex].isAI)) && // AI can't play if no cards
          loopCount < 5
        );
        gameData.turnIndex = nextTurnIndex;
        gameData.turnCount = (gameData.turnCount || 0) + 1;

        // Update Firestore
        transaction.update(this.roomRef, gameData);
      });
      this.gameCallbacks.playSound("card");
      this.gameCallbacks.showGameMessage("카드를 제출했습니다.", 100);
    } catch (e) {
      console.error("Failed to submit cards:", e);
      this.gameCallbacks.showGameMessage("카드 제출 실패: " + e, 150);
    }
  }

  async challenge(challengerIndex) {
    if (!this.isMyTurn) {
      this.gameCallbacks.showGameMessage("당신의 턴이 아닙니다.", 100);
      return;
    }
    if (!this.gameCallbacks.canChallenge()) {
      // Check if there's a last played batch
      this.gameCallbacks.showGameMessage("도전할 수 없습니다.", 100);
      return;
    }

    try {
      await runTransaction(this.db, async (transaction) => {
        const roomDoc = await transaction.get(this.roomRef);
        if (!roomDoc.exists()) throw "Room does not exist.";
        const gameData = roomDoc.data();

        if (gameData.turnIndex !== challengerIndex)
          throw "It's not your turn to challenge.";
        if (gameData.phase !== "PLAYING") throw "Game is not in PLAYING phase.";
        if (!gameData.lastPlayedBatch)
          throw "No cards were played to challenge.";

        const lastPlayedCards = gameData.lastPlayedBatch.cards; // These are just types
        const submitterIndex = gameData.lastPlayedBatch.playerIndex;
        const currentRank = gameData.currentRank;

        // [수정] 1. 데빌 카드 효과를 먼저 체크하고 처리
        const hasDevil = lastPlayedCards.some((cardType) => cardType === "D");

        if (hasDevil) {
          // Devil card effect: all players except submitter go to roulette
          const victims = [];
          for (let i = 0; i < gameData.players.length; i++) {
            if (i === submitterIndex) {
              continue; // 제출자 제외
            }
            if (!gameData.players[i].isDead) {
              victims.push(i); // 살아있는 플레이어만 추가
            }
          }

          gameData.phase = "ROULETTE";
          gameData.victimIndices = victims;
          gameData.rouletteType = "devil"; // Custom type for devil card
          gameData.lastPlayedBatch = null; // Clear batch after resolution
          transaction.update(this.roomRef, gameData);
          return; // 데빌 카드 처리 후 종료
        }

        // [수정] 2. 데빌 카드가 아닐 경우에만 일반 거짓말 판정
        const isLie = lastPlayedCards.some(
          (cardType) => cardType !== currentRank && cardType !== "J",
        );

        // Normal challenge resolution
        let loserIndex;
        if (isLie) {
          loserIndex = submitterIndex;
        } else {
          loserIndex = challengerIndex;
        }

        gameData.phase = "RESOLVING"; // Set to resolving first, then ROULETTE after animations
        gameData.challengerIndex = challengerIndex;
        gameData.submitterIndex = submitterIndex;
        gameData.isLie = isLie;
        gameData.loserIndex = loserIndex;
        gameData.lastPlayedBatch = null; // Clear batch after resolution

        transaction.update(this.roomRef, gameData);
      });
      this.gameCallbacks.playSound("drama");
      this.gameCallbacks.showGameMessage("거짓말!", 100);
    } catch (e) {
      console.error("Failed to challenge:", e);
      this.gameCallbacks.showGameMessage("도전 실패: " + e, 150);
    }
  }

  // This function would be called by liars-roulette.js after roulette animation completes locally
  async handleRouletteCompletion(victimIndex, isBang) {
    try {
      await runTransaction(this.db, async (transaction) => {
        const roomDoc = await transaction.get(this.roomRef);
        if (!roomDoc.exists()) throw "Room does not exist.";
        const gameData = roomDoc.data();

        // Ensure this is the correct roulette to process
        if (gameData.phase !== "ROULETTE") return; // Already moved on or error

        const currentVictims = gameData.victimIndices;
        const processedVictim = currentVictims.shift(); // Remove the one just processed

        // [수정] 리볼버 약실 회전 (다음 칸으로 이동)
        if (!gameData.players[processedVictim].revolver) {
          gameData.players[processedVictim].revolver = {
            currentChamber: 0,
            bulletPosition: 0,
          };
        }
        gameData.players[processedVictim].revolver.currentChamber =
          (gameData.players[processedVictim].revolver.currentChamber + 1) % 6;

        if (isBang) {
          gameData.players[processedVictim].isDead = true;
        }

        // If there are more victims (e.g., Devil card), update and continue
        if (currentVictims.length > 0) {
          gameData.victimIndices = currentVictims;
          // Keep phase as ROULETTE, liars-roulette.js will trigger next roulette
        } else {
          // All victims processed, check win condition
          const survivors = gameData.players.filter((p) => !p.isDead);
          if (survivors.length <= 1) {
            gameData.status = "game_over";
            gameData.winner =
              survivors.length === 1 ? survivors[0].nickname : "No one";
          } else {
            // Start new round
            gameData.phase = "DEALING"; // Will trigger startRound in liars-roulette.js
            gameData.tableCards = [];
            gameData.lastPlayedBatch = null;
            gameData.turnCount = 0;
            gameData.currentRank = this.gameCallbacks.getRandomRank(); // Get new random rank
            gameData.deck = this.gameCallbacks.createDeck(); // Create new deck
            // Reset player hands (handled by liars-roulette.js startRound)
          }
          gameData.victimIndices = []; // Clear victims
          gameData.rouletteType = null;
        }
        transaction.update(this.roomRef, gameData);
      });
    } catch (e) {
      console.error("Failed to process roulette completion:", e);
    }
  }

  // Handle multiple roulette completions (e.g. Devil card)
  async handleBatchRouletteCompletion(results) {
    try {
      await runTransaction(this.db, async (transaction) => {
        const roomDoc = await transaction.get(this.roomRef);
        if (!roomDoc.exists()) throw "Room does not exist.";
        const gameData = roomDoc.data();

        if (gameData.phase !== "ROULETTE") return;

        // Apply deaths
        results.forEach((res) => {
          // [수정] 리볼버 약실 회전 (다음 칸으로 이동)
          if (!gameData.players[res.index].revolver) {
            gameData.players[res.index].revolver = {
              currentChamber: 0,
              bulletPosition: 0,
            };
          }
          gameData.players[res.index].revolver.currentChamber =
            (gameData.players[res.index].revolver.currentChamber + 1) % 6;

          if (res.isDead) {
            gameData.players[res.index].isDead = true;
          }
        });

        // Clear victims
        gameData.victimIndices = [];
        gameData.rouletteType = null;

        // Check win condition
        const survivors = gameData.players.filter((p) => !p.isDead);
        if (survivors.length <= 1) {
          gameData.status = "game_over";
          gameData.winner =
            survivors.length === 1 ? survivors[0].nickname : "No one";
        } else {
          // Start new round
          gameData.phase = "DEALING";
          gameData.tableCards = [];
          gameData.lastPlayedBatch = null;
          gameData.turnCount = 0;
          gameData.currentRank = this.gameCallbacks.getRandomRank();
          gameData.deck = this.gameCallbacks.createDeck();
          // Reset hands for living players
          gameData.players = gameData.players.map((p) => ({
            ...p,
            hand: p.isDead ? p.hand : [],
          }));
        }

        transaction.update(this.roomRef, gameData);
      });
    } catch (e) {
      console.error("Failed to process batch roulette completion:", e);
    }
  }

  // Host-only function to start the game (after lobby countdown)
  async hostStartGame(initialPlayers) {
    try {
      await runTransaction(this.db, async (transaction) => {
        const roomDoc = await transaction.get(this.roomRef);
        if (!roomDoc.exists()) throw "Room does not exist.";
        const gameData = roomDoc.data();

        if (gameData.status !== "starting")
          throw "Game is not in starting phase.";

        // [Multiplayer Fix] 호스트가 초기 카드 분배 수행
        const deck = this.gameCallbacks.createDeck();
        const playersWithHands = initialPlayers.map((p) => ({
          nickname: p.nickname,
          charIndex: p.charIndex,
          isAI: p.isAI || false,
          isDead: false,
          hand: [],
        }));

        // 카드 나누기 (5장씩)
        const totalCards = playersWithHands.length * 5;
        for (let i = 0; i < totalCards; i++) {
          const cardType = deck[i];
          const playerIndex = i % playersWithHands.length;
          playersWithHands[playerIndex].hand.push({
            type: cardType,
            faceUp: false,
          });
        }

        // Initialize game state
        const initialGameState = {
          status: "playing",
          phase: "DEALING", // Start with dealing phase
          turnIndex: 3, // South player starts (my player)
          currentRank: this.gameCallbacks.getRandomRank(),
          tableCards: [],
          lastPlayedBatch: null,
          turnCount: 0,
          victimIndices: [],
          rouletteType: null,
          deck: this.gameCallbacks.createDeck(), // Generate initial deck
          players: initialPlayers.map((p) => ({
            nickname: p.nickname,
            charIndex: p.charIndex,
            isAI: p.isAI || false,
            isDead: false,
            hand: [], // Hands will be dealt by liars-roulette.js
          })),
          deck: deck,
          players: playersWithHands,
        };
        transaction.update(this.roomRef, initialGameState);
      });
      console.log("MultiplayerGameManager: Game state initialized by host.");
    } catch (e) {
      console.error("Failed to initialize game state by host:", e);
      this.gameCallbacks.showGameMessage("게임 시작 실패: " + e, 200);
    }
  }

  // Host-only function to reset game state for a new round (after roulette or game over)
  async hostStartNewRound() {
    try {
      await runTransaction(this.db, async (transaction) => {
        const roomDoc = await transaction.get(this.roomRef);
        if (!roomDoc.exists()) throw "Room does not exist.";
        const currentData = roomDoc.data();

        // Filter out dead players for the new round
        const livingPlayers = currentData.players.filter((p) => !p.isDead);
        if (livingPlayers.length <= 1) {
          // Game over, no new round
          return;
        }

        // Find next turn index among living players
        let nextTurnIndex = currentData.turnIndex;
        let loopCount = 0;
        do {
          nextTurnIndex = (nextTurnIndex - 1 + 4) % 4; // Counter-clockwise
          loopCount++;
        } while (currentData.players[nextTurnIndex].isDead && loopCount < 5);

        // [Multiplayer Fix] 새 라운드 카드 분배
        const deck = this.gameCallbacks.createDeck();
        const nextPlayers = currentData.players.map((p) => ({
          ...p,
          hand: [],
        })); // 기존 핸드 초기화

        // 살아있는 플레이어 인덱스 찾기
        const survivorIndices = nextPlayers
          .map((p, idx) => ({ isDead: p.isDead, index: idx }))
          .filter((p) => !p.isDead)
          .map((p) => p.index);

        const totalCards = survivorIndices.length * 5;
        for (let i = 0; i < totalCards; i++) {
          const cardType = deck[i];
          const targetIndex = survivorIndices[i % survivorIndices.length];
          nextPlayers[targetIndex].hand.push({ type: cardType, faceUp: false });
        }

        const newGameState = {
          ...currentData, // Keep existing player data (isDead status)
          status: "playing",
          phase: "DEALING",
          turnIndex: nextTurnIndex,
          currentRank: this.gameCallbacks.getRandomRank(),
          tableCards: [],
          lastPlayedBatch: null,
          turnCount: 0,
          victimIndices: [],
          rouletteType: null,
          deck: this.gameCallbacks.createDeck(), // Generate new deck
          // Player hands will be reset and dealt by liars-roulette.js
          deck: deck,
          players: nextPlayers,
        };
        // Reset hands for living players
        newGameState.players = newGameState.players.map((p) => ({
          ...p,
          hand: p.isDead ? p.hand : [], // Keep dead players' hands as is, reset living players' hands
        }));

        transaction.update(this.roomRef, newGameState);
      });
      console.log("MultiplayerGameManager: New round started by host.");
    } catch (e) {
      console.error("Failed to start new round by host:", e);
      this.gameCallbacks.showGameMessage("새 라운드 시작 실패: " + e, 200);
    }
  }

  // Host-only function to update game phase (e.g. DEALING -> PLAYING)
  async hostUpdatePhase(newPhase) {
    try {
      await updateDoc(this.roomRef, { phase: newPhase });
    } catch (e) {
      console.error("Failed to update phase:", e);
    }
  }

  // Player leaving the game (switch to AI or remove)
  async leaveGame() {
    if (!this.roomId) return;
    try {
      await runTransaction(this.db, async (transaction) => {
        const roomDoc = await transaction.get(this.roomRef);
        if (!roomDoc.exists()) return;
        const data = roomDoc.data();
        const players = data.players || [];
        const myIndex = players.findIndex(
          (p) => p.nickname === this.myNickname,
        );

        if (myIndex === -1) return;

        if (data.status === "playing") {
          // Game in progress: Switch to AI
          players[myIndex].isAI = true;

          // If I was host, migrate host to the first human player
          if (players[myIndex].isHost) {
            players[myIndex].isHost = false;
            const newHost = players.find(
              (p) => !p.isAI && p.nickname !== this.myNickname,
            );
            if (newHost) {
              newHost.isHost = true;
            }
          }
          transaction.update(this.roomRef, { players: players });
        } else {
          // Waiting: Remove player
          const newPlayers = players.filter(
            (p) => p.nickname !== this.myNickname,
          );
          // If I was host, migrate
          if (players[myIndex].isHost && newPlayers.length > 0) {
            newPlayers[0].isHost = true;
          }
          if (newPlayers.length === 0) {
            transaction.delete(this.roomRef); // Delete room if empty
          } else {
            transaction.update(this.roomRef, { players: newPlayers });
          }
        }
      });
    } catch (e) {
      console.error("Error leaving game:", e);
    }
  }
}

export default MultiplayerGameManager;
