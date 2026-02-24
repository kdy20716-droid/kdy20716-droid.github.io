const {
  Engine,
  Render,
  Runner,
  World,
  Bodies,
  Body,
  Events,
  Vector,
  Composite,
} = Matter;

// 엔진 초기화
const engine = Engine.create();
engine.world.gravity.y = 0; // 탑뷰이므로 중력 제거

const canvas = document.getElementById("game-canvas");
const container = document.getElementById("game-container");

// 게임 해상도 1:1 비율 설정
const width = 800;
const height = 800;
const tableWidth = 400; // 당구대 너비
const tableHeight = 697; // 당구대 높이

const render = Render.create({
  element: container,
  engine: engine,
  canvas: canvas,
  options: {
    width: width,
    height: height,
    wireframes: false,
    background: "transparent", // 배경을 투명하게 하여 CSS 바닥 패턴이 보이게 함
    pixelRatio: window.devicePixelRatio,
  },
});

// --- 사운드 시스템 (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const SoundGen = {
  // 큐대 타격음 (탁! - 나무와 가죽 팁 소리)
  cueHit: function (intensity = 1) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;

    // 1. 타격 노이즈 (Impact) - 짧고 강하게
    const noise = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(
      1,
      audioCtx.sampleRate * 0.1,
      audioCtx.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 3000;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.8 * intensity, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.03); // 더 짧게

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start(t);

    // 2. 나무 공명음 (Body)
    const osc = audioCtx.createOscillator();
    osc.type = "square"; // Square wave filtered sounds more like wood impact
    osc.frequency.setValueAtTime(150, t);

    const oscFilter = audioCtx.createBiquadFilter();
    oscFilter.type = "lowpass";
    oscFilter.frequency.value = 500;

    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.4 * intensity, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  },

  // 공끼리 충돌 (딱! - 단단한 레진 소리)

  ballHit: function (intensity = 1) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;

    // 메인 톤 (높고 짧음, 피치 변화 없음)
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2400, t); // 고정 주파수

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.7 * intensity, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03); // 매우 짧은 디케이

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.05);

    // 클릭음 (노이즈) 추가
    const noise = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(
      1,
      audioCtx.sampleRate * 0.01,
      audioCtx.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.4 * intensity, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.01);

    noise.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start(t);
  },

  // 벽(쿠션) 충돌 (퉁... - 고무 반동 소리)
  wallHit: function (intensity = 1) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();

    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t); // 낮은 주파수
    // 약간의 피치 하강은 고무 느낌을 줌, 하지만 과하지 않게
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.6 * intensity, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  },

  // UI 호버 (큐팁으로 살짝 건드리는 소리)
  uiHover: function () {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  },

  // UI 클릭 (공 부딪히는 소리)
  uiClick: function () {
    this.ballHit(0.6);
  },
};

// 벽 생성 (당구대 쿠션)
const wallThickness = 32; // 40 * 0.8
const walls = [];

function createWalls() {
  World.remove(engine.world, walls);
  walls.length = 0;

  const options = {
    isStatic: true,
    render: { fillStyle: "#3a2b30" }, // 빈티지 퍼플 우드
    friction: 0.5,
    restitution: 0.8,
    label: "wall", // 벽 라벨 추가
  };

  // 상, 하, 좌, 우 (중앙 정렬을 위해 좌표 조정)
  const centerX = width / 2;
  const centerY = height / 2;

  // [추가] 바닥(Floor)을 가장 먼저 생성하여 배경으로 깔기
  // 센서(isSensor: true)로 설정하여 공과 충돌하지 않게 함
  walls.push(
    Bodies.rectangle(centerX, centerY, tableWidth, tableHeight, {
      isStatic: true,
      isSensor: true,
      render: { fillStyle: "#67a171" }, // 밝은 세이지 그린
      label: "floor",
    }),
  );

  // 상단 벽
  walls.push(
    Bodies.rectangle(
      centerX,
      centerY - tableHeight / 2 - wallThickness / 2,
      tableWidth + wallThickness * 2,
      wallThickness,
      { ...options, chamfer: { radius: [20, 20, 0, 0] } }, // 위쪽 모서리만 둥글게
    ),
  );
  // 하단 벽
  walls.push(
    Bodies.rectangle(
      centerX,
      centerY + tableHeight / 2 + wallThickness / 2,
      tableWidth + wallThickness * 2,
      wallThickness,
      { ...options, chamfer: { radius: [0, 0, 20, 20] } }, // 아래쪽 모서리만 둥글게
    ),
  );
  // 좌측 벽 (uiWidth 만큼 이동)
  walls.push(
    Bodies.rectangle(
      centerX - tableWidth / 2 - wallThickness / 2,
      centerY,
      wallThickness,
      tableHeight,
      options, // 둥글기 없음 (직각)
    ),
  );
  // 우측 벽 (width - uiWidth 만큼 이동)
  walls.push(
    Bodies.rectangle(
      centerX + tableWidth / 2 + wallThickness / 2,
      centerY,
      wallThickness,
      tableHeight,
      options, // 둥글기 없음 (직각)
    ),
  );

  World.add(engine.world, walls);
}

