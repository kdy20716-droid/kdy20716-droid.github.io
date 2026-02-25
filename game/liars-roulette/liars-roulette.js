import {
  initMultiplayer,
  sendGameAction,
  myNickname,
  isHost,
  myPlayerIndex,
  currentRoomId,
  sendExternalChatMessage,
} from "./multiplayer.js";
import {
  audioCtx,
  playSound,
  playBGM,
  setupUISounds,
} from "./sound-manager.js";
import { drawBackCard, drawFrontCard, drawCardDeck } from "./graphics-utils.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 캔버스 크기 설정
canvas.width = 1024;
canvas.height = 900;

// 먼지 입자 초기화
const particles = [];
for (let i = 0; i < 50; i++) {
  particles.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.2,
    vy: (Math.random() - 0.5) * 0.2,
    size: Math.random() * 2 + 0.5,
    alpha: Math.random(),
    changeAlpha: (Math.random() - 0.5) * 0.01,
  });
}

// 폭죽 입자 관리
const fireworks = [];
const embers = []; // 불티 입자 관리

// 데빌 카드 등장 애니메이션 상태
const devilCardAnim = {
  active: false,
  phase: "IDLE", // IDLE, ENTER, STAY, EXIT
  progress: 0,
  timer: 0,
};

// 게임 상태 및 플레이어 설정
let centerX = canvas.width / 2;
let centerY = canvas.height / 2;
let tableY = centerY + 30;

const players = [
  {
    name: "East",
    displayName: "플레이어 2",
    x: centerX + 430,
    y: tableY,
    angle: -Math.PI / 2,
    hand: [],
    spacing: 15,
    isDead: false,
  },
  {
    name: "North",
    displayName: "플레이어 3",
    x: centerX,
    y: tableY - 280,
    angle: Math.PI,
    hand: [],
    spacing: 15,
    isDead: false,
  },
  {
    name: "West",
    displayName: "플레이어 4",
    x: centerX - 430,
    y: tableY,
    angle: Math.PI / 2,
    hand: [],
    spacing: 15,
    isDead: false,
  },
  {
    name: "South",
    displayName: "플레이어 1",
    x: centerX,
    y: tableY + 280,
    angle: 0,
    hand: [],
    spacing: 15,
    isDead: false,
  },
];

