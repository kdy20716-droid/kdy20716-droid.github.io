let isItemMode = false;
window.isMultiItemMode = false;
window.isReversed = false;

// 아이템 블록 색상 추가
COLORS[9] = "#ff3333"; // 폭탄 (빨강)
COLORS[10] = "#ffd700"; // 별 (노랑)
COLORS[11] = "#33ff33"; // 하트 (초록)
COLORS[12] = "#ff00ff"; // 시한폭탄 (마젠타)
COLORS[13] = "#ffffff"; // 멀티플레이 아이템 박스 (흰색)
COLORS[14] = "#111111"; // 신규 싱글: 폭탄
COLORS[15] = "#00bfff"; // 신규 싱글: 슬로우
COLORS[16] = "#ff69b4"; // 신규 싱글: 행운

// --- 2P 멀티 아이템전 시스템 ---
const ITEM_TYPES = {
  1: { name: "TimeBomb", icon: "💣" },
  2: { name: "Reverse", icon: "🔄" },
  3: { name: "Ink", icon: "🦑" },
  4: { name: "RandomBlocks", icon: "🧱" },
};

let multiplayerInventory = new Array(9).fill(null);
let selectedSlotIndex = 0;
let multiItemSpawnCounter = 0;
let multiItemNextThreshold = 10;

window.resetMultiplayerInventory = function () {
  multiplayerInventory.fill(null);
  selectedSlotIndex = 0;
  multiItemSpawnCounter = 0;
  multiItemNextThreshold = Math.floor(Math.random() * 11) + 10; // 시작 시 첫 아이템 상자 기준: 10~20 블록
  window.isReversed = false;
  updateInventoryUI();
  const ink = document.getElementById("ink-overlay");
  if (ink) ink.classList.add("hidden");
};

function addMultiplayerItem() {
  const emptySlot = multiplayerInventory.findIndex((item) => item === null);
  if (emptySlot !== -1) {
    const randomItemType = Math.floor(Math.random() * 4) + 1; // 1~4번 아이템
    multiplayerInventory[emptySlot] = randomItemType;
    updateInventoryUI();
  }
}

function updateInventoryUI() {
  for (let i = 0; i < 9; i++) {
    const slot = document.getElementById(`slot-${i + 1}`);
    if (slot) {
      const iconSpan = slot.querySelector(".icon");
      if (multiplayerInventory[i]) {
        iconSpan.textContent = ITEM_TYPES[multiplayerInventory[i]].icon;
      } else {
        iconSpan.textContent = "";
      }
      if (i === selectedSlotIndex) slot.classList.add("selected");
      else slot.classList.remove("selected");
    }
  }
}

window.selectItemSlot = function (index) {
  if (index >= 0 && index < 9) {
    selectedSlotIndex = index;
    updateInventoryUI();
  }
};

window.useSelectedItem = function () {
  const item = multiplayerInventory[selectedSlotIndex];
  if (item) {
    multiplayerInventory[selectedSlotIndex] = null;
    updateInventoryUI();
    sendItemAttack(item);
  }
};

window.sendItemAttack = async function (itemType) {
  if (!db || !currentRoomId) return;
  const actionsRef = window.fs.collection(
    db,
    "tetris_rooms",
    currentRoomId,
    "actions",
  );
  await window.fs.addDoc(actionsRef, {
    type: "itemAttack",
    target: amIHost ? 1 : 0,
    itemType: itemType,
    timestamp: window.fs.serverTimestamp(),
  });
  showItemPopup(`공격 아이템 사용!`);
};

window.receiveItemAttack = function (itemType) {
  if (itemType === 1) {
    showItemPopup("⚠️ 15초 폭탄 블록 경고!");
    placeTimeBomb();
  } else if (itemType === 2) {
    showItemPopup("⚠️ 방향키 반전!");
    window.isReversed = true;
    setTimeout(() => {
      window.isReversed = false;
    }, 8000);
  } else if (itemType === 3) {
    showItemPopup("⚠️ 먹물 공격!");
    const ink = document.getElementById("ink-overlay");
    if (ink) {
      ink.classList.remove("hidden");
      setTimeout(() => {
        ink.classList.add("hidden");
      }, 8000);
    }
  } else if (itemType === 4) {
    showItemPopup("⚠️ 무작위 블록 투하!");
    dropRandomBlocks();
  }
};

