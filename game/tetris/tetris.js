const canvas = document.getElementById("tetris-board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next-board");
const nextCtx = nextCanvas.getContext("2d");
const scoreElement = document.getElementById("score");
const startBtn = document.getElementById("start-btn");

// 화면 및 메뉴 버튼
const startScreen = document.getElementById("start-screen");
const gameScreen = document.getElementById("game-screen");
const btn1p = document.getElementById("btn-1p");
const btn2p = document.getElementById("btn-2p");
const btnHowto = document.getElementById("btn-howto");
const btnBackToMenu = document.getElementById("back-btn"); // 인게임 뒤로가기 버튼
const howtoModal = document.getElementById("howto-modal");
const btnCloseHowto = document.getElementById("btn-close-howto");

// 일시정지 버튼 생성 및 추가
const btnPause = document.createElement("button");
btnPause.id = "pause-btn";
btnPause.textContent = "⏸ Pause";
document.querySelector(".header")?.appendChild(btnPause);

// 활성화된 아이템 타이머를 담을 UI 생성 (조작법 아래에 배치)
const controlsInfo = document.querySelector(".controls-info");
if (controlsInfo) {
  const activeItemsUI = document.createElement("div");
  activeItemsUI.id = "active-items-ui";
  activeItemsUI.style.display = "none";
  controlsInfo.parentNode.insertBefore(activeItemsUI, controlsInfo.nextSibling);
}

// 결과 모달 관련 변수
const resultModal = document.getElementById("result-modal");
const resultTitle = document.getElementById("result-title");
const resultDesc = document.getElementById("result-desc");
const btnResultLobby = document.getElementById("btn-result-lobby");
const btnResultMain = document.getElementById("btn-result-main");

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;

// 멀티플레이용 변수
const opponentPanel = document.getElementById("opponent-panel");
const oppCanvas = document.getElementById("opponent-board");
const oppCtx = oppCanvas?.getContext("2d");
if (oppCtx) oppCtx.scale(15, 15); // 상대방 화면은 절반 크기

let isMultiplayer = false;
let opponentBoard = [];
let syncInterval = null;
let unsubscribeActions = null;
let lastHoleIndex = -1; // 이전 공격의 빈칸 위치 기억
const mySpaceIndicator = document.getElementById("my-space-indicator");

// Canvas 크기 설정
ctx.scale(BLOCK_SIZE, BLOCK_SIZE);
nextCtx.scale(BLOCK_SIZE, BLOCK_SIZE);

// 테트로미노 모양 및 색상 정의
const SHAPES = [
  [], // 비어있는 값 (0)
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I (Cyan)
  [
    [2, 0, 0],
    [2, 2, 2],
    [0, 0, 0],
  ], // J (Blue)
  [
    [0, 0, 3],
    [3, 3, 3],
    [0, 0, 0],
  ], // L (Orange)
  [
    [4, 4],
    [4, 4],
  ], // O (Yellow)
  [
    [0, 5, 5],
    [5, 5, 0],
    [0, 0, 0],
  ], // S (Green)
  [
    [0, 6, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // T (Purple)
  [
    [7, 7, 0],
    [0, 7, 7],
    [0, 0, 0],
  ], // Z (Red)
];

window.COLORS = [
  null,
  "#00FFFF", // I
  "#0000FF", // J
  "#FFA500", // L
  "#FFFF00", // O
  "#00FF00", // S
  "#800080", // T
  "#FF0000", // Z
  "#888888", // 8: 공격받은 회색 쓰레기 블록
];
const COLORS = window.COLORS;

let board = [];
let piece = null;
let nextPiece = null;
let score = 0;
let currentLevel = 1;
let isGameOver = false;
let isPlaying = false;
let isPaused = false;
let dropCounter = 0;
let dropInterval = 1000; // 1초마다 하강
let lastTime = 0;
let lockDelayCounter = 0;
const LOCK_DELAY_LIMIT = 3000; // 바닥 도달 후 최대 3초 유예 (티스핀 등)
let animationId = null;
let skipCooldown = 0;
const MAX_SKIP_COOLDOWN = 10;

// --- 사운드 시스템 (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let masterVolume = 0.5;
let isMuted = false;

const SoundManager = {
  bgmInterval: null,
  bgmOscillators: [],
  currentStep: 0,

  getVolume() {
    return isMuted ? 0 : masterVolume;
  },

  playSFX(type) {
    if (this.getVolume() === 0) return;
    if (audioCtx.state === "suspended") audioCtx.resume();

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const vol = this.getVolume();

    switch (type) {
      case "move": // 틱 (짧은 펄스)
        osc.type = "square";
        osc.frequency.setValueAtTime(300, t);
        gain.gain.setValueAtTime(0.05 * vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
      case "rotate": // 티릭 (빠르게 상승)
        osc.type = "sine";
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
        gain.gain.setValueAtTime(0.05 * vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      case "drop": // 탁 (바닥 도달)
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);
        gain.gain.setValueAtTime(0.15 * vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
        break;
      case "clear": // 뾰로롱 (화음 아르페지오)
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = "square";
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.1 * vol, t + i * 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.2);
          o.connect(g);
          g.connect(audioCtx.destination);
          o.start(t + i * 0.05);
          o.stop(t + i * 0.05 + 0.2);
        });
        break;
      case "gameover": // 띠로로... (디센딩)
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 1.5);
        gain.gain.setValueAtTime(0.2 * vol, t);
        gain.gain.linearRampToValueAtTime(0, t + 1.5);
        osc.start(t);
        osc.stop(t + 1.5);
        break;
    }
  },

  startBGM() {
    this.stopBGM();
    if (audioCtx.state === "suspended") audioCtx.resume();

    // 테트리스 메인 테마(Korobeiniki)를 모티브로 한 8비트 멜로디 루프
    const baseNotes = [
      220.0, 220.0, 220.0, 220.0, 174.61, 174.61, 174.61, 174.61, 196.0, 196.0,
      196.0, 196.0, 164.81, 164.81, 164.81, 164.81,
    ];
    const melodyNotes = [
      329.63, 246.94, 261.63, 293.66, 261.63, 246.94, 220.0, 220.0, 261.63,
      329.63, 293.66, 261.63, 246.94, 246.94, 261.63, 293.66,
    ];

    this.bgmInterval = setInterval(() => {
      if (this.getVolume() === 0 || isPaused) return;

      const t = audioCtx.currentTime;
      const vol = this.getVolume() * 0.04; // 배경음악은 조용하게

      // 베이스 (8비트 톱니파)
      const bOsc = audioCtx.createOscillator();
      const bGain = audioCtx.createGain();
      bOsc.type = "sawtooth";
      bOsc.frequency.value = baseNotes[this.currentStep % baseNotes.length] / 2; // 한 옥타브 낮게
      bGain.gain.setValueAtTime(vol * 0.5, t);
      bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      bOsc.connect(bGain);
      bGain.connect(audioCtx.destination);
      bOsc.start(t);
      bOsc.stop(t + 0.15);
      this.bgmOscillators.push(bOsc);

      // 멜로디 (사각파)
      const mOsc = audioCtx.createOscillator();
      const mGain = audioCtx.createGain();
      mOsc.type = "square";
      mOsc.frequency.value = melodyNotes[this.currentStep % melodyNotes.length];
      mGain.gain.setValueAtTime(vol * 0.5, t);
      mGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      mOsc.connect(mGain);
      mGain.connect(audioCtx.destination);
      mOsc.start(t);
      mOsc.stop(t + 0.15);
      this.bgmOscillators.push(mOsc);

      this.currentStep++;
      if (this.bgmOscillators.length > 20)
        this.bgmOscillators.splice(0, this.bgmOscillators.length - 10);
    }, 200); // 템포
  },

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.bgmOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch (e) {}
    });
    this.bgmOscillators = [];
    this.currentStep = 0;
  },
};

