import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "../suika/firebaseConfig.js";

// Firebase 초기화 (수박게임/라이어스룰렛과 동일한 프로젝트 공유)
let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("Firebase Firestore initialized for Yacht Dice.");
} catch (e) {
  console.error("Firebase 초기화 실패:", e);
}

// 기본 DOM 요소
const startScreen = document.getElementById("start-screen");
const multiMenuScreen = document.getElementById("multi-menu-screen");
const gameScreen = document.getElementById("game-screen");

// 메인 화면 버튼
const btnStart = document.getElementById("btn-start");
const localModeSelect = document.getElementById("local-mode-select");
const btn1p = document.getElementById("btn-1p");
const btn2pLocal = document.getElementById("btn-2p-local");
const btnMulti = document.getElementById("btn-multi");
const btnBackMenu = document.getElementById("btn-back-menu");

// 멀티 화면 요소
const multiMainButtons = document.getElementById("multi-main-buttons");
const multiWaitingArea = document.getElementById("multi-waiting-area");
const waitingCodeText = document.getElementById("waiting-code-text");
const btnCancelWaiting = document.getElementById("btn-cancel-waiting");
const roomCodeInput = document.getElementById("room-code-input");
const btnBackMulti = document.getElementById("btn-back-multi");
const btnCreateRoom = document.getElementById("btn-create-room");
const btnJoinRoom = document.getElementById("btn-join-room");
const multiStatus = document.getElementById("multi-status");

// 게임 헤더 요소
const p1Header = document.getElementById("p1-header");
const p2Header = document.getElementById("p2-header");

// 게임 시작 클릭 시 2인용 로컬 모드로 바로 시작
btnStart.addEventListener("click", () => {
  startGame("2p_local");
});

// 2P 게임 시작
if (btn2pLocal) {
  btn2pLocal.addEventListener("click", () => {
    startGame("2p_local");
  });
}

// 멀티플레이 메뉴 진입
btnMulti.addEventListener("click", () => {
  startScreen.classList.add("hidden");
  multiMenuScreen.classList.remove("hidden");
  if (multiMainButtons) multiMainButtons.classList.remove("hidden");
  if (multiWaitingArea) multiWaitingArea.classList.add("hidden");
  if (multiStatus) multiStatus.textContent = "";
  if (roomCodeInput) roomCodeInput.value = "";
});

// 멀티 화면에서 뒤로가기
btnBackMulti.addEventListener("click", () => {
  cleanupRoom();
  multiMenuScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
});

// 메인 화면에서 뒤로가기 (게임 리스트로 돌아가기)
btnBackMenu.addEventListener("click", () => {
  window.location.href = "../game-list.html";
});

// 게임 상태 변수
let currentMode = "2p_local"; // "2p_local", "multi"
let currentPlayer = 1;
let currentRound = 1;
const MAX_ROUNDS = 12;
let dice = [1, 1, 1, 1, 1];
let held = [false, false, false, false, false];
let rollsLeft = 3;
let isRolling = false;

// 멀티플레이 전용 변수
let currentRoomId = null;
let myPlayerNumber = null; // 1 (방장) or 2 (참가자)
let isMyTurn = false;
let roomUnsubscribe = null;
let lastProcessedActionId = null;

// 로컬 2P 점수 상태
let localScores = { 1: {}, 2: {} };

const btnRoll = document.getElementById("btn-roll");
const diceContainer = document.getElementById("dice-container");
const scoreTbody = document.getElementById("score-tbody");
const btnIngameBack = document.getElementById("btn-ingame-back");
const turnIndicator = document.getElementById("turn-indicator");

