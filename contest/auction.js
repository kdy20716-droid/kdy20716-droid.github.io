import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  getDoc,
  arrayUnion,
  arrayRemove, // ✨ arrayRemove 추가
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "../game/suika/firebaseConfig.js";

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 1. 초기 데이터 설정
let teams = [
  {
    id: 1,
    name: "TEAM_이름을 입력해주세요",
    leader: "팀장 1",
    points: 1000,
    maxPoints: 1000,
    members: [],
  },
  {
    id: 2,
    name: "TEAM_이름을 입력해주세요",
    leader: "팀장 2",
    points: 1000,
    maxPoints: 1000,
    members: [],
  },
  {
    id: 3,
    name: "TEAM_이름을 입력해주세요",
    leader: "팀장 3",
    points: 1000,
    maxPoints: 1000,
    members: [],
  },
  {
    id: 4,
    name: "TEAM_이름을 입력해주세요",
    leader: "팀장 4",
    points: 1000,
    maxPoints: 1000,
    members: [],
  },
  {
    id: 5,
    name: "TEAM_이름을 입력해주세요",
    leader: "팀장 5",
    points: 1000,
    maxPoints: 1000,
    members: [],
  },
  {
    id: 6,
    name: "TEAM_이름을 입력해주세요",
    leader: "팀장 6",
    points: 1000,
    maxPoints: 1000,
    members: [],
  },
];

let auctionPlayers = []; // 경매에 나올 선수 목록 (방장이 설정)
let connectedBidders = []; // ✨ 실시간 접속자 명단을 담을 배열 추가!

let currentPrice = 0; // 현재 입찰 가격
let highestBidder = null;
let currentTurnTeamIdx = 0; // 시뮬레이션을 위해 순차적으로 팀을 바꿈
let auctionStarted = false; // ✨ 경매 시작 여부 플래그 추가
let unsubscribeRoom = null; // 실시간 동기화를 위한 리스너 해제 함수
let lastSaleInfo = null; // ✨ 마지막 낙찰 정보를 저장 (모든 데이터 포함)
let currentBiddingLock = null; // ✨ 입찰 잠금 상태 관리 변수

// 2. DOM 요소 참조
const entryScreenEl = document.getElementById("entry-screen");
const setupScreenEl = document.getElementById("setup-screen");
const joinRoomModalEl = document.getElementById("join-room-modal");
const gridLayoutEl = document.querySelector(".grid-layout");
const bottomWaitingAreaEl = document.getElementById("bottom-waiting-area");
const hostRoomCodeDisplayEl = document.getElementById("host-room-code-display");
const displayRoomCodeEl = document.getElementById("display-room-code");
const roomCodeInputEl = document.getElementById("room-code-input");

const waitingListEl = document.getElementById("waiting-list");
const waitingListCountEl = document.getElementById("waiting-list-count");
const bidLogsEl = document.getElementById("bid-logs");
const currentPriceEl = document.getElementById("current-price");
const highestBidderInfoEl = document.getElementById("highest-bidder-info");
const bidInputEl = document.getElementById("bid-input");
const confirmBidBtn = document.getElementById("confirm-bid-btn");
const undoBtn = document.getElementById("undo-btn");
const placeBidBtn = document.getElementById("place-bid-btn");
const cancelPlacementBtn = document.getElementById("cancel-placement-btn");
const targetPlayerNameEl = document.getElementById("target-player-name");
const targetPlayerRoleEl = document.getElementById("target-player-role");
const draggablePlayerCardEl = document.getElementById(
  "current-player-card-draggable",
);
const draggablePlayerNameEl = document.getElementById("draggable-player-name");
const draggablePlayerRoleEl = document.getElementById("draggable-player-role");
const currentPlayerCardContentEl = document.querySelector(
  ".current-player-card .player-info",
).parentElement; // 현재 경매 대상 정보
const bidControlsEl = document.querySelector(".bid-controls");
const waitingForHostScreenEl = document.getElementById(
  "waiting-for-host-screen",
); // ✨ 대기 화면 DOM 요소
const waitingRoomCodeEl = document.getElementById("waiting-room-code"); // ✨ 대기 화면 방 코드

// ✨ 새로 추가한 HTML 요소(참가자 현황판)를 JS와 연결합니다.
const connectedBiddersListEl = document.getElementById(
  "connected-bidders-list",
);
const connectedBidderCountEl = document.getElementById(
  "connected-bidder-count",
);

let isHost = false; // 변수 선언 추가
window.isHost = isHost; // 인라인 HTML 접근을 위해 window 객체에 할당
let currentRoomCode = null; // 현재 방 코드
let myNickname = ""; // ✨ 경매자 닉네임 저장
let currentAuctionPlayer = null; // 현재 경매 대상 선수
let isPlacingPlayer = false; // 선수를 팀에 배치 중인지 여부