// 사운드 컨트롤 UI 이벤트 리스너
const btnMute = document.getElementById("btn-mute");
const volumeSlider = document.getElementById("volume-slider");
if (btnMute && volumeSlider) {
  btnMute.addEventListener("click", () => {
    isMuted = !isMuted;
    btnMute.textContent = isMuted ? "🔇" : "🔊";
    if (audioCtx.state === "suspended" && !isMuted) audioCtx.resume();
  });
  volumeSlider.addEventListener("input", (e) => {
    masterVolume = parseFloat(e.target.value);
    if (masterVolume > 0 && isMuted) {
      isMuted = false;
      btnMute.textContent = "🔊";
    }
  });
}

// 게임 보드 초기화
function createBoard() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// 새로운 조각 생성
function createPiece(type) {
  return {
    matrix: SHAPES[type].map((row) => [...row]), // 블록 회전 시 원본 데이터 손상을 막기 위한 깊은 복사
    pos: {
      x: Math.floor(COLS / 2) - Math.floor(SHAPES[type][0].length / 2),
      y: 0,
    },
    type: type,
  };
}

function generateRandomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  return createPiece(type);
}

// 충돌 검사
function collide(board, piece) {
  const m = piece.matrix;
  const o = piece.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 && (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

// 보드에 조각 합치기
function merge(board, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        board[y + piece.pos.y][x + piece.pos.x] = value;
      }
    });
  });
}

// 줄 완성 확인 및 점수 처리
function sweep() {
  let linesCleared = 0;
  outer: for (let y = board.length - 1; y >= 0; --y) {
    for (let x = 0; x < board[y].length; ++x) {
      if (board[y][x] === 0) {
        continue outer;
      }
    }
    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    ++y;
    linesCleared++;
  }

  if (linesCleared > 0) {
    SoundManager.playSFX("clear");
    const points = [0, 100, 300, 500, 800];
    score += points[linesCleared];
    scoreElement.textContent = score;

    scoreElement.classList.remove("score-pulse");
    void scoreElement.offsetWidth;
    scoreElement.classList.add("score-pulse");

    // 레벨업 기믹: 점수 1000점 단위로 레벨 상승, 배경색 변경 및 속도 점프
    const newLevel = Math.floor(score / 1000) + 1;
    if (newLevel > currentLevel) {
      currentLevel = newLevel;
      // 레벨업 시 속도 한 번에 증가 (최대 속도 300ms)
      dropInterval = Math.max(300, 1000 - (currentLevel - 1) * 150);
      document.body.style.filter = `hue-rotate(${(currentLevel - 1) * 60}deg)`;
      showLevelUpPopup("LEVEL UP! ⚡");
    }

    // 멀티플레이 공격 로직
    if (isMultiplayer && linesCleared >= 2) {
      const attackLines = linesCleared - 1; // 2줄->1줄, 3줄->2줄, 4줄->3줄
      let holeIndex;
      do {
        holeIndex = Math.floor(Math.random() * COLS);
      } while (holeIndex === lastHoleIndex); // 이전 공격과 위치가 다르게 설정
      lastHoleIndex = holeIndex;
      sendAttack(attackLines, holeIndex);
    }
  }
}

// 스킵 UI 업데이트
function updateSkipUI() {
  const skipStatus = document.getElementById("skip-status");
  const skipBar = document.getElementById("skip-bar");
  if (!skipStatus || !skipBar) return;

  if (skipCooldown === 0) {
    skipStatus.textContent = "READY";
    skipStatus.className = "status-ready";
    skipBar.style.width = "100%";
    skipBar.style.backgroundColor = "#4caf50";
  } else {
    skipStatus.textContent = `${skipCooldown} LEFT`;
    skipStatus.className = "status-cooldown";
    skipBar.style.width = `${((MAX_SKIP_COOLDOWN - skipCooldown) / MAX_SKIP_COOLDOWN) * 100}%`;
    skipBar.style.backgroundColor = "#ff3333";
  }
}