function startGame(mode) {
  currentMode = mode;
  currentPlayer = 1;
  currentRound = 1;
  rollsLeft = 3;
  held = [false, false, false, false, false];
  localScores = { 1: {}, 2: {} };
  lastProcessedActionId = null;

  startScreen.classList.add("hidden");
  multiMenuScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  if (currentMode === "multi") {
    if (p1Header) p1Header.textContent = myPlayerNumber === 1 ? "1P (나)" : "1P (상대)";
    if (p2Header) p2Header.textContent = myPlayerNumber === 2 ? "2P (나)" : "2P (상대)";
    isMyTurn = (currentPlayer === myPlayerNumber);
  } else {
    if (p1Header) p1Header.textContent = "1P";
    if (p2Header) p2Header.textContent = "2P";
    isMyTurn = true;
  }

  initBoard();
  updateTurnIndicator();
  resetDiceDisplay();
}

// 인게임 화면에서 나가기
if (btnIngameBack) {
  btnIngameBack.addEventListener("click", () => {
    if (currentMode === "multi") {
      if (confirm("게임을 나가시겠습니까? 진행 중인 멀티플레이가 종료됩니다.")) {
        leaveMultiplayerGame();
      }
    } else {
      gameScreen.classList.add("hidden");
      startScreen.classList.remove("hidden");
    }
  });
}

// 요트 다이스 카테고리 정의
const categories = [
  { id: "aces", name: "Aces" },
  { id: "deuces", name: "Deuces" },
  { id: "threes", name: "Threes" },
  { id: "fours", name: "Fours" },
  { id: "fives", name: "Fives" },
  { id: "sixes", name: "Sixes" },
  { id: "bonus", name: "Bonus (+35)", readonly: true },
  { id: "choice", name: "Choice" },
  { id: "4ok", name: "4 of a Kind" },
  { id: "fh", name: "Full House" },
  { id: "ss", name: "S. Straight" },
  { id: "ls", name: "L. Straight" },
  { id: "yacht", name: "Yacht" },
  { id: "total", name: "Total", readonly: true }
];

// 주사위 면별 3D 회전 각도
const cubeRotations = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: 0, y: -90 },
  5: { x: 0, y: 90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 }
};

// ==========================================
// [1] 보드 및 주사위 DOM 초기화
// ==========================================
function initBoard() {
  diceContainer.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const wrapper = document.createElement("div");
    wrapper.className = "die-wrapper";
    wrapper.dataset.index = i;
    wrapper.addEventListener("click", () => handleHoldClick(i));

    const scene = document.createElement("div");
    scene.className = "scene";

    const cube = document.createElement("div");
    cube.className = "cube";
    cube.id = `cube-${i}`;

    [1, 6, 2, 5, 3, 4].forEach((val) => {
      const face = document.createElement("div");
      face.className = `cube__face face-${val}`;
      face.innerHTML = getDiceSVG(val);
      cube.appendChild(face);
    });

    scene.appendChild(cube);
    wrapper.appendChild(scene);
    diceContainer.appendChild(wrapper);
  }

  scoreTbody.innerHTML = "";
  categories.forEach((cat) => {
    const tr = document.createElement("tr");
    const isBonus = cat.id === "bonus";
    const initText = isBonus ? "0/63" : "";
    const extraStyle = isBonus ? "style='color: #9e9e9e; font-size: 0.9em;'" : "";
    if (isBonus) {
      tr.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
    }
    tr.innerHTML = `
      <td>${cat.name}</td>
      <td class="score-cell p1-score" data-cat="${cat.id}" ${extraStyle}>${initText}</td>
      <td class="score-cell p2-score" data-cat="${cat.id}" ${extraStyle}>${initText}</td>
    `;
    scoreTbody.appendChild(tr);
  });
}