// --- State Sync Logic (Firebase Firestore 기반) ---

async function saveState() {
  if (!currentRoomCode || !window.isHost) return;
  const roomRef = doc(db, "auction_rooms", currentRoomCode);
  try {
    await setDoc(
      roomRef,
      {
        teams,
        auctionPlayers,
        bidders: connectedBidders, // ✨ 초기 방 생성 시 빈 접속자 명단 구조를 만들어줍니다.
        auctionStarted: auctionStarted, // ✨ 경매 시작 여부
        currentPrice,
        highestBidder,
        currentAuctionPlayer,
        isPlacingPlayer,
        currentTurnTeamIdx,
        lastSaleInfo, // ✨ 되돌리기 정보 저장
        logs: bidLogsEl.innerHTML,
        lastUpdated: Date.now(),
      },
      { merge: true },
    );
  } catch (e) {
    console.error("Error saving state: ", e);
  }
}

// ✨ 경매자가 팀을 선택하여 팀장이 되는 기능 추가
window.claimTeam = async function (teamId) {
  if (window.isHost || !currentRoomCode) return;

  const roomRef = doc(db, "auction_rooms", currentRoomCode);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return;

  const data = roomSnap.data();
  const currentTeams = [...data.teams];

  // 이미 어떤 팀의 리더인지 확인
  if (currentTeams.some((t) => t.leader === myNickname)) {
    alert("이미 팀을 선택하셨습니다.");
    return;
  }

  const teamIdx = currentTeams.findIndex((t) => t.id === teamId);
  if (teamIdx === -1) return;

  // "팀장 X"와 같은 초기 플레이스홀더인 경우에만 선택 가능하도록 제한
  if (!currentTeams[teamIdx].leader.startsWith("팀장 ")) {
    alert("이미 다른 참가자가 선택한 팀입니다.");
    return;
  }

  currentTeams[teamIdx].leader = myNickname;
  currentTeams[teamIdx].name = `${myNickname}의 팀`;

  const logEntry = `<div class="log-entry system">> [참가] ${myNickname}님이 ${teamId}번 팀의 팀장이 되었습니다.</div>`;
  const updatedLogs = logEntry + (data.logs || "");

  await updateDoc(roomRef, {
    teams: currentTeams,
    logs: updatedLogs,
  });
};