// 카드 덱 생성 및 셔플
function createDeck() {
  const types = [
    ...Array(6).fill("K"), // King
    ...Array(6).fill("Q"), // Queen
    ...Array(6).fill("A"), // Ace
  ];

  if (Math.random() < 0.2) {
    types.push("D", "D");
    console.log("Devil cards added to deck!");
  } else {
    types.push("J", "J");
    console.log("Joker cards added to deck.");
  }
  // Fisher-Yates Shuffle
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

let cardTypes = [];

// 카드 이미지 로드 (HTML에 있는 img 태그 가져오기)
const cardImages = {};
const imgIds = {
  K: "img-K",
  Q: "img-Q",
  J: "img-J",
  D: "img-D",
  A: "img-A",
  BACK: "img-back",
  REVOLVER: "img-revolver",
  FIST: "img-fist",
};

for (const [key, id] of Object.entries(imgIds)) {
  const img = document.getElementById(id);
  if (img) {
    cardImages[key] = img;
    // 로드 상태 확인용 로그
    img.onload = () => console.log(`이미지 로드 성공: ${id}`);
    img.onerror = () =>
      console.warn(`이미지 로드 실패: ${id} (경로 확인 필요)`);
  }
}

// 배분 애니메이션 상태
let dealingState = {
  isDealing: true,
  totalCards: 20, // 5장 * 4명
  dealtCount: 0,
  movingCard: null, // 현재 이동 중인 카드 {x, y, targetPlayerIndex, progress}
  speed: 0.15, // 카드 이동 속도 (템포 조절)
};

// 애니메이션 관리 (카드 제출 등)
const animations = [];

// 주먹 내리치기 애니메이션 상태
let slamState = {
  active: false,
  playerIndex: -1,
  progress: 0,
};

function showBubble(playerIndex, text) {
  const bubble = document.getElementById(`bubble-${playerIndex}`);
  if (bubble) {
    updateBubblePosition(playerIndex);
    bubble.textContent = text;

    // 이모티콘 감지 (이모티콘만 있는 경우 크기 확대)
    const isEmoji = /^[\p{Extended_Pictographic}\u200d\ufe0f]+$/u.test(text);
    if (isEmoji) {
      bubble.classList.add("emoji-mode");
    } else {
      bubble.classList.remove("emoji-mode");
    }

    bubble.classList.add("show");
    setTimeout(() => {
      bubble.classList.remove("show");
    }, 2000);
  }
}

function updateBubblePosition(playerIndex) {
  const bubble = document.getElementById(`bubble-${playerIndex}`);
  if (!bubble || !players[playerIndex]) return;

  const player = players[playerIndex];
  let offsetX = 0;
  let offsetY = 0;

  if (playerIndex === 0) {
    // East
    offsetX = -120;
    offsetY = -100;
  } else if (playerIndex === 1) {
    // North
    offsetY = -120;
  } else if (playerIndex === 2) {
    // West
    offsetX = 50;
    offsetY = -100;
  } else if (playerIndex === 3) {
    // South
    offsetY = -100;
  }

  bubble.style.left = `${player.x + offsetX}px`;
  bubble.style.top = `${player.y + offsetY}px`;
}

// 러시안 룰렛 상태
const revolver = {
  chambers: 6,
  currentChamber: 0,
  bulletPosition: Math.floor(Math.random() * 6),
};

// 게임 규칙 상태
const gameState = {
  phase: "START", // DEALING, PLAYING, RESOLVING, ROULETTE, GAME_OVER, START
  turnIndex: 3, // 3: South(Player)부터 시작 -> 2: West -> 1: North -> 0: East (반시계/시계 방향에 따라 조정)
  currentRank: "K", // 현재 테이블에 내야 하는 카드 (K, Q, J, S)
  tableCards: [], // 테이블 중앙에 쌓인 카드들
  lastPlayedBatch: null, // 마지막으로 제출된 카드 정보 { playerIndex, cards: [] }
  shakeTimer: 0, // 화면 흔들림 타이머
  lighting: "NORMAL", // NORMAL, DIM, RED_FLASH, FLICKER
  lightingTimer: 0, // 조명 효과 타이머
  turnCount: 0, // 턴 진행 횟수 (도전 확률 증가용)
  victimIndices: [], // 룰렛 대상 플레이어 인덱스 목록 (배열)
  bloodSplatters: [], // 피자국 데이터 {x, y, points, color, scaleX, scaleY, rotation}
  rouletteQueue: [], // 데빌 카드 발동 시 룰렛 대기열
  rouletteStartTime: 0, // 룰렛 애니메이션 시작 시간
  activeTimeouts: [], // 활성화된 타임아웃 ID 관리
};

// 타임아웃 관리 헬퍼 함수 (게임 리셋 시 취소 가능하도록)
function addTimeout(callback, delay) {
  const id = setTimeout(() => {
    callback();
    const index = gameState.activeTimeouts.indexOf(id);
    if (index > -1) gameState.activeTimeouts.splice(index, 1);
  }, delay);
  gameState.activeTimeouts.push(id);
  return id;
}

function clearAllTimeouts() {
  gameState.activeTimeouts.forEach((id) => clearTimeout(id));
  gameState.activeTimeouts = [];
}

function draw() {
  // 카드 배분 로직 업데이트
  if (dealingState.isDealing && gameState.phase !== "START") {
    updateDealing();
  }

  // 배경 (바닥)
  // 1. 전체를 검은색으로 채움 (뒷배경)
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save(); // 흔들림 효과 시작
  if (gameState.shakeTimer > 0) {
    const intensity = gameState.shakeTimer;
    const dx = (Math.random() - 0.5) * intensity;
    const dy = (Math.random() - 0.5) * intensity;
    ctx.translate(dx, dy);
    gameState.shakeTimer--;
  }

  // 조명 효과 계산
  let floorColor = "#1a1a1a";
  let lightColor = "rgba(93, 64, 55, 0.4)";

  if (gameState.lighting === "DIM") {
    // 긴장감 조성 (어둡게)
    lightColor = "rgba(93, 64, 55, 0.1)";
  } else if (gameState.lighting === "RED_FLASH") {
    // 사망 시 붉은 섬광
    if (gameState.lightingTimer > 0) {
      gameState.lightingTimer--;
      const intensity = Math.min(1, gameState.lightingTimer / 60);
      floorColor = `rgb(${Math.floor(120 * intensity)}, 0, 0)`; // 더 진한 붉은색
      lightColor = `rgba(255, 50, 0, ${0.5 * intensity})`; // 주황빛 조명

      // 1. 타오르는 불길 그라디언트 (화면 하단에서 위로)
      const wave = Math.sin(Date.now() * 0.01) * 50;
      const fireHeight = canvas.height * 0.6 + wave; // 화면 60% 높이까지

      const fireGrad = ctx.createLinearGradient(
        0,
        canvas.height,
        0,
        canvas.height - fireHeight,
      );
      fireGrad.addColorStop(0, `rgba(255, 60, 0, ${0.9 * intensity})`); // 하단: 강렬한 주황/빨강
      fireGrad.addColorStop(0.4, `rgba(180, 0, 0, ${0.6 * intensity})`); // 중단: 어두운 빨강
      fireGrad.addColorStop(1, "rgba(0, 0, 0, 0)"); // 상단: 투명

      ctx.fillStyle = fireGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. 흩날리는 불티 (Embers)
      // 생성
      for (let i = 0; i < 5; i++) {
        embers.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 10,
          vx: (Math.random() - 0.5) * 2,
          vy: -(Math.random() * 4 + 3), // 위로 빠르게 올라감
          size: Math.random() * 3 + 1,
          alpha: 1,
          decay: Math.random() * 0.02 + 0.01,
        });
      }

      // 업데이트 및 그리기
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.x += e.vx + Math.sin(Date.now() * 0.01 + e.y * 0.02); // 일렁임
        e.y += e.vy;
        e.alpha -= e.decay;

        if (e.alpha <= 0 || e.y < -50) {
          embers.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(255, 220, 100, ${e.alpha * intensity})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 초기 5프레임 동안 강력한 화이트 플래시 (총구 화염 느낌)
      // 데빌 카드 연출(120프레임)일 때는 생략하고, 총격(60프레임)일 때만 표시
      if (gameState.lightingTimer > 55 && gameState.lightingTimer <= 60) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(gameState.lightingTimer - 55) / 5})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 발사 시 해당 플레이어 방향 모서리 섬광 효과
      if (gameState.victimIndices.length > 0) {
        // 여러 명일 경우 첫 번째 피해자 기준으로 하거나, 화면 전체 효과로 처리
        // 여기서는 첫 번째 피해자 위치 사용 (또는 반복문으로 처리 가능하지만 성능 고려하여 단순화)
        const victim = players[gameState.victimIndices[0]];
        const flashGradient = ctx.createRadialGradient(
          victim.x,
          victim.y,
          10,
          victim.x,
          victim.y,
          600,
        );
        flashGradient.addColorStop(
          0,
          `rgba(255, 255, 200, ${0.9 * intensity})`,
        ); // 중심부 흰색/노란색
        flashGradient.addColorStop(1, "rgba(255, 0, 0, 0)");
        ctx.fillStyle = flashGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      gameState.lighting = "NORMAL";
      embers.length = 0; // 불티 초기화
    }
  } else if (gameState.lighting === "FLICKER") {
    // 생존 시 깜빡임
    if (gameState.lightingTimer > 0) {
      gameState.lightingTimer--;
      if (Math.random() > 0.5) lightColor = "rgba(93, 64, 55, 0.05)";
    } else {
      gameState.lighting = "NORMAL";
    }
  }

  // 2. 테이블 주변만 보이도록 구멍 뚫린 효과 (스포트라이트)
  const bgGradient = ctx.createRadialGradient(
    centerX,
    tableY,
    200,
    centerX,
    tableY,
    700,
  );
  bgGradient.addColorStop(0, floorColor); // 중심부: 동적 바닥색
  bgGradient.addColorStop(1, "rgba(0, 0, 0, 0)"); // 외곽: 투명 (검은색 배경)

  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 내 차례(South)일 때 남쪽에서 희미한 빛 추가
  if (gameState.turnIndex === 3 && gameState.phase === "PLAYING") {
    const turnLight = ctx.createRadialGradient(
      centerX,
      canvas.height + 100,
      100,
      centerX,
      canvas.height,
      800,
    );
    turnLight.addColorStop(0, "rgba(255, 250, 200, 0.19)"); // 따뜻하고 희미한 빛
    turnLight.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = turnLight;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 1. 테이블 다리 (중앙 기둥)
  ctx.save();
  ctx.fillStyle = "#1a0f0a"; // 아주 어두운 나무색
  ctx.strokeStyle = "#3e2723";
  ctx.lineWidth = 4;

  ctx.beginPath();
  // 테이블 중심에서 시작해서 아래로 뻗어나감
  const pillarBottomY = tableY + 260;
  ctx.moveTo(centerX - 50, tableY);
  ctx.lineTo(centerX - 80, pillarBottomY);
  // 바닥 부분 둥글게 처리
  ctx.quadraticCurveTo(
    centerX,
    pillarBottomY + 40,
    centerX + 80,
    pillarBottomY,
  );
  ctx.lineTo(centerX + 50, tableY);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 2. 테이블 아래 빛
  ctx.save();
  const lightY = tableY + 100; // 빛도 테이블을 따라 아래로 이동

  const lightGradient = ctx.createRadialGradient(
    centerX,
    lightY,
    50,
    centerX,
    lightY,
    450,
  );
  lightGradient.addColorStop(0, lightColor); // 중심부 동적 빛
  lightGradient.addColorStop(1, "rgba(93, 64, 55, 0)"); // 외곽 투명

  ctx.fillStyle = lightGradient;
  ctx.beginPath();
  ctx.ellipse(centerX, lightY, 420, 240, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. 테이블 상판 그리기
  const gradient = ctx.createRadialGradient(
    centerX,
    tableY,
    50,
    centerX,
    tableY,
    400,
  );
  gradient.addColorStop(0, "#8d6e63"); // 중앙: 밝은 나무색 (스팟라이트)
  gradient.addColorStop(0.8, "#4e342e"); // 중간: 진한 나무색
  gradient.addColorStop(1, "#281a14"); // 가장자리: 어두운 색

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(centerX, tableY, 400, 220, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3.5 피자국 그리기 (테이블 상판에 클리핑 & 합성)
  ctx.save();
  // 테이블 영역으로 클리핑 (테이블 밖으로 나가지 않게)
  ctx.beginPath();
  ctx.ellipse(centerX, tableY, 400, 220, 0, 0, Math.PI * 2);
  ctx.clip();

  // 나무 질감에 스며든 느낌 (Multiply 블렌딩)
  ctx.globalCompositeOperation = "multiply";

  gameState.bloodSplatters.forEach((splat) => {
    ctx.save();
    ctx.translate(splat.x, splat.y);
    ctx.rotate(splat.rotation);
    ctx.scale(splat.scaleX, splat.scaleY);
    ctx.fillStyle = splat.color;

    // 불규칙한 액체 모양 그리기
    ctx.beginPath();
    if (splat.points && splat.points.length > 0) {
      ctx.moveTo(splat.points[0].x, splat.points[0].y);
      for (let i = 1; i < splat.points.length; i++) {
        // 부드러운 곡선으로 연결
        const p = splat.points[i];
        const prev = splat.points[i - 1];
        const cpX = (prev.x + p.x) / 2;
        const cpY = (prev.y + p.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cpX, cpY);
      }
      // 마지막 점과 첫 점 연결
      const last = splat.points[splat.points.length - 1];
      const first = splat.points[0];
      const cpX = (last.x + first.x) / 2;
      const cpY = (last.y + first.y) / 2;
      ctx.quadraticCurveTo(last.x, last.y, cpX, cpY);
      ctx.quadraticCurveTo(cpX, cpY, first.x, first.y);
    } else {
      // 데이터가 없으면 원형 (fallback)
      ctx.arc(0, 0, splat.radius || 10, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  // 4. 테이블 테두리 (피자국 위에 그려짐)
  ctx.strokeStyle = "#3e2723";
  ctx.lineWidth = 15;
  ctx.stroke();
  ctx.lineWidth = 1;

  // 5. 카드 덱 그리기
  // 딜링 중이거나 이동 중인 카드가 있을 때만 그림 (끝나면 사라짐)
  if (dealingState.isDealing || dealingState.movingCard) {
    drawCardDeck(ctx, cardImages, centerX, tableY - 40);
  }

  // 5.5 리볼버 그리기 (각 플레이어 앞)
  drawPlayerRevolvers();

  // 6. 플레이어 손패 그리기
  if (gameState.phase !== "ROULETTE") {
    players.forEach((player) => {
      const selectedCount = player.hand.filter((c) => c.isSelected).length;
      const isMaxSelected = selectedCount >= 3;

      // 남쪽 플레이어(내 카드)이고 딜링이 끝났으면 카드 간격 넓히기
      if (player.name === "South" && !dealingState.isDealing) {
        // 목표 간격 90, 부드럽게 이동
        player.spacing += (90 - player.spacing) * 0.1;
      }

      // 사망 시 X 표시
      if (player.isDead) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.strokeStyle = "#c62828";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(-40, -40);
        ctx.lineTo(40, 40);
        ctx.moveTo(40, -40);
        ctx.lineTo(-40, 40);
        ctx.stroke();
        ctx.restore();
      }

      player.hand.forEach((card, index) => {
        // 카드를 겹쳐서 배치
        const offsetX = (index - (player.hand.length - 1) / 2) * player.spacing;

        // 선택된 카드 위로 띄우기 (플레이어만)
        const offsetY = card.isSelected ? -30 : 0;

        // 뒤집기 애니메이션 처리
        let scaleX = 1;
        let isBack = !card.faceUp;

        if (card.isFlipping) {
          card.flipProgress += 0.05;
          if (card.flipProgress >= 1) {
            card.flipProgress = 1;
            card.isFlipping = false;
            card.faceUp = true;
          }
          // 0~0.5: 뒷면 줄어듦, 0.5~1: 앞면 늘어남
          if (card.flipProgress < 0.5) {
            scaleX = 1 - card.flipProgress * 2;
            isBack = true;
          } else {
            scaleX = (card.flipProgress - 0.5) * 2;
            isBack = false;
          }
        }

        // 3장 선택 시 나머지 카드 비활성화 효과 (투명도 조절)
        if (player.name === "South" && isMaxSelected && !card.isSelected) {
          ctx.globalAlpha = 0.5;
        } else {
          ctx.globalAlpha = 1.0;
        }

        if (isBack) {
          drawBackCard(
            ctx,
            cardImages,
            player.x,
            player.y,
            player.angle,
            offsetX,
            offsetY,
            scaleX,
            card.isSelected,
          );
        } else {
          drawFrontCard(
            ctx,
            cardImages,
            player.x,
            player.y,
            player.angle,
            card.type,
            offsetX,
            offsetY,
            scaleX,
            card.isSelected,
          );
        }
        // 투명도 초기화
        ctx.globalAlpha = 1.0;
      });
    });
  }

  // 7. 이동 중인 카드 그리기
  if (dealingState.movingCard) {
    const mc = dealingState.movingCard;
    drawBackCard(ctx, cardImages, mc.x, mc.y, mc.angle, 0, 0);
  }

  // 10. 애니메이션 업데이트 및 그리기 (카드 제출 등)
  updateAndDrawAnimations();

  // 10.5 주먹 내리치기 효과 (가장 위에 표시)
  if (slamState.active) {
    updateAndDrawSlam();
  }

  // 8. 테이블 중앙에 쌓인 카드 그리기
  if (gameState.phase !== "ROULETTE") {
    gameState.tableCards.forEach((card, i) => {
      if (card.faceUp) {
        drawFrontCard(
          ctx,
          cardImages,
          card.x,
          card.y,
          card.angle,
          card.type,
          0,
          0,
          1,
        );
      } else {
        drawBackCard(ctx, cardImages, card.x, card.y, card.angle, 0, 0, 1);
      }
    });
  }

  ctx.restore(); // 흔들림 효과 끝

  // 6. 먼지 입자 애니메이션
  updateAndDrawParticles();

  // 7. 폭죽 애니메이션
  updateAndDrawFireworks();

  // 8. 데빌 카드 등장 애니메이션
  updateAndDrawDevilCardAnim();

  requestAnimationFrame(draw);
}

function updateDealing() {
  // 이동 중인 카드가 없다면 새 카드를 발사
  if (!dealingState.movingCard) {
    if (dealingState.dealtCount < dealingState.totalCards) {
      // 살아있는 플레이어에게만 배분
      const survivors = players.filter((p) => !p.isDead);
      const targetPlayer =
        survivors[dealingState.dealtCount % survivors.length];
      const playerIndex = players.indexOf(targetPlayer); // 실제 플레이어 배열의 인덱스 찾기

      dealingState.movingCard = {
        startX: centerX,
        startY: tableY - 40,
        x: centerX,
        y: tableY - 40,
        targetX: targetPlayer.x,
        targetY: targetPlayer.y,
        startAngle: 0.1, // 덱에 있을 때의 각도
        targetAngle: targetPlayer.angle,
        angle: 0.1,
        progress: 0,
        playerIndex: playerIndex,
      };

      // 카드 나눠주는 소리
      playSound("deal");
    } else {
      dealingState.isDealing = false;
      gameState.phase = "PLAYING";

      document.getElementById("game-hud").classList.remove("hidden");
      updateTargetDisplay();
      setTimeout(() => {
        updateGameStatus();
      }, 2500); // 카드 배분 및 뒤집기 애니메이션 후 메시지 표시
      playBGM("main");

      // 라운드 시작 시 버튼 상태 초기화
      const btnLiar = document.getElementById("btn-liar");
      const btnPlay = document.getElementById("btn-play");
      if (btnLiar) btnLiar.classList.add("hidden");
      if (btnPlay) {
        btnPlay.textContent = "완료";
        btnPlay.disabled = true;
      }

      // 딜링이 끝난 후 AI 턴이면 행동 시작
      if (gameState.turnIndex !== 3) {
        processAiTurn();
      }
    }
  }

  // 이동 중인 카드가 있다면 업데이트
  if (dealingState.movingCard) {
    const mc = dealingState.movingCard;
    mc.progress += dealingState.speed;

    if (mc.progress >= 1) {
      // 도착 완료
      const cardType = cardTypes[dealingState.dealtCount];
      players[mc.playerIndex].hand.push({
        type: cardType,
        faceUp: false,
        isFlipping: false,
        flipProgress: 0,
        isSelected: false, // 선택 상태 추가
      }); // 핸드에 카드 추가
      dealingState.dealtCount++;
      dealingState.movingCard = null;

      // 모든 카드가 배분되면 남쪽 플레이어(인덱스 3) 카드 뒤집기
      if (dealingState.dealtCount >= dealingState.totalCards) {
        addTimeout(() => {
          players[3].hand.forEach((card, i) => {
            addTimeout(() => {
              card.isFlipping = true;
            }, i * 200); // 순차적으로 뒤집기
          });
        }, 500);
      }
    } else {
      // 이동 중 (선형 보간)
      mc.x = mc.startX + (mc.targetX - mc.startX) * mc.progress;
      mc.y = mc.startY + (mc.targetY - mc.startY) * mc.progress;
      mc.angle = mc.startAngle + (mc.targetAngle - mc.startAngle) * mc.progress;
    }
  }
}

function updateAndDrawParticles() {
  ctx.fillStyle = "#f0e6d2"; // 빛의 색감에 맞춘 아주 연한 웜톤
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha += p.changeAlpha;

    // 투명도 범위 제한 및 반전 (더 투명하게 조정: 최대 0.5 -> 0.3)
    if (p.alpha <= 0 || p.alpha >= 0.3) {
      p.changeAlpha *= -1;
    }
    // 범위 보정
    if (p.alpha < 0) p.alpha = 0;
    if (p.alpha > 0.3) p.alpha = 0.3;

    // 화면 밖으로 나가면 반대편으로 이동
    if (p.x < 0) p.x = canvas.width;
    if (p.x > canvas.width) p.x = 0;
    if (p.y < 0) p.y = canvas.height;
    if (p.y > canvas.height) p.y = 0;

    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1.0; // 투명도 초기화
}

function createFirework(x, y) {
  const particleCount = 80;
  const color = `hsl(${Math.random() * 360}, 100%, 60%)`;
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 2;
    fireworks.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      color: color,
      gravity: 0.08,
      decay: Math.random() * 0.015 + 0.005,
    });
  }
}

function updateAndDrawFireworks() {
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const p = fireworks[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.alpha -= p.decay;

    if (p.alpha <= 0) {
      fireworks.splice(i, 1);
      continue;
    }

    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

function triggerDevilCardAnimation() {
  devilCardAnim.active = true;
  devilCardAnim.phase = "ENTER";
  devilCardAnim.progress = 0;
  devilCardAnim.timer = 0;
}

function updateAndDrawDevilCardAnim() {
  if (!devilCardAnim.active) return;

  // 화면 오른쪽 아래 좌표 설정
  const startX = canvas.width + 150;
  const startY = canvas.height + 200;
  const endX = canvas.width - 150;
  const endY = canvas.height - 150;

  if (devilCardAnim.phase === "ENTER") {
    devilCardAnim.progress += 0.04; // 속도 조절
    if (devilCardAnim.progress >= 1) {
      devilCardAnim.progress = 1;
      devilCardAnim.phase = "STAY";
      devilCardAnim.timer = 90; // 1.5초 유지
    }
  } else if (devilCardAnim.phase === "STAY") {
    devilCardAnim.timer--;
    if (devilCardAnim.timer <= 0) {
      devilCardAnim.phase = "EXIT";
    }
  } else if (devilCardAnim.phase === "EXIT") {
    devilCardAnim.progress -= 0.04;
    if (devilCardAnim.progress <= 0) {
      devilCardAnim.progress = 0;
      devilCardAnim.active = false;
      devilCardAnim.phase = "IDLE";
      return;
    }
  }

  // Easing 함수 (Cubic Out)
  const t = devilCardAnim.progress;
  const ease = 1 - Math.pow(1 - t, 3);

  const curX = startX + (endX - startX) * ease;
  const curY = startY + (endY - startY) * ease;
  const rotation = 0.5 - ease * 0.8; // 등장하면서 회전

  ctx.save();
  ctx.translate(curX, curY);
  ctx.rotate(rotation);

  // 붉은색 후광 효과
  ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
  ctx.shadowBlur = 40;

  // 3배 확대
  ctx.scale(3, 3);

  // 카드 그리기 (좌표 0,0 기준)
  drawFrontCard(ctx, cardImages, 0, 0, 0, "D");

  ctx.restore();
}

function updateAndDrawAnimations() {
  for (let i = animations.length - 1; i >= 0; i--) {
    const anim = animations[i];
    anim.progress += anim.speed;

    if (anim.progress >= 1) {
      anim.progress = 1;
      if (anim.onComplete) anim.onComplete();
      animations.splice(i, 1);
    } else {
      // 선형 보간 이동
      const curX = anim.startX + (anim.targetX - anim.startX) * anim.progress;
      const curY = anim.startY + (anim.targetY - anim.startY) * anim.progress;
      const curAngle =
        anim.startAngle + (anim.targetAngle - anim.startAngle) * anim.progress;

      // 플레이어 1(index 3)은 카드를 뒤집으면서 냄 (앞면 -> 뒷면)
      let scaleX = 1;
      let isBack = true;

      if (anim.playerIndex === 3) {
        if (anim.progress < 0.5) {
          isBack = false; // 절반 전까지는 앞면
          scaleX = 1 - anim.progress * 2; // 1 -> 0
        } else {
          isBack = true; // 절반 이후는 뒷면
          scaleX = (anim.progress - 0.5) * 2; // 0 -> 1
        }
      }

      // 잔상 효과 (Trail)
      if (!anim.trail) anim.trail = [];
      anim.trail.push({
        x: curX,
        y: curY,
        angle: curAngle,
        scaleX: scaleX,
        isBack: isBack,
      });
      if (anim.trail.length > 5) anim.trail.shift(); // 잔상 길이 제한

      anim.trail.forEach((pos, idx) => {
        ctx.globalAlpha = (idx / anim.trail.length) * 0.3; // 뒤로 갈수록 투명하게
        if (pos.isBack) {
          drawBackCard(
            ctx,
            cardImages,
            pos.x,
            pos.y,
            pos.angle,
            0,
            0,
            pos.scaleX,
          );
        } else {
          drawFrontCard(
            ctx,
            cardImages,
            pos.x,
            pos.y,
            pos.angle,
            anim.cardType,
            0,
            0,
            pos.scaleX,
          );
        }
      });
      ctx.globalAlpha = 1.0;

      // 현재 카드 그리기
      if (isBack) {
        drawBackCard(ctx, cardImages, curX, curY, curAngle, 0, 0, scaleX);
      } else {
        drawFrontCard(
          ctx,
          cardImages,
          curX,
          curY,
          curAngle,
          anim.cardType,
          0,
          0,
          scaleX,
        );
      }
    }
  }
}

// 각 플레이어의 리볼버 그리기 함수
function drawPlayerRevolvers() {
  players.forEach((player, index) => {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // 기본 위치: 플레이어 오른쪽(x+) 앞(y-) 테이블 위
    const restX = 130;
    const restY = -150;
    const restRotation = -Math.PI / 2 + 0.2;

    let currentX = restX;
    let currentY = restY;
    let currentRotation = restRotation;

    // 룰렛 단계이고 피해자인 경우: 자기 자신을 향해 조준
    if (
      gameState.phase === "ROULETTE" &&
      gameState.victimIndices.includes(index)
    ) {
      // 목표 위치 (머리/중심 쪽)
      const aimX = 60;
      const aimY = -80;
      let aimRotation = Math.atan2(-aimY, -aimX);

      // 회전 방향을 반대로 (최단 경로로) 수정
      if (aimRotation - restRotation > Math.PI) {
        aimRotation -= Math.PI * 2;
      } else if (aimRotation - restRotation < -Math.PI) {
        aimRotation += Math.PI * 2;
      }

      // 진행률 계산 (5초 동안 천천히 이동)
      const elapsed = Date.now() - gameState.rouletteStartTime;
      const duration = 5000;
      let progress = Math.min(elapsed / duration, 1);

      // Easing (Cubic Ease Out) - 부드럽게 도착
      const ease = 1 - Math.pow(1 - progress, 3);

      // 위치 및 회전 보간
      currentX = restX + (aimX - restX) * ease;
      currentY = restY + (aimY - restY) * ease;
      currentRotation = restRotation + (aimRotation - restRotation) * ease;

      // 공포로 인한 떨림 효과 (조준이 거의 완료되었을 때 시작)
      if (progress > 0.8) {
        currentX += (Math.random() - 0.5) * 3;
        currentY += (Math.random() - 0.5) * 3;
      }
    }

    ctx.translate(currentX, currentY);
    ctx.rotate(currentRotation);

    const scale = 0.9;
    ctx.scale(scale, scale);

    // 그림자
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 20, 60, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    const w = 100;
    const h = 60;

    // 색상 정의
    const metalColor = "#546e7a"; // 청회색 금속
    const gripColor = "#5d4037"; // 갈색 나무
    const darkMetal = "#263238"; // 어두운 금속

    if (
      cardImages.REVOLVER &&
      cardImages.REVOLVER.complete &&
      cardImages.REVOLVER.naturalWidth > 0
    ) {
      ctx.drawImage(cardImages.REVOLVER, -w / 2, -h / 2, w, h);
    } else {
      // 대체 도형 (옆모습 형상화)
      // 1. 손잡이 (Grip)
      ctx.fillStyle = gripColor;
      ctx.beginPath();
      ctx.moveTo(-40, 10);
      ctx.quadraticCurveTo(-55, 30, -50, 50);
      ctx.lineTo(-30, 50);
      ctx.quadraticCurveTo(-25, 30, -20, 20);
      ctx.lineTo(-40, 10);
      ctx.fill();

      // 손잡이 나사
      ctx.fillStyle = "#3e2723";
      ctx.beginPath();
      ctx.arc(-40, 30, 3, 0, Math.PI * 2);
      ctx.fill();

      // 2. 프레임 (Frame)
      ctx.fillStyle = metalColor;
      ctx.beginPath();
      ctx.moveTo(-40, 10);
      ctx.lineTo(20, 10);
      ctx.lineTo(20, 35);
      ctx.lineTo(-20, 35);
      ctx.lineTo(-40, 20);
      ctx.fill();

      // 3. 실린더 (Cylinder)
      ctx.fillStyle = darkMetal;
      ctx.fillRect(-15, 5, 35, 25);
      ctx.fillStyle = "#37474f";
      ctx.fillRect(-10, 8, 25, 6);
      ctx.fillRect(-10, 20, 25, 6);

      // 4. 총열 (Barrel)
      ctx.fillStyle = metalColor;
      ctx.fillRect(20, 5, 60, 12);
      ctx.fillStyle = "#455a64";
      ctx.fillRect(20, 5, 60, 3);
      ctx.fillStyle = darkMetal; // 가늠쇠
      ctx.beginPath();
      ctx.moveTo(75, 5);
      ctx.lineTo(80, 5);
      ctx.lineTo(80, -2);
      ctx.lineTo(75, 5);
      ctx.fill();

      // 5. 방아쇠 울 및 방아쇠
      ctx.strokeStyle = metalColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-15, 35);
      ctx.quadraticCurveTo(-5, 50, 15, 35);
      ctx.stroke();
      ctx.fillStyle = "#212121";
      ctx.beginPath();
      ctx.moveTo(-5, 35);
      ctx.quadraticCurveTo(0, 42, 5, 35);
      ctx.fill();

      // 6. 공이치기 (Hammer)
      ctx.fillStyle = darkMetal;
      ctx.beginPath();
      ctx.moveTo(-40, 10);
      ctx.quadraticCurveTo(-45, 5, -42, 0);
      ctx.lineTo(-35, 10);
      ctx.fill();
    }

    ctx.restore();
  });
}

// 주먹 내리치기 업데이트 및 그리기
function updateAndDrawSlam() {
  slamState.progress += 0.08; // 애니메이션 속도

  if (slamState.progress >= 1) {
    slamState.active = false;
    return;
  }

  const player = players[slamState.playerIndex];
  let scale = 1;
  let alpha = 1;
  const yOffset = -180; // 테이블 위 위치 (플레이어 앞)
  const xOffset = 60; // 오른쪽으로 살짝 이동

  // 애니메이션: 내려치기(확대->축소) -> 유지 -> 사라짐
  if (slamState.progress < 0.3) {
    // 임팩트 전: 큼지막하게 시작해서 작아짐 (내려찍는 느낌)
    const t = slamState.progress / 0.3;
    scale = 2.5 - t * 1.5; // 2.5 -> 1.0
    alpha = Math.min(1, t * 3); // 빠르게 불투명해짐
  } else if (slamState.progress > 0.7) {
    // 사라짐
    alpha = 1 - (slamState.progress - 0.7) / 0.3;
  }

  // 임팩트 순간 화면 흔들림
  if (slamState.progress >= 0.3 && slamState.progress < 0.38) {
    if (gameState.shakeTimer === 0) gameState.shakeTimer = 10;
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.translate(xOffset, yOffset);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  const size = 140;
  if (
    cardImages.FIST &&
    cardImages.FIST.complete &&
    cardImages.FIST.naturalWidth > 0
  ) {
    // 이미지가 있다면 그대로 표시 (오른손 가정)
    ctx.drawImage(cardImages.FIST, -size / 2, -size / 2, size, size);
  } else {
    // 대체 주먹 (오른손 실사 느낌 드로잉)
    const skinColor = "#e0ac69"; // 피부색
    const shadowColor = "#8d6e63"; // 그림자/윤곽선 색

    // 1. 그림자 (바닥)
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(10, 10, size / 2.2, size / 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 손등 (베이스)
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    const r = 20;
    const x = -size / 2.2;
    const y = -size / 2.5;
    const w = size * 0.9;
    const h = size * 0.7;
    // 둥근 사각형 그리기
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    // 3. 손가락 마디 (주먹 쥔 모습)
    for (let i = 0; i < 4; i++) {
      const fingerX = -size / 2.8 + i * (size * 0.23);
      const fingerY = size * 0.2;

      // 손가락 마디 입체감 (그림자)
      ctx.fillStyle = shadowColor;
      ctx.beginPath();
      ctx.arc(fingerX, fingerY + 3, size * 0.11, 0, Math.PI * 2);
      ctx.fill();

      // 손가락 마디 (본체)
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(fingerX, fingerY, size * 0.11, 0, Math.PI * 2);
      ctx.fill();

      // 관절 주름
      ctx.strokeStyle = shadowColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(fingerX, fingerY, size * 0.08, 0.5, 2.6);
      ctx.stroke();
    }

    // 4. 엄지 손가락 (오른손이므로 왼쪽에 위치)
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    // 엄지가 검지 옆을 감싸는 형태
    ctx.ellipse(-size * 0.35, 0, size * 0.12, size * 0.22, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 엄지 윤곽선
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-size * 0.35, 0, size * 0.12, size * 0.22, 0.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// 마우스 클릭 이벤트 처리
canvas.addEventListener("click", (e) => {
  if (gameState.phase === "GAME_OVER") {
    location.reload();
    return;
  }

  if (gameState.phase !== "PLAYING") return;
  if (gameState.turnIndex !== 3) return; // 플레이어 턴이 아니면 무시

  const rect = canvas.getBoundingClientRect();
  // 캔버스 스케일링 비율 계산 (화면에 보이는 크기 vs 실제 캔버스 크기)
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  const player = players[3]; // South
  const cardW = 80;
  const cardH = 120;

  // 1. 카드 클릭 감지 (역순으로 체크하여 위에 있는 카드부터 선택)
  let cardClicked = false;
  for (let i = player.hand.length - 1; i >= 0; i--) {
    const card = player.hand[i];
    const offsetX = (i - (player.hand.length - 1) / 2) * player.spacing;
    const offsetY = card.isSelected ? -30 : 0;

    // 카드의 화면상 좌표 (중심 기준)
    const cardX = player.x + offsetX;
    const cardY = player.y + offsetY;

    // 히트 박스 체크
    if (
      clickX >= cardX - cardW / 2 &&
      clickX <= cardX + cardW / 2 &&
      clickY >= cardY - cardH / 2 &&
      clickY <= cardY + cardH / 2
    ) {
      const selectedCount = player.hand.filter((c) => c.isSelected).length;
      if (card.isSelected || selectedCount < 3) {
        card.isSelected = !card.isSelected;
        playSound("select"); // 카드 선택 효과음
      }
      cardClicked = true;
      break; // 한 번에 한 장만 클릭 처리 (겹친 경우 위쪽 우선)
    }
  }

  // 카드 클릭 시 Play 버튼 상태 업데이트
  const hasSelection = player.hand.some((c) => c.isSelected);
  const btnPlay = document.getElementById("btn-play");
  if (btnPlay) btnPlay.disabled = !hasSelection;
});

function submitCards(playerIndex, cardIndices) {
  const player = players[playerIndex];
  const cardsToPlay = [];

  // 인덱스 역순 정렬 (splice 시 인덱스 밀림 방지)
  cardIndices.sort((a, b) => b - a);

  // 플레이어별 테이블 목표 위치 설정 (각자 앞쪽 테이블 공간)
  let targetBaseX = centerX;
  let targetBaseY = tableY;
  let targetBaseAngle = 0;

  if (playerIndex === 0) {
    // East
    targetBaseX = centerX + 200;
    targetBaseY = tableY;
    targetBaseAngle = -Math.PI / 2;
  } else if (playerIndex === 1) {
    // North
    targetBaseX = centerX;
    targetBaseY = tableY - 120;
    targetBaseAngle = Math.PI;
  } else if (playerIndex === 2) {
    // West
    targetBaseX = centerX - 200;
    targetBaseY = tableY;
    targetBaseAngle = Math.PI / 2;
  } else if (playerIndex === 3) {
    // South
    targetBaseX = centerX;
    targetBaseY = tableY + 120;
    targetBaseAngle = 0;
  }

  // 선택된 카드를 핸드에서 제거하고 테이블로 이동
  cardIndices.forEach((idx) => {
    const card = player.hand.splice(idx, 1)[0];
    card.isSelected = false;
    card.faceUp = false; // 낼 때는 뒷면으로
    cardsToPlay.push(card);

    // 카드 소리 재생
    playSound("card");

    // 약간의 랜덤 오차 추가 (자연스럽게 쌓이도록)
    const targetX = targetBaseX + (Math.random() - 0.5) * 30;
    const targetY = targetBaseY + (Math.random() - 0.5) * 30;
    const targetAngle = targetBaseAngle + (Math.random() - 0.5) * 0.4;

    // 애니메이션 추가
    animations.push({
      startX: player.x,
      startY: player.y,
      targetX: targetX, // 계산된 목표 위치 사용
      targetY: targetY,
      startAngle: player.angle,
      targetAngle: targetAngle,
      progress: 0,
      speed: 0.15, // 카드 이동 속도 (템포 조절)
      playerIndex: playerIndex, // 뒤집기 효과를 위해 추가
      cardType: card.type, // 앞면 그리기를 위해 추가
      onComplete: () => {
        card.x = targetX; // 카드의 최종 위치 저장
        card.y = targetY;
        card.angle = targetAngle;
        gameState.tableCards.push(card);
      },
    });
  });

  // 마지막 배치 정보 업데이트
  gameState.lastPlayedBatch = {
    playerIndex: playerIndex,
    cards: cardsToPlay,
  };

  console.log(`${player.name} played ${cardsToPlay.length} cards.`);

  gameState.turnCount++; // 턴 카운트 증가

  // 승패 조건 확인: 나를 제외한 모든 플레이어가 카드를 다 털었는지 확인 (또는 내가 다 털어서 1명만 남았는지)
  const othersWithCards = players.filter(
    (p) => !p.isDead && p !== players[playerIndex] && p.hand.length > 0,
  );

  if (othersWithCards.length === 0) {
    // 나 말고 다른 사람들은 모두 카드를 털었음 (내가 마지막)
    // 카드를 냈다는 것은 도전을 하지 않았다는 뜻이므로 패배 처리
    const loser = players[playerIndex];
    console.log(`${loser.name} is the last one playing cards!`);
    showMessage(`${loser.displayName}이(가) 카드를 모두 털지 못했습니다!`, 150);
    addTimeout(() => triggerRussianRoulette(loser), 2000);
    return; // 턴 넘기지 않고 종료
  }

  // 턴 넘기기
  nextTurn();

  // 내 턴이 끝나면 버튼 숨기기/비활성화
  if (playerIndex === 3) {
    document.getElementById("btn-play").disabled = true;
  }

  // 다음 턴이 AI라면 AI 로직 실행
  if (gameState.turnIndex !== 3) {
    processAiTurn();
  }
}

function nextTurn() {
  let nextIndex = gameState.turnIndex;
  let loopCount = 0;
  do {
    nextIndex = (nextIndex - 1 + 4) % 4; // 반시계 방향
    loopCount++;
  } while (
    (players[nextIndex].isDead ||
      (gameState.phase === "PLAYING" &&
        players[nextIndex].hand.length === 0)) &&
    loopCount < 5
  );
  gameState.turnIndex = nextIndex;
  updateGameStatus();

  // 내 턴이 돌아왔을 때 Liar 버튼 표시 여부 확인
  const btnLiar = document.getElementById("btn-liar");
  if (
    gameState.turnIndex === 3 &&
    gameState.lastPlayedBatch &&
    gameState.lastPlayedBatch.playerIndex !== 3
  ) {
    btnLiar.classList.remove("hidden");
  } else {
    btnLiar.classList.add("hidden");
  }
}

function processAiTurn() {
  const aiIndex = gameState.turnIndex;
  const aiPlayer = players[aiIndex];

  // 멀티플레이 시 호스트만 AI 로직 수행
  if (isMultiplayerGame && !isHost) return;

  // 멀티플레이 시 AI 플레이어인지 확인 (사람이면 리턴)
  if (isMultiplayerGame && !aiPlayer.isAI) return;

  // 고민하는 시간 랜덤 설정 (1초 ~ 3초)
  // 고민하는 시간 랜덤 설정 (2초 ~ 4초) - 템포 조절
  const thinkingTime = Math.random() * 2000 + 2000;

  // 멀티플레이 시 AI의 서버 인덱스 계산 (호스트 기준)
  let serverAiIndex = aiIndex;
  if (isMultiplayerGame) {
    // 로컬 인덱스(aiIndex) -> 서버 인덱스 변환 공식
    const offset = (3 - aiIndex + 4) % 4;
    serverAiIndex = (myPlayerIndex + offset) % 4;
  }

  addTimeout(() => {
    // 상대방이 카드를 냈을 때 반응 (50% 확률)
    if (gameState.lastPlayedBatch && Math.random() < 0.5) {
      const reactionPhrases = ["의심스러운데...", "설마?", "자신있어?"];
      showBubble(
        aiIndex,
        reactionPhrases[Math.floor(Math.random() * reactionPhrases.length)],
      );
    }

    addTimeout(() => {
      // 1. 도전(Liar) 여부 결정 (이전 플레이어가 카드를 냈을 경우)
      // 기본 20% + 테이블에 쌓인 카드 1장당 1% 증가
      let challengeChance = 0.2 + gameState.tableCards.length * 0.01;

      // 나 말고 다 털었으면(마지막 생존자) 무조건 도전해야 함 (카드를 내면 패배하므로)
      const othersWithCards = players.filter(
        (p) => !p.isDead && p !== aiPlayer && p.hand.length > 0,
      );
      if (othersWithCards.length === 0) challengeChance = 1.0;

      if (gameState.lastPlayedBatch && Math.random() < challengeChance) {
        const phrases = ["거짓말!", "까봐!", "너 죽고 나죽자!"];
        showBubble(
          aiIndex,
          phrases[Math.floor(Math.random() * phrases.length)],
        );
        console.log(`${aiPlayer.name} challenges!`);
        if (isMultiplayerGame) {
          sendGameAction("CHALLENGE", {}, aiIndex);
          sendGameAction("CHALLENGE", {}, serverAiIndex);
        } else {
          challenge();
        }
        return;
      }

      // 2. 카드 제출 로직
      // 현재 랭크와 일치하거나 조커인 카드 찾기
      const validIndices = [];
      const invalidIndices = [];
      aiPlayer.hand.forEach((card, index) => {
        if (
          card.type === gameState.currentRank ||
          card.type === "J" ||
          card.type === "D"
        ) {
          // 데빌 카드가 있다면 데빌 카드만 따로 분류하거나 우선순위 조정 필요
          // 여기서는 단순하게 유효 카드로 분류하되, 아래에서 섞을 때 주의
          validIndices.push(index);
        } else {
          invalidIndices.push(index);
        }
      });

      // 랭크 텍스트 변환 (대사용)
      let rankText = gameState.currentRank;
      if (rankText === "A") rankText = "에이스";
      if (rankText === "J") rankText = "조커";
      if (rankText === "K") rankText = "킹";
      if (rankText === "Q") rankText = "퀸";

      let indicesToPlay = [];

      // 진실을 말할 확률 (50% 고정 - 진짜 랜덤하게 블러핑)
      const truthChance = 0.5;

      if (validIndices.length > 0 && Math.random() < truthChance) {
        const count = Math.min(
          validIndices.length,
          Math.floor(Math.random() * 3) + 1,
        ); // 1~3장

        // 데빌 카드가 포함되어 있다면 데빌 카드만 선택하도록 필터링
        const devilIndices = validIndices.filter(
          (idx) => aiPlayer.hand[idx].type === "D",
        );
        if (devilIndices.length > 0) {
          // 데빌 카드가 있으면 데빌 카드만 냄 (AI 전략)
          indicesToPlay = devilIndices;
        } else {
          indicesToPlay = validIndices.slice(0, count);
        }

        // 진실 대사
        const phrases = ["들어오시던지!", "쫄려?", "믿어줘"];
        showBubble(
          aiIndex,
          phrases[Math.floor(Math.random() * phrases.length)],
        );
      } else {
        // 거짓말 (랜덤 카드 제출)
        const count = Math.min(
          aiPlayer.hand.length,
          Math.floor(Math.random() * 3) + 1,
        ); // 1~3장
        // 섞어서 선택
        const allIndices = validIndices.concat(invalidIndices);
        // 셔플 (무작위 선택)
        for (let i = allIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
        }

        // 섞은 후 선택된 카드들에 데빌 카드가 섞여 있는지 확인
        indicesToPlay = allIndices.slice(0, count);
        const selectedCards = indicesToPlay.map((idx) => aiPlayer.hand[idx]);
        const hasDevil = selectedCards.some((c) => c.type === "D");
        if (hasDevil) {
          // 데빌 카드가 섞였다면 데빌 카드만 남기거나 다시 선택 (여기서는 데빌만 남김)
          indicesToPlay = indicesToPlay.filter(
            (idx) => aiPlayer.hand[idx].type === "D",
          );
        }

        // 블러핑 대사
        const phrases = ["들어오시던지!", "쫄려?", "믿어줘"];
        showBubble(
          aiIndex,
          phrases[Math.floor(Math.random() * phrases.length)],
        );
      }

      // 카드가 없으면 강제로 아무거나 냄 (규칙상 패스 없음)
      if (indicesToPlay.length === 0 && aiPlayer.hand.length > 0) {
        indicesToPlay.push(0);
      }

      if (isMultiplayerGame) {
        sendGameAction("SUBMIT", { cardIndices: indicesToPlay }, aiIndex);
        sendGameAction("SUBMIT", { cardIndices: indicesToPlay }, serverAiIndex);
      } else {
        submitCards(aiIndex, indicesToPlay);
      }
    }, 1500); // 반응 후 1.5초 대기
  }, thinkingTime);
}

function challenge() {
  // 중복 클릭 방지: 이미 처리 중이거나 다른 단계라면 무시
  if (gameState.phase !== "PLAYING") return;

  const btnLiar = document.getElementById("btn-liar");
  if (btnLiar) btnLiar.classList.add("hidden");

  gameState.phase = "RESOLVING";
  const challenger = players[gameState.turnIndex];
  const lastBatch = gameState.lastPlayedBatch;
  const submitter = players[lastBatch.playerIndex];
  const isLie = lastBatch.cards.some(
    (c) => c.type !== gameState.currentRank && c.type !== "J" && c.type !== "D",
  );

  // 도전 대사 (플레이어가 도전했을 때도 말풍선 표시)
  const phrases = ["거짓말!", "까봐!", "너 죽고 나죽자!"];
  showBubble(
    gameState.turnIndex,
    phrases[Math.floor(Math.random() * phrases.length)],
  );

  console.log("--- CHALLENGE! ---");
  console.log(`Challenger: ${challenger.name}, Submitter: ${submitter.name}`);

  // 주먹 내리치기 애니메이션 시작
  slamState.active = true;
  slamState.playerIndex = gameState.turnIndex;
  slamState.progress = 0;

  lastBatch.cards.forEach((card) => {
    // 결과 확인을 위해 앞면으로 뒤집기 (애니메이션 없이 즉시)
    card.faceUp = true;
  });

  // 데빌 카드 체크
  const hasDevil = lastBatch.cards.some((c) => c.type === "D");
  if (hasDevil) {
    handleDevilEffect(submitter);
    return;
  }

  // 테이블의 마지막 카드들을 앞면으로 그림 (draw 함수에서 처리됨)
  // 여기서는 결과 처리만

  let loser;
  if (isLie) {
    console.log("It was a LIE! Submitter loses.");
    loser = submitter;
    addTimeout(() => {
      const winPhrases = ["거봐!", "그럴줄 알았다", "잘가"];
      showBubble(
        gameState.turnIndex,
        winPhrases[Math.floor(Math.random() * winPhrases.length)],
      );
    }, 1000);
  } else {
    console.log("It was TRUE! Challenger loses.");
    loser = challenger;
    addTimeout(() => {
      const losePhrases = ["말도 안돼...", "젠장!", "FUCK!"];
      showBubble(
        gameState.turnIndex,
        losePhrases[Math.floor(Math.random() * losePhrases.length)],
      );
    }, 1000);
  }

  // 진실/거짓 밝혀질 때 효과음 (두둥!)
  playSound("drama");

  showMessage(isLie ? "거짓말!" : "진실!", 100);

  addTimeout(() => {
    triggerRussianRoulette(loser);
  }, 2000);
}

function handleDevilEffect(submitter) {
  console.log("DEVIL CARD ACTIVATED!");
  playSound("drama");
  playSound("devil");
  showMessage("데빌 카드 발동!", 200);
  gameState.shakeTimer = 60; // 화면 흔들림 추가

  // 배경음악 볼륨 줄이기 (긴장감 조성)
  const mainBgm = document.getElementById("bgm-main");
  if (mainBgm) {
    mainBgm.volume = mainBgm.volume * 0.2;
  }

  // 제출자를 제외한 모든 생존자를 대기열에 추가
  const victims = players.filter((p) => !p.isDead && p !== submitter);

  // 동시 격발 함수 호출
  addTimeout(() => {
    triggerSimultaneousRoulette(victims);
  }, 2000);
}

function processRouletteQueue() {
  if (gameState.rouletteQueue.length === 0) {
    checkWinCondition();
    return;
  }
  const victim = gameState.rouletteQueue.shift();
  triggerRussianRoulette(victim, () => processRouletteQueue());
}

// 단일 대상 룰렛 (기존 함수 유지)
function triggerRussianRoulette(victim, onComplete = null) {
  gameState.phase = "ROULETTE";
  animations.length = 0; // 진행 중인 카드 애니메이션 제거
  playBGM("roulette"); // 룰렛 BGM으로 전환
  gameState.victimIndices = [players.indexOf(victim)]; // 대상 플레이어 인덱스 저장
  gameState.lighting = "DIM"; // 조명 어둡게 (긴장감)
  gameState.rouletteStartTime = Date.now(); // 애니메이션 시작 시간 기록

  // 게임 상태 텍스트 숨기기 (총 쏠 때는 안 보이게)
  const statusEl = document.getElementById("game-status");
  if (statusEl) statusEl.classList.add("hidden");

  // 1. 시작 메시지 (0초)
  showMessage(`${victim.displayName}가 룰렛에 당첨 되었습니다!`, 120);

  // 총을 겨눌 때 대사
  const startPhrases = ["신이시여...", "오 제발!", "아닐꺼야"];
  showBubble(
    players.indexOf(victim),
    startPhrases[Math.floor(Math.random() * startPhrases.length)],
  );

  // 2. 철컥 (2초)
  addTimeout(() => {
    playSound("cock"); // 기계음 (철컥)
    showMessage("철컥", 120);
  }, 2000);

  // 3. 방아쇠를 당겨주세요 (4초)
  addTimeout(() => {
    showMessage("방아쇠를 당겨주세요", 180);
  }, 4000);

  // 4. ... (7초)
  addTimeout(() => {
    showMessage("...", 180);
  }, 7000);

  addTimeout(() => {
    // 발사 로직 (1/6 확률, 실제로는 챔버가 돌아감)
    const isBang = revolver.currentChamber === revolver.bulletPosition;
    revolver.currentChamber = (revolver.currentChamber + 1) % revolver.chambers;

    if (isBang) {
      showMessage("탕! (죽음)", 150);
      playSound("gun"); // 총소리
      gameState.shakeTimer = 30; // 30프레임 동안 흔들림
      gameState.lighting = "RED_FLASH"; // 붉은 섬광
      gameState.lightingTimer = 60;
      victim.isDead = true;

      // 피자국 생성 (테이블 위)
      // 플레이어 위치에서 테이블 중앙 쪽으로 약간 이동한 지점을 피자국 중심으로 설정 (테이블에 묻도록)
      const dx = centerX - victim.x;
      const dy = tableY - victim.y;
      const splatterCenterX = victim.x + dx * 0.15; // 테이블 쪽으로 15% 이동
      const splatterCenterY = victim.y + dy * 0.15;

      // 1. 메인 웅덩이 (Main Pool) - 크고 불규칙함
      const mainPoolCount = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < mainPoolCount; i++) {
        const points = [];
        const segments = 10 + Math.floor(Math.random() * 6); // 세그먼트 많이
        const baseRadius = 25 + Math.random() * 25;

        for (let j = 0; j < segments; j++) {
          const theta = (j / segments) * Math.PI * 2;
          const r = baseRadius * (0.6 + Math.random() * 0.8); // 반지름 변화를 주어 울퉁불퉁하게
          points.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r });
        }

        gameState.bloodSplatters.push({
          x: splatterCenterX + (Math.random() - 0.5) * 30,
          y: splatterCenterY + (Math.random() - 0.5) * 30,
          points: points,
          color: `rgba(${100 + Math.random() * 40}, 0, 0, ${0.8 + Math.random() * 0.2})`,
          scaleX: 1,
          scaleY: 1,
          rotation: Math.random() * Math.PI * 2,
        });
      }

      // 2. 튀는 핏방울 (Droplets & Streaks)
      const dropletCount = 40 + Math.floor(Math.random() * 30);
      for (let i = 0; i < dropletCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 150; // 퍼지는 범위 확대
        const sizeFactor = Math.max(0.2, 1 - dist / 200); // 거리에 따라 크기 감소

        const points = [];
        const segments = 5 + Math.floor(Math.random() * 3);
        const baseRadius = (2 + Math.random() * 6) * sizeFactor;

        for (let j = 0; j < segments; j++) {
          const theta = (j / segments) * Math.PI * 2;
          const r = baseRadius * (0.7 + Math.random() * 0.6);
          points.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r });
        }

        // 방향성 스트릭 (멀리 있는 것은 찌그러짐)
        let scaleX = 1;
        let scaleY = 1;
        if (Math.random() > 0.7) {
          scaleX = 1 + Math.random() * 2.0; // 길쭉하게
          scaleY = 0.3 + Math.random() * 0.4; // 얇게
        }

        gameState.bloodSplatters.push({
          x: splatterCenterX + Math.cos(angle) * dist,
          y: splatterCenterY + Math.sin(angle) * dist,
          points: points,
          color: `rgba(${110 + Math.random() * 50}, 0, 0, ${0.6 + Math.random() * 0.4})`,
          scaleX: scaleX,
          scaleY: scaleY,
          rotation: angle, // 중심에서 바깥쪽을 향해 회전
        });
      }

      // 사망 메시지 표시
      const statusEl = document.getElementById("game-status");
      if (statusEl) {
        statusEl.textContent = `${victim.displayName}는 사망하였습니다.`;
        statusEl.style.color = "#c62828";
      }

      // 사망 처리 후 게임 상태 확인
      addTimeout(() => {
        if (onComplete) {
          onComplete();
        } else {
          checkWinCondition();
        }
      }, 2000);
    } else {
      playSound("click"); // 빈 총 소리
      showMessage("착! (생존)", 100);
      gameState.lighting = "FLICKER"; // 조명 깜빡임
      const survivePhrases = ["주님! 감사합니다", "살았다!", "휴~"];
      showBubble(
        players.indexOf(victim),
        survivePhrases[Math.floor(Math.random() * survivePhrases.length)],
      );
      gameState.lightingTimer = 30;
      addTimeout(() => {
        if (onComplete) {
          onComplete();
        } else {
          startRound(); // 생존 시 다음 라운드
        }
      }, 2000);
    }
  }, 10000);
}

// 다수 대상 동시 룰렛 (데빌 카드용)
function triggerSimultaneousRoulette(victims) {
  gameState.phase = "ROULETTE";
  animations.length = 0;
  playBGM("roulette");
  gameState.victimIndices = victims.map((v) => players.indexOf(v)); // 모든 피해자 인덱스 저장
  gameState.lighting = "DIM";
  gameState.rouletteStartTime = Date.now();

  const statusEl = document.getElementById("game-status");
  if (statusEl) statusEl.classList.add("hidden");

  // 1. 시작 메시지
  showMessage("모두가 룰렛에 당첨되었습니다!", 120);

  // 2. 철컥
  addTimeout(() => {
    playSound("cock");
    showMessage("철컥", 120);
  }, 2000);

  // 3. 방아쇠
  addTimeout(() => {
    showMessage("방아쇠를 당겨주세요", 180);
  }, 4000);

  // 4. ...
  addTimeout(() => {
    showMessage("...", 180);
  }, 7000);

  // 5. 결과 확인 (동시)
  addTimeout(() => {
    let anyDeath = false;
    const deadVictims = [];

    victims.forEach((victim) => {
      // 각자 확률 계산 (독립 시행)
      // 주의: revolver 객체는 하나지만 여기서는 각자 쏘는 것으로 연출하므로
      // 실제로는 각자의 운명을 따로 계산해야 함. -> [수정] 동기화를 위해 공유된 revolver 사용
      // 순서대로 방아쇠를 당기는 것으로 처리하여 결과 동기화

      const isBang = revolver.currentChamber === revolver.bulletPosition;
      revolver.currentChamber =
        (revolver.currentChamber + 1) % revolver.chambers;

      if (isBang) {
        anyDeath = true;
        victim.isDead = true;
        deadVictims.push(victim);

        // 피자국 생성 로직 (각 피해자 위치)
        const dx = centerX - victim.x;
        const dy = tableY - victim.y;
        const splatterCenterX = victim.x + dx * 0.15;
        const splatterCenterY = victim.y + dy * 0.15;

        // 피자국 생성 (간소화된 버전 호출)
        createBloodSplatter(splatterCenterX, splatterCenterY);
      }
    });

    if (anyDeath) {
      showMessage("탕! (사망자 발생)", 150);
      playSound("gun");
      gameState.shakeTimer = 30;
      gameState.lighting = "RED_FLASH";
      gameState.lightingTimer = 60;

      const statusEl = document.getElementById("game-status");
      if (statusEl) {
        const names = deadVictims.map((v) => v.displayName).join(", ");
        statusEl.textContent = `${names} 사망.`;
        statusEl.style.color = "#c62828";
      }
    } else {
      playSound("click");
      showMessage("착! (전원 생존)", 100);
      gameState.lighting = "FLICKER";
      gameState.lightingTimer = 30;
    }

    addTimeout(() => {
      checkWinCondition();
    }, 2000);
  }, 10000);
}

// 피자국 생성 헬퍼 함수
function createBloodSplatter(cx, cy) {
  // 1. 메인 웅덩이
  const mainPoolCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < mainPoolCount; i++) {
    const points = [];
    const segments = 8 + Math.floor(Math.random() * 4);
    const baseRadius = 20 + Math.random() * 20;
    for (let j = 0; j < segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const r = baseRadius * (0.6 + Math.random() * 0.8);
      points.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r });
    }
    gameState.bloodSplatters.push({
      x: cx + (Math.random() - 0.5) * 20,
      y: cy + (Math.random() - 0.5) * 20,
      points: points,
      color: `rgba(${100 + Math.random() * 40}, 0, 0, ${0.8 + Math.random() * 0.2})`,
      scaleX: 1,
      scaleY: 1,
      rotation: Math.random() * Math.PI * 2,
    });
  }
  // 2. 튀는 핏방울 (약간 줄임)
  const dropletCount = 20 + Math.floor(Math.random() * 20);
  for (let i = 0; i < dropletCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 100;
    const sizeFactor = Math.max(0.2, 1 - dist / 150);
    const points = [];
    const segments = 4 + Math.floor(Math.random() * 3);
    const baseRadius = (2 + Math.random() * 4) * sizeFactor;
    for (let j = 0; j < segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const r = baseRadius * (0.7 + Math.random() * 0.6);
      points.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r });
    }
    gameState.bloodSplatters.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      points: points,
      color: `rgba(${110 + Math.random() * 50}, 0, 0, ${0.6 + Math.random() * 0.4})`,
      scaleX: 1,
      scaleY: 1,
      rotation: angle,
    });
  }
}

