/* import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
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
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "../suika/firebaseConfig.js";

// --- Firebase 초기화 ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
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

// --- 상태 변수 ---
export let currentRoomId = null;
export let myNickname = "Player";
export let isHost = false;
export let myPlayerIndex = -1; // 방에서의 내 인덱스 (0~3)

let unsubscribeChat = null;
let unsubscribeRoom = null;
let unsubscribeActions = null;
let gameCallbacks = {
  onStart: null,
  onAction: null,
  onChat: null,
};

// --- UI 요소 (liars-roulette.html에 있는 요소들) ---
// DOM 요소들은 initMultiplayer 호출 시점에 가져오는 것이 안전함
let elements = {};

// --- 초기화 및 이벤트 리스너 등록 ---
export function initMultiplayer(callbacks) {
  gameCallbacks = callbacks;

  elements = {
    multiMenuScreen: document.getElementById("multi-menu-screen"),
    lobbyScreen: document.getElementById("lobby-screen"),
    startScreen: document.getElementById("start-screen"),
    multiStatus: document.getElementById("multi-status"),
    displayRoomCode: document.getElementById("display-room-code"),
    chatMessages: document.getElementById("chat-messages"),
    chatInput: document.getElementById("chat-input"),
    joinModal: document.getElementById("join-modal"),
    nicknameInput: document.getElementById("nickname-input"),
    lobbyPlayerSlots: document.getElementById("lobby-player-slots"),
    btnGameStartMulti: document.getElementById("btn-game-start-multi"),
    // 인게임 채팅 요소
    ingameChat: document.getElementById("ingame-chat"),
    ingameMessages: document.getElementById("ingame-messages"),
    ingameInput: document.getElementById("ingame-input"),
    btnIngameSend: document.getElementById("btn-ingame-send"),
  };

  // 버튼 이벤트 연결
  const btnMulti = document.getElementById("btn-multi");
  if (btnMulti) {
    btnMulti.addEventListener("click", () => {
      elements.startScreen.classList.add("hidden");
      elements.multiMenuScreen.classList.remove("hidden");
      elements.multiStatus.textContent = "서버 연결 성공!";
    });
  }

  const btnBackMenu = document.getElementById("btn-back-menu");
  if (btnBackMenu) {
    btnBackMenu.addEventListener("click", () => {
      elements.multiMenuScreen.classList.add("hidden");
      elements.startScreen.classList.remove("hidden");
    });
  }

  const btnBackLobby = document.getElementById("btn-back-lobby");
  if (btnBackLobby) {
    btnBackLobby.addEventListener("click", leaveRoom);
  }

  const btnCreateRoom = document.getElementById("btn-create-room");
  if (btnCreateRoom) {
    btnCreateRoom.addEventListener("click", () => {
      showJoinModal(true);
    });
  }

  const btnJoinCheck = document.getElementById("btn-join-check");
  if (btnJoinCheck) {
    btnJoinCheck.addEventListener("click", checkRoomCode);
  }

  const btnJoinConfirm = document.getElementById("btn-join-confirm");
  if (btnJoinConfirm) {
    btnJoinConfirm.addEventListener("click", confirmJoin);
  }

  const btnJoinCancel = document.getElementById("btn-join-cancel");
  if (btnJoinCancel) {
    btnJoinCancel.addEventListener("click", () => {
      elements.joinModal.classList.add("hidden");
    });
  }

  const btnSendChat = document.getElementById("btn-send-chat");
  if (btnSendChat) {
    btnSendChat.addEventListener("click", sendChatFromInput);
  }

  if (elements.chatInput) {
    elements.chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendChatFromInput();
    });
  }

  // 인게임 채팅 전송
  if (elements.btnIngameSend) {
    elements.btnIngameSend.addEventListener("click", sendIngameChat);
  }
  if (elements.ingameInput) {
    elements.ingameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendIngameChat();
    });
  }

  // 게임 시작 버튼 (방장)
  if (elements.btnGameStartMulti) {
    elements.btnGameStartMulti.addEventListener("click", startGameAsHost);
  }
}

// --- 로비 및 방 관리 로직 ---

let isCreatingRoom = false;

function showJoinModal(creating) {
  isCreatingRoom = creating;
  elements.joinModal.classList.remove("hidden");
  elements.nicknameInput.value = "";
  elements.nicknameInput.placeholder = creating
    ? "방장 닉네임 입력"
    : "이름을 입력하세요";
  elements.nicknameInput.focus();
}

async function checkRoomCode() {
  const roomInput = document.getElementById("room-code-input");
  const code = roomInput.value;
  if (code.length !== 4) {
    elements.multiStatus.textContent = "4자리 코드를 입력하세요.";
    return;
  }

  elements.multiStatus.textContent = "방 찾는 중...";
  try {
    const roomRef = doc(db, "liar_rooms", code);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      elements.multiStatus.textContent = "존재하지 않는 방입니다.";
      return;
    }
    const roomData = roomSnap.data();
    if (roomData.players && roomData.players.length >= 4) {
      elements.multiStatus.textContent = "이미 꽉 찬 방입니다.";
      return;
    }

    currentRoomId = code;
    showJoinModal(false);
  } catch (e) {
    console.error(e);
    elements.multiStatus.textContent = "오류: " + e.message;
  }
}

async function confirmJoin() {
  const name = elements.nicknameInput.value.trim();
  if (!name) return;

  myNickname = name;
  elements.joinModal.classList.add("hidden");

  if (isCreatingRoom) {
    await createRoom();
  } else {
    await joinRoom();
  }
}

async function createRoom() {
  elements.multiStatus.textContent = "방 생성 중...";
  try {
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    currentRoomId = roomCode;
    isHost = true;

    const initialPlayer = {
      nickname: myNickname,
      charIndex: 0,
      isHost: true,
    };

    await setDoc(doc(db, "liar_rooms", roomCode), {
      host: myNickname,
      status: "waiting",
      createdAt: Date.now(),
      players: [initialPlayer],
    });

    enterLobbyUI();
    addSystemMessage("방이 생성되었습니다.");
  } catch (e) {
    elements.multiStatus.textContent = "오류: " + e.message;
  }
}

async function joinRoom() {
  try {
    const roomRef = doc(db, "liar_rooms", currentRoomId);

    // 트랜잭션으로 안전하게 참가
    await runTransaction(db, async (transaction) => {
      const roomDoc = await transaction.get(roomRef);
      if (!roomDoc.exists()) throw "방이 사라졌습니다.";

      const players = roomDoc.data().players || [];
      if (players.length >= 4) throw "방이 꽉 찼습니다.";

      // 캐릭터 인덱스 자동 할당 (중복 방지)
      const usedChars = players.map((p) => p.charIndex);
      let newCharIndex = 0;
      while (usedChars.includes(newCharIndex)) newCharIndex++;

      const newPlayer = {
        nickname: myNickname,
        charIndex: newCharIndex,
        isHost: false,
      };

      players.push(newPlayer);
      transaction.update(roomRef, { players: players });
    });

    isHost = false;
    enterLobbyUI();
    await sendChatMessage(`${myNickname}님이 입장하셨습니다.`, true);
  } catch (e) {
    alert("입장 실패: " + e);
    elements.joinModal.classList.remove("hidden");
  }
}

function enterLobbyUI() {
  elements.multiMenuScreen.classList.add("hidden");
  elements.lobbyScreen.classList.remove("hidden");
  elements.displayRoomCode.textContent = currentRoomId;

  setupChatListener(currentRoomId);
  setupRoomListener(currentRoomId);
}

function leaveRoom() {
  if (unsubscribeChat) unsubscribeChat();
  if (unsubscribeRoom) unsubscribeRoom();
  if (unsubscribeActions) unsubscribeActions();

  elements.lobbyScreen.classList.add("hidden");
  elements.multiMenuScreen.classList.remove("hidden");
  currentRoomId = null;
  elements.chatMessages.innerHTML = "";

  // TODO: DB에서 플레이어 제거 로직 추가 필요
}

// --- 채팅 ---
async function sendChatMessage(text, isSystem = false) {
  if (!currentRoomId) return;
  const messagesRef = collection(db, "liar_rooms", currentRoomId, "messages");
  await addDoc(messagesRef, {
    text: text,
    sender: isSystem ? "System" : myNickname,
    timestamp: serverTimestamp(),
  });
}

function sendChatFromInput() {
  const text = elements.chatInput.value.trim();
  if (text) {
    sendChatMessage(text);
    elements.chatInput.value = "";
  }
}

function sendIngameChat() {
  const text = elements.ingameInput.value.trim();
  if (text) {
    sendChatMessage(text);
    elements.ingameInput.value = "";
  }
}

function setupChatListener(roomId) {
  const messagesRef = collection(db, "liar_rooms", roomId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));

  unsubscribeChat = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const msg = change.doc.data();
        addMessageToUI(msg.sender, msg.text);
        // 채팅 콜백 호출 (말풍선 표시용)
        if (gameCallbacks.onChat) {
          gameCallbacks.onChat(msg.sender, msg.text);
        }
      }
    });
  });
}

function addMessageToUI(sender, text) {
  const div = document.createElement("div");
  div.style.marginBottom = "5px";
  if (sender === "System") {
    div.style.color = "#ffff00";
    div.textContent = `[알림] ${text}`;
  } else {
    div.innerHTML = `<span style="color: #aaa;">${sender}:</span> ${text}`;
  }
  elements.chatMessages.appendChild(div);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  // 인게임 채팅에도 추가
  if (elements.ingameMessages) {
    const clone = div.cloneNode(true);
    elements.ingameMessages.appendChild(clone);
    elements.ingameMessages.scrollTop = elements.ingameMessages.scrollHeight;
  }
}

function addSystemMessage(text) {
  addMessageToUI("System", text);
}

// --- 캐릭터 선택 및 방 정보 리스너 ---
const charImages = [
  "male.png",
  "female.png",
  "black_male.png",
  "asian_female.png",
];
const charVideos = [
  "male.mp4",
  "female.mp4",
  "black_male.mp4",
  "asian_female.mp4",
];
const charNames = ["Male", "Female", "Black Male", "Asian Female"];
const playedVideos = new Set();

function setupRoomListener(roomId) {
  unsubscribeRoom = onSnapshot(doc(db, "liar_rooms", roomId), (docSnap) => {
    const data = docSnap.data();
    if (data && data.players) {
      renderLobbySlots(data.players);

      // 내 인덱스 찾기
      myPlayerIndex = data.players.findIndex((p) => p.nickname === myNickname);

      // 게임 시작 감지
      if (data.status === "starting") {
        // 액션 리스너 연결
        setupGameActionListener(roomId);
        // 게임 시작 콜백 호출
        if (gameCallbacks.onStart) gameCallbacks.onStart(data.players);
      }
    }
  });
}

function renderLobbySlots(playersData) {
  elements.lobbyPlayerSlots.innerHTML = "";

  // 방장 버튼 활성화 여부
  const amIHost = playersData.some(
    (p) => p.nickname === myNickname && p.isHost,
  );
  if (elements.btnGameStartMulti)
    elements.btnGameStartMulti.disabled = !amIHost;

  for (let i = 0; i < 4; i++) {
    const charName = charNames[i];
    const charImg = charImages[i];
    const charVideo = charVideos[i];

    const owner = playersData.find((p) => p.charIndex === i);
    const isTaken = !!owner;
    const isMe = owner && owner.nickname === myNickname;

    if (!isMe) playedVideos.delete(i);

    const slot = document.createElement("div");
    slot.className = "player-slot";

    let nameText = owner
      ? `${playersData.indexOf(owner) + 1}P(${owner.nickname})`
      : "";
    const imgClass = isTaken ? (isMe ? "selected" : "taken") : "";
    let showVideo = isMe && !playedVideos.has(i);

    let btnHtml = "";
    if (isMe)
      btnHtml = `<button class="btn-select selected" disabled>선택됨</button>`;
    else if (isTaken)
      btnHtml = `<button class="btn-select disabled" disabled>선택불가</button>`;
    else
      btnHtml = `<button class="btn-select" onclick="window.selectChar(${i})">선택</button>`;

    slot.innerHTML = `
      <div class="slot-char-area">
        <img src="./character/${charImg}" alt="${charName}" class="${imgClass}" style="${showVideo ? "display:none" : "display:block"}">
        <video src="./character/${charVideo}" class="char-video" style="${showVideo ? "display:block" : "display:none"}" muted playsinline></video>
      </div>
      <div class="slot-name" style="${isMe ? "color: #d4af37;" : ""}">${nameText}</div>
      ${btnHtml}
    `;
    elements.lobbyPlayerSlots.appendChild(slot);

    if (showVideo) {
      const videoEl = slot.querySelector("video");
      const imgEl = slot.querySelector("img");
      if (videoEl) {
        videoEl.play().catch((e) => {});
        videoEl.onended = () => {
          videoEl.style.display = "none";
          imgEl.style.display = "block";
          playedVideos.add(i);
        };
      }
    }
  }
}

// 전역 함수로 노출 (HTML onclick용)
window.selectChar = async function (newCharIndex) {
  if (!currentRoomId) return;
  const roomRef = doc(db, "liar_rooms", currentRoomId);
  try {
    await runTransaction(db, async (transaction) => {
      const roomDoc = await transaction.get(roomRef);
      if (!roomDoc.exists()) throw "방 없음";
      const players = roomDoc.data().players;
      const myIndex = players.findIndex((p) => p.nickname === myNickname);
      if (myIndex === -1) throw "플레이어 정보 없음";
      if (players.some((p) => p.charIndex === newCharIndex))
        throw "이미 선택됨";

      players[myIndex].charIndex = newCharIndex;
      transaction.update(roomRef, { players: players });
    });
  } catch (e) {
    alert(e);
  }
};

// --- 게임 동기화 로직 ---

async function startGameAsHost() {
  if (!currentRoomId) return;
  try {
    const roomRef = doc(db, "liar_rooms", currentRoomId);
    const roomSnap = await getDoc(roomRef);
    let currentPlayers = [...roomSnap.data().players];

    // AI 채우기
    const usedChars = currentPlayers.map((p) => p.charIndex);
    let botCount = 1;
    while (currentPlayers.length < 4) {
      let newCharIndex = 0;
      while (usedChars.includes(newCharIndex)) newCharIndex++;
      usedChars.push(newCharIndex);
      currentPlayers.push({
        nickname: `Bot ${botCount++}`,
        charIndex: newCharIndex,
        isHost: false,
        isAI: true,
      });
    }

    // 상태 변경 -> starting
    await updateDoc(roomRef, {
      players: currentPlayers,
      status: "starting",
    });

    // 게임 시작 액션 전송 (덱 정보 등 포함 가능)
    // 여기서는 간단히 상태 변경만으로 트리거
  } catch (e) {
    console.error(e);
  }
}

// 게임 액션 전송
export async function sendGameAction(type, payload) {
  if (!currentRoomId) return;
  const actionsRef = collection(db, "liar_rooms", currentRoomId, "actions");
  await addDoc(actionsRef, {
    type: type,
    senderIndex: myPlayerIndex,
    payload: payload,
    timestamp: serverTimestamp(),
  });
}

// 게임 액션 리스너
function setupGameActionListener(roomId) {
  const actionsRef = collection(db, "liar_rooms", roomId, "actions");
  const q = query(actionsRef, orderBy("timestamp", "asc"));

  unsubscribeActions = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const action = change.doc.data();
        // 내 행동이 아니거나, 서버 권한이 필요한 경우 처리
        // 여기서는 모든 클라이언트가 액션을 받아 실행하도록 함
        if (gameCallbacks.onAction) {
          gameCallbacks.onAction(action);
        }
      }
    });
  });
}

// 외부에서 채팅 메시지 전송 (이모티콘 등)
export function sendExternalChatMessage(text) {
  if (text) {
    sendChatMessage(text);
  }
}