// 주사위 눈금 SVG 생성
function getDiceSVG(val) {
  const dots = {
    1: ['<circle cx="35" cy="35" r="8" fill="#e74c3c" />'],
    2: ['<circle cx="20" cy="20" r="6" fill="#333" />', '<circle cx="50" cy="50" r="6" fill="#333" />'],
    3: ['<circle cx="20" cy="20" r="6" fill="#333" />', '<circle cx="35" cy="35" r="6" fill="#333" />', '<circle cx="50" cy="50" r="6" fill="#333" />'],
    4: ['<circle cx="20" cy="20" r="6" fill="#333" />', '<circle cx="50" cy="20" r="6" fill="#333" />', '<circle cx="20" cy="50" r="6" fill="#333" />', '<circle cx="50" cy="50" r="6" fill="#333" />'],
    5: ['<circle cx="20" cy="20" r="6" fill="#333" />', '<circle cx="50" cy="20" r="6" fill="#333" />', '<circle cx="35" cy="35" r="6" fill="#333" />', '<circle cx="20" cy="50" r="6" fill="#333" />', '<circle cx="50" cy="50" r="6" fill="#333" />'],
    6: ['<circle cx="20" cy="15" r="6" fill="#333" />', '<circle cx="50" cy="15" r="6" fill="#333" />', '<circle cx="20" cy="35" r="6" fill="#333" />', '<circle cx="50" cy="35" r="6" fill="#333" />', '<circle cx="20" cy="55" r="6" fill="#333" />', '<circle cx="50" cy="55" r="6" fill="#333" />']
  };
  return `<svg width="70" height="70" viewBox="0 0 70 70">${dots[val].join("")}</svg>`;
}