function checkWinCondition() {
  const survivors = players.filter((p) => !p.isDead);

  if (players[3].isDead) {
    gameState.phase = "GAME_OVER"; // 플레이어 사망
    showGameOver(false);
  } else if (survivors.length === 1 && survivors[0].name === "South") {
    gameState.phase = "GAME_OVER"; // 플레이어 승리 (혼자 남음)
    showGameOver(true);
  } else {
    startRound(); // 게임 계속
  }
}

function startRound(deck = null, bulletPos = null, rank = null) {
  clearAllTimeouts(); // 게임 시작/재시작 시 예약된 모든 연출 취소

  // 팝업 타이머 초기화 (이전 팝업이 남아있다면 제거)
  if (popupTimeout) {
    clearTimeout(popupTimeout);
    popupTimeout = null;
    const popup = document.getElementById("target-popup");
    if (popup) popup.classList.add("hidden");
  }

  // 멀티플레이 호스트 로직: 덱 생성 및 전송
  if (isMultiplayerGame && isHost && !deck) {
    const newDeck = createDeck();
    // 총알 위치도 생성하여 전송
    const newBulletPos = Math.floor(Math.random() * 6);
    // [수정] 목표 카드(Rank)도 생성하여 전송 (동기화)
    const ranks = ["K", "Q", "A"];
    const newRank = ranks[Math.floor(Math.random() * ranks.length)];

    sendGameAction("START_GAME", {
      deck: newDeck,
      bulletPosition: newBulletPos,
      currentRank: newRank,
    });
    return; // 액션이 돌아올 때까지 대기
  }
  // 멀티플레이 클라이언트 로직: 덱 없이 호출되면 무시 (액션 대기)
  if (isMultiplayerGame && !isHost && !deck) {
    return;
  }

  // 테이블 초기화
  gameState.tableCards = [];
  gameState.lastPlayedBatch = null;
  // gameState.bloodSplatters = []; // 피자국은 유지할지 초기화할지 선택 (여기선 유지하여 공포감 조성)
  gameState.phase = "DEALING";
  gameState.lighting = "NORMAL"; // 조명 복구
  gameState.turnCount = 0; // 턴 카운트 초기화
  playBGM("main"); // 메인 BGM으로 복귀

  // 현재 턴인 플레이어가 사망했다면 다음 턴으로 넘김
  if (players[gameState.turnIndex].isDead) {
    nextTurn();
  }

  // 덱 재생성 (20% 확률로 데빌 카드 포함)
  cardTypes = deck || createDeck();

  // 총알 위치 설정 (멀티플레이 동기화)
  if (bulletPos !== null) {
    revolver.bulletPosition = bulletPos;
    revolver.currentChamber = 0; // 새 라운드 시작 시 챔버 초기화
  }

  // 데빌 카드 존재 여부 확인 및 알림
  let hasDevil = false;
  if (cardTypes.includes("D")) {
    hasDevil = true;
    playSound("devil");
    const statusEl = document.getElementById("game-status");
    if (statusEl) {
      statusEl.textContent = "데빌카드가 존재합니다";
      statusEl.style.color = "#c62828";
      statusEl.classList.remove("hidden");
    }
    const hudEl = document.getElementById("game-hud");
    if (hudEl) hudEl.classList.remove("hidden");

    // 데빌 카드 등장 시 붉은 섬광 효과
    gameState.lighting = "RED_FLASH";
    gameState.lightingTimer = 120; // 효과 지속 시간 2배로 증가 (2초)
    showDevilPopup();
    triggerDevilCardAnimation();
  }

  // 생존자들에게 카드 다시 배분 (기존 핸드 초기화)
  players.forEach((p) => {
    p.hand = [];
    p.spacing = 15;
  });

  // 딜링 상태 리셋
  dealingState.isDealing = true;
  dealingState.dealtCount = 0;
  dealingState.totalCards = 20; // 5장 * 4명 (죽은 사람도 딜링 모션은 가지만 카드는 버려짐 처리하거나, 로직 수정 필요)
  // 여기서는 간단히 죽은 사람에게도 카드가 가는 모션은 나오되 핸드에는 안 쌓이게 처리하거나
  // dealtCount 로직을 수정해야 함. 편의상 죽은 사람은 건너뛰고 산 사람에게만 5장씩 주도록 수정.

  // 살아있는 사람 수 * 5장으로 카드 수 설정
  const survivors = players.filter((p) => !p.isDead);
  dealingState.totalCards = survivors.length * 5;

  // 새 랭크 설정
  const ranks = ["K", "Q", "A"];
  gameState.currentRank = ranks[Math.floor(Math.random() * ranks.length)];
  if (rank) {
    gameState.currentRank = rank;
  } else {
    const ranks = ["K", "Q", "A"];
    gameState.currentRank = ranks[Math.floor(Math.random() * ranks.length)];
  }
  updateTargetDisplay();

  if (hasDevil) {
    const el = document.getElementById("target-rank");
    if (el) el.textContent = `Target: ${gameState.currentRank}`;
  } else {
    updateTargetDisplay();
  }
}