// 포켓 (구멍) 생성
const pockets = [];
const pocketRadius = 20; // 25 * 0.8
const cornerPocketRadius = 23; // 코너 포켓 약간 키움

function createPockets() {
  World.remove(engine.world, pockets);
  pockets.length = 0;

  const centerX = width / 2;
  const centerY = height / 2;
  const halfW = tableWidth / 2;
  const halfH = tableHeight / 2;

  const positions = [
    { x: centerX - halfW, y: centerY - halfH, radius: cornerPocketRadius }, // 좌상
    { x: centerX + halfW, y: centerY - halfH, radius: cornerPocketRadius }, // 우상
    { x: centerX - halfW, y: centerY + halfH, radius: cornerPocketRadius }, // 좌하
    { x: centerX + halfW, y: centerY + halfH, radius: cornerPocketRadius }, // 우하
    { x: centerX - halfW, y: centerY, radius: pocketRadius }, // 좌중
    { x: centerX + halfW, y: centerY, radius: pocketRadius }, // 우중
  ];

  positions.forEach((pos) => {
    const pocket = Bodies.circle(pos.x, pos.y, pos.radius, {
      isStatic: true,
      isSensor: true,
      label: "pocket",
      render: { fillStyle: "#1a1a1a" },
    });
    pockets.push(pocket);
  });
  World.add(engine.world, pockets);
}

// 공 설정
let balls = [];
const ballRadius = 11;
let cueBall;

function createBalls() {
  balls.forEach((b) => World.remove(engine.world, b));
  if (cueBall) World.remove(engine.world, cueBall);
  balls = [];

  const centerX = width / 2;
  const centerY = height / 2;

  // 큐볼
  cueBall = Bodies.circle(
    centerX,
    centerY + tableHeight / 2 - 150,
    ballRadius,
    {
      restitution: 0.9,
      friction: 0.005,
      frictionAir: 0.02,
      label: "cueball",
      render: { fillStyle: "#ffffff" },
    },
  );
  World.add(engine.world, cueBall);

  // 목적구 (15개, 삼각형 배치)
  const startX = centerX;
  const startY = centerY - tableHeight / 2 + 150;

  // 공 색상 정의 (1~15)
  const ballColors = {
    1: "#fbc02d", // Yellow (더 진한 노랑)
    2: "#1976d2", // Blue (더 진한 파랑)
    3: "#d32f2f", // Red (더 진한 빨강)
    4: "#7b1fa2", // Purple (더 진한 보라)
    5: "#f57c00", // Orange (더 진한 주황)
    6: "#1b5e20", // Green (아주 진한 초록 - 바닥과 대비)
    7: "#5d4037", // Maroon (진한 갈색)
    8: "#000000", // Black
    9: "#f1c40f", // Yellow Stripe
    10: "#3498db", // Blue Stripe
    11: "#e74c3c", // Red Stripe
    12: "#9b59b6", // Purple Stripe
    13: "#e67e22", // Orange Stripe
    14: "#2ecc71", // Green Stripe
    15: "#800000", // Maroon Stripe
  };

  // 8볼 랙 배치 (5줄)
  // 줄: 1, 2, 3, 4, 5 개
  // 8번 공은 3번째 줄 중앙
  // 양쪽 끝은 하나는 솔리드, 하나는 스트라이프여야 함 (여기선 랜덤 단순화)
  let ballNumbers = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  // 셔플
  ballNumbers.sort(() => Math.random() - 0.5);

  let ballIndex = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const x = startX + (col - row / 2) * (ballRadius * 2 + 2);
      const y = startY + row * (ballRadius * 2 + 2) * Math.sin(Math.PI / 3);

      let number;
      // 3번째 줄(row=2)의 가운데(col=1)는 8번 공
      if (row === 2 && col === 1) {
        number = 8;
      } else {
        number = ballNumbers[ballIndex++];
      }

      const isStripe = number > 8;
      const color = ballColors[number];

      const ball = Bodies.circle(x, y, ballRadius, {
        restitution: 0.9,
        friction: 0.005,
        frictionAir: 0.02,
        label: "ball",
        render: {
          fillStyle: isStripe ? "#ffffff" : color, // 줄무늬 공은 바탕을 흰색으로
        },
      });
      ball.ballNumber = number;
      ball.ballColor = color;
      ball.isStripe = isStripe;

      balls.push(ball);
    }
  }
  World.add(engine.world, balls);
}