// 주사위 표시 초기화 (새 턴 시작 시)
function resetDiceDisplay() {
  rollsLeft = 3;
  held = [false, false, false, false, false];
  isRolling = false;

  const wrappers = document.querySelectorAll(".die-wrapper");
  wrappers.forEach((w, i) => {
    w.classList.remove("held");
    const initialVal = dice[i] || 1;
    const cube = document.getElementById(`cube-${i}`);
    if (cube) {
      cube.style.transition = "none";
      const rot = cubeRotations[initialVal];
      cube.style.transform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg) rotateZ(0deg)`;
      cube.dataset.rotX = rot.x;
      cube.dataset.rotY = rot.y;
      cube.dataset.rotZ = 0;
      void cube.offsetWidth;
      cube.style.transition = "transform 1s cubic-bezier(0.2, 0.8, 0.2, 1)";
    }
  });

  updateRollButtonState();
  clearScorePreviews();
}

function updateTurnIndicator() {
  if (!turnIndicator) return;
  if (currentMode === "multi") {
    if (isMyTurn) {
      turnIndicator.textContent = `[내 턴] ${myPlayerNumber}P (${currentRound}/${MAX_ROUNDS} 라운드)`;
      turnIndicator.style.color = "#2ecc71";
    } else {
      const opp = myPlayerNumber === 1 ? 2 : 1;
      turnIndicator.textContent = `[상대방 턴] ${opp}P (${currentRound}/${MAX_ROUNDS} 라운드)`;
      turnIndicator.style.color = "#e74c3c";
    }
  } else {
    turnIndicator.textContent = `${currentPlayer}P 턴 (${currentRound}/${MAX_ROUNDS} 라운드)`;
    turnIndicator.style.color = "#f1c40f";
  }
}

function updateRollButtonState() {
  if (!btnRoll) return;

  if (currentMode === "multi") {
    if (!isMyTurn) {
      btnRoll.textContent = "상대방 턴 대기 중";
      btnRoll.disabled = true;
      return;
    }
  }

  btnRoll.textContent = `주사위 굴리기 (${rollsLeft})`;
  btnRoll.disabled = rollsLeft <= 0 || isRolling;
}

function clearScorePreviews() {
  document.querySelectorAll(".score-cell.preview-score").forEach((cell) => {
    cell.textContent = "";
    cell.classList.remove("preview-score");
  });
}

// ==========================================
// [2] 주사위 인터랙션 (킵 & 굴리기)
// ==========================================
function handleHoldClick(index) {
  if (isRolling) return;
  if (rollsLeft >= 3) return; // 굴리기 전에는 킵 불가

  if (currentMode === "multi") {
    if (!isMyTurn) return; // 상대 턴에는 킵 불가
    held[index] = !held[index];
    updateHeldUI();

    // Firestore에 킵 상태 즉시 동기화
    if (currentRoomId) {
      updateDoc(doc(db, "yacht_rooms", currentRoomId), {
        held: held,
        lastAction: {
          type: "hold",
          by: myPlayerNumber,
          held: held,
          id: Date.now()
        }
      }).catch(console.error);
    }
  } else {
    held[index] = !held[index];
    updateHeldUI();
  }
}

function updateHeldUI() {
  const wrappers = document.querySelectorAll(".die-wrapper");
  wrappers.forEach((w, i) => {
    if (held[i]) {
      w.classList.add("held");
    } else {
      w.classList.remove("held");
    }
  });
}

btnRoll.addEventListener("click", () => {
  if (rollsLeft <= 0 || isRolling) return;
  if (currentMode === "multi" && !isMyTurn) return;

  rollsLeft--;
  updateRollButtonState();

  const newDice = [...dice];
  for (let i = 0; i < 5; i++) {
    if (!held[i]) {
      newDice[i] = Math.floor(Math.random() * 6) + 1;
    }
  }

  if (currentMode === "multi") {
    if (currentRoomId) {
      const actionId = Date.now();
      lastProcessedActionId = actionId;

      updateDoc(doc(db, "yacht_rooms", currentRoomId), {
        dice: newDice,
        rollsLeft: rollsLeft,
        lastAction: {
          type: "roll",
          by: myPlayerNumber,
          dice: newDice,
          held: held,
          rollsLeft: rollsLeft,
          id: actionId
        }
      }).catch(console.error);
    }
  }

  dice = newDice;
  animateDiceRoll(newDice, held, () => {
    if (currentMode === "multi" ? isMyTurn : true) {
      updateScorePreview();
    }
  });
});

// 3D 굴리기 애니메이션
function animateDiceRoll(targetDice, targetHeld, callback) {
  isRolling = true;
  btnRoll.disabled = true;
  clearScorePreviews();

  for (let i = 0; i < 5; i++) {
    if (!targetHeld[i]) {
      const finalVal = targetDice[i];
      const cube = document.getElementById(`cube-${i}`);
      if (!cube) continue;

      const currentX = cube.dataset.rotX ? parseInt(cube.dataset.rotX) : 0;
      const currentY = cube.dataset.rotY ? parseInt(cube.dataset.rotY) : 0;
      const currentZ = cube.dataset.rotZ ? parseInt(cube.dataset.rotZ) : 0;

      const baseXPins = Math.floor(currentX / 360) * 360;
      const baseYPins = Math.floor(currentY / 360) * 360;
      const baseZPins = Math.floor(currentZ / 360) * 360;

      const extraX = (Math.floor(Math.random() * 3) + 2) * 360;
      const extraY = (Math.floor(Math.random() * 3) + 2) * 360;
      const extraZ = (Math.floor(Math.random() * 3) + 2) * 360;

      const targetX = baseXPins + extraX + cubeRotations[finalVal].x;
      const targetY = baseYPins + extraY + cubeRotations[finalVal].y;
      const targetZ = baseZPins + extraZ;

      cube.style.transform = `rotateX(${targetX}deg) rotateY(${targetY}deg) rotateZ(${targetZ}deg)`;
      cube.dataset.rotX = targetX;
      cube.dataset.rotY = targetY;
      cube.dataset.rotZ = targetZ;
    }
  }

  setTimeout(() => {
    isRolling = false;
    updateRollButtonState();
    if (callback) callback();
  }, 1000);
}

// ==========================================
// [3] 점수 계산 및 선택 로직
// ==========================================
function calculateScores(currentDice) {
  const scores = {};
  const counts = [0, 0, 0, 0, 0, 0];
  currentDice.forEach((d) => counts[d - 1]++);
  const sum = currentDice.reduce((a, b) => a + b, 0);

  // Upper section (Aces ~ Sixes)
  for (let i = 0; i < 6; i++) {
    scores[categories[i].id] = counts[i] * (i + 1);
  }

  // Choice
  scores.choice = sum;

  // 4 of a Kind
  scores["4ok"] = counts.some((c) => c >= 4) ? sum : 0;

  // Full House
  const hasThree = counts.includes(3);
  const hasTwo = counts.includes(2);
  scores.fh = (hasThree && hasTwo) || counts.some((c) => c === 5) ? sum : 0;

  // Straights
  const uniqueSortedStr = [...new Set(currentDice)].sort((a, b) => a - b).join("");
  if (/1234|2345|3456/.test(uniqueSortedStr)) {
    scores.ss = 15;
  } else {
    scores.ss = 0;
  }
  if (/12345|23456/.test(uniqueSortedStr)) {
    scores.ls = 30;
  } else {
    scores.ls = 0;
  }

  // Yacht
  scores.yacht = counts.some((c) => c === 5) ? 50 : 0;

  return scores;
}

function updateScorePreview() {
  if (rollsLeft >= 3) return; // 굴리기 전에는 미리보기 없음
  const potentialScores = calculateScores(dice);
  const playerClass = currentPlayer === 1 ? "p1-score" : "p2-score";

  document.querySelectorAll(`.score-cell.${playerClass}`).forEach((cell) => {
    const cat = cell.dataset.cat;
    if (cat === "total" || cat === "bonus" || cell.classList.contains("filled")) {
      return;
    }
    if (potentialScores[cat] !== undefined) {
      cell.textContent = potentialScores[cat];
      cell.classList.add("preview-score");
    }
  });
}

// 점수판 클릭 이벤트
if (scoreTbody) {
  scoreTbody.addEventListener("click", (e) => {
    const cell = e.target;
    if (!cell.classList.contains("score-cell") || !cell.classList.contains("preview-score")) return;

    if (currentMode === "multi") {
      if (!isMyTurn) return;
      const playerClass = myPlayerNumber === 1 ? "p1-score" : "p2-score";
      if (!cell.classList.contains(playerClass)) return;

      const cat = cell.dataset.cat;
      const scoreVal = parseInt(cell.textContent) || 0;
      submitScoreMulti(cat, scoreVal);
    } else {
      const playerClass = currentPlayer === 1 ? "p1-score" : "p2-score";
      if (!cell.classList.contains(playerClass)) return;

      const cat = cell.dataset.cat;
      const scoreVal = parseInt(cell.textContent) || 0;
      localScores[currentPlayer][cat] = scoreVal;

      cell.classList.remove("preview-score");
      cell.classList.add("filled");
      cell.textContent = scoreVal;

      clearScorePreviews();
      updateTotalAndBonusUI(currentPlayer, localScores[currentPlayer]);
      nextTurnLocal();
    }
  });
}

function updateTotalAndBonusUI(player, scores) {
  const playerClass = player === 1 ? "p1-score" : "p2-score";

  // Upper section sum (Aces ~ Sixes)
  const upperCats = ["aces", "deuces", "threes", "fours", "fives", "sixes"];
  let upperSum = 0;
  upperCats.forEach((c) => {
    if (scores[c] !== undefined) {
      upperSum += scores[c];
    }
  });

  // Bonus cell
  const bonusCell = document.querySelector(`.score-cell.${playerClass}[data-cat="bonus"]`);
  if (bonusCell) {
    if (upperSum >= 63) {
      bonusCell.textContent = "+35";
      bonusCell.classList.add("filled");
      bonusCell.style.color = "#2ecc71";
    } else {
      bonusCell.textContent = `${upperSum}/63`;
    }
  }

  // Total
  let total = 0;
  Object.keys(scores).forEach((c) => {
    if (c !== "total" && c !== "bonus") {
      total += scores[c];
    }
  });
  if (upperSum >= 63) total += 35;

  const totalCell = document.querySelector(`.score-cell.${playerClass}[data-cat="total"]`);
  if (totalCell) {
    totalCell.textContent = total;
    totalCell.classList.add("filled");
  }

  return total;
}

function nextTurnLocal() {
  if (currentPlayer === 1) {
    currentPlayer = 2;
  } else {
    currentPlayer = 1;
    currentRound++;
  }

  if (currentRound > MAX_ROUNDS) {
    setTimeout(() => {
      const p1Total = parseInt(document.querySelector(".score-cell.p1-score[data-cat='total']")?.textContent) || 0;
      const p2Total = parseInt(document.querySelector(".score-cell.p2-score[data-cat='total']")?.textContent) || 0;
      let winnerMsg = `게임 종료!\n1P: ${p1Total}점 vs 2P: ${p2Total}점\n`;
      if (p1Total > p2Total) winnerMsg += "🎉 1P 승리!";
      else if (p2Total > p1Total) winnerMsg += "🎉 2P 승리!";
      else winnerMsg += "🤝 무승부!";
      alert(winnerMsg);
    }, 500);
    return;
  }

  updateTurnIndicator();
  resetDiceDisplay();
}

// ==========================================
// [4] 멀티플레이어 Firestore 연동 로직
// ==========================================

// 방 만들기
btnCreateRoom.addEventListener("click", async () => {
  if (!db) {
    multiStatus.textContent = "데이터베이스에 연결할 수 없습니다.";
    return;
  }

  multiStatus.textContent = "방 생성 중...";
  btnCreateRoom.disabled = true;

  try {
    let roomCode = "";
    let roomDocRef = null;

    // 4자리 고유 코드 탐색
    for (let attempts = 0; attempts < 5; attempts++) {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      const ref = doc(db, "yacht_rooms", code);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        roomCode = code;
        roomDocRef = ref;
        break;
      }
    }

    if (!roomDocRef) {
      multiStatus.textContent = "방 생성 실패: 다시 시도해주세요.";
      btnCreateRoom.disabled = false;
      return;
    }

    currentRoomId = roomCode;
    myPlayerNumber = 1;

    const initialData = {
      roomId: roomCode,
      status: "waiting", // "waiting", "playing", "finished", "abandoned"
      createdAt: serverTimestamp(),
      currentTurn: 1,
      currentRound: 1,
      rollsLeft: 3,
      dice: [1, 1, 1, 1, 1],
      held: [false, false, false, false, false],
      p1Scores: {},
      p2Scores: {},
      lastAction: { type: "create", by: 1, id: Date.now() }
    };

    await setDoc(roomDocRef, initialData);

    waitingCodeText.textContent = roomCode;
    multiMainButtons.classList.add("hidden");
    multiWaitingArea.classList.remove("hidden");
    multiStatus.textContent = "";

    listenToRoom(roomCode);
  } catch (error) {
    console.error("방 생성 오류:", error);
    multiStatus.textContent = "방 생성 실패: " + (error.message || error);
  } finally {
    btnCreateRoom.disabled = false;
  }
});

// 방 취소 (대기 중)
btnCancelWaiting.addEventListener("click", async () => {
  cleanupRoom();
  multiWaitingArea.classList.add("hidden");
  multiMainButtons.classList.remove("hidden");
  multiStatus.textContent = "방 생성을 취소했습니다.";
});

// 방 참가
btnJoinRoom.addEventListener("click", async () => {
  if (!db) {
    multiStatus.textContent = "데이터베이스에 연결할 수 없습니다.";
    return;
  }

  const code = roomCodeInput.value.trim();
  if (code.length !== 4 || !/^\d{4}$/.test(code)) {
    multiStatus.textContent = "올바른 4자리 숫자를 입력하세요.";
    return;
  }

  multiStatus.textContent = "방 참가 중...";
  btnJoinRoom.disabled = true;

  try {
    const roomRef = doc(db, "yacht_rooms", code);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
      multiStatus.textContent = "존재하지 않는 방 코드입니다.";
      btnJoinRoom.disabled = false;
      return;
    }

    const data = snap.data();
    if (data.status !== "waiting") {
      multiStatus.textContent = "이미 게임이 진행 중이거나 종료된 방입니다.";
      btnJoinRoom.disabled = false;
      return;
    }

    currentRoomId = code;
    myPlayerNumber = 2;

    await updateDoc(roomRef, {
      status: "playing",
      lastAction: { type: "join", by: 2, id: Date.now() }
    });

    multiStatus.textContent = "";
    listenToRoom(code);
    startGame("multi");
  } catch (error) {
    console.error("방 참가 오류:", error);
    multiStatus.textContent = "방 참가 실패: " + (error.message || error);
  } finally {
    btnJoinRoom.disabled = false;
  }
});

// 방 실시간 리스너
function listenToRoom(roomCode) {
  if (roomUnsubscribe) {
    roomUnsubscribe();
  }

  const roomRef = doc(db, "yacht_rooms", roomCode);
  roomUnsubscribe = onSnapshot(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      if (currentMode === "multi") {
        alert("방이 종료되었거나 삭제되었습니다.");
        exitGameToMain();
      }
      return;
    }

    const data = snapshot.data();

    // 1P 방장인 경우 상대방 입장 감지
    if (myPlayerNumber === 1 && data.status === "playing" && currentMode !== "multi") {
      multiWaitingArea.classList.add("hidden");
      multiMainButtons.classList.remove("hidden");
      startGame("multi");
    }

    // 상대방 탈주 감지
    if (data.status === "abandoned") {
      alert("상대방이 게임을 나갔습니다.");
      exitGameToMain();
      return;
    }

    // 인게임 동기화
    if (currentMode === "multi" && data.status === "playing") {
      handleRemoteGameUpdate(data);
    }
  }, (err) => {
    console.error("Room listener error:", err);
  });
}

// 원격 게임 데이터 동기화
function handleRemoteGameUpdate(data) {
  currentPlayer = data.currentTurn;
  currentRound = data.currentRound;
  isMyTurn = (currentPlayer === myPlayerNumber);

  updateTurnIndicator();

  // 점수판 동기화
  applyRemoteScores(1, data.p1Scores || {});
  applyRemoteScores(2, data.p2Scores || {});

  const action = data.lastAction;
  if (!action) return;

  // 상대방이 주사위를 굴린 경우 애니메이션 실행
  if (action.type === "roll" && action.id !== lastProcessedActionId) {
    lastProcessedActionId = action.id;
    dice = [...data.dice];
    rollsLeft = data.rollsLeft;
    held = [...data.held];
    updateHeldUI();

    if (action.by !== myPlayerNumber) {
      animateDiceRoll(data.dice, data.held, () => {
        updateRollButtonState();
      });
    }
  }

  // 상대방이 킵을 변경한 경우
  if (action.type === "hold" && action.by !== myPlayerNumber) {
    held = [...data.held];
    updateHeldUI();
  }

  // 턴 전환된 경우 (새 주사위 면 표시)
  if (action.type === "turn_next" && action.id !== lastProcessedActionId) {
    lastProcessedActionId = action.id;
    dice = [...data.dice];
    rollsLeft = data.rollsLeft;
    held = [...data.held];
    resetDiceDisplay();
  }

  // 게임 종료 감지
  if (action.type === "game_finish" && action.id !== lastProcessedActionId) {
    lastProcessedActionId = action.id;
    const p1Total = updateTotalAndBonusUI(1, data.p1Scores || {});
    const p2Total = updateTotalAndBonusUI(2, data.p2Scores || {});

    setTimeout(() => {
      let resultMsg = `멀티플레이 게임 종료!\n1P: ${p1Total}점 vs 2P: ${p2Total}점\n\n`;
      if (p1Total === p2Total) {
        resultMsg += "🤝 무승부입니다!";
      } else {
        const winnerNum = p1Total > p2Total ? 1 : 2;
        if (winnerNum === myPlayerNumber) {
          resultMsg += "🎉 축하합니다! 당신이 승리했습니다!";
        } else {
          resultMsg += "😢 아쉽네요! 패배했습니다.";
        }
      }
      alert(resultMsg);
      exitGameToMain();
    }, 600);
  }

  updateRollButtonState();
}

function applyRemoteScores(player, scores) {
  const playerClass = player === 1 ? "p1-score" : "p2-score";
  Object.keys(scores).forEach((cat) => {
    const cell = document.querySelector(`.score-cell.${playerClass}[data-cat="${cat}"]`);
    if (cell) {
      cell.textContent = scores[cat];
      cell.classList.remove("preview-score");
      cell.classList.add("filled");
    }
  });
  updateTotalAndBonusUI(player, scores);
}

// 멀티플레이 점수 제출
async function submitScoreMulti(cat, scoreVal) {
  if (!currentRoomId || !isMyTurn) return;

  try {
    const roomRef = doc(db, "yacht_rooms", currentRoomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const pKey = myPlayerNumber === 1 ? "p1Scores" : "p2Scores";
    const newScores = { ...(data[pKey] || {}), [cat]: scoreVal };

    let nextTurn = data.currentTurn === 1 ? 2 : 1;
    let nextRound = data.currentRound;
    if (data.currentTurn === 2) {
      nextRound++;
    }

    // 12라운드 초과 시 게임 종료
    if (nextRound > MAX_ROUNDS) {
      await updateDoc(roomRef, {
        [pKey]: newScores,
        status: "finished",
        lastAction: {
          type: "game_finish",
          by: myPlayerNumber,
          id: Date.now()
        }
      });
      return;
    }

    // 다음 턴을 위한 주사위 초기값
    const newInitialDice = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];

    await updateDoc(roomRef, {
      [pKey]: newScores,
      currentTurn: nextTurn,
      currentRound: nextRound,
      rollsLeft: 3,
      dice: newInitialDice,
      held: [false, false, false, false, false],
      lastAction: {
        type: "turn_next",
        by: myPlayerNumber,
        dice: newInitialDice,
        held: [false, false, false, false, false],
        rollsLeft: 3,
        id: Date.now()
      }
    });
  } catch (error) {
    console.error("점수 제출 실패:", error);
  }
}

// 방 나가기 및 정리
function cleanupRoom() {
  if (roomUnsubscribe) {
    roomUnsubscribe();
    roomUnsubscribe = null;
  }
  if (currentRoomId && myPlayerNumber === 1) {
    deleteDoc(doc(db, "yacht_rooms", currentRoomId)).catch(console.warn);
  }
  currentRoomId = null;
  myPlayerNumber = null;
}

function leaveMultiplayerGame() {
  if (currentRoomId) {
    updateDoc(doc(db, "yacht_rooms", currentRoomId), {
      status: "abandoned"
    }).catch(console.warn);
  }
  cleanupRoom();
  exitGameToMain();
}

function exitGameToMain() {
  if (roomUnsubscribe) {
    roomUnsubscribe();
    roomUnsubscribe = null;
  }
  currentRoomId = null;
  myPlayerNumber = null;
  gameScreen.classList.add("hidden");
  multiMenuScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
}

window.addEventListener("beforeunload", () => {
  if (currentMode === "multi" && currentRoomId) {
    updateDoc(doc(db, "yacht_rooms", currentRoomId), {
      status: "abandoned"
    }).catch(console.warn);
  }
});