let messageTimeout = null;
let popupTimeout = null;
function showMessage(text, duration) {
  const overlay = document.getElementById("message-overlay");
  overlay.textContent = text;
  overlay.classList.remove("hidden");

  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }

  // duration이 지나면 숨김 (프레임 단위가 아닌 시간 단위로 변경)
  messageTimeout = setTimeout(() => {
    overlay.classList.add("hidden");
  }, duration * 16); // 기존 duration이 프레임 단위였으므로 대략 ms로 변환
}

function showDevilPopup() {
  const popup = document.getElementById("target-popup");
  const popupImg = document.getElementById("target-popup-img");
  const popupText = document.getElementById("target-popup-text");

  if (popup && popupImg && popupText) {
    const sourceImg = document.getElementById("img-D");
    if (sourceImg) {
      popupImg.src = sourceImg.src;
      popupText.textContent = "데빌카드가 존재합니다";
      popupText.style.color = "#c62828";

      if (popupTimeout) clearTimeout(popupTimeout);
      popup.classList.remove("hidden");

      popupTimeout = setTimeout(() => {
        popup.classList.add("hidden");
        popupText.style.color = "";
        popupTimeout = null;
      }, 2000);
    }
  }
}

function updateTargetDisplay() {
  const el = document.getElementById("target-rank");
  if (!el) return;

  const rank = gameState.currentRank;

  // 1. 상시 표시 (텍스트) - 원래대로 복구
  el.textContent = `Target: ${rank}`;

  // 2. 중앙 팝업 (이미지 + 텍스트) - 일시적 표시
  const popup = document.getElementById("target-popup");
  const popupImg = document.getElementById("target-popup-img");
  const popupText = document.getElementById("target-popup-text");

  if (popup && popupImg && popupText) {
    const imgId = imgIds[rank];
    const sourceImg = document.getElementById(imgId);
    if (sourceImg) {
      popupImg.src = sourceImg.src;
      popupText.textContent = `Target: ${rank}`;

      if (popupTimeout) clearTimeout(popupTimeout);
      popup.classList.remove("hidden");

      // 2초 후 사라짐
      popupTimeout = setTimeout(() => {
        popup.classList.add("hidden");
        popupTimeout = null;
      }, 2000);
    }
  }
}