function startSync(enteredCode) {
  if (unsubscribeRoom) unsubscribeRoom();

  const roomRef = doc(db, "auction_rooms", enteredCode);
  unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
    const state = snapshot.data();
    if (!state) return;

    // ✨ 접속자 명단 동기화: 실시간으로 참가자 목록과 인원수를 감지
    if (state.bidders) {
      const newBidders = state.bidders.filter(
        (name) => !connectedBidders.includes(name),
      );

      // ✨ 중요: 데이터를 먼저 업데이트해야 addLog -> saveState 실행 시 최신 명단이 DB에 반영됩니다.
      connectedBidders = state.bidders;

      newBidders.forEach((name) => {
        console.log(`${name}님이 들어옴`);
        if (window.isHost) {
          addLog(`${name}님이 입장하셨습니다.`, "system");
        }
      });
      renderConnectedBidders();
    }

    // 경매자(Bidder)이거나 호스트가 아닌 경우 전체 상태 업데이트
    if (!window.isHost) {
      // ✨ 경매 시작 여부에 따라 화면 전환
      if (
        state.auctionStarted &&
        waitingForHostScreenEl.style.display !== "none"
      ) {
        waitingForHostScreenEl.style.display = "none";
        gridLayoutEl.style.display = "grid";
        bottomWaitingAreaEl.style.display = "block";
        renderConnectedBidders(); // 시작 시 명단 최신화
        init(); // 메인 화면 진입 시 UI 초기화
        addLog(`경매가 시작되었습니다.`, "system");
      } else if (
        !state.auctionStarted &&
        gridLayoutEl.style.display !== "none"
      ) {
        // 호스트가 경매를 취소하거나 다시 설정 화면으로 돌아간 경우
        gridLayoutEl.style.display = "none";
        bottomWaitingAreaEl.style.display = "block"; // 대기 중에도 명단은 보이도록 유지
        waitingForHostScreenEl.style.display = "flex";
        addLog(`경매가 일시 중지되었습니다.`, "system");
      }

      // 항상 핵심 데이터는 업데이트
      if (state.teams !== undefined) teams = state.teams;
      if (state.auctionPlayers !== undefined)
        auctionPlayers = state.auctionPlayers;
      if (state.currentPrice !== undefined) currentPrice = state.currentPrice;
      if (state.highestBidder !== undefined)
        highestBidder = state.highestBidder;
      if (state.currentAuctionPlayer !== undefined)
        currentAuctionPlayer = state.currentAuctionPlayer;
      if (state.isPlacingPlayer !== undefined)
        isPlacingPlayer = state.isPlacingPlayer;
      if (state.currentTurnTeamIdx !== undefined)
        currentTurnTeamIdx = state.currentTurnTeamIdx;
      lastSaleInfo = state.lastSaleInfo || null; // ✨ 되돌리기 정보 동기화
      if (state.logs) bidLogsEl.innerHTML = state.logs;

      // 경매가 시작된 경우에만 UI 렌더링 함수 호출
      if (state.auctionStarted) {
        renderTeams();
        renderWaitingList();
        updateAuctionDisplay();
      }
    } else {
      // ✅ 호스트 전용 로직

      // 1. 만약 호스트인데 아직 화면이 setup 상태라면 화면 전환
      if (state.auctionStarted && gridLayoutEl.style.display === "none") {
        setupScreenEl.style.display = "none";
        gridLayoutEl.style.display = "grid";
        bottomWaitingAreaEl.style.display = "block";
        init();
      }

      // 2. 데이터 동기화 (팀 정보, 입찰 가격, 로그 등 모두 포함)
      if (state.teams !== undefined) teams = state.teams;
      if (state.auctionPlayers !== undefined)
        auctionPlayers = state.auctionPlayers;
      if (state.currentPrice !== undefined) currentPrice = state.currentPrice;
      if (state.highestBidder !== undefined)
        highestBidder = state.highestBidder;
      if (state.currentAuctionPlayer !== undefined)
        currentAuctionPlayer = state.currentAuctionPlayer;
      if (state.currentTurnTeamIdx !== undefined)
        currentTurnTeamIdx = state.currentTurnTeamIdx;
      lastSaleInfo = state.lastSaleInfo || null; // ✨ 되돌리기 정보 동기화
      if (state.logs) bidLogsEl.innerHTML = state.logs;

      renderTeams();
      updateAuctionDisplay();
    } // [1] else 끝
  }); // [2] onSnapshot 리스너 끝
} // [3] startSync 함수 전체 끝

// --- 이벤트 리스너: 브라우저 종료 시 명단 제거 ---
window.addEventListener("beforeunload", async () => {
  if (currentRoomCode && !window.isHost && myNickname) {
    const roomRef = doc(db, "auction_rooms", currentRoomCode);
    try {
      await updateDoc(roomRef, {
        bidders: arrayRemove(myNickname),
      });
    } catch (e) {
      console.error("퇴장 처리 실패:", e);
    }
  }
});
// --- Entry Logic ---

window.updateCurrentPrice = function () {
  if (!window.isHost) return;
  const amount = parseInt(bidInputEl.value);
  if (isNaN(amount)) return;

  currentPrice = amount;
  highestBidder = null; // 호스트가 수동 등록 시 입찰자 정보 초기화

  updateAuctionDisplay();
  addLog(
    `[공지] 방장이 입찰가를 ${currentPrice}pt로 업데이트했습니다.`,
    "system",
  );
  saveState();
};

window.editLeaderName = function (teamId) {
  if (!window.isHost) return;
  const team = teams.find((t) => t.id === teamId);
  const newName = prompt("새로운 팀장 이름을 입력하세요:", team.leader);
  if (newName && newName.trim()) {
    team.leader = newName.trim();
    renderTeams();
    updateAuctionDisplay(); // 팀장 이름 변경 시 중앙 입찰 정보도 즉시 갱신
    saveState();
  }
};

window.editTeamName = function (teamId) {
  if (!window.isHost) return;
  const team = teams.find((t) => t.id === teamId);
  const newName = prompt("새로운 팀 이름을 입력하세요:", team.name);
  if (newName && newName.trim()) {
    team.name = newName.trim();
    renderTeams();
    updateAuctionDisplay(); // 팀 이름 변경 시 중앙 입찰 정보도 즉시 갱신
    saveState();
  }
};

window.toggleLog = function () {
  const sidebar = document.getElementById("log-sidebar");
  sidebar.classList.toggle("active");
};

