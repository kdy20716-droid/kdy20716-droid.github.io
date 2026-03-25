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
COLORS[17] = "#8b4513"; // 신규 싱글: 똥 블록 (해로움)
COLORS[18] = "#000000"; // 신규 싱글: 먹물 (해로움)
COLORS[19] = "#800080"; // 신규 싱글: 방향 반전 (해로움)

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
  const ink = document.getElementById("ink-splatter-container");
  if (ink) ink.remove();
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
    window.triggerInkSplatter();
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
  } else if (isItemMode && !window.isMultiItemMode) {
    const rand = Math.random();
    if (rand < 0.001) {
      // 0.1% 확률: 행운 블록
      let itemType = 16;
      return {
        matrix: [[itemType]],
        pos: { x: Math.floor(COLS / 2), y: 0 },
        type: itemType,
      };
    } else if (rand < 0.201) {
      // 약 20% 확률: 폭탄 또는 슬로우
      let itemType = 14; // 폭탄
      if (Math.random() > 0.5) itemType = 15; // 슬로우
      return {
        matrix: [[itemType]],
        pos: { x: Math.floor(COLS / 2), y: 0 },
        type: itemType,
      };
    } else if (rand < 0.401) {
      // 20% 확률: 일반 블록에 해로운 아이템 포함
      let blocks = [];
      for (let y = 0; y < piece.matrix.length; y++) {
        for (let x = 0; x < piece.matrix[y].length; x++) {
          if (piece.matrix[y][x] !== 0) blocks.push({ x, y });
        }
      }
      if (blocks.length > 0) {
        const target = blocks[Math.floor(Math.random() * blocks.length)];
        const hRand = Math.random();
        let hItem = 17; // 똥
        if (hRand > 0.33 && hRand <= 0.66)
          hItem = 18; // 먹물
        else if (hRand > 0.66) hItem = 19; // 반전
        piece.matrix[target.y][target.x] = hItem;
      }
    }
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
      if (value >= 9 && value <= 19) {
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
        if (value === 17) icon = "💩";
        if (value === 18) icon = "🦑";
        if (value === 19) icon = "🔄";
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
      if (val >= 15 && val <= 19) itemsTriggered.push(val);
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
let luckyScoreInterval = null;

function applySingleItemEffect(itemType) {
  if (itemType === 15) {
    // 슬로우 블록
    showItemPopup("🐢 슬로우! (10초)");
    window.isSlowMode = true;
    let baseSpeed = Math.max(300, 1000 - (currentLevel - 1) * 150);
    dropInterval = baseSpeed + 500;

    if (slowTimer) clearTimeout(slowTimer);
    slowTimer = setTimeout(() => {
      window.isSlowMode = false;
      dropInterval = Math.max(300, 1000 - (currentLevel - 1) * 150);
    }, 10000);
  } else if (itemType === 16) {
    // 행운 블록
    showItemPopup("🌈 럭키 타임! 닿으면 파괴 (10초)");
    window.isLuckyMode = true;
    document.body.classList.add("lucky-theme");

    if (luckyTimer) clearTimeout(luckyTimer);
    if (luckyScoreInterval) clearInterval(luckyScoreInterval);

    // 1초마다 폭죽 이펙트와 함께 1000점씩 획득
    luckyScoreInterval = setInterval(() => {
      if (isPlaying && !isGameOver) {
        score += 1000;
        scoreElement.textContent = score;
        showItemPopup("🎆 +1000 🎆");
        createDOMFirework();
      }
    }, 1000);

    luckyTimer = setTimeout(() => {
      window.isLuckyMode = false;
      document.body.classList.remove("lucky-theme");
      if (luckyScoreInterval) clearInterval(luckyScoreInterval);

      // 행운 모드 종료 시 2초 정지 후 재개
      let wasPlaying = isPlaying;
      if (wasPlaying) isPlaying = false;
      showCountdownPopup("2");

      setTimeout(() => showCountdownPopup("1"), 1000);
      setTimeout(() => {
        showCountdownPopup("GO!");
        if (wasPlaying && !isGameOver) isPlaying = true;
      }, 2000);
    }, 10000);
  } else if (itemType === 17) {
    // 똥 블록 3개
    showItemPopup("💩 똥 블록 투하!");
    for (let i = 0; i < 3; i++) {
      let x = Math.floor(Math.random() * COLS);
      let y = 0;
      while (y < ROWS - 1 && board[y + 1][x] === 0) y++;
      board[y][x] = 8; // 회색 블록 고정
    }
    gameScreen.classList.remove("damage-flash");
    void gameScreen.offsetWidth;
    gameScreen.classList.add("damage-flash");
  } else if (itemType === 18) {
    // 먹물 가림
    showItemPopup("🦑 먹물 공격!");
    window.triggerInkSplatter();
  } else if (itemType === 19) {
    // 조작 반전
    showItemPopup("🔄 조작 반전! (10초)");
    window.isReversed = true;
    setTimeout(() => {
      window.isReversed = false;
    }, 10000);
  }
}

// 마리오 카트 스타일 먹물 흩뿌리기
window.triggerInkSplatter = function () {
  const boardWrapper = document.querySelector(".board-wrapper");
  if (!boardWrapper) return;

  let oldContainer = document.getElementById("ink-splatter-container");
  if (oldContainer) oldContainer.remove();

  const container = document.createElement("div");
  container.id = "ink-splatter-container";
  container.className = "ink-splatter-container";
  boardWrapper.appendChild(container);

  const numSplatters = Math.floor(Math.random() * 4) + 5; // 5~8개 무작위 배치
  for (let i = 0; i < numSplatters; i++) {
    const splatter = document.createElement("div");
    splatter.className = "ink-splatter";
    const size = Math.random() * 50 + 50; // 50px ~ 100px 크기 랜덤
    splatter.style.width = `${size}px`;
    splatter.style.height = `${size}px`;
    splatter.style.top = `${Math.random() * 80}%`;
    splatter.style.left = `${Math.random() * 80}%`;
    splatter.style.setProperty("--rot", `${Math.random() * 360}deg`);
    container.appendChild(splatter);
  }

  setTimeout(() => {
    if (container.parentNode) container.remove();
  }, 5000); // 5초 후 요소 삭제
};

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

// 대형 중앙 카운트다운 팝업
function showCountdownPopup(text) {
  let popup = document.createElement("div");
  popup.className = "countdown-popup";
  popup.textContent = text;
  let wrapper = document.querySelector(".board-wrapper");
  if (wrapper) wrapper.appendChild(popup);
  setTimeout(() => popup.remove(), 1000); // 1초마다 애니메이션과 함께 삭제
}

// --- 폭죽 파티클 이펙트 시스템 ---
function createDOMFirework() {
  const wrapper = document.querySelector(".board-wrapper");
  if (!wrapper) return;
  const colors = [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ff00ff",
    "#00ffff",
  ];

  for (let i = 0; i < 40; i++) {
    const p = document.createElement("div");
    p.style.position = "absolute";
    p.style.width = "8px";
    p.style.height = "8px";
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.borderRadius = "50%";
    p.style.top = "40%";
    p.style.left = "50%";
    p.style.pointerEvents = "none";
    p.style.zIndex = "1000";
    wrapper.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 120 + 50;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;

    p.animate(
      [
        { transform: `translate(-50%, -50%) scale(1)`, opacity: 1 },
        {
          transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`,
          opacity: 0,
        },
      ],
      {
        duration: 800 + Math.random() * 400,
        easing: "ease-out",
        fill: "forwards",
      },
    );

    setTimeout(() => p.remove(), 1200);
  }
}

// --- 신규 싱글 아이템전 충돌/발동 로직 ---
window.explodeBomb = function (cx, cy) {
  showItemPopup("💣 해당 줄 파괴!");

  // 1. 폭탄이 위치한 줄(자신이 속한 줄) 파괴
  if (cy >= 0 && cy < ROWS) {
    board.splice(cy, 1);
    board.unshift(new Array(COLS).fill(0));
  }

  gameScreen.classList.remove("damage-flash");
  void gameScreen.offsetWidth;
  gameScreen.classList.add("damage-flash");
};

window.spawnNextAfterSpecial = function () {
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

window.handleItemPieceLanded = function () {
  if (isItemMode && !window.isMultiItemMode) {
    // 1. 폭탄(14) 바닥 도달 시 폭발
    if (piece.matrix.length === 1 && piece.matrix[0][0] === 14) {
      window.explodeBomb(piece.pos.x, piece.pos.y);
      window.spawnNextAfterSpecial();
      return true; // 머지 생략
    }

    // 2. 럭키 모드 시, 닿자마자 블록 파괴 및 점수 획득
    if (window.isLuckyMode) {
      let destroyed = 0;
      piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            destroyed++; // 조각 자신
            let boardX = piece.pos.x + x;
            let boardY = piece.pos.y + y;
            // 인접 블록 파괴 (하, 좌, 우)
            if (boardY + 1 < ROWS && board[boardY + 1][boardX] !== 0) {
              board[boardY + 1][boardX] = 0;
              destroyed++;
            }
            if (boardX - 1 >= 0 && board[boardY][boardX - 1] !== 0) {
              board[boardY][boardX - 1] = 0;
              destroyed++;
            }
            if (boardX + 1 < COLS && board[boardY][boardX + 1] !== 0) {
              board[boardY][boardX + 1] = 0;
              destroyed++;
            }
          }
        });
      });
      showItemPopup(`💥 연쇄 파괴!`);
      window.spawnNextAfterSpecial();
      return true; // 머지 생략
    }
  }
  return false;
};

window.handleShiftPress = function () {
  if (
    isItemMode &&
    !window.isMultiItemMode &&
    piece &&
    piece.matrix.length === 1 &&
    piece.matrix[0][0] === 14
  ) {
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
  document.body.style.filter = "hue-rotate(0deg)";
  isItemMode = false;
  window.isSlowMode = false;
  window.isLuckyMode = false;
  window.isReversed = false;
  const ink = document.getElementById("ink-splatter-container");
  if (ink) ink.remove();
  if (slowTimer) clearTimeout(slowTimer);
  if (luckyTimer) clearTimeout(luckyTimer);
  if (luckyScoreInterval) clearInterval(luckyScoreInterval);
};

document.getElementById("back-btn")?.addEventListener("click", resetTheme);
document
  .getElementById("btn-result-main")
  ?.addEventListener("click", resetTheme);