function updateGameStatus() {
  const statusEl = document.getElementById("game-status");
  if (!statusEl) return;
  statusEl.classList.remove("hidden"); // 상태 업데이트 시 다시 보이게 함

  if (gameState.turnIndex === 3) {
    statusEl.textContent = "플레이어 1은 카드를 내주세요";
    statusEl.style.color = "#ffffff"; // White
  } else {
    statusEl.textContent = `${players[gameState.turnIndex].displayName}가 선택 중입니다...`;
    statusEl.style.color = "#ffffff";
  }
}

function showGameOver(isWin) {
  const screen = document.getElementById("game-over-screen");
  const title = document.getElementById("game-over-title");

  screen.classList.remove("hidden");
  document.getElementById("game-hud").classList.add("hidden");

  if (isWin) {
    title.textContent = "생존했습니다";
    title.style.color = "#2e7d32";

    // 승리 효과: 환호성 및 폭죽 3개
    playSound("cheer");
    addTimeout(
      () => createFirework(canvas.width * 0.3, canvas.height * 0.3),
      0,
    );
    addTimeout(
      () => createFirework(canvas.width * 0.7, canvas.height * 0.3),
      400,
    );
    addTimeout(
      () => createFirework(canvas.width * 0.5, canvas.height * 0.2),
      800,
    );
  } else {
    title.textContent = "사망했습니다";
    title.style.color = "#c62828";
  }
}