window.copyRoomCode = function () {
  if (currentRoomCode) {
    navigator.clipboard
      .writeText(currentRoomCode)
      .then(() => {
        alert(`방 코드 [${currentRoomCode}]가 클립보드에 복사되었습니다.`);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  }
};

window.selectRole = function (role) {
  entryScreenEl.style.opacity = "0";
  setTimeout(() => {
    entryScreenEl.style.display = "none";
    if (role === "host") {
      isHost = true;
      window.isHost = true; // window 객체와 동기화
      currentRoomCode = generateRoomCode();
      displayRoomCodeEl.textContent = currentRoomCode;
      hostRoomCodeDisplayEl.style.display = "block";
      setupScreenEl.style.display = "flex";
      // 방장은 입찰 버튼 숨김, 낙찰 확정 버튼 표시
      placeBidBtn.style.display = "none";
      confirmBidBtn.style.display = "block";
      auctionStarted = false; // ✨ 방 생성 시 경매 시작 안 됨
      connectedBidders = []; // ✨ 방 생성 시 접속자 명단 초기화
      saveState(); // 초기 방 생성 상태 저장
      startSync(currentRoomCode); // ✨ 방 생성 즉시 실시간 동기화 시작 (방장이 참가자 정보를 실시간으로 보기 위함)
    } else {
      isHost = false;
      window.isHost = false; // window 객체와 동기화
      joinRoomModalEl.style.display = "flex";
      // 경매자는 입찰 버튼 표시, 낙찰 확정 버튼 숨김
      placeBidBtn.style.display = "block";
      confirmBidBtn.style.display = "none";
    }
  }, 500);
};

// 배치 취소 로직 (Host Only)
window.cancelPlacement = function () {
  if (!window.isHost) return;
  isPlacingPlayer = false;
  draggablePlayerCardEl.style.display = "none";
  confirmBidBtn.style.display = "block";
  confirmBidBtn.disabled = false;
  cancelPlacementBtn.style.display = "none";

  renderTeams();
  addLog(`[알림] 팀 배치가 취소되었습니다. 다시 진행해주세요.`, "system");
  saveState();
};

// 방 코드 생성
function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// 경매자: 방 참여
window.joinRoom = async function () {
  const enteredCode = roomCodeInputEl.value.trim();

  if (enteredCode.length !== 4) {
    alert("4자리 방 코드를 입력해주세요.");
    return;
  }

  // Firestore에서 방 존재 여부 확인
  const roomRef = doc(db, "auction_rooms", enteredCode);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    alert("존재하지 않는 방 코드입니다. 코드를 다시 확인해주세요.");
    return;
  }

  // ✨ 추가된 로직: 참가자에게 닉네임을 물어보고 DB에 등록합니다.
  // 닉네임 입력 모달을 띄우는 것이 더 좋지만, 일단 prompt로 대체
  const bidderName = prompt("경매에 참여할 닉네임을 입력해주세요!");
  if (!bidderName || !bidderName.trim()) {
    alert("닉네임을 입력해야 입장할 수 있습니다.");
    return;
  }

  // 데이터베이스 방 명부에 내 닉네임을 추가합니다.
  myNickname = bidderName.trim(); // ✨ 닉네임 저장
  await updateDoc(roomRef, {
    bidders: arrayUnion(myNickname), // ✨ 저장된 닉네임 사용
  });

  currentRoomCode = enteredCode;
  joinRoomModalEl.style.display = "none";
  bottomWaitingAreaEl.style.display = "block"; // ✨ 대기 화면에서도 참가자 현황은 보이도록 수정
  waitingForHostScreenEl.style.display = "flex"; // ✨ 대기 화면 표시
  startSync(currentRoomCode);

  init(); // 경매자도 메인 화면 진입
  addLog(`방 코드 [${currentRoomCode}]에 참여했습니다.`, "system");

  // 경매자는 드래그 기능 비활성화
  draggablePlayerCardEl.draggable = false;
  draggablePlayerCardEl.style.cursor = "default";
  draggablePlayerCardEl.style.display = "none"; // 경매자는 드래그 요소 안 보이게

  // 팀 카드 드롭 기능 비활성화
  document.querySelectorAll(".team-card").forEach((card) => {
    card.removeEventListener("dragover", handleDragOver);
    card.removeEventListener("dragleave", handleDragLeave);
    card.removeEventListener("drop", handleDrop);
  });
};

// 경매자: 방 참여 취소
window.cancelJoin = function () {
  joinRoomModalEl.style.display = "none";
  entryScreenEl.style.opacity = "1";
  entryScreenEl.style.display = "flex";
};

// --- Drag & Drop Logic (Host Only) ---
let draggedPlayer = null;

// 클릭으로 선수 배치 (Host Only)
window.handleSlotClick = function (teamId, slotIndex) {
  if (!window.isHost || !isPlacingPlayer || !currentAuctionPlayer) return;

  const team = teams.find((t) => t.id === teamId);

  if (team && team.members[slotIndex] === undefined) {
    if (team.points < currentPrice) {
      alert("포인트가 부족하여 영입할 수 없는 팀입니다.");
      return;
    }

    team.points -= currentPrice;
    team.members[slotIndex] = currentAuctionPlayer;

    addLog(
      `[배치 완료] ${currentAuctionPlayer.name} 선수가 ${team.name}팀에 배정되었습니다.`,
      "system",
    );

    // 상태 초기화
    auctionPlayers = auctionPlayers.filter((p) => p !== currentAuctionPlayer);
    currentPrice = 0;
    highestBidder = null;
    currentAuctionPlayer = null;
    isPlacingPlayer = false;
    init();

    // 버튼 상태 복구
    cancelPlacementBtn.style.display = "none";
    confirmBidBtn.style.display = "block";
    saveState();
  }
};

/* function handleDragStart(e) { // 드래그 앤 드롭 대신 클릭으로 대체
    if (!isHost || !currentAuctionPlayer) {
        e.preventDefault(); // 방장이 아니거나 경매 대상이 없으면 드래그 방지
        return;
    }
    draggedPlayer = currentAuctionPlayer; // 현재 경매 대상 선수
    e.dataTransfer.setData('text/plain', JSON.stringify(draggedPlayer));
    e.target.style.opacity = '0.5'; // 드래그 중인 요소 투명하게
} */

/* function handleDragEnd(e) { // 드래그 앤 드롭 대신 클릭으로 대체
    if (!isHost) return;
    e.target.style.opacity = '1';
    draggedPlayer = null;
    draggablePlayerCardEl.style.display = 'none'; // 드래그 끝나면 숨김
} */

function handleDragOver(e) {
  if (!isHost) return;
  e.preventDefault(); // 드롭을 허용하기 위해 기본 동작 방지
  e.currentTarget.classList.add("drag-over");
}

function handleDragLeave(e) {
  if (!isHost) return;
  e.currentTarget.classList.remove("drag-over");
}

function handleDrop(e) {
  if (!isHost) return;
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");

  const teamId = parseInt(e.currentTarget.dataset.teamId);
  const team = teams.find((t) => t.id === teamId);

  if (team && draggedPlayer) {
    // 낙찰 확정 로직
    if (team.members.length >= 5) {
      alert("팀 슬롯이 가득 찼습니다!");
      return;
    }

    team.points -= currentPrice; // 최고 입찰가만큼 포인트 차감
    team.members.push(draggedPlayer); // 선수 추가
    addLog(
      `[낙찰] ${draggedPlayer.name} 선수가 ${team.name}팀에 영입되었습니다!`,
      "system",
    );

    // auctionPlayers 배열에서 낙찰된 선수 제거
    auctionPlayers = auctionPlayers.filter((p) => p !== draggedPlayer);

    // 초기화
    currentPrice = 0;
    highestBidder = null;
    currentAuctionPlayer = null; // 현재 경매 대상 초기화

    init(); // UI 갱신
    draggablePlayerCardEl.style.display = "none"; // 드래그 요소 숨김
    currentPlayerCardContentEl.style.display = "none"; // 경매 대상 정보 숨김
    confirmBidBtn.disabled = true; // 낙찰 확정 버튼 다시 비활성화
    saveState();
  }
}

function setupDragAndDrop() {
  if (draggablePlayerCardEl) {
    draggablePlayerCardEl.addEventListener("dragstart", handleDragStart);
    draggablePlayerCardEl.addEventListener("dragend", handleDragEnd);
  }

  document.querySelectorAll(".team-card").forEach((card) => {
    card.addEventListener("dragover", handleDragOver);
    card.addEventListener("dragleave", handleDragLeave);
    card.addEventListener("drop", handleDrop);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // 초기에는 경매 메인 화면 숨김
  gridLayoutEl.style.display = "none";
  bottomWaitingAreaEl.style.display = "none";
  hostRoomCodeDisplayEl.style.display = "none";
  joinRoomModalEl.style.display = "none";
  currentPlayerCardContentEl.style.display = "none"; // 경매 대상 정보도 초기에는 숨김
});

// --- Setup Logic ---

window.addPlayerToSetup = function () {
  const nameInput = document.getElementById("input-player-name");
  const roleInput = document.getElementById("input-player-role");
  const role2Input = document.getElementById("input-player-role2");
  const tierInput = document.getElementById("input-player-tier");

  if (!nameInput.value.trim()) return alert("이름을 입력하세요.");

  const role1 = roleInput.value;
  const role2 = role2Input.value;
  const displayRole = role2 ? `${role1}, ${role2}` : role1;

  const newPlayer = {
    name: nameInput.value.trim(),
    role: displayRole,
    rank: tierInput.value.trim() || "Unranked",
  };

  auctionPlayers.push(newPlayer);
  nameInput.value = ""; // 초기화
  role2Input.value = ""; // 초기화
  tierInput.value = ""; // 초기화

  renderSetupList(); // 대기 명단 렌더링
  saveState();
};

function renderSetupList() {
  const listEl = document.getElementById("setup-player-list");
  document.getElementById("setup-count").textContent = auctionPlayers.length;
  listEl.innerHTML = auctionPlayers
    .map(
      (p) => `
        <li>
          <span>${p.name}</span>
          <span style="color:var(--val-blue); font-size: 0.8rem;">${p.role} (${p.rank})</span>
        </li>
    `,
    )
    .join("");

  document.getElementById("start-auction-btn").disabled =
    auctionPlayers.length === 0;
}

window.startAuction = async function () {
  // async 추가
  // ✨ 경매 시작 시 선수 명단을 무작위로 섞음 (Fisher-Yates Shuffle)
  for (let i = auctionPlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [auctionPlayers[i], auctionPlayers[j]] = [
      auctionPlayers[j],
      auctionPlayers[i],
    ];
  }

  auctionStarted = true; // 1. 상태를 먼저 true로 변경

  // 2. 화면 전환 실행
  setupScreenEl.style.display = "none";
  gridLayoutEl.style.display = "grid";
  bottomWaitingAreaEl.style.display = "block";

  // 3. DB에 '경매 시작됨' 상태를 먼저 저장 (참가자들이 알 수 있게)
  await saveState();

  // 4. 동기화 및 초기화 시작
  startSync(currentRoomCode);
  init();

  addLog(`방 코드 [${currentRoomCode}]로 경매가 시작되었습니다.`, "system");
};

// --- 경매 시스템 Logic ---

function init() {
  renderTeams();
  renderWaitingList();
  updateAuctionDisplay();
}

// 팀 리스트 렌더링
function renderTeams() {
  const leftTeams = document.getElementById("left-teams");
  const rightTeams = document.getElementById("right-teams");
  leftTeams.innerHTML = ""; // 초기화
  rightTeams.innerHTML = ""; // 초기화

  teams.forEach((team, index) => {
    const percentage = (team.points / team.maxPoints) * 100;
    const card = document.createElement("div");

    // 하이라이트/딤 조건 설정
    let statusClass = "";
    if (isPlacingPlayer) {
      statusClass =
        team.points >= currentPrice ? "highlighted selectable" : "dimmed";
    } else if (highestBidder && highestBidder.id === team.id) {
      statusClass = "active";
    }

    card.className = `team-card ${statusClass}`;

    // ✨ 경매자가 팀 칸을 클릭했을 때 팀장으로 등록되도록 이벤트 추가
    if (!window.isHost) {
      card.style.cursor = "pointer";
      card.onclick = () => window.claimTeam(team.id);
    }

    card.innerHTML = `
            <div class="team-header">
                <div class="team-identity">
                    <span class="team-name">
                        <strong>${team.name}</strong>
                        ${window.isHost ? `<i class="fa-solid fa-pen-to-square edit-name-btn" onclick="editTeamName(${team.id})"></i>` : ""}
                    </span>
                    <div class="team-leader" style="font-size: 0.7rem; color: var(--val-blue);">
                        Leader: ${team.leader} ${window.isHost ? `<i class="fa-solid fa-user-pen edit-name-btn" onclick="editLeaderName(${team.id})"></i>` : ""}
                    </div>
                </div>
                <span class="team-points">${team.points} PT</span>
            </div>
            <div class="points-bar">
                <div class="points-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="member-slots">
                ${[...Array(4)]
                  .map(
                    (_, i) => `
                    <div class="slot ${team.members[i] ? "filled" : ""}" onclick="handleSlotClick(${team.id}, ${i})">
                        ${
                          team.members[i]
                            ? `
                            <span class="player-name">${team.members[i].name}</span>
                            <span class="player-role text-xs text-gray-400">${team.members[i].role} / ${team.members[i].rank}</span>
                        `
                            : "EMPTY"
                        }
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `;

    if (index % 2 === 0) {
      leftTeams.appendChild(card);
    } else {
      rightTeams.appendChild(card);
    }
  });
}

// 대기자 명단 렌더링
function renderWaitingList() {
  waitingListCountEl.textContent = `${auctionPlayers.length}명`;
  waitingListEl.innerHTML = ""; // 초기화
  auctionPlayers.forEach((p, index) => {
    const li = document.createElement("li");
    li.dataset.playerIndex = index; // 클릭 이벤트를 위해 인덱스 저장
    li.innerHTML = `
            <div style="font-weight:bold">${p.name}</div>
            <div style="color:var(--val-blue); font-size:0.7rem">${p.role} / ${p.rank}</div>
        `;
    waitingListEl.appendChild(li);

    // 대기 명단 클릭 시 경매 대상으로 올리기
    if (window.isHost) {
      li.addEventListener("click", () => selectPlayerForAuction(index));
    }
  });
}

// 대기 명단에서 선수 선택 시 경매 대상으로 올리는 함수
function selectPlayerForAuction(playerIndex) {
  if (auctionPlayers.length === 0) return;
  if (isPlacingPlayer) {
    alert("먼저 낙찰된 선수의 팀 배치를 완료해주세요.");
    return;
  }

  // 다른 품목 클릭 시 기존 입찰 상태 초기화 (취소 기능)
  currentPrice = 0;
  highestBidder = null;
  if (currentAuctionPlayer) {
    addLog(`[알림] 새로운 경매를 위해 상태가 초기화되었습니다.`, "system");
  }

  currentAuctionPlayer = auctionPlayers[playerIndex];
  // 선택된 선수를 배열의 맨 앞으로 이동 (또는 복사)
  auctionPlayers.splice(playerIndex, 1); // 기존 위치에서 제거
  auctionPlayers.unshift(currentAuctionPlayer); // 맨 앞으로 추가

  updateAuctionDisplay();
  renderWaitingList(); // 대기 명단 갱신
  if (isHost) confirmBidBtn.disabled = false;
  saveState();
}

// 4. 경매 로직

// 입찰하기
window.placeBid = async function () {
  if (placeBidBtn.disabled) return;

  const roomRef = doc(db, "auction_rooms", currentRoomCode);

  const amount = parseInt(bidInputEl.value);
  if (isNaN(amount) || amount <= currentPrice) {
    alert(`현재가(${currentPrice}pt)보다 높은 금액을 입력해주세요.`);
    return;
  }
  if (!currentAuctionPlayer) {
    alert("경매 대상 선수를 먼저 선택해주세요.");
    return;
  }

  // ✨ 내 닉네임으로 현재 팀 찾기
  const myTeam = teams.find((t) => t.leader === myNickname);
  if (!myTeam) {
    alert("팀장만 입찰할 수 있습니다. 팀 칸을 눌러 팀장이 되어주세요.");
    return;
  }

  if (myTeam.points < amount) {
    alert("포인트가 부족합니다!");
    addLog(`${myTeam.name} 포인트가 부족합니다!`, "system");
    return;
  }

  // ✨ 입찰 상태 업데이트 및 3초 점등 정보 생성 (5초 잠금 제거)
  currentPrice = amount;
  highestBidder = myTeam;
  const biddingLock = {
    bidder: myNickname,
    flashUntil: Date.now() + 3000, // 3초간 빨간색 점등
  };

  // 로그 추가
  addLog(`[입찰희망] ${myNickname}님이 ${amount}pt를 제시했습니다.`, "bid");

  updateAuctionDisplay();
  renderTeams();

  // 입찰 정보 Firestore 업데이트 (로그 포함)
  await updateDoc(roomRef, {
    currentPrice,
    highestBidder,
    biddingLock,
    logs: bidLogsEl.innerHTML,
  });
};

// 낙찰 확정
window.confirmBid = async function () {
  if (!window.isHost || !currentAuctionPlayer || !highestBidder) {
    alert("낙찰할 대상이나 입찰자가 없습니다.");
    return;
  }

  const team = teams.find((t) => t.id === highestBidder.id);
  if (!team) return;

  if (team.members.length >= 4) {
    alert("해당 팀의 멤버가 가득 찼습니다.");
    return;
  }

  // ✨ 마지막 낙찰 정보 기록 (되돌리기용)
  lastSaleInfo = {
    teamId: team.id,
    player: { ...currentAuctionPlayer },
    price: currentPrice,
    auctionPlayers: [...auctionPlayers], // 이전 대기 명단 상태 저장
  };

  // 자동 영입 처리
  team.points -= currentPrice;
  team.members.push(currentAuctionPlayer);

  addLog(
    `[낙찰] ${currentAuctionPlayer.name} 선수가 ${team.name}팀에 ${currentPrice}pt로 영입되었습니다.`,
    "system",
  );

  // 상태 초기화
  auctionPlayers = auctionPlayers.filter(
    (p) => p.name !== currentAuctionPlayer.name,
  );
  currentAuctionPlayer = null;
  currentPrice = 0;
  highestBidder = null;

  init();
  saveState();
};

// ✨ 시간 되돌리기 (낙찰 취소) 함수 추가
window.undoAuction = async function () {
  if (!window.isHost || !lastSaleInfo) return;

  if (!confirm("마지막 낙찰을 취소하고 시간을 되돌리시겠습니까?")) return;

  const team = teams.find((t) => t.id === lastSaleInfo.teamId);
  if (team) {
    // 팀에서 선수 제거 및 포인트 복구
    team.members = team.members.filter(
      (m) => m.name !== lastSaleInfo.player.name,
    );
    team.points += lastSaleInfo.price;
  }

  // 선수 명단 및 상태 완전 복구
  auctionPlayers = [
    lastSaleInfo.player,
    ...auctionPlayers.filter((p) => p.name !== lastSaleInfo.player.name),
  ];
  currentAuctionPlayer = lastSaleInfo.player;
  currentPrice = lastSaleInfo.price; // 낙찰 직전 가격이 아닌 낙찰 가격으로 복구 (상황에 따라 0으로 변경 가능)

  addLog(
    `[되돌리기] ${lastSaleInfo.player.name} 선수의 낙찰이 취소되고 명단으로 복귀되었습니다.`,
    "system",
  );

  lastSaleInfo = null; // 정보 초기화

  // 갱신 및 DB 저장 (이때 모든 참가자의 onSnapshot이 트리거됨)
  init();
  await saveState();
};

// 로그 추가 함수
function addLog(message, type = "") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = `> ${message}`;
  bidLogsEl.prepend(entry);
  saveState();
}

// 중앙 디스플레이 갱신
function updateAuctionDisplay() {
  currentPriceEl.textContent = currentPrice;
  highestBidderInfoEl.textContent = highestBidder
    ? `${highestBidder.name} (${highestBidder.leader})`
    : "입찰자 없음";

  if (currentAuctionPlayer) {
    targetPlayerNameEl.textContent = currentAuctionPlayer.name;
    targetPlayerRoleEl.innerHTML = `${currentAuctionPlayer.role}<br><span style="font-size: 0.8em; opacity: 0.8;">${currentAuctionPlayer.rank}</span>`;
    currentPlayerCardContentEl.style.display = "block"; // 대상이 선택되면 카드 표시
    // 방장이 낙찰 확정 버튼을 누르기 전까지는 드래그 카드 숨김
    if (!isPlacingPlayer) draggablePlayerCardEl.style.display = "none";
  } else {
    targetPlayerNameEl.textContent = "경매 대상 없음";
    targetPlayerRoleEl.textContent = "-";
    currentPlayerCardContentEl.style.display = "none"; // 대상이 없으면 카드 숨김
    draggablePlayerCardEl.style.display = "none"; // 대상이 없으면 드래그 카드도 숨김
  }

  // ✨ 방장 전용 UI 제어
  if (window.isHost) {
    bidInputEl.parentElement.style.display = "none"; // ✅ 방장은 입력창 아예 숨김
    confirmBidBtn.disabled = !highestBidder; // 입찰자가 있을 때만 낙찰 가능
    undoBtn.style.display = lastSaleInfo ? "block" : "none"; // 되돌릴 정보가 있을 때만 버튼 표시
    // ✨ 낙찰 취소 버튼에 복구될 선수 정보를 툴팁으로 추가
    if (lastSaleInfo) {
      undoBtn.title = `취소 시 '${lastSaleInfo.player.name}' 선수가 명단으로 복구되며, ${lastSaleInfo.price}pt가 해당 팀에 반환됩니다.`;
    }
  } else {
    bidInputEl.parentElement.style.display = "flex"; // ✅ 경매자 화면에서는 다시 보임
  }

  // 입찰 금액 최소값 설정 (현재가보다 높아야 함)
  bidInputEl.min = currentPrice + 1;
}
// ✨ 실시간 접속자 명단을 화면에 그려주는 함수 (Host 용)
window.renderConnectedBidders = function () {
  const count = connectedBidders.length;
  const listHtml =
    count === 0
      ? `<p class="no-bidders-msg">참가자를 기다리는 중...</p>`
      : connectedBidders
          .map(
            (name) => `
        <div class="bidder-chip">
            <span class="status-indicator"></span>
            <span class="font-bold text-white">${name}</span>
        </div>
      `,
          )
          .join("");

  // 방장 설정 화면 업데이트
  if (connectedBidderCountEl) connectedBidderCountEl.textContent = count;
  if (connectedBiddersListEl) connectedBiddersListEl.innerHTML = listHtml;
};