// 게임 상태
let isDragging = false;
let dragStart = null;
let currentMousePos = null;
let solidCount = 7;
let stripeCount = 7;
let currentPlayer = 1; // 1 or 2
let isShooting = false; // 샷 진행 중 여부
let pottedThisTurn = []; // 이번 턴에 넣은 공들
let foulThisTurn = false; // 이번 턴 파울 여부
let isBallInHand = false; // 프리볼 상태
let firstHitRecorded = false; // 턴 시작 후 첫 충돌 감지 여부
let slowMotionTimer = 0; // 슬로우 모션(정지 대기) 타이머
let messageTimeout = null; // 메시지 타이머
let isGameEnded = false; // 게임 종료 여부
const powerGaugeWrap = document.getElementById("power-gauge-wrap");
const powerGaugeFill = document.getElementById("power-gauge-fill");

// 입력 이벤트
canvas.addEventListener("mousedown", handleInputStart);
canvas.addEventListener("touchstart", handleInputStart, { passive: false });
window.addEventListener("mousemove", handleInputMove);
window.addEventListener("touchmove", handleInputMove, { passive: false });
window.addEventListener("mouseup", handleInputEnd);
window.addEventListener("touchend", handleInputEnd);

function handleInputStart(e) {
  if (isGameEnded || !cueBall) return; // 게임 종료 또는 시작 전 클릭 방지
  if (isShooting || isMoving(cueBall)) return; // 샷 진행 중이거나 공이 움직이면 조작 불가

  // 프리볼(Ball in Hand) 상태일 때 배치 시작
  if (isBallInHand) {
    const pos = getMousePos(e);

    // 테이블 범위 제한
    const halfW = tableWidth / 2 - ballRadius;
    const halfH = tableHeight / 2 - ballRadius;
    const centerX = width / 2;
    const centerY = height / 2;
    let x = Math.max(centerX - halfW, Math.min(centerX + halfW, pos.x));
    let y = Math.max(centerY - halfH, Math.min(centerY + halfH, pos.y));

    Body.setPosition(cueBall, { x, y });
    Body.setVelocity(cueBall, { x: 0, y: 0 });

    isBallInHand = false; // 클릭 즉시 배치 완료
    document.getElementById("message-overlay").classList.add("hidden");
    return;
  }

  const pos = getMousePos(e);
  if (Vector.magnitude(Vector.sub(pos, cueBall.position)) < 50) {
    isDragging = true;
    dragStart = cueBall.position;
    currentMousePos = pos;
    powerGaugeWrap.classList.remove("hidden");
    powerGaugeFill.style.width = "0%";
  }
}

function handleInputMove(e) {
  if (isGameEnded || !cueBall) return;
  const pos = getMousePos(e);
  currentMousePos = pos;

  if (!isDragging) return;
  e.preventDefault();
  const forceVector = Vector.sub(dragStart, pos);
  const maxForce = 0.04;
  const forceMag = Vector.magnitude(forceVector) * 0.0002;
  const power = Math.min(forceMag, maxForce) / maxForce;
  powerGaugeFill.style.width = `${power * 100}%`;
}