// --- DOM 이벤트 리스너 등록 ---

document.getElementById("btn-start").addEventListener("click", () => {
  document.getElementById("start-screen").classList.add("hidden");

  // 오디오 컨텍스트 시작 (브라우저 정책 대응)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  playSound("select");
  startRound(); // 게임 시작 시에도 라운드 초기화 로직(데빌 카드 체크 등)을 실행하도록 변경
});

// 게임 방법 버튼 이벤트
const btnHowto = document.getElementById("btn-howto");
const howtoModal = document.getElementById("howto-modal");
const btnCloseHowto = document.getElementById("btn-close-howto");

if (btnHowto) {
  btnHowto.addEventListener("click", () => {
    howtoModal.classList.remove("hidden");
  });
}
if (btnCloseHowto) {
  btnCloseHowto.addEventListener("click", () => {
    howtoModal.classList.add("hidden");
  });
}

document.getElementById("btn-play").addEventListener("click", () => {
  const player = players[3];
  const selectedIndices = player.hand
    .map((card, index) => (card.isSelected ? index : -1))
    .filter((index) => index !== -1);

  // 멀티플레이: 내 턴이 아니면 클릭 방지 (UI 상으로도 막혀있지만 이중 체크)
  if (isMultiplayerGame && gameState.turnIndex !== 3) return;

  // 데빌 카드 규칙: 데빌 카드가 포함되면 데빌 카드만 낼 수 있음
  const selectedCards = selectedIndices.map((idx) => player.hand[idx]);
  const hasDevil = selectedCards.some((c) => c.type === "D");
  const onlyDevil = selectedCards.every((c) => c.type === "D");
  if (hasDevil && !onlyDevil) {
    alert("데빌 카드는 다른 카드와 함께 낼 수 없습니다.");
    return;
  }

  if (isMultiplayerGame) {
    // 멀티플레이: 서버로 액션 전송
    sendGameAction("SUBMIT", { cardIndices: selectedIndices });
  } else {
    // 싱글플레이: 로컬 실행
    submitCards(3, selectedIndices);
  }
});

