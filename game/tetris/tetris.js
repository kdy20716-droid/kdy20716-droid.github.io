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

const COLORS = [
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

let board = [];
let piece = null;
let nextPiece = null;
let score = 0;
let isGameOver = false;
let isPlaying = false;
let dropCounter = 0;
let dropInterval = 1000; // 1초마다 하강
let lastTime = 0;
let animationId = null;

// 게임 보드 초기화
function createBoard() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// 새로운 조각 생성
function createPiece(type) {
  return {
    matrix: SHAPES[type],
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
    const points = [0, 100, 300, 500, 800];
    score += points[linesCleared];
    scoreElement.textContent = score;
    // 레벨업에 따른 속도 증가
    dropInterval = Math.max(100, 1000 - Math.floor(score / 500) * 100);

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

// 블록 떨어지기
function pieceDrop() {
  piece.pos.y++;
  if (collide(board, piece)) {
    piece.pos.y--;
    merge(board, piece);
    sweep();
    piece = nextPiece;
    nextPiece = generateRandomPiece();
    drawNextPiece();
    if (collide(board, piece)) {
      gameOver();
    }
  }
  dropCounter = 0;
}

// 즉시 하강 (하드 드롭)
function pieceHardDrop() {
  while (!collide(board, piece)) {
    piece.pos.y++;
  }
  piece.pos.y--;
  merge(board, piece);
  sweep();
  piece = nextPiece;
  nextPiece = generateRandomPiece();
  drawNextPiece();
  if (collide(board, piece)) {
    gameOver();
  }
  dropCounter = 0;
}

// 좌우 이동
function pieceMove(offset) {
  piece.pos.x += offset;
  if (collide(board, piece)) {
    piece.pos.x -= offset;
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
}

// 그리기
function drawMatrix(matrix, offset, targetCtx = ctx) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        targetCtx.fillStyle = COLORS[value];
        targetCtx.fillRect(x + offset.x, y + offset.y, 1, 1);

        // 블록 입체감 효과
        targetCtx.lineWidth = 0.05;
        targetCtx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        targetCtx.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function draw() {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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
  oppCtx.fillStyle = "#111";
  oppCtx.fillRect(0, 0, oppCanvas.width / 15, oppCanvas.height / 15);
  if (opponentBoard.length > 0) {
    drawMatrix(opponentBoard, { x: 0, y: 0 }, oppCtx);
  }
}

function drawNextPiece() {
  nextCtx.fillStyle = "#333";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  // Next 캔버스 중앙에 표시하기 위한 계산
  const offsetX = (4 - nextPiece.matrix[0].length) / 2;
  const offsetY = (4 - nextPiece.matrix.length) / 2;

  drawMatrix(nextPiece.matrix, { x: offsetX, y: offsetY }, nextCtx);
}

// 메인 게임 루프
function update(time = 0) {
  if (isGameOver) return;

  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter > dropInterval) {
    pieceDrop();
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
  if (syncInterval) clearInterval(syncInterval);
  if (unsubscribeActions) {
    unsubscribeActions();
    unsubscribeActions = null;
  }

  createBoard();
  score = 0;
  scoreElement.textContent = score;
  dropInterval = 1000;
  isGameOver = false;
  isPlaying = true;
  piece = generateRandomPiece();
  nextPiece = generateRandomPiece();
  drawNextPiece();
  startBtn.textContent = "다시 시작";

  if (animationId) cancelAnimationFrame(animationId);
  update();
}

function gameOver() {
  isGameOver = true;
  isPlaying = false;
  if (isMultiplayer) {
    alert("게임 오버! 패배하셨습니다. 😥");
    if (db && currentRoomId) {
      window.fs
        .updateDoc(window.fs.doc(db, "tetris_rooms", currentRoomId), {
          status: "gameover",
          loser: amIHost ? 0 : 1,
        })
        .catch((e) => console.error(e));
    }
  } else {
    alert(`게임 오버! 최종 점수: ${score}`);
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
  isMultiplayer = false;
  if (syncInterval) clearInterval(syncInterval);
  if (unsubscribeActions) {
    unsubscribeActions();
    unsubscribeActions = null;
  }

  mySpaceIndicator.classList.add("hidden");

  if (animationId) cancelAnimationFrame(animationId);

  gameScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
});

startBtn.addEventListener("click", () => {
  startGame();
  // 게임 보드로 포커스 이동하여 키 입력 즉시 적용
  canvas.focus();
});

// 키보드 입력 처리
document.addEventListener("keydown", (event) => {
  if (!isPlaying) return;

  if (event.key === "ArrowLeft") {
    pieceMove(-1);
  } else if (event.key === "ArrowRight") {
    pieceMove(1);
  } else if (event.key === "ArrowDown") {
    pieceDrop();
  } else if (event.key === "ArrowUp") {
    pieceRotate();
  } else if (event.key === " ") {
    pieceHardDrop();
  }

  // 스페이스바나 화살표 키 기본 동작(스크롤) 방지
  if (
    [" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
  ) {
    event.preventDefault();
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
const btnGameStartMulti = document.getElementById("btn-game-start-multi");
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

      const initialPlayer = { nickname: myNickname, isHost: true };

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
    multiMenuScreen.classList.add("hidden");
    lobbyScreen.classList.remove("hidden");
    displayRoomCode.textContent = currentRoomId;

    try {
      const roomRef = window.fs.doc(db, "tetris_rooms", currentRoomId);
      const newPlayer = { nickname: myNickname, isHost: false };

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
        await sendChatMessage(`${myNickname}님이 퇴장하셨습니다.`, true);
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

        if (amIHost && data.players.length === 2) {
          btnGameStartMulti.disabled = false;
        } else {
          btnGameStartMulti.disabled = true;
        }

        // 상대방 보드 렌더링 동기화
        if (isMultiplayer && isPlaying) {
          try {
            if (!amIHost && data.board_0)
              opponentBoard = JSON.parse(data.board_0);
            if (amIHost && data.board_1)
              opponentBoard = JSON.parse(data.board_1);
          } catch (e) {}
        }

        if (data.status === "playing" && !isPlaying && !isGameOver) {
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
            alert("상대방이 게임 오버되었습니다! 승리하셨습니다! 🎉");
          }
        }
      }
    },
  );
}

function renderLobbySlots(playersData) {
  lobbyPlayerSlots.innerHTML = "";
  for (let i = 0; i < 2; i++) {
    const player = playersData[i];
    const slot = document.createElement("div");
    slot.className = `player-slot ${player && player.isHost ? "host" : ""}`;

    if (player) {
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
}

btnGameStartMulti.addEventListener("click", async () => {
  if (!db || !currentRoomId) return;
  try {
    const roomRef = window.fs.doc(db, "tetris_rooms", currentRoomId);
    await window.fs.updateDoc(roomRef, { status: "playing" });
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
  scoreElement.textContent = score;
  dropInterval = 1000;
  isGameOver = false;
  isPlaying = true;
  piece = generateRandomPiece();
  nextPiece = generateRandomPiece();
  drawNextPiece();

  startBtn.classList.add("hidden");
  opponentPanel.classList.remove("hidden");

  // 내 공간 알림 화살표 3초 동안 표시
  mySpaceIndicator.classList.remove("hidden");
  setTimeout(() => {
    mySpaceIndicator.classList.add("hidden");
  }, 3000);

  setupActionsListener(currentRoomId);
  startMultiplayerSync();

  if (animationId) cancelAnimationFrame(animationId);
  update();
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
        }
      }
    });
  });
}