function handleInputEnd(e) {
  if (isGameEnded || !cueBall) return;

  if (!isDragging) return;
  const pos = getMousePos(e);
  const forceVector = Vector.sub(dragStart, pos);
  const maxForce = 0.04;
  const forceMag = Vector.magnitude(forceVector) * 0.0002;
  const force = Vector.mult(
    Vector.normalise(forceVector),
    Math.min(forceMag, maxForce),
  );

  if (forceMag > 0.001) Body.applyForce(cueBall, cueBall.position, force);
  SoundGen.cueHit(Math.min(forceMag * 50, 1)); // 큐 타격음 재생

  isDragging = false;
  isShooting = true; // 샷 시작
  pottedThisTurn = [];
  foulThisTurn = false;
  firstHitRecorded = false; // 첫 충돌 기록 초기화
  slowMotionTimer = 0; // 타이머 초기화
  dragStart = null;
  powerGaugeWrap.classList.add("hidden");
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.touches ? e.changedTouches[0].clientY : e.clientY;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function isMoving(body) {
  return body.speed > 0.15;
}

// 충돌 감지 (포켓)
Events.on(engine, "collisionStart", (event) => {
  event.pairs.forEach((pair) => {
    const bodyA = pair.bodyA;
    const bodyB = pair.bodyB;
    let ball = null;

    // 충돌 사운드 처리
    const speedA = bodyA.speed || 0;
    const speedB = bodyB.speed || 0;
    const maxSpeed = Math.max(speedA, speedB);

    // 일정 속도 이상일 때만 소리 재생 (굴러가는 미세한 충돌 제외)
    if (maxSpeed > 0.2) {
      const intensity = Math.min(maxSpeed / 15, 1); // 강도 조절

      // 공 vs 공
      if (
        (bodyA.label === "ball" || bodyA.label === "cueball") &&
        (bodyB.label === "ball" || bodyB.label === "cueball")
      ) {
        SoundGen.ballHit(intensity);
      }
      // 공 vs 벽
      else if (
        ((bodyA.label === "ball" || bodyA.label === "cueball") &&
          bodyB.label === "wall") ||
        ((bodyB.label === "ball" || bodyB.label === "cueball") &&
          bodyA.label === "wall")
      ) {
        SoundGen.wallHit(intensity);
      }
    }

    // 1. 첫 충돌 감지 (파울 체크)
    if (isShooting && !firstHitRecorded) {
      let otherBall = null;
      if (bodyA.label === "cueball" && bodyB.label === "ball")
        otherBall = bodyB;
      if (bodyB.label === "cueball" && bodyA.label === "ball")
        otherBall = bodyA;

      if (otherBall) {
        firstHitRecorded = true;
        const num = otherBall.ballNumber;
        let isFoul = false;

        // 내 공을 먼저 맞췄는지 확인
        if (currentPlayer === 1) {
          // 1P(Solid): 1~7번 또는 (다 넣었으면) 8번
          if (solidCount > 0 && num > 7)
            isFoul = true; // 줄무늬나 8번을 먼저 맞춤
          else if (solidCount === 0 && num !== 8) isFoul = true; // 8번을 맞춰야 하는데 다른거 맞춤
        } else {
          // 2P(Stripe): 9~15번 또는 (다 넣었으면) 8번
          if (stripeCount > 0 && num < 9)
            isFoul = true; // 단색이나 8번을 먼저 맞춤
          else if (stripeCount === 0 && num !== 8) isFoul = true;
        }

        if (isFoul) {
          foulThisTurn = true;
          showMessage("파울!", 100); // 파울 즉시 표시
        }
      }
    }
  });
});

// 턴 관리 및 게임 상태 업데이트 (매 프레임 체크)
Events.on(engine, "beforeUpdate", () => {
  if (isGameEnded) return;

  if (isShooting) {
    // 모든 공 중 가장 빠른 속도 확인
    let maxSpeed = 0;
    if (cueBall) maxSpeed = Math.max(maxSpeed, cueBall.speed);
    balls.forEach((b) => (maxSpeed = Math.max(maxSpeed, b.speed)));

    // 공이 빠르게 움직이면 타이머 리셋 (계속 대기)
    if (maxSpeed > 0.2) {
      slowMotionTimer = 0;
    } else {
      // 공이 아주 천천히 움직이거나 멈춰있으면 타이머 증가
      slowMotionTimer++;
      // 약 1초(60fps * 1 = 60프레임) 대기 후 턴 넘김
      if (slowMotionTimer > 60) {
        isShooting = false;
        slowMotionTimer = 0;
        processTurnResult();
      }
    }
    // 샷 진행 중일 때 포켓 처리 (거리 기반)
    checkPockets();
    checkOutOfBounds();
  }
});

function checkPockets() {
  // 큐볼 체크
  if (cueBall) {
    for (let pocket of pockets) {
      // 거리 체크: 포켓 반지름 사용
      if (
        Vector.magnitude(Vector.sub(cueBall.position, pocket.position)) <
        pocket.circleRadius
      ) {
        Body.setPosition(cueBall, { x: width / 2, y: height - 150 });
        Body.setVelocity(cueBall, { x: 0, y: 0 });
        foulThisTurn = true;
        showFloatingText(pocket.position.x, pocket.position.y, "빠짐!");
        showMessage("파울!", 100);
        updateScoreDisplay();
        break;
      }
    }
  }

  // 목적구 체크
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    for (let pocket of pockets) {
      if (
        Vector.magnitude(Vector.sub(ball.position, pocket.position)) <
        pocket.circleRadius
      ) {
        // 8번 공 처리 (즉시 승패 판정)
        if (ball.ballNumber === 8) {
          if (foulThisTurn) {
            // 파울 상태에서 8번 공 넣음 -> 패배
            endGame(currentPlayer === 1 ? 2 : 1);
          } else {
            // 정상적인 상태에서 8번 공 넣음 -> 조건 확인
            if (currentPlayer === 1) {
              if (solidCount === 0)
                endGame(1); // 승리
              else endGame(2); // 패배 (아직 남은 공 있음)
            } else {
              if (stripeCount === 0)
                endGame(2); // 승리
              else endGame(1); // 패배
            }
          }
          return; // 게임 종료
        }

        if (currentPlayer === 1 && ball.ballNumber > 8) {
          foulThisTurn = true;
          showMessage("파울!", 100);
        }
        if (currentPlayer === 2 && ball.ballNumber < 8) {
          foulThisTurn = true;
          showMessage("파울!", 100);
        }

        World.remove(engine.world, ball);
        balls.splice(i, 1);
        pottedThisTurn.push(ball);

        if (ball.ballNumber < 8) solidCount = Math.max(0, solidCount - 1);
        else if (ball.ballNumber > 8)
          stripeCount = Math.max(0, stripeCount - 1);

        // +1 시각 효과 (소리 대신)
        showFloatingText(pocket.position.x, pocket.position.y, "+1");
        updateScoreDisplay();
        break;
      }
    }
  }
}

