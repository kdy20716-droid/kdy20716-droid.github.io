// 1. 초기 데이터 설정
const teams = [
    { id: 1, name: "TEAM_이름을 입력해주세요", leader: "팀장 1", points: 1000, maxPoints: 1000, members: [] },
    { id: 2, name: "TEAM_이름을 입력해주세요", leader: "팀장 2", points: 1000, maxPoints: 1000, members: [] },
    { id: 3, name: "TEAM_이름을 입력해주세요", leader: "팀장 3", points: 1000, maxPoints: 1000, members: [] },
    { id: 4, name: "TEAM_이름을 입력해주세요", leader: "팀장 4", points: 1000, maxPoints: 1000, members: [] },
    { id: 5, name: "TEAM_이름을 입력해주세요", leader: "팀장 5", points: 1000, maxPoints: 1000, members: [] },
    { id: 6, name: "TEAM_이름을 입력해주세요", leader: "팀장 6", points: 1000, maxPoints: 1000, members: [] }
];

let auctionPlayers = []; // 경매에 나올 선수 목록 (방장이 설정)

let currentPrice = 0;
let highestBidder = null;
let currentTurnTeamIdx = 0; // 시뮬레이션을 위해 순차적으로 팀을 바꿈

// 2. DOM 요소 참조
const entryScreenEl = document.getElementById('entry-screen');
const setupScreenEl = document.getElementById('setup-screen');
const joinRoomModalEl = document.getElementById('join-room-modal');
const gridLayoutEl = document.querySelector('.grid-layout');
const bottomWaitingAreaEl = document.getElementById('bottom-waiting-area');
const hostRoomCodeDisplayEl = document.getElementById('host-room-code-display');
const displayRoomCodeEl = document.getElementById('display-room-code');
const roomCodeInputEl = document.getElementById('room-code-input');

const waitingListEl = document.getElementById('waiting-list');
const waitingListCountEl = document.getElementById('waiting-list-count');
const bidLogsEl = document.getElementById('bid-logs');
const currentPriceEl = document.getElementById('current-price');
const highestBidderInfoEl = document.getElementById('highest-bidder-info');
const bidInputEl = document.getElementById('bid-input');
const confirmBidBtn = document.getElementById('confirm-bid-btn');
const placeBidBtn = document.getElementById('place-bid-btn');
const cancelPlacementBtn = document.getElementById('cancel-placement-btn');
const targetPlayerNameEl = document.getElementById('target-player-name');
const targetPlayerRoleEl = document.getElementById('target-player-role');
const draggablePlayerCardEl = document.getElementById('current-player-card-draggable');
const draggablePlayerNameEl = document.getElementById('draggable-player-name');
const draggablePlayerRoleEl = document.getElementById('draggable-player-role');
const currentPlayerCardContentEl = document.querySelector('.current-player-card .player-info').parentElement; // 현재 경매 대상 정보
const bidControlsEl = document.querySelector('.bid-controls');

window.isHost = false; // 인라인 HTML 접근을 위해 window 객체에 할당
let currentRoomCode = null; // 현재 방 코드
let currentAuctionPlayer = null; // 현재 경매 대상 선수
let isPlacingPlayer = false; // 선수를 팀에 배치 중인지 여부

// --- Entry Logic ---

window.updateCurrentPrice = function() {
    if (!window.isHost) return;
    const amount = parseInt(bidInputEl.value);
    if (isNaN(amount)) return;

    currentPrice = amount;
    highestBidder = null; // 호스트가 수동 등록 시 입찰자 정보 초기화

    updateAuctionDisplay();
    addLog(`[공지] 방장이 입찰가를 ${currentPrice}pt로 업데이트했습니다.`, 'system');
};

