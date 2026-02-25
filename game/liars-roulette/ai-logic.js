--- /dev/null
+++ c:\project\kdy20716-droid.github.io\game\liars-roulette\ai-logic.js
@@ -0,0 +1,114 @@
+export function processAiTurn(params) {
+  const {
+    gameState,
+    players,
+    isMultiplayerGame,
+    isHost,
+    myPlayerIndex,
+    sendGameAction,
+    submitCards,
+    challenge,
+    showBubble,
+    addTimeout,
+  } = params;
+
+  const aiIndex = gameState.turnIndex;
+  const aiPlayer = players[aiIndex];
+
+  if (isMultiplayerGame && !isHost) return;
+  if (isMultiplayerGame && !aiPlayer.isAI) return;
+
+  const thinkingTime = Math.random() * 2000 + 2000;
+
+  let serverAiIndex = aiIndex;
+  if (isMultiplayerGame) {
+    const offset = (3 - aiIndex + 4) % 4;
+    serverAiIndex = (myPlayerIndex + offset) % 4;
+  }
+
+  addTimeout(() => {
+    if (gameState.lastPlayedBatch && Math.random() < 0.5) {
+      const reactionPhrases = ["의심스러운데...", "설마?", "자신있어?"];
+      showBubble(
+        aiIndex,
+        reactionPhrases[Math.floor(Math.random() * reactionPhrases.length)],
+      );
+    }
+
+    addTimeout(() => {
+      let challengeChance = 0.2 + gameState.tableCards.length * 0.01;
+
+      const othersWithCards = players.filter(
+        (p) => !p.isDead && p !== aiPlayer && p.hand.length > 0,
+      );
+      if (othersWithCards.length === 0) challengeChance = 1.0;
+
+      if (gameState.lastPlayedBatch && Math.random() < challengeChance) {
+        const phrases = ["거짓말!", "까봐!", "너 죽고 나죽자!"];
+        showBubble(
+          aiIndex,
+          phrases[Math.floor(Math.random() * phrases.length)],
+        );
+        console.log(`${aiPlayer.name} challenges!`);
+        if (isMultiplayerGame) {
+          sendGameAction("CHALLENGE", {}, serverAiIndex);
+        } else {
+          challenge();
+        }
+        return;
+      }
+
+      const validIndices = [];
+      const invalidIndices = [];
+      aiPlayer.hand.forEach((card, index) => {
+        if (
+          card.type === gameState.currentRank ||
+          card.type === "J" ||
+          card.type === "D"
+        ) {
+          validIndices.push(index);
+        } else {
+          invalidIndices.push(index);
+        }
+      });
+
+      let indicesToPlay = [];
+      const truthChance = 0.5;
+
+      if (validIndices.length > 0 && Math.random() < truthChance) {
+        const count = Math.min(
+          validIndices.length,
+          Math.floor(Math.random() * 3) + 1,
+        );
+        const devilIndices = validIndices.filter(
+          (idx) => aiPlayer.hand[idx].type === "D",
+        );
+        if (devilIndices.length > 0) {
+          indicesToPlay = devilIndices;
+        } else {
+          indicesToPlay = validIndices.slice(0, count);
+        }
+        const phrases = ["들어오시던지!", "쫄려?", "믿어줘"];
+        showBubble(
+          aiIndex,
+          phrases[Math.floor(Math.random() * phrases.length)],
+        );
+      } else {
+        const count = Math.min(
+          aiPlayer.hand.length,
+          Math.floor(Math.random() * 3) + 1,
+        );
+        const allIndices = validIndices.concat(invalidIndices);
+        for (let i = allIndices.length - 1; i > 0; i--) {
+          const j = Math.floor(Math.random() * (i + 1));
+          [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
+        }
+        indicesToPlay = allIndices.slice(0, count);
+        const selectedCards = indicesToPlay.map((idx) => aiPlayer.hand[idx]);
+        const hasDevil = selectedCards.some((c) => c.type === "D");
+        if (hasDevil) {
+          indicesToPlay = indicesToPlay.filter(
+            (idx) => aiPlayer.hand[idx].type === "D",
+          );
+        }
+        const phrases = ["들어오시던지!", "쫄려?", "믿어줘"];
+        showBubble(
+          aiIndex,
+          phrases[Math.floor(Math.random() * phrases.length)],
+        );
+      }
+
+      if (indicesToPlay.length === 0 && aiPlayer.hand.length > 0) {
+        indicesToPlay.push(0);
+      }
+
+      if (isMultiplayerGame) {
+        sendGameAction("SUBMIT", { cardIndices: indicesToPlay }, serverAiIndex);
+      } else {
+        submitCards(aiIndex, indicesToPlay);
+      }
+    }, 1500);
+  }, thinkingTime);
+}