// 블록 스킵 액션
function skipPieceAction() {
  if (skipCooldown > 0) return;
  piece = nextPiece;
  nextPiece = generateRandomPiece();
  drawNextPiece();
  skipCooldown = MAX_SKIP_COOLDOWN;
  updateSkipUI();

  if (collide(board, piece)) {
    gameOver();
  }
  dropCounter = 0;
  lockDelayCounter = 0;
}

// 블록 고정 (Lock) 처리 함수
function lockPiece() {
  if (
    typeof window.handleItemPieceLanded === "function" &&
    window.handleItemPieceLanded()
  ) {
    return;
  }

  SoundManager.playSFX("drop");
  merge(board, piece);
  sweep();
  piece = nextPiece;
  nextPiece = generateRandomPiece();
  drawNextPiece();
  if (skipCooldown > 0) {
    skipCooldown--;
    updateSkipUI();
  }
  if (collide(board, piece)) {
    gameOver();
  }
  lockDelayCounter = 0;
  dropCounter = 0;
}

// 블록 떨어지기 (소프트 드롭 & 자연 하강)
function pieceDrop() {
  piece.pos.y++;
  if (collide(board, piece)) {
    piece.pos.y--;
  } else {
    dropCounter = 0;
  }
}

// 즉시 하강 (하드 드롭)
function pieceHardDrop() {
  while (!collide(board, piece)) {
    piece.pos.y++;
  }
  piece.pos.y--;
  lockPiece();
}

// 좌우 이동
function pieceMove(offset) {
  piece.pos.x += offset;
  if (collide(board, piece)) {
    piece.pos.x -= offset;
  } else {
    SoundManager.playSFX("move");
  }
}

// 회전 로직
function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) {
    matrix.forEach((row) => row.reverse());
  } else {
    matrix.reverse();
  }
}

function pieceRotate() {
  const pos = piece.pos.x;
  let offset = 1;
  rotate(piece.matrix, 1);
  // 벽 충돌 보정 (Wall Kick)
  while (collide(board, piece)) {
    piece.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > piece.matrix[0].length) {
      rotate(piece.matrix, -1);
      piece.pos.x = pos;
      return;
    }
  }
  SoundManager.playSFX("rotate");
}

// 그리기
function drawMatrix(matrix, offset, targetCtx = ctx) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        targetCtx.fillStyle = COLORS[value];
        targetCtx.fillRect(x + offset.x, y + offset.y, 1, 1);

        // 상단, 좌측 빛 하이라이트
        targetCtx.fillStyle = "rgba(255, 255, 255, 0.3)";
        targetCtx.beginPath();
        targetCtx.moveTo(x + offset.x, y + offset.y);
        targetCtx.lineTo(x + offset.x + 1, y + offset.y);
        targetCtx.lineTo(x + offset.x + 0.8, y + offset.y + 0.2);
        targetCtx.lineTo(x + offset.x + 0.2, y + offset.y + 0.2);
        targetCtx.lineTo(x + offset.x + 0.2, y + offset.y + 0.8);
        targetCtx.lineTo(x + offset.x, y + offset.y + 1);
        targetCtx.fill();

        // 하단, 우측 그림자
        targetCtx.fillStyle = "rgba(0, 0, 0, 0.4)";
        targetCtx.beginPath();
        targetCtx.moveTo(x + offset.x + 1, y + offset.y + 1);
        targetCtx.lineTo(x + offset.x, y + offset.y + 1);
        targetCtx.lineTo(x + offset.x + 0.2, y + offset.y + 0.8);
        targetCtx.lineTo(x + offset.x + 0.8, y + offset.y + 0.8);
        targetCtx.lineTo(x + offset.x + 0.8, y + offset.y + 0.2);
        targetCtx.lineTo(x + offset.x + 1, y + offset.y);
        targetCtx.fill();

        // 테두리
        targetCtx.lineWidth = 0.05;
        targetCtx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        targetCtx.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function draw() {
  // 배경색 동적 설정 (럭키모드 무지개, 아이템전 어두운 빨강, 일반전 어두운 파랑)
  if (typeof window.isLuckyMode !== "undefined" && window.isLuckyMode) {
    const hue = (performance.now() / 10) % 360;
    ctx.fillStyle = `hsla(${hue}, 80%, 20%, 1)`;
  } else {
    const itemTheme =
      (typeof isItemMode !== "undefined" && isItemMode) ||
      (typeof window.isMultiItemMode !== "undefined" && window.isMultiItemMode);
    ctx.fillStyle = itemTheme ? "#2a0a0a" : "#0a0a2a";
  }
  ctx.fillRect(0, 0, COLS, ROWS); // 스케일이 적용된 상태이므로 칸 단위로 배경 지우기

  // 블록 크기의 희미한 선 (그리드) 그리기
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 0.05;
  ctx.setLineDash([0.1, 0.1]); // 점선 효과
  ctx.beginPath();
  for (let x = 0; x <= COLS; x++) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ROWS);
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.moveTo(0, y);
    ctx.lineTo(COLS, y);
  }
  ctx.stroke();
  ctx.setLineDash([]); // 복구

  drawMatrix(board, { x: 0, y: 0 });
  if (piece) {
    // 고스트 블록 계산 및 그리기
    const ghost = {
      matrix: piece.matrix,
      pos: { x: piece.pos.x, y: piece.pos.y },
    };
    while (!collide(board, ghost)) {
      ghost.pos.y++;
    }
    ghost.pos.y--; // 바닥에 닿기 직전 위치로 복구

    ctx.globalAlpha = 0.2; // 반투명 설정
    drawMatrix(ghost.matrix, ghost.pos);
    ctx.globalAlpha = 1.0; // 원래 투명도로 복구

    drawMatrix(piece.matrix, piece.pos);
  }

  if (isMultiplayer) {
    drawOpponent();
  }
}

