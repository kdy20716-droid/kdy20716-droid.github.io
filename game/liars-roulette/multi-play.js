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
    this.lastTurnCount = -1; // Track turn count to detect card plays
    this.lastPhase = null; // Track last phase to trigger transitions once
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
    try {
      // Update local players array and myPlayerIndex
      this.localPlayers = gameData.players || [];
      this.myPlayerIndex = this.localPlayers.findIndex(
        (p) => p.nickname === this.myNickname,
      );
      const amIHost = this.localPlayers[this.myPlayerIndex]?.isHost;

      // Update game state in liars-roulette.js
      this.gameCallbacks.updatePlayers(gameData.players); // Update players array in liars-roulette.js
      this.gameCallbacks.updateGameState(gameData); // Update core gameState object

      // Detect card play (turn count increased)
      if (
        this.lastTurnCount !== -1 &&
        gameData.turnCount > this.lastTurnCount
      ) {
        if (gameData.lastPlayedBatch) {
          this.gameCallbacks.handleCardPlay(gameData.lastPlayedBatch);
        }
      }
      this.lastTurnCount = gameData.turnCount;

      // Check if it's my turn
      this.isMyTurn = gameData.turnIndex === this.myPlayerIndex;
      this.gameCallbacks.setMyTurn(this.isMyTurn); // Enable/disable UI elements

      // Specific actions based on game phase
      if (gameData.status === "playing") {
        // Only trigger phase transition logic if phase changed
        if (gameData.phase !== this.lastPhase) {
          if (gameData.phase === "DEALING" && !this.gameCallbacks.isDealing()) {
            this.gameCallbacks.startDealing();
          } else if (gameData.phase === "RESOLVING") {
            if (
              gameData.challengerIndex === -1 &&
              gameData.submitterIndex !== -1
            ) {
              // Last player failed case
              const loserName =
                this.localPlayers[gameData.submitterIndex].nickname;
              this.gameCallbacks.showGameMessage(
                `${loserName}이(가) 카드를 모두 털지 못했습니다!`,
                150,
              );
            } else {
              this.gameCallbacks.triggerChallengeResolutionUI(
                gameData.challengerIndex,
                gameData.submitterIndex,
                gameData.isLie,
              );
            }

            // Host triggers transition to ROULETTE after delay
            if (amIHost) {
              setTimeout(() => {
                this.hostProceedToRoulette(gameData.loserIndex);
              }, 3000);
            }
          } else if (gameData.phase === "ROULETTE") {
            if (gameData.victimIndices && gameData.victimIndices.length > 0) {
              if (gameData.rouletteType === "devil") {
                this.gameCallbacks.triggerDevilEffects();
                setTimeout(() => {
                  this.gameCallbacks.triggerRoulette(gameData.victimIndices);
                }, 2000);
              } else {
                this.gameCallbacks.triggerRoulette(gameData.victimIndices);
              }
            }
          }
        }

        // Continuous updates
        if (gameData.phase === "PLAYING") {
          this.gameCallbacks.updateGameStatus(); // Update status text
          // Check if it's an AI turn and I am the host
          if (this.gameCallbacks.checkAiTurn) {
            this.gameCallbacks.checkAiTurn();
          }
        } else if (gameData.phase === "DEALING") {
          // If dealing is stuck or finished, ensure we move to playing if host
          if (amIHost && !this.gameCallbacks.isDealing()) {
            // This might be redundant if updateDealing handles it, but good for safety
          }
        }
      } else if (gameData.status === "game_over") {
        this.gameCallbacks.showGameOverScreen(gameData.winner);
        this.stop(); // Game ended, stop listening
      }
      this.lastPhase = gameData.phase;
    } catch (e) {
      console.error("Error in handleGameUpdate:", e);
    }
  }

  async hostProceedToRoulette(loserIndex) {
    try {
      await runTransaction(this.db, async (transaction) => {
        const roomDoc = await transaction.get(this.roomRef);
        if (!roomDoc.exists()) throw "Room does not exist.";
        const gameData = roomDoc.data();

        if (gameData.phase !== "RESOLVING") return;

        gameData.phase = "ROULETTE";
        // If victimIndices is not set (normal challenge), set it using loserIndex
        if (!gameData.victimIndices || gameData.victimIndices.length === 0) {
          gameData.victimIndices = [loserIndex];
        }

        transaction.update(this.roomRef, gameData);
      });
    } catch (e) {
      console.error("Failed to proceed to roulette:", e);
    }
  }

  // --- Player Actions (called from liars-roulette.js UI) ---

  async submitCards(playerIndex, cardIndices) {
    const isMe = playerIndex === this.myPlayerIndex;
    const isAi = this.localPlayers[playerIndex]?.isAI;
    const amIHost = this.localPlayers[this.myPlayerIndex]?.isHost;

    if (!isMe && !(isAi && amIHost)) {
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
          const othersWithCards = gameData.players.filter(
            (p, idx) => !p.isDead && idx !== playerIndex && p.hand.length > 0,
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
          nextTurnIndex = (nextTurnIndex + 1) % 4; // Clockwise (0->1->2->3)
          loopCount++;
        } while (
          (gameData.players[nextTurnIndex].isDead ||
            (gameData.phase === "PLAYING" &&
              gameData.players[nextTurnIndex].hand.length === 0)) &&
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
    const isMe = challengerIndex === this.myPlayerIndex;
    const isAi = this.localPlayers[challengerIndex]?.isAI;
    const amIHost = this.localPlayers[this.myPlayerIndex]?.isHost;

    if (!isMe && !(isAi && amIHost)) {
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

        // Reveal cards in tableCards
        const lastBatchCount = lastPlayedCards.length;
        const totalTableCards = gameData.tableCards.length;
        for (
          let i = totalTableCards - lastBatchCount;
          i < totalTableCards;
          i++
        ) {
          if (i >= 0) {
            gameData.tableCards[i].faceUp = true;
          }
        }

        if (hasDevil) {
          // Devil card effect: all players except submitter go to roulette
          const victims = gameData.players
            .map((p, idx) => idx)
            .filter(
              (idx) => idx !== submitterIndex && !gameData.players[idx].isDead,
            );
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
  async handleRouletteCompletion(victimServerIndex, isBang) {
    // Only Host updates the game state to avoid race conditions
    if (!this.localPlayers[this.myPlayerIndex]?.isHost) return;

    try {
      await runTransaction(this.db, async (transaction) => {
        const roomDoc = await transaction.get(this.roomRef);
        if (!roomDoc.exists()) throw "Room does not exist.";
        const gameData = roomDoc.data();

        // Ensure this is the correct roulette to process
        if (gameData.phase !== "ROULETTE") return; // Already moved on or error

        const currentVictims = gameData.victimIndices;
        // Safety check: if victims are empty, stop to prevent crash
        if (!currentVictims || currentVictims.length === 0) return;

        const processedVictim = currentVictims.shift(); // Remove the one just processed

        // Update revolver state (advance chamber)
        const player = gameData.players[processedVictim];
        if (player.revolver) {
          player.revolver.currentChamber =
            (player.revolver.currentChamber + 1) % 6;
        }

        if (isBang) {
          player.isDead = true;
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
            // 1. Find next turn (skip dead players)
            let nextTurnIndex = gameData.turnIndex;
            let loopCount = 0;
            do {
              nextTurnIndex = (nextTurnIndex + 1) % 4;
              loopCount++;
            } while (gameData.players[nextTurnIndex].isDead && loopCount < 5);

            // 2. Deal new cards
            const deck = this.gameCallbacks.createDeck();
            const livingCount = survivors.length;
            const hands = new Array(4).fill(null).map(() => []);
            const livingIndices = gameData.players
              .map((p, i) => i)
              .filter((i) => !gameData.players[i].isDead);

            for (let c = 0; c < livingCount * 5; c++) {
              const targetServerIndex = livingIndices[c % livingCount];
              hands[targetServerIndex].push({ type: deck[c], faceUp: false });
            }

            // 3. Update Game Data
            gameData.phase = "DEALING";
            gameData.turnIndex = nextTurnIndex;
            gameData.currentRank = this.gameCallbacks.getRandomRank();
            gameData.tableCards = [];
            gameData.lastPlayedBatch = null;
            gameData.turnCount = 0;
            gameData.victimIndices = [];
            gameData.rouletteType = null;
            gameData.deck = deck;
            gameData.players = gameData.players.map((p, i) => ({
              ...p,
              hand: p.isDead ? p.hand : hands[i],
              // Keep revolver state
            }));
          }
        }
        transaction.update(this.roomRef, gameData);
      });
    } catch (e) {
      console.error("Failed to process roulette completion:", e);
    }
  }

  // Handle multiple roulette completions (e.g. Devil card)
  async handleBatchRouletteCompletion(results) {
    // Only Host updates the game state
    if (!this.localPlayers[this.myPlayerIndex]?.isHost) return;

    try {
      await runTransaction(this.db, async (transaction) => {
        const roomDoc = await transaction.get(this.roomRef);
        if (!roomDoc.exists()) throw "Room does not exist.";
        const gameData = roomDoc.data();

        if (gameData.phase !== "ROULETTE") return;

        // Apply deaths
        results.forEach((res) => {
          const player = gameData.players[res.index];
          if (player.revolver) {
            player.revolver.currentChamber =
              (player.revolver.currentChamber + 1) % 6;
          }

          if (res.isDead) {
            player.isDead = true;
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
          // 1. Find next turn (skip dead players)
          let nextTurnIndex = gameData.turnIndex;
          let loopCount = 0;
          do {
            nextTurnIndex = (nextTurnIndex + 1) % 4;
            loopCount++;
          } while (gameData.players[nextTurnIndex].isDead && loopCount < 5);

          // 2. Deal new cards
          const deck = this.gameCallbacks.createDeck();
          const livingCount = survivors.length;
          const hands = new Array(4).fill(null).map(() => []);
          const livingIndices = gameData.players
            .map((p, i) => i)
            .filter((i) => !gameData.players[i].isDead);

          for (let c = 0; c < livingCount * 5; c++) {
            const targetServerIndex = livingIndices[c % livingCount];
            hands[targetServerIndex].push({ type: deck[c], faceUp: false });
          }

          gameData.phase = "DEALING";
          gameData.turnIndex = nextTurnIndex;
          gameData.tableCards = [];
          gameData.lastPlayedBatch = null;
          gameData.turnCount = 0;
          gameData.currentRank = this.gameCallbacks.getRandomRank();
          gameData.deck = deck;
          // Reset hands for living players
          gameData.players = gameData.players.map((p, i) => ({
            ...p,
            hand: p.isDead ? p.hand : hands[i],
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

        // Deal cards
        const deck = this.gameCallbacks.createDeck();
        const playersWithHand = initialPlayers.map((p, i) => {
          const hand = [];
          for (let j = 0; j < 5; j++) {
            // Round-robin dealing: Card 0 to P0, Card 1 to P1...
            hand.push({ type: deck[j * 4 + i], faceUp: false });
          }
          return {
            nickname: p.nickname,
            charIndex: p.charIndex,
            isAI: p.isAI || false,
            isHost: p.isHost || false,
            isDead: false,
            hand: hand,
            revolver: {
              currentChamber: 0,
              bulletPosition: Math.floor(Math.random() * 6),
            },
          };
        });

        // Initialize game state
        const initialGameState = {
          status: "playing",
          phase: "DEALING", // Start with dealing phase
          turnIndex: 0, // Host (index 0) starts
          currentRank: this.gameCallbacks.getRandomRank(),
          tableCards: [],
          lastPlayedBatch: null,
          turnCount: 0,
          victimIndices: [],
          rouletteType: null,
          deck: deck, // Generate initial deck
          players: playersWithHand,
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
          nextTurnIndex = (nextTurnIndex + 1) % 4; // Clockwise
          loopCount++;
        } while (currentData.players[nextTurnIndex].isDead && loopCount < 5);

        const deck = this.gameCallbacks.createDeck();
        const livingCount = livingPlayers.length;
        const hands = new Array(currentData.players.length)
          .fill(null)
          .map(() => []);

        // Deal cards to living players (Round-robin)
        const livingIndices = currentData.players
          .map((p, i) => i)
          .filter((i) => !currentData.players[i].isDead);

        for (let c = 0; c < livingCount * 5; c++) {
          const targetServerIndex = livingIndices[c % livingCount];
          hands[targetServerIndex].push({ type: deck[c], faceUp: false });
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
          deck: deck, // Generate new deck
          // Reset hands for living players
          players: currentData.players.map((p, i) => ({
            ...p,
            hand: p.isDead ? p.hand : hands[i],
            revolver: p.isDead
              ? p.revolver
              : {
                  currentChamber: 0,
                  bulletPosition: Math.floor(Math.random() * 6),
                },
          })),
        };

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
            const newHost = players.find((p) => !p.isAI);
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