// 기존 블록 생성 함수 가로채기 (아이템 등장 확률 부여)
const _oldGenerateRandomPiece = generateRandomPiece;
generateRandomPiece = function () {
  const piece = _oldGenerateRandomPiece();

  if (window.isMultiItemMode) {
    multiItemSpawnCounter++;
    // 10~20개 블록마다 아이템 상자 하나를 무작위로 심어줌
    if (multiItemSpawnCounter >= multiItemNextThreshold) {
      multiItemSpawnCounter = 0;
      multiItemNextThreshold = Math.floor(Math.random() * 11) + 10; // 다음 기준도 10~20 재설정

      let blocks = [];
      for (let y = 0; y < piece.matrix.length; y++) {
        for (let x = 0; x < piece.matrix[y].length; x++) {
          if (piece.matrix[y][x] !== 0) blocks.push({ x, y });
        }
      }
      if (blocks.length > 0) {
        const target = blocks[Math.floor(Math.random() * blocks.length)];
        piece.matrix[target.y][target.x] = 13; // 13: 🎁 멀티플레이 아이템 박스
      }
    }
  } else if (isItemMode && Math.random() < 0.2) {
    // 싱글 아이템전 전용 1x1 아이템 블록
    const rand = Math.random();
    let itemType = 14; // 폭탄
    if (rand > 0.33 && rand <= 0.66) itemType = 15; // 슬로우
    else if (rand > 0.66) itemType = 16; // 행운
    
    return {
      matrix: [[itemType]],
      pos: { x: Math.floor(COLS / 2), y: 0 },
      type: itemType
    };
  }
  return piece;
};

// 기존 그리기 함수 가로채기 (아이템 이모티콘 렌더링)
const _oldDrawMatrix = drawMatrix;
drawMatrix = function (matrix, offset, targetCtx = ctx) {
  _oldDrawMatrix(matrix, offset, targetCtx); // 기본 블록 먼저 렌더링

  // 아이템 블록 위에는 텍스트(이모티콘) 추가
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if ((value >= 9 && value <= 16)) {
        targetCtx.save();
        targetCtx.font = "0.7px Arial";
        targetCtx.textAlign = "center";
        targetCtx.textBaseline = "middle";
        let icon = "";
        if (value === 9 || value === 14) icon = "💣";
        if (value === 10) icon = "⭐"; // 구 싱글
        if (value === 11) icon = "❤️"; // 구 싱글
        if (value === 12) icon = "⏱️";
        if (value === 13) icon = "🎁";
        if (value === 15) icon = "🐢";
        if (value === 16) icon = "🍀";
        targetCtx.fillText(icon, x + offset.x + 0.5, y + offset.y + 0.5);
        targetCtx.restore();
      }
    });
  });
};

