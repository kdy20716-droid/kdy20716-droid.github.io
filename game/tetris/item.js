let isItemMode = false;

// 아이템 블록 색상 추가
COLORS[9] = "#ff3333"; // 폭탄 (빨강)
COLORS[10] = "#ffd700"; // 별 (노랑)
COLORS[11] = "#33ff33"; // 하트 (초록)

// 기존 블록 생성 함수 가로채기 (아이템 등장 확률 부여)
const _oldGenerateRandomPiece = generateRandomPiece;
generateRandomPiece = function () {
  const piece = _oldGenerateRandomPiece();
  // 아이템 모드일 때 20% 확률로 아이템 블록 등장
  if (isItemMode && Math.random() < 0.2) {
    let blocks = [];
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (piece.matrix[y][x] !== 0) blocks.push({ x, y });
      }
    }
    if (blocks.length > 0) {
      // 블록 조각 중 무작위 한 칸을 아이템으로 변경
      const target = blocks[Math.floor(Math.random() * blocks.length)];
      const rand = Math.random();
      let itemType = 9; // 기본 폭탄

      if (rand > 0.33 && rand <= 0.66)
        itemType = 10; // 별
      else if (rand > 0.66) itemType = 11; // 하트

      piece.matrix[target.y][target.x] = itemType;
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
      if (value >= 9 && value <= 11) {
        targetCtx.save();
        targetCtx.font = "0.7px Arial";
        targetCtx.textAlign = "center";
        targetCtx.textBaseline = "middle";
        let icon = "";
        if (value === 9) icon = "💣";
        if (value === 10) icon = "⭐";
        if (value === 11) icon = "❤️";
        targetCtx.fillText(icon, x + offset.x + 0.5, y + offset.y + 0.5);
        targetCtx.restore();
      }
    });
  });
};

// 기존 라인 클리어 함수 가로채기 (아이템 발동 처리)
const _oldSweep = sweep;
sweep = function () {
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
      if (val >= 9 && val <= 11) itemsTriggered.push(val);
    }

    // 줄 삭제 및 빈 줄 추가
    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    ++y;
    linesCleared++;
  }

  if (linesCleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[linesCleared];
    scoreElement.textContent = score;
    dropInterval = Math.max(100, 1000 - Math.floor(score / 500) * 100);

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
    itemsTriggered.forEach((item) => applyItemEffect(item));
  }
};

// 아이템 효과 적용 함수
function applyItemEffect(itemType) {
  if (itemType === 9) {
    // 💣 폭탄: 맨 아래 3줄을 무조건 삭제
    for (let i = 0; i < 3; i++) {
      board.pop();
      board.unshift(new Array(COLS).fill(0));
    }
    gameScreen.classList.remove("damage-flash");
    void gameScreen.offsetWidth; // 리플로우 강제 발생 (애니메이션 재시작)
    gameScreen.classList.add("damage-flash");
    showItemPopup("💣 폭탄 발동! 3줄 제거");
  } else if (itemType === 10) {
    // ⭐ 별: 즉시 점수 +1000
    score += 1000;
    scoreElement.textContent = score;
    showItemPopup("⭐ 보너스 +1000점!");
  } else if (itemType === 11) {
    // ❤️ 하트: 가장 밑에 있는 회색 쓰레기 블록 2줄 정화
    let removed = 0;
    for (let y = board.length - 1; y >= 0; y--) {
      if (board[y].includes(8)) {
        // 8 = 멀티플레이 공격받은 쓰레기 블록
        board.splice(y, 1);
        board.unshift(new Array(COLS).fill(0));
        removed++;
        y++;
        if (removed >= 2) break;
      }
    }
    if (removed > 0) showItemPopup(`❤️ 방어! 쓰레기 ${removed}줄 정화`);
    else showItemPopup("❤️ 하트 (정화할 블록 없음)");
  }
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
  isItemMode = false;
};

document.getElementById("back-btn")?.addEventListener("click", resetTheme);
document
  .getElementById("btn-result-main")
  ?.addEventListener("click", resetTheme);