document.getElementById("btn-liar").addEventListener("click", () => {
  if (isMultiplayerGame) {
    sendGameAction("CHALLENGE", {});
  } else {
    challenge();
  }
});

document.getElementById("btn-restart").addEventListener("click", () => {
  document.body.classList.add("fade-out");
  setTimeout(() => {
    location.reload();
  }, 1000);
});

document.getElementById("btn-fullscreen").addEventListener("click", (e) => {
  const container = document.getElementById("game-container");
  if (!document.fullscreenElement) {
    document.documentElement
      .requestFullscreen()
      .then(() => {
        if (container) container.classList.add("fullscreen");

        // 즉시 리사이즈 및 지연 리사이즈 (모바일 화면 전환/회전 딜레이 대응)
        resizeGame();
        setTimeout(resizeGame, 500);

        // 모바일에서 전체화면 시 가로 모드 고정
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock("landscape").catch((err) => {
            console.log("Orientation lock failed: ", err);
          });
        }
      })
      .catch((err) => {
        console.log(
          `Error attempting to enable full-screen mode: ${err.message}`,
        );
      });
  } else {
    document.exitFullscreen().then(() => {
      if (container) container.classList.remove("fullscreen");
      resizeGame();
    });
    // 전체화면 해제 시 방향 잠금 해제
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
  }
});

// --- 인게임 채팅 이모티콘 로직 ---
const btnEmoji = document.getElementById("btn-emoji");
const emojiPicker = document.getElementById("emoji-picker");
const emojiItems = document.querySelectorAll(".emoji-item");

if (btnEmoji && emojiPicker) {
  btnEmoji.addEventListener("click", () => {
    emojiPicker.classList.toggle("hidden");
  });

  emojiItems.forEach((item) => {
    item.addEventListener("click", () => {
      const emoji = item.textContent;
      if (isMultiplayerGame) {
        sendExternalChatMessage(emoji);
      }
      emojiPicker.classList.add("hidden");
    });
  });
}

// --- 뒤로 가기 버튼 이벤트 ---
document.getElementById("btn-back-start").addEventListener("click", () => {
  window.location.href = "../game-list.html";
});
document.getElementById("btn-back-ingame").addEventListener("click", () => {
  window.location.href = "../game-list.html";
});

// 화면 크기에 맞춰 게임 컨테이너 크기 조절 (비율 유지)
function resizeGame() {
  const container = document.getElementById("game-container");
  if (!container) return;

  let winW = window.innerWidth;
  let winH = window.innerHeight;

  // 모바일 브라우저 주소창/하단바 대응 (Visual Viewport API 사용)
  if (window.visualViewport) {
    winW = window.visualViewport.width;
    winH = window.visualViewport.height;
  }

  // [수정] 고정 해상도 설정 (로비 크기 1300px에 맞춤)
  const baseWidth = 1300;
  const baseHeight = 900;

  // 여백 확보 (상하좌우 100px)
  const margin = 100;
  const availW = Math.max(winW - margin * 2, 320); // 최소 너비 안전장치
  const availH = Math.max(winH - margin * 2, 320); // 최소 높이 안전장치

  // 1. 캔버스 및 컨테이너 크기 고정
  canvas.width = baseWidth;
  canvas.height = baseHeight;
  container.style.width = `${baseWidth}px`;
  container.style.height = `${baseHeight}px`;

  // 2. 가용 공간에 맞춰 비율 유지하며 스케일링 (Fit)
  const scale = Math.min(availW / baseWidth, availH / baseHeight);

  container.style.transform = `scale(${scale})`;
  container.style.setProperty("--game-scale", scale);

  // 4. 게임 내부 레이아웃 재정렬 (중앙 정렬 유지)
  updateLayout();
}
window.addEventListener("resize", resizeGame);
if (window.visualViewport) {
  // 모바일 키보드/주소창 변경 등에 대응
  window.visualViewport.addEventListener("resize", resizeGame);
}

