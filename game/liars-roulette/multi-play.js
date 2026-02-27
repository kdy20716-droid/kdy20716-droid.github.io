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
      } else if (gameData.phase === "RESOLVING") {
        // Challenge resolution
        // This part might need more specific callbacks if liars-roulette.js needs to show specific animations
        // For now, the general game state update should suffice for rendering
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

  async submitCards(playerIndex, cardIndices, cardTypes) {
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
        }; // Store only types for simplicity

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

        // Determine if it was a lie
        const isLie = lastPlayedCards.some(
          (cardType) =>
            cardType !== currentRank && cardType !== "J" && cardType !== "D",
        );

        // Check for Devil card
        const hasDevil = lastPlayedCards.some((cardType) => cardType === "D");

        if (hasDevil) {
          // Devil card effect: all players except submitter go to roulette
          const victims = gameData.players
            .filter((p, idx) => idx !== submitterIndex && !p.isDead)
            .map((p, idx) => idx);
          gameData.phase = "ROULETTE";
          gameData.victimIndices = victims;
          gameData.rouletteType = "devil"; // Custom type for devil card
          gameData.lastPlayedBatch = null; // Clear batch after resolution
          transaction.update(this.roomRef, gameData);
          return;
        }

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

  // Host-only function to start the game (after lobby countdown)
  async hostStartGame(initialPlayers) {
    try {
      await runTransaction(this.db, async (transaction) => {
        const roomDoc = await transaction.get(this.roomRef);
        if (!roomDoc.exists()) throw "Room does not exist.";
        const gameData = roomDoc.data();

        if (gameData.status !== "starting")
          throw "Game is not in starting phase.";

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
}

export default MultiplayerGameManager;
