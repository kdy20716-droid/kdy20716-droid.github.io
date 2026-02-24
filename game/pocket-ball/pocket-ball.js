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

// 캔버스 크기 설정
let width = container.clientWidth;
let height = container.clientHeight;

const render = Render.create({
  element: container,
  engine: engine,
  canvas: canvas,
  options: {
    width: width,
    height: height,
    wireframes: false,
    background: "#2d5a27", // 당구대 바닥 색 (진한 녹색)
    pixelRatio: window.devicePixelRatio, // 고해상도 디스플레이 대응
  },
});

// 벽 생성 (당구대 쿠션)
const wallThickness = 40;
const walls = [];

function createWalls() {
  World.remove(engine.world, walls);
  walls.length = 0;

  const options = {
    isStatic: true,
    render: { fillStyle: "#5d4037" },
    friction: 0.5,
    restitution: 0.8,
  };

  // 상, 하, 좌, 우 벽
  walls.push(Bodies.rectangle(width / 2, 0, width, wallThickness, options));
  walls.push(
    Bodies.rectangle(width / 2, height, width, wallThickness, options),
  );
  walls.push(
    Bodies.rectangle(width, height / 2, wallThickness, height, options),
  );
  walls.push(Bodies.rectangle(0, height / 2, wallThickness, height, options));

  World.add(engine.world, walls);
}

// 포켓 (구멍) 생성
const pockets = [];
const pocketRadius = 25;

function createPockets() {
  World.remove(engine.world, pockets);
  pockets.length = 0;

  const positions = [
    { x: 0, y: 0 },
    { x: width / 2, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: height },
    { x: width / 2, y: height },
    { x: width, y: height },
  ];

  positions.forEach((pos) => {
    const pocket = Bodies.circle(pos.x, pos.y, pocketRadius, {
      isStatic: true,
      isSensor: true, // 물리적 충돌 없이 감지만 함
      label: "pocket",
      render: { fillStyle: "#1a1a1a" },
    });
    pockets.push(pocket);
  });
  World.add(engine.world, pockets);
}

// 공 설정
let balls = [];
const ballRadius = 12;
let cueBall;

function createBalls() {
  // 기존 공 제거
  balls.forEach((b) => World.remove(engine.world, b));
  if (cueBall) World.remove(engine.world, cueBall);
  balls = [];

  // 큐볼 (흰공) - 하단 중앙 배치
  cueBall = Bodies.circle(width / 2, height - 150, ballRadius, {
    restitution: 0.9, // 탄성
    friction: 0.005, // 마찰
    frictionAir: 0.02, // 공기 저항 (감속)
    label: "cueball",
    render: { fillStyle: "#ffffff" },
  });
  World.add(engine.world, cueBall);

  // 목적구 (색깔 공들) - 상단 삼각형 배치
  const startX = width / 2;
  const startY = 150;
  const colors = [
    "#e74c3c",
    "#f1c40f",
    "#3498db",
    "#9b59b6",
    "#e67e22",
    "#2ecc71",
    "#e74c3c",
    "#f1c40f",
    "#3498db",
    "#9b59b6",
  ];

  let ballIndex = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col <= row; col++) {
      const x = startX + (col - row / 2) * (ballRadius * 2 + 2);
      const y = startY + row * (ballRadius * 2 + 2) * Math.sin(Math.PI / 3);

      if (ballIndex < colors.length) {
        const ball = Bodies.circle(x, y, ballRadius, {
          restitution: 0.9,
          friction: 0.005,
          frictionAir: 0.02,
          label: "ball",
          render: { fillStyle: colors[ballIndex % colors.length] },
        });
        balls.push(ball);
        ballIndex++;
      }
    }
  }
  World.add(engine.world, balls);
}

// 게임 상태
let isDragging = false;
let dragStart = null;
let score = 0;

// 마우스/터치 이벤트 처리 (큐대 조작)
canvas.addEventListener("mousedown", handleInputStart);
canvas.addEventListener("touchstart", handleInputStart, { passive: false });

window.addEventListener("mousemove", handleInputMove);
window.addEventListener("touchmove", handleInputMove, { passive: false });

window.addEventListener("mouseup", handleInputEnd);
window.addEventListener("touchend", handleInputEnd);

function handleInputStart(e) {
  if (isMoving(cueBall)) return; // 공이 움직이는 중에는 조작 불가

  const pos = getMousePos(e);
  // 큐볼 근처를 클릭했는지 확인
  const dist = Vector.magnitude(Vector.sub(pos, cueBall.position));
  if (dist < 50) {
    isDragging = true;
    dragStart = cueBall.position;
    // 게이지 표시
    if (powerGaugeContainer) powerGaugeContainer.classList.remove("hidden");
    if (powerGaugeBar) powerGaugeBar.style.width = "0%";
  }
}

