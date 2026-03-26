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

// 멀티 화면 버튼
const btnBackMulti = document.getElementById("btn-back-multi");
const btnCreateRoom = document.getElementById("btn-create-room");
const btnJoinRoom = document.getElementById("btn-join-room");
const multiStatus = document.getElementById("multi-status");

// 게임 시작 클릭 시 2인용 로컬 모드로 바로 시작
btnStart.addEventListener("click", () => {
  startGame("2p_local");
});

// 2P 게임 시작
btn2pLocal.addEventListener("click", () => {
  startGame("2p_local");
});

// 멀티플레이 메뉴 진입
btnMulti.addEventListener("click", () => {
  startScreen.classList.add("hidden");
  multiMenuScreen.classList.remove("hidden");
});

// 멀티 화면에서 뒤로가기
btnBackMulti.addEventListener("click", () => {
  multiMenuScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
});

// 메인 화면에서 뒤로가기 (게임 리스트로 돌아가기)
btnBackMenu.addEventListener("click", () => {
  window.location.href = "../game-list.html";
});

// 게임 초기화 로직
let currentMode = "1p";
let currentPlayer = 1;
let currentRound = 1;
const MAX_ROUNDS = 12;
let dice = [1, 1, 1, 1, 1];
let held = [false, false, false, false, false];
let rollsLeft = 3;

const btnRoll = document.getElementById("btn-roll");
const diceContainer = document.getElementById("dice-container");
const scoreTbody = document.getElementById("score-tbody");
const btnIngameBack = document.getElementById("btn-ingame-back");
const turnIndicator = document.getElementById("turn-indicator");

function startGame(mode) {
  currentMode = mode;
  currentPlayer = 1;
  currentRound = 1;
  startScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  console.log(`${mode} 모드로 요트 다이스 게임을 시작합니다.`);
  
  initBoard();
  updateTurnIndicator();
  resetTurn();
}

// 인게임 화면에서 나가기
if (btnIngameBack) {
  btnIngameBack.addEventListener("click", () => {
    gameScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
  });
}

// 요트 다이스 카테고리
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