// 기존 라인 클리어 함수 가로채기 (아이템 발동 처리)
const _oldSweep = sweep;
sweep = function () {
  // 멀티플레이 아이템전 로직
  if (window.isMultiItemMode) {
    let linesCleared = 0;
    let multiItemsCollected = 0; // 줄을 지울 때 포함된 아이템 상자 수

    outer: for (let y = board.length - 1; y >= 0; --y) {
      for (let x = 0; x < board[y].length; ++x) {
        if (board[y][x] === 0) continue outer;
      }

      // 지워지는 줄에 아이템 상자(13)가 박혀 있는지 검사
      for (let x = 0; x < board[y].length; ++x) {
        if (board[y][x] === 13) multiItemsCollected++;
      }

      const row = board.splice(y, 1)[0].fill(0);
      board.unshift(row);
      ++y;
      linesCleared++;
    }

    if (linesCleared > 0) {
      const points = [0, 100, 300, 500, 800];
      score += points[linesCleared];
      scoreElement.textContent = score;

      const newLevel = Math.floor(score / 1000) + 1;
      if (newLevel > currentLevel) {
        currentLevel = newLevel;
        dropInterval = Math.max(300, 1000 - (currentLevel - 1) * 150);
        document.body.style.filter = `hue-rotate(${(currentLevel - 1) * 60}deg)`;
        showLevelUpPopup("LEVEL UP! ⚡");
      }

      // 없앤 아이템 상자 개수만큼 인벤토리에 지급
      for (let i = 0; i < multiItemsCollected; i++) {
        addMultiplayerItem();
        showItemPopup("🎁 아이템 획득!");
      }

      // 기본 공격(쓰레기 블록)도 같이 날리기
      if (isMultiplayer && linesCleared >= 2) {
        const attackLines = linesCleared - 1;
        let holeIndex;
        do {
          holeIndex = Math.floor(Math.random() * COLS);
        } while (
          typeof lastHoleIndex !== "undefined" &&
          holeIndex === lastHoleIndex
        );
        if (typeof lastHoleIndex !== "undefined") lastHoleIndex = holeIndex;
        if (typeof sendAttack === "function")
          sendAttack(attackLines, holeIndex);
      }
    }
    return;
  }

  if (!isItemMode) {
    _oldSweep();
    return;
  }

  let linesCleared = 0;
  let itemsTriggered = [];

  outer: for (let y = board.length - 1; y >= 0; --y) {
    for (let x = 0; x < board[y].length; ++x) {
      if (board[y][x] === 0) {
        continue outer; // 빈 칸이 있으면 다음 줄로 넘어감
      }
    }
    // 꽉 찬 줄에서 아이템 수집
    for (let x = 0; x < board[y].length; ++x) {
      let val = board[y][x];
      if (val === 15 || val === 16) itemsTriggered.push(val);
    }

    // 줄 삭제 및 빈 줄 추가
    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    ++y;
    linesCleared++;
  }

  if (linesCleared > 0) {
    const points = [0, 100, 300, 500, 800];
    let earned = points[linesCleared];
    if (window.isLuckyMode) earned *= 2; // 럭키 모드 점수 2배
    score += earned;
    scoreElement.textContent = score;

    const newLevel = Math.floor(score / 1000) + 1;
    if (newLevel > currentLevel) {
      currentLevel = newLevel;
      let baseSpeed = Math.max(300, 1000 - (currentLevel - 1) * 150);
      if (window.isSlowMode) baseSpeed += 500; // 슬로우 효과 적용
      dropInterval = baseSpeed;
      document.body.style.filter = `hue-rotate(${(currentLevel - 1) * 60}deg)`;
      showLevelUpPopup("LEVEL UP! ⚡");
    }

    // 멀티플레이 연동용 코드
    if (
      typeof isMultiplayer !== "undefined" &&
      isMultiplayer &&
      linesCleared >= 2
    ) {
      const attackLines = linesCleared - 1;
      let holeIndex;
      do {
        holeIndex = Math.floor(Math.random() * COLS);
      } while (
        typeof lastHoleIndex !== "undefined" &&
        holeIndex === lastHoleIndex
      );
      if (typeof lastHoleIndex !== "undefined") lastHoleIndex = holeIndex;
      if (typeof sendAttack === "function") sendAttack(attackLines, holeIndex);
    }

    // 수집된 아이템 효과 발동!
    itemsTriggered.forEach((item) => applySingleItemEffect(item));
  }
};

window.isSlowMode = false;
window.isLuckyMode = false;
let slowTimer = null;
let luckyTimer = null;

function applySingleItemEffect(itemType) {
  if (itemType === 15) { // 슬로우 블록
    showItemPopup("🐢 슬로우! (10초)");
    window.isSlowMode = true;
    let baseSpeed = Math.max(300, 1000 - (currentLevel - 1) * 150);
    dropInterval = baseSpeed + 500;
    
    if (slowTimer) clearTimeout(slowTimer);
    slowTimer = setTimeout(() => {
      window.isSlowMode = false;
      dropInterval = Math.max(300, 1000 - (currentLevel - 1) * 150);
    }, 10000);
  } else if (itemType === 16) { // 행운 블록
    showItemPopup("🌈 럭키 타임! 닿으면 파괴 (10초)");
    window.isLuckyMode = true;
    document.body.classList.add("lucky-theme");
    
    if (luckyTimer) clearTimeout(luckyTimer);
    luckyTimer = setTimeout(() => {
      window.isLuckyMode = false;
      document.body.classList.remove("lucky-theme");
    }, 10000);
  }
}

// --- 멀티플레이 아이템 효과 로직 ---
function placeTimeBomb() {
  let placed = false;
  let attempts = 0;
  while (!placed && attempts < 50) {
    let x = Math.floor(Math.random() * COLS);
    let y = Math.floor(Math.random() * (ROWS / 2)); // 위쪽에 생성
    if (board[y][x] === 0) {
      board[y][x] = 12; // 12: 시한폭탄 블록
      placed = true;
    }
    attempts++;
  }
  if (!placed) board[0][Math.floor(COLS / 2)] = 12; // 빈자리 없으면 맨 위 가운데 강제 배치

  setTimeout(() => {
    const bombStillExists = board.some((row) => row.includes(12));
    if (bombStillExists) {
      // 보드에 남아있다면 섞기
      showItemPopup("💥 폭탄 폭발! 진형 붕괴!");
      for (let r = 0; r < ROWS; r++) {
        if (board[r].some((val) => val !== 0))
          board[r].sort(() => Math.random() - 0.5);
        for (let c = 0; c < COLS; c++) if (board[r][c] === 12) board[r][c] = 8; // 터진 폭탄은 회색 블록으로
      }
    }
  }, 15000);
}