function checkOutOfBounds() {
  const buffer = 50; // 화면 밖 여유 공간

  // 큐볼 체크
  if (cueBall) {
    if (
      cueBall.position.x < -buffer ||
      cueBall.position.x > width + buffer ||
      cueBall.position.y < -buffer ||
      cueBall.position.y > height + buffer
    ) {
      Body.setPosition(cueBall, { x: width / 2, y: height - 150 });
      Body.setVelocity(cueBall, { x: 0, y: 0 });
      foulThisTurn = true;
      showMessage("파울! (장외)", 100);
    }
  }

  // 목적구 체크
  balls.forEach((ball) => {
    if (
      ball.position.x < -buffer ||
      ball.position.x > width + buffer ||
      ball.position.y < -buffer ||
      ball.position.y > height + buffer
    ) {
      Body.setPosition(ball, { x: width / 2, y: height / 2 }); // 중앙으로 복귀
      Body.setVelocity(ball, { x: 0, y: 0 });
      foulThisTurn = true;
      showMessage("파울! (장외)", 100);
    }
  });
}

function processTurnResult() {
  // 8번 공 처리는 checkPockets에서 즉시 수행됨

  // 2. 턴 넘김 로직
  let switchTurn = true;

  // 파울이 발생하면 무조건 턴 넘김 + 프리볼
  if (foulThisTurn) {
    isBallInHand = true;
    switchTurn = true;
    showMessage("원하는 곳에 볼을 놓아 주세요", 9999); // 턴 시작 전까지 계속 표시
  } else {
    // 파울이 아닐 때, 자신의 공을 하나라도 넣었으면 턴 유지
    const myBallPotted = pottedThisTurn.some((b) => {
      if (currentPlayer === 1) return b.ballNumber < 8; // Solid
      return b.ballNumber > 8; // Stripe
    });

    if (myBallPotted) {
      switchTurn = false; // 한 번 더 치기
      updateTurnIndicator(); // 턴 표시 애니메이션 재실행
      showMessage("한번 더 쳐주세요!", 125); // 2초간 메시지 표시 (125 * 16ms ≈ 2000ms)
    }
  }

  if (switchTurn) {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateTurnIndicator();
  }
}