function handleInputMove(e) {
  if (!isDragging) return;
  e.preventDefault(); // 스크롤 방지

  // 파워 게이지 업데이트
  const pos = getMousePos(e);
  const forceVector = Vector.sub(dragStart, pos);
  const maxForce = 0.04; // handleInputEnd와 동일한 최대 힘
  const forceMag = Vector.magnitude(forceVector) * 0.0002;
  const power = Math.min(forceMag, maxForce) / maxForce; // 0.0 ~ 1.0 비율 계산

  if (powerGaugeBar) {
    powerGaugeBar.style.width = `${power * 100}%`;
  }
}

function handleInputEnd(e) {
  if (!isDragging) return;

  const pos = getMousePos(e);
  const forceVector = Vector.sub(dragStart, pos); // 드래그 반대 방향으로 힘 적용

  // 힘 제한 및 조절
  const maxForce = 0.04;
  const forceMag = Vector.magnitude(forceVector) * 0.0002;
  const force = Vector.mult(
    Vector.normalise(forceVector),
    Math.min(forceMag, maxForce),
  );

  if (forceMag > 0.001) {
    // 너무 약한 힘은 무시
    Body.applyForce(cueBall, cueBall.position, force);
  }

  isDragging = false;
  dragStart = null;

  // 게이지 숨기기
  if (powerGaugeContainer) powerGaugeContainer.classList.add("hidden");
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.touches ? e.changedTouches[0].clientY : e.clientY;
  // 캔버스 스케일링 고려
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function isMoving(body) {
  return body.speed > 0.15; // 속도가 일정 이상이면 움직이는 것으로 간주
}

// 충돌 감지 (포켓)
Events.on(engine, "collisionStart", (event) => {
  const pairs = event.pairs;

  pairs.forEach((pair) => {
    const bodyA = pair.bodyA;
    const bodyB = pair.bodyB;

    // 포켓과 공의 충돌 확인
    let ball = null;
    if (
      bodyA.label === "pocket" &&
      (bodyB.label === "ball" || bodyB.label === "cueball")
    )
      ball = bodyB;
    if (
      bodyB.label === "pocket" &&
      (bodyA.label === "ball" || bodyA.label === "cueball")
    )
      ball = bodyA;

    if (ball) {
      if (ball.label === "cueball") {
        // 큐볼이 빠지면 페널티 후 리셋
        Body.setPosition(cueBall, { x: width / 2, y: height - 150 });
        Body.setVelocity(cueBall, { x: 0, y: 0 });
        score = Math.max(0, score - 10);
      } else {
        // 일반 공이 빠지면 제거 및 점수
        World.remove(engine.world, ball);
        balls = balls.filter((b) => b !== ball);
        score += 10;

        // 모든 공을 다 넣었으면 게임 오버 (승리)
        if (balls.length === 0) {
          endGame();
        }
      }
      updateScore();
    }
  });
});

// 렌더링 루프에서 가이드라인 그리기
Events.on(render, "afterRender", () => {
  if (isDragging && dragStart) {
    const ctx = render.context;
    // 현재 마우스 위치는 mousemove 이벤트에서 저장하거나 Matter.Mouse에서 가져올 수 있음
    // 여기서는 간단히 구현하기 위해 생략하거나, 전역 변수에 저장된 마우스 위치 사용 필요
    // (Matter.js Render가 이미 큐볼을 그리고 있으므로, 그 위에 선을 그리면 됨)
  }
});

// UI 로직
const startScreen = document.getElementById("start-screen");
const gameHud = document.getElementById("game-hud");
const gameOverScreen = document.getElementById("game-over-screen");
const scoreEl = document.getElementById("score");
const finalScoreEl = document.getElementById("final-score");
const powerGaugeContainer = document.getElementById("power-gauge-container");
const powerGaugeBar = document.getElementById("power-gauge-bar");

function startGame() {
  startScreen.classList.add("hidden");
  gameHud.classList.remove("hidden");
  gameOverScreen.classList.add("hidden");

  score = 0;
  updateScore();

  // 화면 크기 재계산
  width = container.clientWidth;
  height = container.clientHeight;
  render.canvas.width = width;
  render.canvas.height = height;

  createWalls();
  createPockets();
  createBalls();

  Render.run(render);
  Runner.run(Runner.create(), engine);
}

function endGame() {
  gameHud.classList.add("hidden");
  gameOverScreen.classList.remove("hidden");
  finalScoreEl.textContent = score;
}

function updateScore() {
  scoreEl.textContent = score;
}

// 버튼 이벤트 연결
document.getElementById("btn-start").addEventListener("click", startGame);
document.getElementById("btn-restart").addEventListener("click", startGame);

document.getElementById("btn-back").addEventListener("click", () => {
  window.location.href = "../game-list.html";
});
document.getElementById("btn-quit").addEventListener("click", () => {
  window.location.href = "../game-list.html";
});

// 반응형 처리
window.addEventListener("resize", () => {
  width = container.clientWidth;
  height = container.clientHeight;
  render.canvas.width = width;
  render.canvas.height = height;
  createWalls();
  createPockets();
  // 공 위치는 비율에 맞춰 조정하거나 리셋 필요 (여기서는 단순 리셋 방지)
});