function drawOpponent() {
  if (!oppCtx) return;
  oppCtx.fillStyle =
    typeof window.isMultiItemMode !== "undefined" && window.isMultiItemMode
      ? "#2a0a0a"
      : "#0a0a2a";
  oppCtx.fillRect(0, 0, COLS, ROWS);

  // 그리드 그리기
  oppCtx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  oppCtx.lineWidth = 0.05;
  oppCtx.setLineDash([0.1, 0.1]);
  oppCtx.beginPath();
  for (let x = 0; x <= COLS; x++) {
    oppCtx.moveTo(x, 0);
    oppCtx.lineTo(x, ROWS);
  }
  for (let y = 0; y <= ROWS; y++) {
    oppCtx.moveTo(0, y);
    oppCtx.lineTo(COLS, y);
  }
  oppCtx.stroke();
  oppCtx.setLineDash([]);

  if (opponentBoard.length > 0) {
    drawMatrix(opponentBoard, { x: 0, y: 0 }, oppCtx);
  }
}

function drawNextPiece() {
  nextCtx.fillStyle = "#333";
  nextCtx.fillRect(
    0,
    0,
    nextCanvas.width / BLOCK_SIZE,
    nextCanvas.height / BLOCK_SIZE,
  );

  // Next 캔버스 중앙에 표시하기 위한 계산
  const offsetX = (4 - nextPiece.matrix[0].length) / 2;
  const offsetY = (4 - nextPiece.matrix.length) / 2;

  drawMatrix(nextPiece.matrix, { x: offsetX, y: offsetY }, nextCtx);
}

// 메인 게임 루프
function update(time = 0) {
  if (isGameOver) return;

  if (isPaused) {
    lastTime = time;
    animationId = requestAnimationFrame(update);
    return;
  }

  const deltaTime = time - lastTime;
  lastTime = time;

  // 아이템 타이머 갱신 (진행된 시간만큼 차감)
  if (typeof window.updateItemTimers === "function") {
    window.updateItemTimers(deltaTime);
  }

  // 바닥 충돌 여부 체크 (Lock Delay 로직)
  piece.pos.y++;
  const isTouchingFloor = collide(board, piece);
  piece.pos.y--;

  if (isTouchingFloor) {
    lockDelayCounter += deltaTime;
    if (lockDelayCounter >= LOCK_DELAY_LIMIT) {
      lockPiece();
    }
  } else {
    lockDelayCounter = 0; // 공중에 있으면 유예 시간 초기화
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      pieceDrop();
    }
  }

  draw();
  animationId = requestAnimationFrame(update);
}

// 게임 시작 및 종료
function startGame() {
  isMultiplayer = false;
  opponentPanel.classList.add("hidden");
  mySpaceIndicator.classList.add("hidden");
  startBtn.classList.remove("hidden");
  const ink = document.getElementById("ink-splatter-container");
  if (ink) ink.remove();
  window.isReversed = false;
  if (syncInterval) clearInterval(syncInterval);
  if (unsubscribeActions) {
    unsubscribeActions();
    unsubscribeActions = null;
  }

  createBoard();
  score = 0;
  scoreElement.textContent = score;
  currentLevel = 1;
  document.body.style.filter = "hue-rotate(0deg)";
  dropInterval = 1000;
  isGameOver = false;
  isPlaying = true;
  isPaused = false;
  piece = generateRandomPiece();
  nextPiece = generateRandomPiece();
  drawNextPiece();
  skipCooldown = 0;
  lockDelayCounter = 0;
  updateSkipUI();
  startBtn.textContent = "다시 시작";

  SoundManager.startBGM();
  if (animationId) cancelAnimationFrame(animationId);
  lastTime = performance.now(); // 프레임 튐으로 인한 갑작스러운 하강 방지
  update(lastTime);
}

function showResultModal(title, desc) {
  resultTitle.textContent = title;
  resultDesc.textContent = desc;

  resultTitle.className = ""; // 클래스 초기화
  if (title === "VICTORY") resultTitle.classList.add("text-victory");
  else if (title === "DEFEAT" || title === "GAME OVER")
    resultTitle.classList.add("text-defeat");

  if (isMultiplayer) {
    btnResultLobby.classList.remove("hidden");
  } else {
    btnResultLobby.classList.add("hidden");
  }

  resultModal.classList.remove("hidden");
}

function gameOver() {
  isGameOver = true;
  isPlaying = false;
  SoundManager.playSFX("gameover");
  SoundManager.stopBGM();
  if (animationId) cancelAnimationFrame(animationId); // 확실하게 렌더링 루프 정지

  if (isMultiplayer) {
    showResultModal("DEFEAT", "패배하셨습니다. 😥");
    if (db && currentRoomId) {
      window.fs
        .updateDoc(window.fs.doc(db, "tetris_rooms", currentRoomId), {
          status: "gameover",
          loser: amIHost ? 0 : 1,
        })
        .catch((e) => console.error(e));
    }
  } else {
    showResultModal("GAME OVER", `최종 점수: ${score}`);
  }
}

// 메뉴 이벤트 리스너
btn1p.addEventListener("click", () => {
  startScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  startGame();
  canvas.focus();
});

btnHowto.addEventListener("click", () => {
  howtoModal.classList.remove("hidden");
});

btnCloseHowto.addEventListener("click", () => {
  howtoModal.classList.add("hidden");
});

btnBackToMenu.addEventListener("click", () => {
  isGameOver = true;
  isPlaying = false;
  isPaused = false;
  SoundManager.stopBGM();

  // 멀티플레이 중 나갈 때 상대방 승리를 위해 기권 처리
  if (isMultiplayer && db && currentRoomId) {
    window.fs
      .updateDoc(window.fs.doc(db, "tetris_rooms", currentRoomId), {
        status: "gameover",
        loser: amIHost ? 0 : 1,
      })
      .catch((e) => console.error(e));
  }

  isMultiplayer = false;
  if (syncInterval) clearInterval(syncInterval);
  if (unsubscribeActions) {
    unsubscribeActions();
    unsubscribeActions = null;
  }

  mySpaceIndicator.classList.add("hidden");
  document.body.style.filter = "hue-rotate(0deg)";

  if (animationId) cancelAnimationFrame(animationId);

  gameScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
});