function updateTurnIndicator() {
  const indicator = document.getElementById("turn-indicator");

  // 애니메이션 재실행을 위한 리플로우 트리거
  indicator.style.animation = "none";
  indicator.offsetHeight; /* trigger reflow */
  indicator.style.animation = null;

  if (currentPlayer === 1) {
    indicator.textContent = "Player 1 Turn";
    indicator.className = "p1-turn";
    document.body.style.backgroundColor = "#411e1e"; // 1P: 살짝 어두운 빨간색 배경
  } else {
    indicator.textContent = "Player 2 Turn";
    indicator.className = "p2-turn";
    document.body.style.backgroundColor = "#1b1b2b"; // 2P: 살짝 어두운 파란색 배경
  }
}

function showMessage(text, duration) {
  const overlay = document.getElementById("message-overlay");
  if (!overlay) return;
  overlay.textContent = text;
  overlay.classList.remove("hidden");

  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }

  messageTimeout = setTimeout(() => {
    overlay.classList.add("hidden");
  }, duration * 16); // 프레임 단위(약 16ms)로 변환
}

function showFloatingText(x, y, text) {
  const el = document.createElement("div");
  el.className = "floating-text";
  el.textContent = text;
  el.style.left = x + "px";
  el.style.top = y + "px";
  document.getElementById("ui-layer").appendChild(el);
  setTimeout(() => el.remove(), 800);
}

// 렌더링 후 커스텀 그리기 (당구대 바닥 및 줄무늬)
Events.on(render, "afterRender", () => {
  const ctx = render.context;

  // 1. 당구대 바닥 그리기 (가장 아래에 그려야 하므로 globalCompositeOperation 사용하거나 beforeRender로 옮겨야 함)
  // 하지만 Matter.js render는 매 프레임 캔버스를 지우므로, beforeRender가 맞음.
  // 여기서는 줄무늬 공 처리를 위해 afterRender 사용.

  // 줄무늬 공 그리기
  const bodies = Composite.allBodies(engine.world);
  bodies.forEach((body) => {
    if (body.label === "ball" && body.isStripe) {
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);

      // 가운데 색깔 띠 그리기
      ctx.fillStyle = body.ballColor;
      ctx.beginPath();
      ctx.arc(0, 0, body.circleRadius, 0, Math.PI * 2);
      ctx.clip(); // 공 모양으로 자르기
      // 중앙에 띠 (높이는 반지름의 약 60%)
      ctx.fillRect(
        -body.circleRadius,
        -body.circleRadius * 0.6,
        body.circleRadius * 2,
        body.circleRadius * 1.2,
      );

      ctx.restore();
    }
  });

  // 큐대 및 가이드라인 그리기 (드래그 중일 때)
  if (isDragging && cueBall && currentMousePos) {
    const dx = currentMousePos.x - cueBall.position.x;
    const dy = currentMousePos.y - cueBall.position.y;
    const angle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 큐대 당김 거리 제한 (최대 파워 기준 약 200px)
    const pullDist = Math.min(dist, 200);

    ctx.save();
    ctx.translate(cueBall.position.x, cueBall.position.y);

    // 1. 가이드라인 (큐대 반대 방향 = 공이 나갈 방향)
    ctx.save();
    ctx.rotate(angle + Math.PI);
    ctx.beginPath();
    ctx.setLineDash([5, 5]); // 점선
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.moveTo(ballRadius + 5, 0);
    ctx.lineTo(800, 0); // 길게 그림
    ctx.stroke();
    ctx.restore();

    // 2. 큐대 그리기 (마우스 방향)
    ctx.rotate(angle);
    // 공에서 떨어진 거리 + 당긴 거리만큼 뒤로 이동
    const stickOffset = ballRadius + 10 + pullDist;
    const stickLen = 400;
    const tipW = 6;
    const handleW = 12;

    // 나무 질감 그라데이션
    const grad = ctx.createLinearGradient(0, -handleW / 2, 0, handleW / 2);
    grad.addColorStop(0, "#5d4037");
    grad.addColorStop(0.5, "#8d6e63");
    grad.addColorStop(1, "#3e2723");
    ctx.fillStyle = grad;

    // 큐대 몸통
    ctx.beginPath();
    ctx.moveTo(stickOffset, -tipW / 2);
    ctx.lineTo(stickOffset + stickLen, -handleW / 2);
    ctx.lineTo(stickOffset + stickLen, handleW / 2);
    ctx.lineTo(stickOffset, tipW / 2);
    ctx.fill();

    // 큐대 팁 (흰색 + 파란 초크)
    ctx.fillStyle = "#eee";
    ctx.fillRect(stickOffset, -tipW / 2, 8, tipW);
    ctx.fillStyle = "#1976d2";
    ctx.fillRect(stickOffset, -tipW / 2, 3, tipW);

    ctx.restore();
  }
});