function initBoard() {
  diceContainer.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const wrapper = document.createElement("div");
    wrapper.className = "die-wrapper";
    wrapper.dataset.index = i;
    wrapper.addEventListener("click", () => toggleHold(i));

    const scene = document.createElement("div");
    scene.className = "scene";

    const cube = document.createElement("div");
    cube.className = "cube";
    cube.id = `cube-${i}`;

    // 주사위 6면 생성
    [1, 6, 2, 5, 3, 4].forEach(val => {
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
  categories.forEach(cat => {
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

// 점수판 클릭 이벤트 (이벤트 위임)
if (scoreTbody) {
  scoreTbody.addEventListener("click", (e) => {
    const cell = e.target;
    if (!cell.classList.contains("score-cell") || !cell.classList.contains("preview-score")) return;
    
    const playerClass = currentPlayer === 1 ? 'p1-score' : 'p2-score';
    if (!cell.classList.contains(playerClass)) return;

    // 점수 확정
    cell.classList.remove("preview-score");
    cell.classList.add("filled");

    // 다른 미리보기 지우기
    document.querySelectorAll(`.score-cell.${playerClass}.preview-score`).forEach(c => {
        c.textContent = "";
        c.classList.remove("preview-score");
    });

    updateTotalScore(currentPlayer);
    nextTurn();
  });
}

function updateTotalScore(player) {
  const playerClass = player === 1 ? 'p1-score' : 'p2-score';
  let total = 0;
  document.querySelectorAll(`.score-cell.${playerClass}.filled`).forEach(cell => {
      if (cell.dataset.cat !== 'total') {
          total += parseInt(cell.textContent) || 0;
      }
  });
  const totalCell = document.querySelector(`.score-cell.${playerClass}[data-cat="total"]`);
  if (totalCell) {
      totalCell.textContent = total;
      totalCell.classList.add("filled");
  }
}

function updateTurnIndicator() {
  if (turnIndicator) {
      turnIndicator.textContent = `${currentPlayer}P 턴 (${currentRound}/${MAX_ROUNDS} 라운드)`;
  }
}

function nextTurn() {
  if (currentMode === "2p_local") {
      if (currentPlayer === 1) {
          currentPlayer = 2;
      } else {
          currentPlayer = 1;
          currentRound++;
      }
  } else {
      currentRound++; // 1P 모드는 혼자서 12라운드 진행
  }

  if (currentRound > MAX_ROUNDS) {
      // 게임 종료 처리
      setTimeout(() => {
          alert("게임 종료! 최종 점수를 확인하세요.");
      }, 500);
      return;
  }

  updateTurnIndicator();
  resetTurn();
}

// 주사위 눈금을 그려주는 SVG 생성 함수
function getDiceSVG(val) {
  const dots = {
    1: ['<circle cx="35" cy="35" r="8" fill="#e74c3c" />'], // 1은 빨간 점
    2: ['<circle cx="20" cy="20" r="6" fill="#333" />', '<circle cx="50" cy="50" r="6" fill="#333" />'],
    3: ['<circle cx="20" cy="20" r="6" fill="#333" />', '<circle cx="35" cy="35" r="6" fill="#333" />', '<circle cx="50" cy="50" r="6" fill="#333" />'],
    4: ['<circle cx="20" cy="20" r="6" fill="#333" />', '<circle cx="50" cy="20" r="6" fill="#333" />', '<circle cx="20" cy="50" r="6" fill="#333" />', '<circle cx="50" cy="50" r="6" fill="#333" />'],
    5: ['<circle cx="20" cy="20" r="6" fill="#333" />', '<circle cx="50" cy="20" r="6" fill="#333" />', '<circle cx="35" cy="35" r="6" fill="#333" />', '<circle cx="20" cy="50" r="6" fill="#333" />', '<circle cx="50" cy="50" r="6" fill="#333" />'],
    6: ['<circle cx="20" cy="15" r="6" fill="#333" />', '<circle cx="50" cy="15" r="6" fill="#333" />', '<circle cx="20" cy="35" r="6" fill="#333" />', '<circle cx="50" cy="35" r="6" fill="#333" />', '<circle cx="20" cy="55" r="6" fill="#333" />', '<circle cx="50" cy="55" r="6" fill="#333" />']
  };
  return `<svg width="70" height="70" viewBox="0 0 70 70">${dots[val].join('')}</svg>`;
}

function toggleHold(index) {
  if (rollsLeft >= 3) return; // 한 번도 안 굴렸으면 킵 불가
  held[index] = !held[index];
  const wrapper = diceContainer.children[index];
  if (held[index]) {
    wrapper.classList.add("held");
  } else {
    wrapper.classList.remove("held");
  }
}

// 목표 회전 각도 맵핑
const cubeRotations = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: 0, y: -90 },
  5: { x: 0, y: 90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 }
};

function resetTurn() {
  rollsLeft = 3;
  held.fill(false);
  
  const wrappers = document.querySelectorAll(".die-wrapper");
  wrappers.forEach((w, i) => {
    w.classList.remove("held");
    
    // 초기화 시 랜덤한 주사위 면 표시 (애니메이션 없이)
    const initialVal = Math.floor(Math.random() * 6) + 1;
    dice[i] = initialVal;
    
    const cube = document.getElementById(`cube-${i}`);
    cube.style.transition = "none";
    
    const rot = cubeRotations[initialVal];
    cube.style.transform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg) rotateZ(0deg)`;
    cube.dataset.rotX = rot.x;
    cube.dataset.rotY = rot.y;
    cube.dataset.rotZ = 0;

    // 강제 리플로우 (브라우저가 transition:none 상태를 즉시 적용하게 함)
    void cube.offsetWidth;
    
    // 다시 부드러운 애니메이션 복구
    cube.style.transition = "transform 1s cubic-bezier(0.2, 0.8, 0.2, 1)";
  });

  btnRoll.textContent = `주사위 굴리기 (${rollsLeft})`;
  btnRoll.disabled = false;

  // 점수 미리보기 초기화
  document.querySelectorAll('.score-cell.preview-score').forEach(cell => {
      cell.textContent = '';
      cell.classList.remove('preview-score');
  });
}

btnRoll.addEventListener("click", () => {
  if (rollsLeft > 0 && !btnRoll.disabled) {
    rollsLeft--;
    btnRoll.textContent = `주사위 굴리기 (${rollsLeft})`;
    rollDice();
  }
});

function rollDice() {
  btnRoll.disabled = true; // 구르는 동안 연타 방지

  // 이전 미리보기 점수 지우기
  document.querySelectorAll('.score-cell.preview-score').forEach(cell => {
      cell.textContent = '';
      cell.classList.remove('preview-score');
  });

  for (let i = 0; i < 5; i++) {
    if (!held[i]) {
      const finalVal = Math.floor(Math.random() * 6) + 1;
      dice[i] = finalVal;

      const cube = document.getElementById(`cube-${i}`);
      
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

  // 애니메이션이 끝난 후 (1초) 버튼 재활성화 및 점수 미리보기
  setTimeout(() => {
    if (rollsLeft > 0) {
        btnRoll.disabled = false;
    } else {
        btnRoll.disabled = true;
    }
    updateScorePreview();
  }, 1000);
}

// --- 점수 계산 및 미리보기 로직 ---

function calculateScores(currentDice) {
    const scores = {};
    const counts = [0, 0, 0, 0, 0, 0];
    currentDice.forEach(d => counts[d - 1]++);
    const sum = currentDice.reduce((a, b) => a + b, 0);

    // Upper section (Aces ~ Sixes)
    for (let i = 0; i < 6; i++) {
        scores[categories[i].id] = counts[i] * (i + 1);
    }

    // Choice
    scores.choice = sum;

    // 4 of a Kind
    scores['4ok'] = counts.some(c => c >= 4) ? sum : 0;

    // Full House
    const hasThree = counts.includes(3);
    const hasTwo = counts.includes(2);
    scores.fh = (hasThree && hasTwo) || counts.some(c => c === 5) ? sum : 0;

    // Straights
    const uniqueSortedStr = [...new Set(currentDice)].sort((a, b) => a - b).join('');
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
    scores.yacht = counts.some(c => c === 5) ? 50 : 0;

    return scores;
}

function updateScorePreview() {
    // 주사위가 한 번이라도 굴려졌는지 확인
    if (dice.some(d => typeof d !== 'number')) return;

    const potentialScores = calculateScores(dice);
    
    // 현재 턴의 플레이어에 해당하는 점수판 셀만 업데이트
    const playerClass = currentPlayer === 1 ? 'p1-score' : 'p2-score';
    document.querySelectorAll(`.score-cell.${playerClass}`).forEach(cell => {
        const cat = cell.dataset.cat;
        // 이미 점수가 채워진 칸이나 총점, 보너스 칸은 건너뜀
        if (cat === 'total' || cat === 'bonus' || cell.classList.contains('filled')) {
            return;
        }
        
        if (potentialScores[cat] !== undefined) {
            cell.textContent = potentialScores[cat];
            cell.classList.add('preview-score');
        }
    });
}

// 임시 멀티플레이 버튼 로직
btnCreateRoom.addEventListener("click", () => {
  multiStatus.textContent = "방 생성 기능 준비 중...";
});
btnJoinRoom.addEventListener("click", () => {
  multiStatus.textContent = "방 참가 기능 준비 중...";
});