btnPause.addEventListener("click", () => {
  if (!isPlaying || isMultiplayer || isGameOver) return;
  isPaused = !isPaused;
  if (isPaused) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, COLS, ROWS);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "bold 1.5px 'Orbitron', 'Noto Sans KR', sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", COLS / 2, ROWS / 2);
  }
  canvas.focus(); // 버튼 클릭 후 키보드 입력을 위해 캔버스로 포커스 되돌림
});

startBtn.addEventListener("click", () => {
  startGame();
  // 게임 보드로 포커스 이동하여 키 입력 즉시 적용
  canvas.focus();
});

// 키보드 입력 처리
document.addEventListener("keydown", (event) => {
  if (!isPlaying) return;

  // P 키 또는 ESC 키로 일시정지 (싱글플레이 전용)
  if (event.key === "Escape" || event.key.toLowerCase() === "p") {
    if (!isMultiplayer) {
      isPaused = !isPaused;
      if (isPaused) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, COLS, ROWS);
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "bold 1.5px 'Orbitron', 'Noto Sans KR', sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText("PAUSED", COLS / 2, ROWS / 2);
      }
    }
    return;
  }

  if (isPaused) return;

  let dir = window.isReversed ? -1 : 1; // 방향키 반전 아이템 체크

  if (event.key === "ArrowLeft") {
    pieceMove(-1 * dir);
  } else if (event.key === "ArrowRight") {
    pieceMove(1 * dir);
  } else if (event.key === "ArrowDown") {
    if (window.isReversed) {
      pieceRotate();
    } else {
      pieceDrop();
      SoundManager.playSFX("move");
    }
  } else if (event.key === "ArrowUp") {
    if (window.isReversed) {
      pieceDrop();
      SoundManager.playSFX("move");
    } else {
      pieceRotate();
    }
  } else if (event.key === " ") {
    pieceHardDrop();
  } else if (event.key === "Tab") {
    skipPieceAction();
  } else if (event.key === "Shift") {
    if (typeof window.handleShiftPress === "function")
      window.handleShiftPress();
  }

  // 스페이스바나 화살표 키 기본 동작(스크롤) 방지
  if (
    [" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(
      event.key,
    )
  ) {
    event.preventDefault();
  }
});

// 결과 창: 메인 메뉴로 돌아가기
btnResultMain.addEventListener("click", () => {
  resultModal.classList.add("hidden");
  gameScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  isPaused = false;
  SoundManager.stopBGM();
  document.body.style.filter = "hue-rotate(0deg)";

  if (isMultiplayer) {
    isMultiplayer = false;
    if (syncInterval) clearInterval(syncInterval);
    if (unsubscribeActions) {
      unsubscribeActions();
      unsubscribeActions = null;
    }
    if (unsubscribeChat) unsubscribeChat();
    if (unsubscribeRoom) unsubscribeRoom();

    if (currentRoomId && db) {
      const roomRef = window.fs.doc(db, "tetris_rooms", currentRoomId);
      window.fs.getDoc(roomRef).then((roomSnap) => {
        if (roomSnap.exists()) {
          let players = roomSnap.data().players || [];
          players = players.filter((p) => p.nickname !== myNickname);
          window.fs.updateDoc(roomRef, { players });
          sendChatMessage(`상대방이 대기실을 떠났습니다.`, true);
        }
      });
    }
    currentRoomId = null;
    chatMessages.innerHTML = "";
  }
});

// 결과 창: 멀티플레이 대기실로 돌아가기
btnResultLobby.addEventListener("click", async () => {
  resultModal.classList.add("hidden");
  gameScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
  SoundManager.stopBGM();

  if (syncInterval) clearInterval(syncInterval);
  if (unsubscribeActions) {
    unsubscribeActions();
    unsubscribeActions = null;
  }

  // 방장이 게임 상태를 waiting으로 되돌려 상대방도 로비에서 재준비할 수 있게 함
  if (amIHost && db && currentRoomId) {
    try {
      const roomRef = window.fs.doc(db, "tetris_rooms", currentRoomId);
      const roomSnap = await window.fs.getDoc(roomRef);
      if (roomSnap.exists()) {
        let players = roomSnap
          .data()
          .players.map((p) => ({ ...p, isReady: false }));
        await window.fs.updateDoc(roomRef, {
          status: "waiting",
          loser: null,
          players: players,
        });
      }
    } catch (e) {
      console.error(e);
    }
  }
});