// 레이아웃 업데이트 함수 (화면 크기 변경 시 호출)
function updateLayout() {
  const oldCenterX = centerX;
  const oldCenterY = centerY;

  centerX = canvas.width / 2;
  centerY = canvas.height / 2;
  tableY = centerY + 30;

  const dx = centerX - oldCenterX;
  const dy = centerY - oldCenterY;

  // 화면 크기가 변하면 테이블 위의 요소들도 같이 이동 (중앙 정렬 유지)
  if (dx !== 0 || dy !== 0) {
    gameState.tableCards.forEach((card) => {
      card.x += dx;
      card.y += dy;
    });

    gameState.bloodSplatters.forEach((splat) => {
      splat.x += dx;
      splat.y += dy;
    });

    animations.forEach((anim) => {
      anim.startX += dx;
      anim.startY += dy;
      anim.targetX += dx;
      anim.targetY += dy;
      if (anim.trail) {
        anim.trail.forEach((t) => {
          t.x += dx;
          t.y += dy;
        });
      }
    });

    if (dealingState.movingCard) {
      dealingState.movingCard.startX += dx;
      dealingState.movingCard.startY += dy;
      dealingState.movingCard.targetX += dx;
      dealingState.movingCard.targetY += dy;
      dealingState.movingCard.x += dx;
      dealingState.movingCard.y += dy;
    }

    fireworks.forEach((fw) => {
      fw.x += dx;
      fw.y += dy;
    });
  }

  // 플레이어 위치 재설정 (중앙 기준 상대 위치 유지)
  if (players.length > 0) {
    players[0].x = centerX + 430;
    players[0].y = tableY; // East
    players[1].x = centerX;
    players[1].y = tableY - 280; // North
    players[2].x = centerX - 430;
    players[2].y = tableY; // West
    players[3].x = centerX;
    players[3].y = tableY + 280; // South
  }

  for (let i = 0; i < players.length; i++) {
    updateBubblePosition(i);
  }
}

// --- 사운드 컨트롤 이벤트 ---
const btnMute = document.getElementById("btn-mute");
const volumeSlider = document.getElementById("volume-slider");
let isMuted = false;
let previousVolume = 0.5;

if (btnMute) {
  btnMute.addEventListener("click", () => {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    isMuted = !isMuted;
    const mainBgm = document.getElementById("bgm-main");
    const rouletteBgm = document.getElementById("bgm-roulette");

    if (isMuted) {
      // 뮤트 시 현재 볼륨 저장 (0이 아닐 때만)
      if (masterGain.gain.value > 0) {
        previousVolume = masterGain.gain.value;
      }

      masterGain.gain.value = 0;
      if (mainBgm) mainBgm.volume = 0;
      if (rouletteBgm) rouletteBgm.volume = 0;

      btnMute.textContent = "🔇";
      if (volumeSlider) volumeSlider.value = 0;
    } else {
      // 언뮤트 시 이전 볼륨 복구
      const targetVol = previousVolume > 0 ? previousVolume : 0.5;

      masterGain.gain.value = targetVol;
      if (mainBgm) mainBgm.volume = targetVol * 0.1;
      if (rouletteBgm) rouletteBgm.volume = targetVol * 0.1;

      btnMute.textContent = "🔊";
      if (volumeSlider) volumeSlider.value = targetVol;
    }
  });
}

if (volumeSlider) {
  volumeSlider.addEventListener("input", (e) => {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const vol = parseFloat(e.target.value);
    masterGain.gain.value = vol;

    const mainBgm = document.getElementById("bgm-main");
    const rouletteBgm = document.getElementById("bgm-roulette");
    if (mainBgm) mainBgm.volume = vol * 0.1;
    if (rouletteBgm) rouletteBgm.volume = vol * 0.1;

    if (vol === 0) {
      isMuted = true;
      if (btnMute) btnMute.textContent = "🔇";
    } else {
      isMuted = false;
      if (btnMute) btnMute.textContent = "🔊";
    }
  });
}

// 페이지 로드 시 BGM 자동 재생 시도
playBGM("main");

// 브라우저 정책으로 자동 재생이 막혔을 경우, 첫 클릭 시 재생
document.addEventListener(
  "click",
  () => {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  },
  { once: true },
);

// 동적 파비콘 설정 (리볼버 실린더 모양)
function setDynamicFavicon() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  ctx.translate(32, 32);

  // 실린더 몸체
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fillStyle = "#455a64"; // 금속 색상
  ctx.fill();
  ctx.strokeStyle = "#263238";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 6개의 약실 (구멍)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const r = 16;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#212121"; // 구멍 색상
    ctx.fill();

    // 탄환 하나 (금색) - 포인트
    if (i === 0) {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd700";
      ctx.fill();
    }
  }

  // 파비콘 적용
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = canvas.toDataURL();
}

setDynamicFavicon();

// 오디오 리소스 미리 로드 (재생 지연 방지)
window.addEventListener("load", () => {
  const preloadIds = ["sfx-cock", "sfx-click", "sfx-gun", "sfx-devil"];
  preloadIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.load();
    }
  });
});

// 게임 루프 시작
resizeGame();

setupUISounds();
draw();

// --- 멀티플레이 연동 ---

const lobbyScreen = document.getElementById("lobby-screen");
const countdownOverlay = document.getElementById("countdown-overlay");
let isMultiplayerGame = false;

// 멀티플레이 초기화
initMultiplayer({
  onStart: startMultiplayerSequence,
  onAction: handleRemoteAction,
  onChat: handleRemoteChat,
});

// 멀티플레이 시작 시퀀스 (카운트다운 -> 게임 진입)
function startMultiplayerSequence(roomPlayers) {
  isMultiplayerGame = true;

  // 플레이어 매핑 (나를 South(3) 위치로 고정하고 나머지를 회전)
  // roomPlayers 순서: [P1, P2, P3, P4] (서버 기준 0, 1, 2, 3)
  // 내 인덱스(myPlayerIndex)가 1이라면:
  // South(3) = P2 (Me, idx 1)
  // West(2) = P3 (idx 2)
  // North(1) = P4 (idx 3)
  // East(0) = P1 (idx 0)
  // 공식: (serverIndex - myIndex + 4) % 4 -> localIndex (0:East, 1:North, 2:West, 3:South)
  // 하지만 기존 코드의 mapping 배열은 [3, 2, 1, 0] 순서로 할당하고 있음.
  // South(3) <- room[baseIndex]
  // West(2) <- room[(baseIndex + 1) % 4]
  // North(1) <- room[(baseIndex + 2) % 4]
  // East(0) <- room[(baseIndex + 3) % 4]

  const baseIndex = myPlayerIndex === -1 ? 0 : myPlayerIndex;

  // 로컬 players 배열 업데이트 (시각적 위치 할당)
  // players[0] = East, [1] = North, [2] = West, [3] = South
  // roomPlayers[baseIndex]는 무조건 South(3)에 와야 함.

  for (let i = 0; i < 4; i++) {
    // i: 로컬 인덱스 (0:East, 1:North, 2:West, 3:South)
    // offset: South(3) 기준으로 얼마나 떨어져 있는지
    // South(3) -> offset 0
    // West(2) -> offset 1
    // North(1) -> offset 2
    // East(0) -> offset 3
    const offset = (3 - i + 4) % 4;
    const roomPlayerIndex = (baseIndex + offset) % 4;

    const roomPlayer = roomPlayers[roomPlayerIndex];

    players[i].displayName = roomPlayer.nickname;
    players[i].isAI = !!roomPlayer.isAI;
    // 캐릭터 이미지 등 추가 속성 설정 가능
  }

  // [수정] 턴 순서 동기화: 방장(Server Index 0)부터 시작하도록 설정
  // 내(baseIndex)가 0번 플레이어를 어디(localIndex)로 보고 있는지 계산
  const server0Relative = (0 - baseIndex + 4) % 4;
  const server0Local = (3 - server0Relative + 4) % 4;
  gameState.turnIndex = server0Local;
  updateGameStatus(); // UI 업데이트

  // 카운트다운 시작
  let count = 3;
  countdownOverlay.classList.remove("hidden");
  countdownOverlay.textContent = count;
  playSound("select");

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      countdownOverlay.textContent = count;
      playSound("select");
    } else {
      clearInterval(timer);
      countdownOverlay.textContent = "START!";
      playSound("drama");
      setTimeout(() => {
        countdownOverlay.classList.add("hidden");
        lobbyScreen.classList.add("hidden");
        document.getElementById("game-hud").classList.remove("hidden");
        document.getElementById("ingame-chat").classList.remove("hidden");
        startRound(); // 게임 라운드 시작
      }, 1000);
    }
  }, 1000);
}

// 서버에서 온 액션 처리
function handleRemoteAction(action) {
  // action.senderIndex는 서버 기준 인덱스 (0~3)
  // 로컬 인덱스로 변환 필요
  // 내 인덱스(myPlayerIndex)가 1일 때, sender가 2라면?
  // South(3) = 1
  // West(2) = 2 -> 로컬 인덱스 2

  const baseIndex = myPlayerIndex === -1 ? 0 : myPlayerIndex;
  // 서버 인덱스 -> 로컬 인덱스 변환 공식
  // (sender - base + 4) % 4 -> 상대적 위치 (0:나, 1:오른쪽, 2:맞은편, 3:왼쪽)
  // 로컬 배치: 3(나), 2(오른쪽/West), 1(맞은편/North), 0(왼쪽/East)
  // 따라서: localIndex = (3 - (sender - base + 4) % 4 + 4) % 4

  const relativePos = (action.senderIndex - baseIndex + 4) % 4;
  const localIndex = (3 - relativePos + 4) % 4;

  console.log(
    `Action received: ${action.type} from Server ${action.senderIndex} -> Local ${localIndex}`,
  );

  switch (action.type) {
    case "START_GAME":
      // 덱 정보 동기화 등 (현재는 startRound에서 랜덤 생성하므로 생략 가능하나,
      // 완벽한 동기화를 위해선 호스트가 덱을 보내줘야 함)
      if (action.payload && action.payload.deck) {
        cardTypes = action.payload.deck;
      }
      startRound(
        action.payload.deck,
        action.payload.bulletPosition,
        action.payload.currentRank,
      );
      break;

    case "SUBMIT":
      // 카드 제출
      // payload: { cardIndices: [...] }
      // 로컬에서는 submitCards 호출
      // 주의: submitCards는 내부적으로 nextTurn()을 호출함
      submitCards(localIndex, action.payload.cardIndices);
      break;

    case "CHALLENGE":
      // 도전
      // challenge() 함수는 현재 턴(gameState.turnIndex)의 플레이어가 도전하는 것으로 가정
      // 동기화가 잘 되어 있다면 gameState.turnIndex == localIndex 여야 함
      if (gameState.turnIndex !== localIndex) {
        console.warn("Turn mismatch sync warning!");
        gameState.turnIndex = localIndex; // 강제 동기화
      }
      challenge();
      break;

    // 룰렛 결과 등 추가 가능
  }
}

// 서버에서 온 채팅 처리 (말풍선 표시)
function handleRemoteChat(sender, text) {
  if (sender === "System") return;

  // 닉네임으로 플레이어 인덱스 찾기
  const playerIndex = players.findIndex((p) => p.displayName === sender);
  if (playerIndex !== -1) {
    showBubble(playerIndex, text);
  }
}