window.editLeaderName = function(teamId) {
    if (!window.isHost) return;
    const team = teams.find(t => t.id === teamId);
    const newName = prompt("새로운 팀장 이름을 입력하세요:", team.leader);
    if (newName && newName.trim()) {
        team.leader = newName.trim();
        renderTeams();
        updateAuctionDisplay(); // 팀장 이름 변경 시 중앙 입찰 정보도 즉시 갱신
    }
};

window.editTeamName = function(teamId) {
    if (!window.isHost) return;
    const team = teams.find(t => t.id === teamId);
    const newName = prompt("새로운 팀 이름을 입력하세요:", team.name);
    if (newName && newName.trim()) {
        team.name = newName.trim();
        renderTeams();
        updateAuctionDisplay(); // 팀 이름 변경 시 중앙 입찰 정보도 즉시 갱신
    }
};

window.toggleLog = function() {
    const sidebar = document.getElementById('log-sidebar');
    sidebar.classList.toggle('active');
};

window.copyRoomCode = function() {
    if (currentRoomCode) {
        navigator.clipboard.writeText(currentRoomCode).then(() => {
            alert(`방 코드 [${currentRoomCode}]가 클립보드에 복사되었습니다.`);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    }
};

window.selectRole = function(role) {
    entryScreenEl.style.opacity = '0';
    setTimeout(() => {
        entryScreenEl.style.display = 'none';
        if (role === 'host') {
            isHost = true;
            currentRoomCode = generateRoomCode();
            displayRoomCodeEl.textContent = currentRoomCode;
            hostRoomCodeDisplayEl.style.display = 'block';
            setupScreenEl.style.display = 'flex';
            // 방장은 입찰 버튼 숨김, 낙찰 확정 버튼 표시
            placeBidBtn.style.display = 'none';
            confirmBidBtn.style.display = 'block';
        } else {
            isHost = false;
            joinRoomModalEl.style.display = 'flex';
            // 경매자는 입찰 버튼 표시, 낙찰 확정 버튼 숨김
            placeBidBtn.style.display = 'block';
            confirmBidBtn.style.display = 'none';
        }
    }, 500);
};

// 배치 취소 로직 (Host Only)
window.cancelPlacement = function() {
    if (!window.isHost) return;
    isPlacingPlayer = false;
    draggablePlayerCardEl.style.display = 'none';
    confirmBidBtn.style.display = 'block';
    confirmBidBtn.disabled = false;
    cancelPlacementBtn.style.display = 'none';
    
    renderTeams();
    addLog(`[알림] 팀 배치가 취소되었습니다. 다시 진행해주세요.`, 'system');
};

// 방 코드 생성
function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// 경매자: 방 참여
window.joinRoom = function() {
    const enteredCode = roomCodeInputEl.value.trim();

    if (enteredCode.length !== 4) {
        alert("4자리 방 코드를 입력해주세요.");
        return;
    }

    // 실제로는 여기서 백엔드에 방 코드 유효성 검사 및 참여 요청
    // 현재는 로컬 시뮬레이션이므로, 방 코드가 유효하다고 가정하고 진행
    currentRoomCode = enteredCode;
    joinRoomModalEl.style.display = 'none';
    gridLayoutEl.style.display = 'grid';
    bottomWaitingAreaEl.style.display = 'block';
    init(); // 경매자도 메인 화면 진입
    addLog(`방 코드 [${currentRoomCode}]에 참여했습니다.`, 'system');

    // 경매자는 드래그 기능 비활성화
    draggablePlayerCardEl.draggable = false;
    draggablePlayerCardEl.style.cursor = 'default';
    draggablePlayerCardEl.style.display = 'none'; // 경매자는 드래그 요소 안 보이게

    // 팀 카드 드롭 기능 비활성화
    document.querySelectorAll('.team-card').forEach(card => {
        card.removeEventListener('dragover', handleDragOver);
        card.removeEventListener('dragleave', handleDragLeave);
        card.removeEventListener('drop', handleDrop);
    });
};

// 경매자: 방 참여 취소
window.cancelJoin = function() {
    joinRoomModalEl.style.display = 'none';
    entryScreenEl.style.opacity = '1';
    entryScreenEl.style.display = 'flex';
};

// --- Drag & Drop Logic (Host Only) ---
let draggedPlayer = null;

// 클릭으로 선수 배치 (Host Only)
window.handleSlotClick = function(teamId, slotIndex) {
    if (!window.isHost || !isPlacingPlayer || !currentAuctionPlayer) return;

    const team = teams.find(t => t.id === teamId);

    if (team && team.members[slotIndex] === undefined) {
        if (team.points < currentPrice) {
            alert("포인트가 부족하여 영입할 수 없는 팀입니다.");
            return;
        }
        
        team.points -= currentPrice;
        team.members[slotIndex] = currentAuctionPlayer;
        
        addLog(`[배치 완료] ${currentAuctionPlayer.name} 선수가 ${team.name}팀에 배정되었습니다.`, 'system');
        
        // 상태 초기화
        auctionPlayers = auctionPlayers.filter(p => p !== currentAuctionPlayer);
        currentPrice = 0;
        highestBidder = null;
        currentAuctionPlayer = null;
        isPlacingPlayer = false;
        init();
        
        // 버튼 상태 복구
        cancelPlacementBtn.style.display = 'none';
        confirmBidBtn.style.display = 'block';
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
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (!isHost) return;
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    if (!isHost) return;
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const teamId = parseInt(e.currentTarget.dataset.teamId);
    const team = teams.find(t => t.id === teamId);

    if (team && draggedPlayer) {
        // 낙찰 확정 로직
        if (team.members.length >= 5) {
            alert("팀 슬롯이 가득 찼습니다!");
            return;
        }

        team.points -= currentPrice; // 최고 입찰가만큼 포인트 차감
        team.members.push(draggedPlayer); // 선수 추가
        addLog(`[낙찰] ${draggedPlayer.name} 선수가 ${team.name}팀에 영입되었습니다!`, 'system');
        
        // auctionPlayers 배열에서 낙찰된 선수 제거
        auctionPlayers = auctionPlayers.filter(p => p !== draggedPlayer);

        // 초기화
        currentPrice = 0;
        highestBidder = null;
        currentAuctionPlayer = null; // 현재 경매 대상 초기화
        
        init(); // UI 갱신
        draggablePlayerCardEl.style.display = 'none'; // 드래그 요소 숨김
        currentPlayerCardContentEl.style.display = 'none'; // 경매 대상 정보 숨김
        confirmBidBtn.disabled = true; // 낙찰 확정 버튼 다시 비활성화
    }
}

function setupDragAndDrop() {
    if (draggablePlayerCardEl) {
        draggablePlayerCardEl.addEventListener('dragstart', handleDragStart);
        draggablePlayerCardEl.addEventListener('dragend', handleDragEnd);
    }

    document.querySelectorAll('.team-card').forEach(card => {
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // 초기에는 경매 메인 화면 숨김
    gridLayoutEl.style.display = 'none';
    bottomWaitingAreaEl.style.display = 'none';
    hostRoomCodeDisplayEl.style.display = 'none';
    joinRoomModalEl.style.display = 'none';
    currentPlayerCardContentEl.style.display = 'none'; // 경매 대상 정보도 초기에는 숨김
});

// --- Setup Logic ---

window.addPlayerToSetup = function() {
    const nameInput = document.getElementById('input-player-name');
    const roleInput = document.getElementById('input-player-role');
    
    if (!nameInput.value.trim()) return alert("이름을 입력하세요.");

    const newPlayer = {
        name: nameInput.value.trim(),
        role: roleInput.value,
        rank: "PARTICIPANT" // 기본 랭크 (임의)
    };

    auctionPlayers.push(newPlayer);
    nameInput.value = ""; // 초기화
    
    renderSetupList(); // 대기 명단 렌더링
};

function renderSetupList() {
    const listEl = document.getElementById('setup-player-list');
    document.getElementById('setup-count').textContent = auctionPlayers.length;
    listEl.innerHTML = auctionPlayers.map(p => `
        <li><span>${p.name}</span><span style="color:var(--val-blue)">${p.role}</span></li>
    `).join('');
    
    document.getElementById('start-auction-btn').disabled = auctionPlayers.length === 0;
}

window.startAuction = function() {
    setupScreenEl.style.display = 'none';
    gridLayoutEl.style.display = 'grid'; // 경매 메인 화면 표시
    bottomWaitingAreaEl.style.display = 'block'; // 대기 명단 표시
    init();
    addLog(`방 코드 [${currentRoomCode}]로 경매가 시작되었습니다.`, 'system');
    // draggablePlayerCardEl은 방장이 낙찰 확정 시에만 표시되므로, 여기서 숨김
};

// --- 경매 시스템 Logic ---

function init() {
    renderTeams();
    renderWaitingList();
    updateAuctionDisplay();
}

// 팀 리스트 렌더링
function renderTeams() {
    const leftTeams = document.getElementById('left-teams');
    const rightTeams = document.getElementById('right-teams');
    leftTeams.innerHTML = ''; // 초기화
    rightTeams.innerHTML = ''; // 초기화

    teams.forEach((team, index) => {
        const percentage = (team.points / team.maxPoints) * 100;
        const card = document.createElement('div');
        
        // 하이라이트/딤 조건 설정
        let statusClass = '';
        if (isPlacingPlayer) {
            statusClass = team.points >= currentPrice ? 'highlighted selectable' : 'dimmed';
        } else if (highestBidder && highestBidder.id === team.id) {
            statusClass = 'active';
        }

        card.className = `team-card ${statusClass}`;
        card.innerHTML = `
            <div class="team-header">
                <div class="team-identity">
                    <span class="team-name">
                        <strong>${team.name}</strong>
                        ${isHost ? `<i class="fa-solid fa-pen-to-square edit-name-btn" onclick="editTeamName(${team.id})"></i>` : ''}
                    </span>
                    <div class="team-leader" style="font-size: 0.7rem; color: var(--val-blue);">
                        Leader: ${team.leader} ${isHost ? `<i class="fa-solid fa-user-pen edit-name-btn" onclick="editLeaderName(${team.id})"></i>` : ''}
                    </div>
                </div>
                <span class="team-points">${team.points} PT</span>
            </div>
            <div class="points-bar">
                <div class="points-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="member-slots">
                ${[...Array(4)].map((_, i) => `
                    <div class="slot ${team.members[i] ? 'filled' : ''}" onclick="handleSlotClick(${team.id}, ${i})">
                        ${team.members[i] ? `
                            <span class="player-name">${team.members[i].name}</span>
                            <span class="player-role text-xs text-gray-400">${team.members[i].role}</span>
                        ` : 'EMPTY'}
                    </div>
                `).join('')}
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
    waitingListEl.innerHTML = ''; // 초기화
    auctionPlayers.forEach((p, index) => {
        const li = document.createElement('li');
        li.dataset.playerIndex = index; // 클릭 이벤트를 위해 인덱스 저장
        li.innerHTML = `
            <div style="font-weight:bold">${p.name}</div>
            <div style="color:var(--val-blue); font-size:0.7rem">${p.role}</div>
        `;
        waitingListEl.appendChild(li);

        // 대기 명단 클릭 시 경매 대상으로 올리기
        if (window.isHost) {
            li.addEventListener('click', () => selectPlayerForAuction(index));
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
        addLog(`[알림] 새로운 경매를 위해 상태가 초기화되었습니다.`, 'system');
    }

    currentAuctionPlayer = auctionPlayers[playerIndex];
    // 선택된 선수를 배열의 맨 앞으로 이동 (또는 복사)
    auctionPlayers.splice(playerIndex, 1); // 기존 위치에서 제거
    auctionPlayers.unshift(currentAuctionPlayer); // 맨 앞으로 추가

    updateAuctionDisplay();
    renderWaitingList(); // 대기 명단 갱신
    if (isHost) confirmBidBtn.disabled = false;
}

// 4. 경매 로직

// 입찰하기
window.placeBid = function() {
    const amount = parseInt(bidInputEl.value);
    if (isNaN(amount) || amount <= currentPrice) {
        alert(`현재가(${currentPrice}pt)보다 높은 금액을 입력해주세요.`);
        return;
    }
    if (!currentAuctionPlayer) {
        alert("경매 대상 선수를 먼저 선택해주세요.");
        return;
    }

    const team = teams[currentTurnTeamIdx];

    // 간단한 검증
    if (team.points < currentPrice + amount) {
        addLog(`${team.name} 포인트가 부족합니다!`, 'system');
        return;
    }

    currentPrice = amount;
    highestBidder = team;

    // 로그 추가
    addLog(`[입찰] ${team.leader}님이 ${amount}pt를 제시했습니다.`, 'bid');
    
    // 시뮬레이션: 다음 팀으로 턴 넘기기
    currentTurnTeamIdx = (currentTurnTeamIdx + 1) % teams.length;
    
    updateAuctionDisplay();
    renderTeams();
};

// 낙찰 확정
window.confirmBid = function() {
    if (!window.isHost) {
        alert("방장만 낙찰을 확정할 수 있습니다.");
        return;
    }

    const winnerName = highestBidder ? `${highestBidder.name}팀` : "방장 지정";
    addLog(`[낙찰 확정] ${winnerName}이 ${currentPrice}pt로 낙찰되었습니다.`, 'system');
    addLog(`[안내] 방장님, 배정할 팀의 EMPTY 슬롯을 클릭해주세요.`, 'system');
    
    isPlacingPlayer = true;
    renderTeams();

    // 버튼 교체
    confirmBidBtn.style.display = 'none';
    cancelPlacementBtn.style.display = 'block';

    draggablePlayerCardEl.style.display = 'flex'; 
    draggablePlayerCardEl.draggable = false; 
    draggablePlayerNameEl.textContent = currentAuctionPlayer.name;
    draggablePlayerRoleEl.textContent = currentAuctionPlayer.role;
    confirmBidBtn.disabled = true; // 낙찰 확정 버튼 비활성화
};

// 로그 추가 함수
function addLog(message, type = '') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `> ${message}`;
    bidLogsEl.prepend(entry);
}

// 중앙 디스플레이 갱신
function updateAuctionDisplay() {
    currentPriceEl.textContent = currentPrice;
    highestBidderInfoEl.textContent = highestBidder ? `${highestBidder.name} (${highestBidder.leader})` : "입찰자 없음";

    if (currentAuctionPlayer) {
        targetPlayerNameEl.textContent = currentAuctionPlayer.name;
        targetPlayerRoleEl.textContent = `${currentAuctionPlayer.role} / ${currentAuctionPlayer.rank}`;
        currentPlayerCardContentEl.style.display = 'block'; // 대상이 선택되면 카드 표시
        // 방장이 낙찰 확정 버튼을 누르기 전까지는 드래그 카드 숨김
        if (!isPlacingPlayer) draggablePlayerCardEl.style.display = 'none';
    } else {
        targetPlayerNameEl.textContent = "경매 대상 없음";
        targetPlayerRoleEl.textContent = "-";
        currentPlayerCardContentEl.style.display = 'none'; // 대상이 없으면 카드 숨김
        draggablePlayerCardEl.style.display = 'none'; // 대상이 없으면 드래그 카드도 숨김
    }

    // 입찰 금액 입력 필드 초기화 및 최소값 설정
    bidInputEl.min = currentPrice + 10;
    bidInputEl.value = currentPrice + 10;
}