// --- 멀티플레이 로비 시스템 (Firebase 동적 로드) ---
const multiMenuScreen = document.getElementById("multi-menu-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const btnJoinCheck = document.getElementById("btn-join-check");
const btnCreateRoom = document.getElementById("btn-create-room");
const btnBackMenuMulti = document.getElementById("btn-back-menu");
const roomInput = document.getElementById("room-code-input");
const multiStatus = document.getElementById("multi-status");

const displayRoomCode = document.getElementById("display-room-code");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const btnSendChat = document.getElementById("btn-send-chat");
const joinModal = document.getElementById("join-modal");
const nicknameInput = document.getElementById("nickname-input");
const btnJoinConfirm = document.getElementById("btn-join-confirm");
const btnJoinCancel = document.getElementById("btn-join-cancel");
const btnReadyMulti = document.getElementById("btn-ready-multi");
const btnGameStartMulti = document.getElementById("btn-game-start-multi");
const btnGameStartItemMulti = document.getElementById(
  "btn-game-start-item-multi",
);
const btnBackLobby = document.getElementById("btn-back-lobby");
const lobbyPlayerSlots = document.getElementById("lobby-player-slots");

let db = null;
let currentRoomId = null;
let myNickname = "Player";
let unsubscribeChat = null;
let unsubscribeRoom = null;
let isCreatingRoom = false;
let amIHost = false;

// 2P 버튼 클릭 시 서버 연결
btn2p.addEventListener("click", async () => {
  startScreen.classList.add("hidden");
  multiMenuScreen.classList.remove("hidden");

  if (!db) {
    multiStatus.textContent = "서버 연결 중...";
    try {
      const { initializeApp } =
        await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
      const {
        getFirestore,
        collection,
        addDoc,
        doc,
        onSnapshot,
        setDoc,
        getDoc,
        updateDoc,
        arrayUnion,
        serverTimestamp,
        runTransaction,
      } =
        await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
      const { firebaseConfig } = await import("../suika/firebaseConfig.js");

      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      multiStatus.textContent = "서버 연결 성공!";

      window.fs = {
        collection,
        addDoc,
        doc,
        onSnapshot,
        setDoc,
        getDoc,
        updateDoc,
        arrayUnion,
        serverTimestamp,
        runTransaction,
      };
    } catch (e) {
      console.error(e);
      multiStatus.textContent = "서버 연결 실패: " + e.message;
    }
  }
});

// 로비 뒤로가기
btnBackMenuMulti.addEventListener("click", () => {
  multiMenuScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
});

// 방 만들기
btnCreateRoom.addEventListener("click", async () => {
  if (!db) return;
  isCreatingRoom = true;
  joinModal.classList.remove("hidden");
  nicknameInput.value = "";
  nicknameInput.placeholder = "방장 닉네임 입력";
  nicknameInput.focus();
});

// 방 참가 확인
btnJoinCheck.addEventListener("click", async () => {
  if (!db) return;
  const code = roomInput.value.trim();
  if (code.length !== 4) {
    multiStatus.textContent = "4자리 코드를 입력하세요.";
    return;
  }

  isCreatingRoom = false;
  multiStatus.textContent = "방 찾는 중...";
  try {
    const roomRef = window.fs.doc(db, "tetris_rooms", code);
    const roomSnap = await window.fs.getDoc(roomRef);

    if (!roomSnap.exists()) {
      multiStatus.textContent = "존재하지 않는 방입니다.";
      return;
    }

    const roomData = roomSnap.data();
    if (roomData.players && roomData.players.length >= 2) {
      multiStatus.textContent = "이미 꽉 찬 방입니다.";
      return;
    }

    currentRoomId = code;
    joinModal.classList.remove("hidden");
    nicknameInput.value = "";
    nicknameInput.placeholder = "이름을 입력하세요";
    nicknameInput.focus();
  } catch (e) {
    console.error(e);
    multiStatus.textContent = "참가 오류: " + e.message;
  }
});

// 닉네임 확인 후 방 생성/참가
btnJoinConfirm.addEventListener("click", async () => {
  const name = nicknameInput.value.trim();
  if (!name) return;

  myNickname = name;
  joinModal.classList.add("hidden");

  if (isCreatingRoom) {
    multiStatus.textContent = "방 생성 중...";
    try {
      const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
      currentRoomId = roomCode;

      const initialPlayer = {
        nickname: myNickname,
        isHost: true,
        isReady: false,
      };

      await window.fs.setDoc(window.fs.doc(db, "tetris_rooms", roomCode), {
        host: myNickname,
        status: "waiting",
        createdAt: Date.now(),
        players: [initialPlayer],
      });

      multiMenuScreen.classList.add("hidden");
      lobbyScreen.classList.remove("hidden");
      displayRoomCode.textContent = roomCode;
      addMessageToUI("System", "방이 생성되었습니다.");
      amIHost = true;

      setupChatListener(roomCode);
      setupRoomListener(roomCode);
    } catch (e) {
      multiStatus.textContent = "오류: " + e.message;
    }
  } else {
    try {
      const roomRef = window.fs.doc(db, "tetris_rooms", currentRoomId);
      const roomSnap = await window.fs.getDoc(roomRef);

      if (roomSnap.exists()) {
        const roomData = roomSnap.data();
        if (
          roomData.players &&
          roomData.players.some((p) => p.nickname === myNickname)
        ) {
          alert("이미 방에 존재하는 닉네임입니다. 다른 닉네임을 입력해주세요.");
          joinModal.classList.remove("hidden");
          return;
        }
      }

      multiMenuScreen.classList.add("hidden");
      lobbyScreen.classList.remove("hidden");
      displayRoomCode.textContent = currentRoomId;

      const newPlayer = { nickname: myNickname, isHost: false, isReady: false };

      await window.fs.updateDoc(roomRef, {
        players: window.fs.arrayUnion(newPlayer),
      });

      await sendChatMessage(`${myNickname}님이 입장하셨습니다.`, true);
      amIHost = false;

      setupChatListener(currentRoomId);
      setupRoomListener(currentRoomId);
    } catch (e) {
      alert("입장 중 오류 발생: " + e.message);
    }
  }
});

btnJoinCancel.addEventListener("click", () => {
  joinModal.classList.add("hidden");
  currentRoomId = null;
});

// 준비 버튼 이벤트 리스너
btnReadyMulti.addEventListener("click", async () => {
  if (!db || !currentRoomId) return;

  btnReadyMulti.disabled = true;
  try {
    const roomRef = window.fs.doc(db, "tetris_rooms", currentRoomId);
    await window.fs.runTransaction(db, async (transaction) => {
      const roomDoc = await transaction.get(roomRef);
      if (!roomDoc.exists()) {
        throw "Room does not exist!";
      }
      const players = roomDoc.data().players.map((p) => ({ ...p }));
      const myPlayerIndex = players.findIndex((p) => p.nickname === myNickname);
      if (myPlayerIndex !== -1) {
        players[myPlayerIndex].isReady = !players[myPlayerIndex].isReady;
        transaction.update(roomRef, { players: players });
      }
    });
  } catch (e) {
    console.error("Ready-up failed: ", e);
    btnReadyMulti.disabled = false;
  }
});

// 로비 나가기
btnBackLobby.addEventListener("click", async () => {
  if (unsubscribeChat) unsubscribeChat();
  if (unsubscribeRoom) unsubscribeRoom();

  if (currentRoomId && db) {
    try {
      const roomRef = window.fs.doc(db, "tetris_rooms", currentRoomId);
      const roomSnap = await window.fs.getDoc(roomRef);
      if (roomSnap.exists()) {
        let players = roomSnap.data().players || [];
        players = players.filter((p) => p.nickname !== myNickname);
        await window.fs.updateDoc(roomRef, { players });
        await sendChatMessage(`상대방이 대기실을 떠났습니다.`, true);
      }
    } catch (e) {
      console.error(e);
    }
  }

  lobbyScreen.classList.add("hidden");
  multiMenuScreen.classList.remove("hidden");
  currentRoomId = null;
  chatMessages.innerHTML = "";
});

// 채팅 및 방 상태 관리
async function sendChatMessage(text, isSystem = false) {
  if (!db || !currentRoomId) return;
  const messagesRef = window.fs.collection(
    db,
    "tetris_rooms",
    currentRoomId,
    "messages",
  );
  await window.fs.addDoc(messagesRef, {
    text: text,
    sender: isSystem ? "System" : myNickname,
    timestamp: window.fs.serverTimestamp(),
  });
}

function setupChatListener(roomId) {
  const messagesRef = window.fs.collection(
    db,
    "tetris_rooms",
    roomId,
    "messages",
  );
  unsubscribeChat = window.fs.onSnapshot(messagesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const msg = change.doc.data();
        addMessageToUI(msg.sender, msg.text);
      }
    });
  });
}