function dropRandomBlocks() {
  for (let i = 0; i < 2; i++) {
    let x = Math.floor(Math.random() * COLS);
    let y = 0;
    while (y < ROWS - 1 && board[y + 1][x] === 0) y++;
    board[y][x] = 8; // 낙하한 위치에 회색 블록 고정
  }
  gameScreen.classList.remove("damage-flash");
  void gameScreen.offsetWidth;
  gameScreen.classList.add("damage-flash");
}

// 아이템 발동 알림 텍스트 효과
function showItemPopup(text) {
  let popup = document.createElement("div");
  popup.className = "item-popup";
  popup.textContent = text;
  let wrapper = document.querySelector(".board-wrapper");
  if (wrapper) wrapper.appendChild(popup);

  setTimeout(() => popup.remove(), 1500);
}

// --- 신규 싱글 아이템전 충돌/발동 로직 ---
window.explodeBomb = function(cx, cy) {
  showItemPopup("💣 폭발!");
  // 주변 3x3 범위 파괴
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        board[y][x] = 0; // 블록 삭제
      }
    }
  }
  gameScreen.classList.remove("damage-flash");
  void gameScreen.offsetWidth; 
  gameScreen.classList.add("damage-flash");
};

window.spawnNextAfterSpecial = function() {
  piece = nextPiece;
  nextPiece = generateRandomPiece();
  drawNextPiece();
  if (typeof skipCooldown !== "undefined" && skipCooldown > 0) {
    skipCooldown--;
    if (typeof updateSkipUI === "function") updateSkipUI();
  }
  if (collide(board, piece)) {
    gameOver();
  }
  dropCounter = 0;
};

window.handleItemPieceLanded = function() {
  if (isItemMode && !window.isMultiItemMode) {
    // 1. 폭탄(14) 바닥 도달 시 폭발
    if (piece.matrix.length === 1 && piece.matrix[0][0] === 14) {
      window.explodeBomb(piece.pos.x, piece.pos.y);
      window.spawnNextAfterSpecial();
      return true; // 머지 생략
    }
    
    // 2. 럭키 모드 시, 닿자마자 블록 파괴 및 점수 획득
    if (window.isLuckyMode) {
      let blocks = 0;
      piece.matrix.forEach(r => r.forEach(v => {if(v!==0) blocks++}));
      score += blocks * 50 * 2; // 한 칸당 기본 50점 * 2배 = 100점
      scoreElement.textContent = score;
      showItemPopup(`💥 즉시 파괴! +${blocks * 100}점`);
      window.spawnNextAfterSpecial();
      return true; // 머지 생략
    }
  }
  return false;
};

window.handleShiftPress = function() {
  if (isItemMode && !window.isMultiItemMode && piece && piece.matrix.length === 1 && piece.matrix[0][0] === 14) {
    window.explodeBomb(piece.pos.x, piece.pos.y);
    window.spawnNextAfterSpecial();
  }
};

// --- 메뉴 및 버튼 이벤트 연동 ---
const btnItemMode = document.getElementById("btn-item-mode");
const colorWipeLine = document.getElementById("color-wipe-line");

if (btnItemMode && colorWipeLine) {
  btnItemMode.addEventListener("click", () => {
    // 화면 전환 빗방향 선 애니메이션 시작
    colorWipeLine.classList.remove("hidden");
    colorWipeLine.classList.add("active");

    // 선이 화면 중간을 지날 때 쯤(600ms) 배경 테마 변경 및 게임 시작
    setTimeout(() => {
      document.body.classList.add("item-theme");
      startScreen.classList.add("hidden");
      gameScreen.classList.remove("hidden");

      isItemMode = true;
      startGame();
      canvas.focus();
    }, 600);

    // 애니메이션이 완전히 끝나면 선 요소 숨김 (1200ms)
    setTimeout(() => {
      colorWipeLine.classList.remove("active");
      colorWipeLine.classList.add("hidden");
    }, 1200);
  });
}

// 뒤로가기 버튼 등을 눌렀을 때 아이템전 테마 해제
const resetTheme = () => {
  document.body.classList.remove("item-theme");
  document.body.classList.remove("lucky-theme");
  document.body.style.filter = 'hue-rotate(0deg)';
  isItemMode = false;
  window.isSlowMode = false;
  window.isLuckyMode = false;
  if (slowTimer) clearTimeout(slowTimer);
  if (luckyTimer) clearTimeout(luckyTimer);
};

document.getElementById("back-btn")?.addEventListener("click", resetTheme);
document
  .getElementById("btn-result-main")
  ?.addEventListener("click", resetTheme);