// UI 로직
const startScreen = document.getElementById("start-screen");
const hud = document.getElementById("hud");
const gameOver = document.getElementById("game-over");
let runner = null;

// 렌더러는 전역에서 한 번만 실행 (중복 실행 방지)
Render.run(render);

function startGame() {
  startScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  gameOver.classList.add("hidden");
  solidCount = 7;
  stripeCount = 7;
  currentPlayer = 1;
  isShooting = false;
  isBallInHand = false;
  firstHitRecorded = false;
  slowMotionTimer = 0;
  isGameEnded = false;
  document.getElementById("message-overlay").classList.add("hidden");
  updateTurnIndicator();
  updateScoreDisplay();

  // 기존 러너가 있다면 중지 및 월드 초기화
  if (runner) Runner.stop(runner);
  World.clear(engine.world);
  Engine.clear(engine);

  createWalls();
  createPockets();
  createBalls();

  runner = Runner.create();
  Runner.run(runner, engine);
}

function updateScoreDisplay() {
  const solidEl = document.getElementById("solid-count");
  const stripeEl = document.getElementById("stripe-count");
  if (solidEl) solidEl.textContent = solidCount;
  if (stripeEl) stripeEl.textContent = stripeCount;
}

function endGame(winner) {
  isGameEnded = true;
  hud.classList.add("hidden");
  gameOver.classList.remove("hidden");
  const msg = document.querySelector("#game-over p");
  msg.textContent = `${winner}P의 승리!`;

  // 메시지 오버레이 숨기기
  const overlay = document.getElementById("message-overlay");
  if (overlay) overlay.classList.add("hidden");
  if (messageTimeout) clearTimeout(messageTimeout);
}

// 버튼 이벤트
const btnStart = document.getElementById("btn-start");
if (btnStart) btnStart.addEventListener("click", startGame);

const btnRestart = document.getElementById("btn-restart");
if (btnRestart) btnRestart.addEventListener("click", startGame);

const goHome = () => (location.href = "../game-list.html");
document.getElementById("btn-home")?.addEventListener("click", goHome);
document.getElementById("btn-quit")?.addEventListener("click", goHome);
document.getElementById("btn-home-over")?.addEventListener("click", goHome);

// 게임 방법 모달
const howtoModal = document.getElementById("howto-modal");
const btnHowto = document.getElementById("btn-howto");
if (btnHowto)
  btnHowto.addEventListener("click", () => {
    howtoModal.classList.remove("hidden");
  });
document.getElementById("btn-close-howto")?.addEventListener("click", () => {
  howtoModal.classList.add("hidden");
});

// 반응형 처리
function resizeGame() {
  const scale = Math.min(
    window.innerWidth / width,
    window.innerHeight / height,
  );
  container.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener("resize", resizeGame);
resizeGame(); // 초기 실행

// --- UI 버튼 효과음 연결 ---
function setupUISounds() {
  const uiButtons = document.querySelectorAll("button");
  uiButtons.forEach((btn) => {
    btn.addEventListener("mouseenter", () => {
      if (!btn.disabled) SoundGen.uiHover();
    });
    btn.addEventListener("click", () => {
      if (!btn.disabled) SoundGen.uiClick();
    });
  });
}
setupUISounds();