function addMessageToUI(sender, text) {
  const div = document.createElement("div");
  div.style.marginBottom = "5px";
  if (sender === "System") {
    div.style.color = "#f39c12";
    div.textContent = `[알림] ${text}`;
  } else {
    div.innerHTML = `<span style="color: #e94057; font-weight:bold;">${sender}:</span> ${text}`;
  }
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

btnSendChat.addEventListener("click", () => {
  const text = chatInput.value.trim();
  if (text) {
    sendChatMessage(text);
    chatInput.value = "";
  }
});
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") btnSendChat.click();
});

function setupRoomListener(roomId) {
  unsubscribeRoom = window.fs.onSnapshot(
    window.fs.doc(db, "tetris_rooms", roomId),
    (doc) => {
      const data = doc.data();
      if (data && data.players) {
        renderLobbySlots(data.players);

        // 상대방 보드 렌더링 동기화
        if (isMultiplayer && isPlaying) {
          try {
            if (!amIHost && data.board_0)
              opponentBoard = JSON.parse(data.board_0);
            if (amIHost && data.board_1)
              opponentBoard = JSON.parse(data.board_1);
          } catch (e) {}
        }

        if (data.status === "playing" && !isPlaying) {
          // 아이템전 모드 체크 및 UI 세팅
          window.isMultiItemMode = data.mode === "item";
          if (window.isMultiItemMode) {
            document.body.classList.add("item-theme");
            if (typeof resetMultiplayerInventory === "function")
              resetMultiplayerInventory();
          } else {
            document.body.classList.remove("item-theme");
          }
          document.getElementById("multi-item-ui")?.classList.add("hidden");

          lobbyScreen.classList.add("hidden");
          multiMenuScreen.classList.add("hidden");
          startScreen.classList.add("hidden");
          gameScreen.classList.remove("hidden");
          startGameMulti();
          canvas.focus();
        }

        if (data.status === "gameover" && isPlaying) {
          const myIndex = amIHost ? 0 : 1;
          if (data.loser !== myIndex) {
            isGameOver = true;
            isPlaying = false;
            if (animationId) cancelAnimationFrame(animationId); // 확실하게 렌더링 정지
            showResultModal("VICTORY", "상대방이 게임 오버되었습니다! 🎉");
          }
        }
      }
    },
  );
}

function renderLobbySlots(playersData) {
  lobbyPlayerSlots.innerHTML = "";

  const myPlayer = playersData.find((p) => p.nickname === myNickname);
  amIHost = myPlayer?.isHost ?? false;

  for (let i = 0; i < 2; i++) {
    const player = playersData[i];
    const slot = document.createElement("div");
    slot.className = `player-slot ${player && player.isHost ? "host" : ""}`;

    if (player) {
      if (player.isReady && !player.isHost) {
        slot.classList.add("ready");
      }
      slot.innerHTML = `
        <div style="font-size:2rem; margin-bottom:10px;">${player.isHost ? "👑" : "👤"}</div>
        <div>${player.nickname}</div>
      `;
    } else {
      slot.innerHTML = `
        <div style="font-size:2rem; margin-bottom:10px; opacity:0.5;">Empty</div>
        <div style="opacity:0.5;">대기 중...</div>
      `;
    }
    lobbyPlayerSlots.appendChild(slot);
  }

  // 버튼 상태 및 표시 관리
  const otherPlayer = playersData.find((p) => p.nickname !== myNickname);

  if (amIHost) {
    btnGameStartMulti.classList.remove("hidden");
    btnGameStartItemMulti.classList.remove("hidden");
    btnReadyMulti.classList.add("hidden");
    btnGameStartMulti.disabled = false; // 상대방 레디와 상관없이 항상 누를 수 있게 활성화
    btnGameStartItemMulti.disabled = false;
  } else {
    btnGameStartMulti.classList.add("hidden");
    btnGameStartItemMulti.classList.add("hidden");
    btnReadyMulti.classList.remove("hidden");

    if (myPlayer && myPlayer.isReady) {
      btnReadyMulti.textContent = "준비 완료";
    } else {
      btnReadyMulti.textContent = "준비";
    }
    btnReadyMulti.disabled = false;
  }
}

btnGameStartMulti.addEventListener("click", async () => {
  if (!db || !currentRoomId) return;
  try {
    const roomRef = window.fs.doc(db, "tetris_rooms", currentRoomId);
    const roomSnap = await window.fs.getDoc(roomRef);

    if (roomSnap.exists()) {
      const players = roomSnap.data().players || [];
      const otherPlayer = players.find((p) => p.nickname !== myNickname);

      // 상대방이 없거나 레디하지 않은 경우 시스템 메시지 전송 후 시작 취소
      if (!otherPlayer || !otherPlayer.isReady) {
        await sendChatMessage("준비 버튼을 눌러주세요.", true);
        return;
      }
    }

    await window.fs.updateDoc(roomRef, { status: "playing", mode: "normal" });
  } catch (e) {
    console.error(e);
  }
});

btnGameStartItemMulti.addEventListener("click", async () => {
  if (!db || !currentRoomId) return;
  try {
    const roomRef = window.fs.doc(db, "tetris_rooms", currentRoomId);
    const roomSnap = await window.fs.getDoc(roomRef);

    if (roomSnap.exists()) {
      const players = roomSnap.data().players || [];
      const otherPlayer = players.find((p) => p.nickname !== myNickname);

      // 상대방이 없거나 레디하지 않은 경우
      if (!otherPlayer || !otherPlayer.isReady) {
        await sendChatMessage("준비 버튼을 눌러주세요.", true);
        return;
      }
    }

    await window.fs.updateDoc(roomRef, { status: "playing", mode: "item" });
  } catch (e) {
    console.error(e);
  }
});

// --- 멀티플레이 인게임 통신 및 게임 로직 ---

function startGameMulti() {
  isMultiplayer = true;
  lastHoleIndex = -1; // 초기화
  createBoard();
  opponentBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  score = 0;
  currentLevel = 1;
  document.body.style.filter = "hue-rotate(0deg)";
  scoreElement.textContent = score;
  dropInterval = 1000;
  isGameOver = false;
  isPlaying = true;
  piece = generateRandomPiece();
  nextPiece = generateRandomPiece();
  drawNextPiece();
  skipCooldown = 0;
  updateSkipUI();

  startBtn.classList.add("hidden");
  opponentPanel.classList.remove("hidden");

  // 내 공간 알림 화살표 3초 동안 표시
  mySpaceIndicator.classList.remove("hidden");
  setTimeout(() => {
    mySpaceIndicator.classList.add("hidden");
  }, 3000);

  setupActionsListener(currentRoomId);
  startMultiplayerSync();

  SoundManager.startBGM();

  if (animationId) cancelAnimationFrame(animationId);
  lastTime = performance.now();
  update(lastTime);
}

function startMultiplayerSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    if (!isPlaying) return;
    let displayBoard = board.map((row) => [...row]); // 현재 피스 포함 깊은 복사
    if (piece) {
      piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (
            value !== 0 &&
            displayBoard[y + piece.pos.y] &&
            displayBoard[y + piece.pos.y][x + piece.pos.x] !== undefined
          ) {
            displayBoard[y + piece.pos.y][x + piece.pos.x] = value;
          }
        });
      });
    }
    const updateData = {};
    updateData[amIHost ? "board_0" : "board_1"] = JSON.stringify(displayBoard);
    window.fs
      .updateDoc(window.fs.doc(db, "tetris_rooms", currentRoomId), updateData)
      .catch((e) => console.error(e));
  }, 500); // 부하를 줄이기 위해 0.5초마다 보드 동기화
}

async function sendAttack(lines, holeIndex) {
  if (!db || !currentRoomId) return;
  const actionsRef = window.fs.collection(
    db,
    "tetris_rooms",
    currentRoomId,
    "actions",
  );
  await window.fs.addDoc(actionsRef, {
    type: "attack",
    target: amIHost ? 1 : 0,
    lines: lines,
    hole: holeIndex,
    timestamp: window.fs.serverTimestamp(),
  });
}

function receiveAttack(lines, holeIndex) {
  // 피격 시 테두리 깜빡임 효과
  gameScreen.classList.remove("damage-flash");
  void gameScreen.offsetWidth; // 리플로우 발생으로 애니메이션 재시작
  gameScreen.classList.add("damage-flash");

  for (let i = 0; i < lines; i++) {
    board.shift();
    const newRow = new Array(COLS).fill(8); // 8: 회색 쓰레기 블록
    newRow[holeIndex] = 0; // 뚫린 구멍
    board.push(newRow);
  }
  if (piece) {
    piece.pos.y -= lines;
    if (collide(board, piece)) {
      gameOver();
    }
  }
}

function setupActionsListener(roomId) {
  if (unsubscribeActions) unsubscribeActions();
  const actionsRef = window.fs.collection(
    db,
    "tetris_rooms",
    roomId,
    "actions",
  );
  unsubscribeActions = window.fs.onSnapshot(actionsRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const action = change.doc.data();
        const myIndex = amIHost ? 0 : 1;
        if (
          action.type === "attack" &&
          action.target === myIndex &&
          isPlaying
        ) {
          receiveAttack(action.lines, action.hole);
        } else if (
          action.type === "itemAttack" &&
          action.target === myIndex &&
          isPlaying
        ) {
          if (typeof receiveItemAttack === "function")
            receiveItemAttack(action.itemType);
        }
      }
    });
  });
}

// 레벨업 팝업 효과
function showLevelUpPopup(text) {
  let popup = document.createElement("div");
  popup.className = "level-up-popup";
  popup.textContent = text;
  let wrapper = document.querySelector(".board-wrapper");
  if (wrapper) wrapper.appendChild(popup);
  setTimeout(() => popup.remove(), 2000);
}
