import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { BossSystem } from "./boss.js";

// 1. 씬 설정
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // 완전한 어둠
// 안개 설정: (색상, 시작 거리, 끝 거리) - 끝 거리를 조절하여 가시거리를 변경하세요.
scene.fog = new THREE.Fog(0x000000, 30, 150); // 기존보다 가시거리 증가

// 2. 카메라 및 조명
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.y = 2.0; // 플레이어 눈높이 (2m)

// 환경광: 전체적인 밝기를 조절합니다. (색상값 0x333333을 높이면 더 밝아짐)
const ambientLight = new THREE.AmbientLight(0x444444);
scene.add(ambientLight);

// 플레이어 주변 조명 (PointLight): (색상, 강도, 거리)
// 강도(2.0)와 거리(100)를 조절하여 주변 밝기를 변경하세요.
const playerLight = new THREE.PointLight(0xffffff, 30.0, 100);
camera.add(playerLight);

// 플레이어 손전등 (SpotLight)
// (색상, 강도, 거리, 각도, 페넘브라, 감쇠) - 강도(5)와 거리(250)를 조절하세요.
const flashlight = new THREE.SpotLight(0xffffff, 15, 250, Math.PI / 1, 0.5, 1);
flashlight.position.set(0.5, 0, 0); // 카메라 오른쪽
flashlight.target.position.set(0, 0, -1);
camera.add(flashlight);
camera.add(flashlight.target);
scene.add(camera);

// 오디오 컨텍스트 (경고음용)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSiren() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(200, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 1.0);
  osc.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 2.0);

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.0);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 2.0);
}

// BGM 시스템
let bgmOscillators = [];
let bgmInterval = null;
let currentBgmType = null;

function playBGM(type) {
  if (currentBgmType === type) return; // 이미 같은 BGM이면 무시
  stopBGM();
  currentBgmType = type;

  if (audioCtx.state === "suspended") audioCtx.resume();

  if (type === "normal") {
    playNormalBGM();
  } else if (type === "boss") {
    playBossBGM();
  } else if (type === "ending") {
    playEndingBGM();
  }
}

function stopBGM() {
  if (bgmInterval) clearInterval(bgmInterval);
  bgmInterval = null;
  bgmOscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch (e) {}
    osc.disconnect();
  });
  bgmOscillators.length = 0;
  currentBgmType = null;
}

function playNormalBGM() {
  // 어두운 앰비언트 드론 사운드
  const osc = audioCtx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 55; // A1 (낮은음)
  const gain = audioCtx.createGain();
  gain.gain.value = 0.05;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 200;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  bgmOscillators.push(osc);

  // 심장 박동 같은 비트
  bgmInterval = setInterval(() => {
    const t = audioCtx.currentTime;
    const kick = audioCtx.createOscillator();
    kick.frequency.setValueAtTime(100, t);
    kick.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
    const kGain = audioCtx.createGain();
    kGain.gain.setValueAtTime(0.1, t);
    kGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    kick.connect(kGain);
    kGain.connect(audioCtx.destination);
    kick.start(t);
    kick.stop(t + 0.5);
  }, 1000);
}

function playBossBGM() {
  // 긴박한 사이렌 느낌의 베이스
  bgmInterval = setInterval(() => {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.linearRampToValueAtTime(55, t + 0.1);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }, 250); // 빠른 템포
}

function playEndingBGM() {
  // 승리의 아르페지오 (C Major)
  const notes = [261.63, 329.63, 392.0, 523.25];
  let i = 0;
  bgmInterval = setInterval(() => {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = notes[i % notes.length];
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 1.0);
    i++;
  }, 500);
}

// 무기 상태 관리
const weaponState = {
  current: "rifle", // 'rifle' or 'pistol'
  rifle: {
    mag: 60, // 현재 탄창
    reserve: 240, // 예비 탄약 (총 300발 - 60발)
    maxMag: 60,
    damage: 1,
    fireRate: 0.1, // 연사 속도 상향 (0.2 -> 0.1)
    speed: 300, // 탄속 증가
    automatic: true, // 연사 가능
    reloadTime: 2000, // 재장전 시간 2초
  },
  pistol: {
    mag: Infinity, // 무한
    reserve: Infinity,
    damage: 1,
    fireRate: 0.2,
    speed: 200, // 탄속 증가
    automatic: false, // 단발 사격
  },
};
const ammoElement = document.getElementById("ammo-board");
const weapon1Slot = document.getElementById("weapon-1");
const weapon2Slot = document.getElementById("weapon-2");
const healthBar = document.getElementById("health-bar");
const staminaBar = document.getElementById("stamina-bar");

// 소총 모델 생성 및 카메라 부착
const rifle = new THREE.Group();

// 몸통
const bodyGeo = new THREE.BoxGeometry(0.3, 0.4, 1.5);
const bodyMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.position.set(0, 0, 0);
rifle.add(body);

// 총열
const barrelGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5);
const barrelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
const barrel = new THREE.Mesh(barrelGeo, barrelMat);
barrel.rotation.x = -Math.PI / 2;
barrel.position.set(0, 0.1, -1.5);
rifle.add(barrel);

// 개머리판
const stockGeo = new THREE.BoxGeometry(0.2, 0.3, 0.8);
const stockMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 });
const stock = new THREE.Mesh(stockGeo, stockMat);
stock.position.set(0, -0.1, 1.0);
rifle.add(stock);

// 탄창
const magGeo = new THREE.BoxGeometry(0.15, 0.6, 0.3);
const magMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
const mag = new THREE.Mesh(magGeo, magMat);
mag.position.set(0, -0.4, 0.2);
rifle.add(mag);

rifle.position.set(0.5, -0.5, -1); // 화면 우측 하단 배치
camera.add(rifle);

// 권총 모델 생성 및 카메라 부착 (초기엔 숨김)
const pistol = new THREE.Group();

// 권총 몸통
const pBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.3, 0.8),
  new THREE.MeshLambertMaterial({ color: 0x333333 }),
);
pistol.add(pBody);

// 권총 총열
const pBarrel = new THREE.Mesh(
  new THREE.BoxGeometry(0.15, 0.15, 0.8),
  new THREE.MeshLambertMaterial({ color: 0x111111 }),
);
pBarrel.position.set(0, 0.15, -0.4);
pistol.add(pBarrel);

// 권총 손잡이
const pGrip = new THREE.Mesh(
  new THREE.BoxGeometry(0.18, 0.6, 0.3),
  new THREE.MeshLambertMaterial({ color: 0x5d4037 }),
);
pGrip.position.set(0, -0.3, 0.2);
pGrip.rotation.x = 0.2;
pistol.add(pGrip);

pistol.position.set(0.5, -0.6, -0.8); // 화면 우측 하단
pistol.visible = false; // 처음엔 소총 사용
camera.add(pistol);

// 총구 위치 (발사 원점) - 소총용
const rifleMuzzle = new THREE.Object3D();
rifleMuzzle.position.set(0, 0.1, -2.3);
rifle.add(rifleMuzzle);

// 총구 위치 - 권총용
const pistolMuzzle = new THREE.Object3D();
pistolMuzzle.position.set(0, 0.15, -0.9);
pistol.add(pistolMuzzle);

// 3. 렌더러
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 4. 바닥 생성
const floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 }); // 회색 바닥
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// 4.5 맵 생성 (장애물)
const obstacles = [];
const obstacleBoxes = []; // 충돌 감지용 박스 데이터
const wallMeshes = []; // 벽 메쉬 저장
const wallBoxes = []; // 벽 충돌 박스 저장

function createCityMap() {
  // 빌딩 숲 생성
  const buildingGeo = new THREE.BoxGeometry(30, 100, 30);
  const buildingMat = new THREE.MeshLambertMaterial({ color: 0x222222 }); // 어두운 빌딩
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // 창문 불빛

  const gridSize = 15; // 15x15 그리드
  const spacing = 70; // 건물 간격 (도로 폭 포함)

  for (let x = -gridSize; x <= gridSize; x++) {
    for (let z = -gridSize; z <= gridSize; z++) {
      // 시작 지점(중앙) 주변은 비워둠
      if (Math.abs(x) < 2 && Math.abs(z) < 2) continue;

      // 80% 확률로 건물 생성 (빈 공터도 있음)
      if (Math.random() > 0.8) continue;

      const building = new THREE.Mesh(buildingGeo, buildingMat);
      building.position.set(x * spacing, 50, z * spacing);

      // 건물 높이 랜덤화
      const heightScale = 0.5 + Math.random() * 2.0;
      building.scale.y = heightScale;
      building.position.y = 50 * heightScale;

      scene.add(building);
      obstacles.push(building);
      obstacleBoxes.push(new THREE.Box3().setFromObject(building));
    }
  }

  // 동적 벽 초기 생성 (위치와 크기는 updateMapSize에서 설정)
  const wallMat = new THREE.MeshLambertMaterial({
    color: 0x550000,
    transparent: true,
    opacity: 0.5,
  }); // 붉은색 에너지장 느낌
  const wallGeo = new THREE.BoxGeometry(1, 500, 1); // 기본 지오메트리

  for (let i = 0; i < 4; i++) {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    scene.add(wall);
    wallMeshes.push(wall);
  }
}
createCityMap();

function getMapRadius(round) {
  // 초기 반지름 120 (넓게 시작), 라운드당 30씩 증가
  return 120 + (round - 1) * 30;
}

// 맵 크기 업데이트 함수
function updateMapSize(wave) {
  const radius = getMapRadius(wave);
  const thickness = 10;
  const height = 500;

  // 북쪽 (Z-)
  wallMeshes[0].position.set(0, height / 2, -radius - thickness / 2);
  wallMeshes[0].scale.set(radius * 2 + thickness * 2, 1, thickness);

  // 남쪽 (Z+)
  wallMeshes[1].position.set(0, height / 2, radius + thickness / 2);
  wallMeshes[1].scale.set(radius * 2 + thickness * 2, 1, thickness);

  // 동쪽 (X+)
  wallMeshes[2].position.set(radius + thickness / 2, height / 2, 0);
  wallMeshes[2].scale.set(thickness, 1, radius * 2);

  // 서쪽 (X-)
  wallMeshes[3].position.set(-radius - thickness / 2, height / 2, 0);
  wallMeshes[3].scale.set(thickness, 1, radius * 2);

  // 충돌 박스 업데이트
  wallBoxes.length = 0;
  wallMeshes.forEach((wall) => {
    wallBoxes.push(new THREE.Box3().setFromObject(wall));
  });
}

// 5. 컨트롤 (PointerLock)
const controls = new PointerLockControls(camera, document.body);
const pauseMenu = document.getElementById("pause-menu");

let gameStarted = false;
let isFiring = false; // 발사 상태 플래그

document.addEventListener("click", (e) => {
  // 시작 화면이나 모달이 떠있으면 포인터 락 방지
  const startScreen = document.getElementById("start-screen");
  const howtoModal = document.getElementById("howto-modal");
  const gameOverScreen = document.getElementById("game-over-screen");
  const pauseMenu = document.getElementById("pause-menu");
  if (!startScreen.classList.contains("hidden")) return;
  if (!howtoModal.classList.contains("hidden")) return;
  if (gameOverScreen && !gameOverScreen.classList.contains("hidden")) return;
  if (pauseMenu && !pauseMenu.classList.contains("hidden")) return;

  if (!controls.isLocked) {
    controls.lock();
    // 모바일 모드일 때는 lock()이 동작하지 않거나 필요 없을 수 있음 (아래 로직에서 처리)
  }
});

document.addEventListener("mousedown", () => {
  if (controls.isLocked && gameStarted) isFiring = true;
});

document.addEventListener("mouseup", () => {
  isFiring = false;
});

controls.addEventListener("lock", () => {
  if (isMobileMode) return; // 모바일은 별도 UI 사용
  if (pauseMenu) pauseMenu.classList.add("hidden");
  if (!gameStarted) {
    gameStarted = true;
    resetGame();
  }
});

controls.addEventListener("unlock", () => {
  if (isMobileMode) return;
  // 엔딩 화면이 켜져있으면 일시정지 메뉴를 띄우지 않음
  const endingScreen = document.getElementById("ending-screen");
  if (endingScreen && !endingScreen.classList.contains("hidden")) {
    return;
  }
  // 사망 연출 중에는 일시정지 메뉴 표시 안 함
  if (isPlayerDying) return;

  if (gameStarted && pauseMenu) {
    pauseMenu.classList.remove("hidden");
  }
});

scene.add(controls.getObject());

// 6. 이동 로직
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

// 달리기 상태 추가
moveState.sprint = false;
// 모바일 조이스틱 입력 벡터
const joystickVector = { x: 0, y: 0 };

let canJump = false;

document.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "KeyW":
      moveState.forward = true;
      break;
    case "KeyA":
      moveState.left = true;
      break;
    case "KeyS":
      moveState.backward = true;
      break;
    case "KeyD":
      moveState.right = true;
      break;
    case "Space":
      if (canJump) {
        velocity.y += 20; // 점프 힘
        canJump = false;
      }
      break;
    case "ShiftLeft":
    case "ShiftRight":
      moveState.sprint = true;
      break;
    // 무기 교체 및 히든 단축키 통합
    case "Digit1":
    case "Digit2":
    case "Digit3":
    case "Digit4":
    case "Digit5":
    case "Digit6":
    case "Digit7":
    case "Digit8":
    case "Digit9":
    case "Digit0":
      if (event.shiftKey && event.altKey) {
        const startScreen = document.getElementById("start-screen");
        // 시작 화면이 보일 때만 작동
        if (startScreen && !startScreen.classList.contains("hidden")) {
          let targetWave = parseInt(event.code.replace("Digit", "")) * 10;
          if (targetWave === 0) targetWave = 100; // 0은 100웨이브

          startScreen.classList.add("hidden");
          gameStarted = true;
          controls.lock();
          resetGame(targetWave - 1);
        }
      } else if (event.code === "Digit1") {
        switchWeapon("rifle");
      } else if (event.code === "Digit2") {
        switchWeapon("pistol");
      }
      break;
  }
});

document.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "KeyW":
      moveState.forward = false;
      break;
    case "KeyA":
      moveState.left = false;
      break;
    case "KeyS":
      moveState.backward = false;
      break;
    case "KeyD":
      moveState.right = false;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      moveState.sprint = false;
      break;
  }
});

// --- 시작 화면 및 모바일 컨트롤 로직 ---
let isMobileMode = false;
const startScreen = document.getElementById("start-screen");
const mobileControls = document.getElementById("mobile-controls");
const howtoModal = document.getElementById("howto-modal");

// PC 시작
document.getElementById("btn-pc-start").addEventListener("click", () => {
  startScreen.classList.add("hidden");
  controls.lock(); // 포인터 락 요청
});

// 모바일 시작
document.getElementById("btn-mobile-start").addEventListener("click", () => {
  isMobileMode = true;
  startScreen.classList.add("hidden");
  mobileControls.classList.remove("hidden");

  // 전체화면 및 가로모드 요청
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch((e) => console.log(e));
  }
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock("landscape").catch((e) => console.log(e));
  }

  // 게임 시작 처리
  if (!gameStarted) {
    gameStarted = true;
    resetGame();
  }
  if (pauseMenu) pauseMenu.classList.add("hidden");
});

// 게임 방법
document.getElementById("btn-howto").addEventListener("click", () => {
  howtoModal.classList.remove("hidden");
});
document.getElementById("btn-close-howto").addEventListener("click", () => {
  howtoModal.classList.add("hidden");
});

// 나가기
document.getElementById("btn-exit").addEventListener("click", () => {
  if (document.referrer && document.referrer.includes("game-list.html")) {
    history.back();
  } else {
    location.href = "../../game-list.html"; // 경로 수정 (game/shooting/ 에서 상위로)
  }
});

// 모바일 조이스틱 로직
const joystickZone = document.getElementById("joystick-zone");
const joystickKnob = document.getElementById("joystick-knob");
let joystickId = null;
const maxJoystickRadius = 40;

joystickZone.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joystickId = touch.identifier;
    updateJoystick(touch);
  },
  { passive: false },
);

joystickZone.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickId) {
        updateJoystick(e.changedTouches[i]);
        break;
      }
    }
  },
  { passive: false },
);

joystickZone.addEventListener("touchend", (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === joystickId) {
      joystickId = null;
      joystickKnob.style.transform = `translate(-50%, -50%)`;
      joystickVector.x = 0;
      joystickVector.y = 0;
      break;
    }
  }
});

function updateJoystick(touch) {
  const rect = joystickZone.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let dx = touch.clientX - centerX;
  let dy = touch.clientY - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > maxJoystickRadius) {
    const ratio = maxJoystickRadius / dist;
    dx *= ratio;
    dy *= ratio;
  }

  joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

  // 정규화된 벡터 (-1 ~ 1)
  joystickVector.x = dx / maxJoystickRadius;
  joystickVector.y = dy / maxJoystickRadius;
}

// 모바일 버튼 로직
document.getElementById("btn-m-jump").addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (canJump) {
    velocity.y += 20;
    canJump = false;
  }
});
document.getElementById("btn-m-shoot").addEventListener("touchstart", (e) => {
  e.preventDefault();
  isFiring = true;
  if (!weaponState[weaponState.current].automatic) shoot();
});
document.getElementById("btn-m-shoot").addEventListener("touchend", (e) => {
  e.preventDefault();
  isFiring = false;
});
document.getElementById("btn-m-run").addEventListener("touchstart", (e) => {
  e.preventDefault();
  moveState.sprint = !moveState.sprint; // 토글 방식
  e.target.classList.toggle("active", moveState.sprint);
});
document.getElementById("btn-m-pause").addEventListener("click", () => {
  // 일시정지 토글 (간단히 메뉴 표시)
  if (pauseMenu.classList.contains("hidden")) {
    pauseMenu.classList.remove("hidden");
    gameStarted = false;
  } else {
    pauseMenu.classList.add("hidden");
    gameStarted = true;
  }
});

// 모바일 시점 변환 (화면 드래그)
let lastTouchX = 0;
let lastTouchY = 0;
document.addEventListener("touchstart", (e) => {
  if (!isMobileMode) return;
  // 조이스틱이나 버튼이 아닌 영역 터치 시 시점 제어
  if (!e.target.closest("#mobile-controls")) {
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
  }
});
document.addEventListener("touchmove", (e) => {
  if (!isMobileMode || !gameStarted) return;
  if (!e.target.closest("#mobile-controls")) {
    const touch = e.touches[0];
    const movementX = touch.clientX - lastTouchX;
    const movementY = touch.clientY - lastTouchY;

    // 카메라 회전 (감도 조절)
    const sensitivity = 0.005;
    const yawObject = controls.getObject(); // Camera wrapper
    const pitchObject = yawObject.children[0]; // Camera itself (usually)

    // PointerLockControls 구조상 yawObject.rotation.y, camera.rotation.x를 직접 제어해야 함
    // 하지만 PointerLockControls는 내부적으로 mousemove를 사용하므로,
    // 모바일에서는 직접 rotation을 수정합니다.

    yawObject.rotation.y -= movementX * sensitivity;
    // Pitch 제한 (-90 ~ 90도)
    // PointerLockControls 내부 구조를 직접 건드리는 대신,
    // 모바일에서는 controls 객체의 rotation을 직접 수정하는 것이 안전함
    // (단, PointerLockControls가 활성화되지 않았을 때)

    // Three.js PointerLockControls 구현을 보면 camera.rotation.x를 직접 제어함
    // 여기서는 간단히 camera.rotation.x를 수정
    camera.rotation.x -= movementY * sensitivity;
    camera.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, camera.rotation.x),
    );

    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
  }
});

// 7. 게임 설정 및 상태
const enemyTypes = {
  grunt: {
    name: "grunt",
    size: 2,
    color: 0x556b2f, // 썩은 녹색
    speed: 7.5,
    health: 5, // 체력 5
    damage: 20, // 데미지 20
    score: 10,
  },
  tank: {
    name: "tank",
    size: 4,
    color: 0x2f4f4f, // 어두운 회색
    speed: 3.75,
    health: 15, // 체력 15
    damage: 50, // 데미지 50
    score: 50,
  },
  runner: {
    name: "runner",
    size: 1.5,
    color: 0x8b0000, // 핏빛 빨강
    speed: 12,
    health: 3, // 체력 3
    damage: 20, // 데미지 20
    score: 20,
  },
};

const bullets = [];
const enemies = [];
let score = 0;
const scoreElement = document.getElementById("score-board");
const waveElement = document.getElementById("wave-board");
const bossHud = document.getElementById("boss-hud");
const bossNameEl = document.getElementById("boss-name");
const bossHealthBar = document.getElementById("boss-health-bar");

let currentWave = 0;
let activeBoss = null; // 현재 보스 객체

let enemiesRemainingInWave = 0; // 누락된 변수 추가
let waveCooldown = 0; // 누락된 변수 추가
const WAVE_COOLDOWN_TIME = 5; // 누락된 상수 추가
let playerHealth = 100; // 플레이어 체력 100으로 변경
let playerStamina = 100; // 스테미나 추가
const maxHealth = 100;
const maxStamina = 100;
let isExhausted = false; // 탈진 상태
let lastDamageTime = 0; // 무적 시간 체크용
let lastShotTime = 0; // 연사 속도 체크용
const items = []; // 아이템 배열
const particles = []; // 파티클 배열
let isReloading = false; // 재장전 상태 플래그
let shakeTimer = 0; // 화면 흔들림 타이머
let isPlayerDying = false; // 플레이어 사망 상태

// Boss System Initialization
const bossSystem = new BossSystem(scene, controls.getObject(), {
  showMessage: showMessage,
  damagePlayer: (amount, knockback) => {
    playerHealth -= amount;
    updateStatusBars();
    if (knockback) velocity.add(knockback);
  },
  shakeCamera: (duration) => {
    shakeTimer = duration;
  },
  createBloodParticles: createBloodParticles,
  spawnMinion: (type) => spawnEnemy(type),
  setFog: (near, far) => {
    scene.fog.near = near;
    scene.fog.far = far;
  },
});

// 무기 교체 함수
function switchWeapon(name) {
  weaponState.current = name;
  if (name === "rifle") {
    rifle.visible = true;
    pistol.visible = false;
    weapon1Slot.classList.add("active");
    weapon2Slot.classList.remove("active");
  } else {
    rifle.visible = false;
    pistol.visible = true;
    weapon1Slot.classList.remove("active");
    weapon2Slot.classList.add("active");
  }
  updateAmmoDisplay();
}

// 탄약 UI 업데이트
function updateAmmoDisplay() {
  if (weaponState.current === "rifle") {
    ammoElement.textContent = `Rifle: ${weaponState.rifle.mag} / ${weaponState.rifle.reserve}`;
    ammoElement.style.color = "#ffff00";
  } else {
    ammoElement.textContent = `Pistol: ∞`;
    ammoElement.style.color = "#ffffff";
  }
}

// 좀비 텍스처 생성 함수 (캔버스에 직접 그리기)
function createZombieTexture(colorStr) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  // 피부색
  ctx.fillStyle = colorStr;
  ctx.fillRect(0, 0, 64, 64);

  // 눈 (빨간색)
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(10, 20, 15, 10);
  ctx.fillRect(39, 20, 15, 10);

  // 입 (검은색)
  ctx.fillStyle = "#1a0f0f";
  ctx.fillRect(15, 45, 34, 10);

  // 이빨 (흰색)
  ctx.fillStyle = "#eeeeee";
  ctx.fillRect(20, 45, 5, 5);
  ctx.fillRect(39, 45, 5, 5);

  return new THREE.CanvasTexture(canvas);
}

// 피 파티클 생성 함수
function createBloodParticles(pos) {
  const particleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const particleMat = new THREE.MeshBasicMaterial({ color: 0x8a0303 }); // 진한 피색

  for (let i = 0; i < 8; i++) {
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.position.copy(pos);

    particle.userData = {
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
      ),
      life: 1.0, // 1초 생존
    };
    scene.add(particle);
    particles.push(particle);
  }
}

const zombieTextures = {
  grunt: createZombieTexture("#556b2f"),
  tank: createZombieTexture("#2f4f4f"),
  runner: createZombieTexture("#8b0000"),
};

// 총알 발사 함수
function shoot() {
  if (isReloading) return; // 재장전 중 발사 불가

  const currentW = weaponState[weaponState.current];
  const now = performance.now() / 1000; // 초 단위 시간

  // 연사 속도 체크
  if (now - lastShotTime < currentW.fireRate) return;

  // 탄약 체크 및 처리 (소총인 경우)
  if (weaponState.current === "rifle") {
    if (currentW.mag <= 0) {
      // 탄창이 비었을 때
      if (currentW.reserve > 0) {
        reload(); // 재장전 함수 호출
        return;
      } else {
        // 예비 탄약도 없으면 권총으로 전환
        switchWeapon("pistol");
        showMessage("탄약 소진! 권총 전환");
        return;
      }
    }
    currentW.mag--;
  }

  lastShotTime = now;
  updateAmmoDisplay();

  const bulletGeometry = new THREE.SphereGeometry(0.2, 8, 8);
  const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

  // 총구 위치에서 발사
  const muzzlePos = new THREE.Vector3();
  if (weaponState.current === "rifle") {
    rifleMuzzle.getWorldPosition(muzzlePos);
  } else {
    pistolMuzzle.getWorldPosition(muzzlePos);
  }
  bullet.position.copy(muzzlePos);

  // 발사 방향: 카메라가 바라보는 지점(크로스헤어)을 향해
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  const target = new THREE.Vector3();
  raycaster.ray.at(100, target); // 100미터 앞을 조준

  const direction = new THREE.Vector3();
  direction.subVectors(target, muzzlePos).normalize();

  bullet.userData = { velocity: direction.multiplyScalar(currentW.speed) };

  scene.add(bullet);
  bullets.push(bullet);

  // 2초 후 제거
  setTimeout(() => {
    scene.remove(bullet);
    const index = bullets.indexOf(bullet);
    if (index > -1) bullets.splice(index, 1);
  }, 2000);
}

// 재장전 함수
function reload() {
  if (isReloading) return;
  const currentW = weaponState[weaponState.current];
  isReloading = true;
  showMessage("재장전 중...");

  setTimeout(() => {
    const reloadAmount = Math.min(currentW.maxMag, currentW.reserve);
    currentW.mag = reloadAmount;
    currentW.reserve -= reloadAmount;
    isReloading = false;
    updateAmmoDisplay();
    showMessage("재장전 완료!");
  }, currentW.reloadTime);
}

function spawnEnemy(enemyTypeName) {
  enemiesRemainingInWave--; // 적 생성 시 카운트 감소
  // if (!controls.isLocked) return; // 일시정지여도 생성은 하되 움직이지 않게 함 (웨이브 꼬임 방지)

  const type = enemyTypes[enemyTypeName];
  if (!type) {
    console.error(`알 수 없는 적 타입: ${enemyTypeName}`);
    return;
  }

  // 좀비 그룹 생성
  const zombie = new THREE.Group();
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: type.color });
  const headMaterial = new THREE.MeshLambertMaterial({
    map: zombieTextures[type.name],
  });

  let body, head, leftArm, rightArm, leftLeg, rightLeg;

  if (type.name === "tank") {
    // 뚱뚱한 좀비 (Tank) - 거대하고 육중함
    body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.8), bodyMaterial);
    body.position.y = 1.4;
    zombie.add(body);

    head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMaterial);
    head.position.y = 2.35;
    zombie.add(head);

    const armGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
    armGeo.translate(0, -0.5, 0); // 피벗 상단
    leftArm = new THREE.Mesh(armGeo, bodyMaterial);
    leftArm.position.set(-0.9, 2.0, 0);
    zombie.add(leftArm);
    rightArm = new THREE.Mesh(armGeo, bodyMaterial);
    rightArm.position.set(0.9, 2.0, 0);
    zombie.add(rightArm);

    const legGeo = new THREE.BoxGeometry(0.5, 1.0, 0.5);
    legGeo.translate(0, -0.5, 0);
    leftLeg = new THREE.Mesh(legGeo, bodyMaterial);
    leftLeg.position.set(-0.4, 1.0, 0);
    zombie.add(leftLeg);
    rightLeg = new THREE.Mesh(legGeo, bodyMaterial);
    rightLeg.position.set(0.4, 1.0, 0);
    zombie.add(rightLeg);
  } else if (type.name === "runner") {
    // 뛰는 좀비 (Runner) - 마르고 날렵함
    body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.25), bodyMaterial);
    body.position.y = 1.0;
    zombie.add(body);

    head = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      headMaterial,
    );
    head.position.y = 1.55;
    zombie.add(head);

    const armGeo = new THREE.BoxGeometry(0.15, 0.8, 0.15);
    armGeo.translate(0, -0.3, 0);
    leftArm = new THREE.Mesh(armGeo, bodyMaterial);
    leftArm.position.set(-0.4, 1.35, 0);
    zombie.add(leftArm);
    rightArm = new THREE.Mesh(armGeo, bodyMaterial);
    rightArm.position.set(0.4, 1.35, 0);
    zombie.add(rightArm);

    const legGeo = new THREE.BoxGeometry(0.2, 0.9, 0.2);
    legGeo.translate(0, -0.45, 0);
    leftLeg = new THREE.Mesh(legGeo, bodyMaterial);
    leftLeg.position.set(-0.15, 0.9, 0);
    zombie.add(leftLeg);
    rightLeg = new THREE.Mesh(legGeo, bodyMaterial);
    rightLeg.position.set(0.15, 0.9, 0);
    zombie.add(rightLeg);
  } else {
    // 일반 좀비 (Grunt)
    body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.3), bodyMaterial);
    body.position.y = 0.9;
    zombie.add(body);

    head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), headMaterial);
    head.position.y = 1.55;
    zombie.add(head);

    const armGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    armGeo.translate(0, -0.3, 0);
    leftArm = new THREE.Mesh(armGeo, bodyMaterial);
    leftArm.position.set(-0.5, 1.3, 0);
    zombie.add(leftArm);
    rightArm = new THREE.Mesh(armGeo, bodyMaterial);
    rightArm.position.set(0.5, 1.3, 0);
    zombie.add(rightArm);

    const legGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25);
    legGeo.translate(0, -0.45, 0);
    leftLeg = new THREE.Mesh(legGeo, bodyMaterial);
    leftLeg.position.set(-0.2, 0.9, 0); // 다리 위치 수정 (바닥에 닿게)
    zombie.add(leftLeg);
    rightLeg = new THREE.Mesh(legGeo, bodyMaterial);
    rightLeg.position.set(0.2, 0.9, 0); // 다리 위치 수정
    zombie.add(rightLeg);
  }

  // 플레이어 주변 랜덤 위치 생성
  const angle = Math.random() * Math.PI * 2;
  const radius = 40 + Math.random() * 30; // 조금 더 멀리서 생성
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  zombie.position.set(
    controls.getObject().position.x + x,
    -0.5, // [위치 조절] 좀비 Y축 높이 (기존 -1.0에서 -0.5로 상향)
    controls.getObject().position.z + z,
  );

  // 좀비 크기 확대 (플레이어 키 3.0에 맞춰 2배 확대)
  zombie.scale.set(2.0, 2.0, 2.0);

  // 적 데이터 저장
  zombie.userData = {
    type: type.name,
    health: type.health,
    speed: type.speed,
    score: type.score,
    knockback: new THREE.Vector3(), // 넉백 벡터 초기화 (오류 해결)
    headY: (type.name === "tank" ? 2.35 : 1.55) * 2.0, // 헤드샷 판정용 머리 높이 (스케일 2.0 적용)
    limbs: { leftArm, rightArm, leftLeg, rightLeg },
    animOffset: Math.random() * 100, // 애니메이션 오프셋
  };

  scene.add(zombie);
  enemies.push(zombie);
}

// 아이템 생성 함수
function spawnItem(position) {
  const rand = Math.random();
  let type = "health";
  let color = 0xff0000;

  if (rand < 0.33) {
    type = "health";
    color = 0xff0000; // 빨강 (체력)
  } else if (rand < 0.66) {
    type = "speed";
    color = 0x0000ff; // 파랑 (속도)
  } else {
    type = "ammo";
    color = 0xffff00; // 노랑 (탄약)
  }

  const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const material = new THREE.MeshBasicMaterial({ color: color });
  const item = new THREE.Mesh(geometry, material);

  item.position.copy(position);
  item.position.y = 1; // 바닥 위에 띄움
  item.userData = { type: type };

  scene.add(item);
  items.push(item);
}

// 보스 생성 함수
function spawnBoss(wave) {
  const boss = bossSystem.spawnBoss(wave);
  enemies.push(boss);
  activeBoss = boss;

  // UI 표시
  bossHud.classList.remove("hidden");
  bossNameEl.textContent = boss.userData.name;
  bossHealthBar.style.width = "100%";

  // 보스 등장 연출
  playSiren();
  shakeTimer = 2.0; // 2초간 화면 흔들림
  showMessage(
    boss.userData.isFinalBoss
      ? "⚠ FINAL BOSS APPROACHING ⚠"
      : "WARNING: EXPERIMENT SUBJECT DETECTED!",
    200,
  );
}

// 웨이브 시작 함수
function startNextWave() {
  currentWave++;

  waveElement.textContent = `Wave: ${currentWave}`;
  showMessage(`Wave ${currentWave} 시작!`);

  // 웨이브에 맞춰 맵 크기 조절
  updateMapSize(currentWave);

  enemiesRemainingInWave = 0;

  // 10웨이브마다 보스전
  if (currentWave % 10 === 0) {
    enemiesRemainingInWave = 0; // 보스는 즉시 생성되므로 대기 카운트 0
    spawnBoss(currentWave);
  } else {
    playBGM("normal"); // 일반 웨이브 BGM 재생
    // 일반 웨이브
    const totalZombies = 5 + Math.floor(currentWave * 2); // 웨이브당 2마리씩 증가

    // 좀비 타입 분포 결정
    const waveData = { grunt: 0, runner: 0, tank: 0 };

    for (let i = 0; i < totalZombies; i++) {
      const rand = Math.random();
      // 웨이브가 높을수록 강력한 좀비 확률 증가
      if (currentWave > 4 && rand < 0.15) waveData.tank++;
      else if (currentWave > 2 && rand < 0.4) waveData.runner++;
      else waveData.grunt++;
    }

    let spawnDelay = 1000; // 1초 후 첫 스폰 시작
    for (const enemyType in waveData) {
      const count = waveData[enemyType];
      enemiesRemainingInWave += count;
      for (let i = 0; i < count; i++) {
        setTimeout(() => spawnEnemy(enemyType), spawnDelay);
        spawnDelay += 500 + Math.random() * 500; // 스폰 간격 랜덤화
      }
    }
  }

  waveCooldown = 0;
}

// 게임 리셋 함수
function resetGame(initialWave = 0) {
  score = 0;
  scoreElement.textContent = `Score: ${score}`;
  enemies.forEach((en) => scene.remove(en));
  enemies.length = 0;
  items.forEach((i) => scene.remove(i));
  items.length = 0;
  controls.getObject().position.set(0, 2.0, 0); // 높이 수정 (2m)
  velocity.set(0, 0, 0);
  currentWave = initialWave;
  enemiesRemainingInWave = 0;
  playerHealth = 100; // 체력 리셋
  playerStamina = 100; // 스테미나 리셋
  isExhausted = false; // 탈진 상태 초기화
  isPlayerDying = false; // 사망 상태 초기화
  camera.rotation.z = 0; // 카메라 기울기 초기화
  isReloading = false; // 재장전 상태 초기화
  activeBoss = null;
  shakeTimer = 0;
  bossSystem.clear(); // Clear boss projectiles/particles
  bossHud.classList.add("hidden");
  playBGM("normal"); // 리셋 시 일반 BGM

  // 탄약 리셋
  weaponState.rifle.mag = 60;
  weaponState.rifle.reserve = 240;
  switchWeapon("rifle"); // 소총으로 시작
  updateAmmoDisplay();

  startNextWave(); // 게임 리셋 후 바로 첫 웨이브 시작
}

// 타이틀 화면으로 복귀 함수
function returnToTitle() {
  gameStarted = false;
  document.exitPointerLock();

  // 게임 오브젝트 제거
  enemies.forEach((en) => scene.remove(en));
  enemies.length = 0;
  items.forEach((i) => scene.remove(i));
  items.length = 0;
  particles.forEach((p) => scene.remove(p));
  particles.length = 0;
  bossSystem.clear();

  // 플레이어 상태 초기화
  controls.getObject().position.set(0, 2.0, 0);
  velocity.set(0, 0, 0);
  currentWave = 0;
  enemiesRemainingInWave = 0;
  playerHealth = 100;
  playerStamina = 100;
  isExhausted = false;
  isPlayerDying = false;
  camera.rotation.z = 0;
  isReloading = false;
  activeBoss = null;
  shakeTimer = 0;
  bossHud.classList.add("hidden");

  // 무기 초기화
  weaponState.rifle.mag = 60;
  weaponState.rifle.reserve = 240;
  switchWeapon("rifle");

  stopBGM();
  document.getElementById("start-screen").classList.remove("hidden");
  if (pauseMenu) pauseMenu.classList.add("hidden");
}

// 게임 메시지 표시 함수
const messageEl = document.getElementById("game-message");
let messageTimeout;
function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.add("show");
  if (messageTimeout) clearTimeout(messageTimeout);
  messageTimeout = setTimeout(() => {
    messageEl.classList.remove("show");
  }, 2000);
}

// 상태바 업데이트 함수
function updateStatusBars() {
  healthBar.style.width = `${(playerHealth / maxHealth) * 100}%`;
  staminaBar.style.width = `${(playerStamina / maxStamina) * 100}%`;
}

// 8. 게임 루프
let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  if (controls.isLocked || (isMobileMode && gameStarted)) {
    // 웨이브 클리어 체크 (모든 적 처치 및 스폰 완료 시)
    if (enemies.length === 0 && enemiesRemainingInWave <= 0 && gameStarted) {
      waveCooldown += delta;
      if (waveCooldown >= WAVE_COOLDOWN_TIME) {
        startNextWave();
      }
    }

    // 연사 처리 (자동 무기만 animate 루프에서 발사)
    const currentW = weaponState[weaponState.current];
    if (isFiring && currentW.automatic && !isPlayerDying) {
      shoot();
    }

    // 스테미나 및 이동 속도 계산
    let currentSpeed = 200.0; // 기본 걷기 속도 (느리게)
    const isMoving =
      moveState.forward ||
      moveState.backward ||
      moveState.left ||
      moveState.right;

    // 탈진 상태 회복 체크 (10% 이상 차야 달리기 가능)
    if (isExhausted && playerStamina > maxStamina * 0.1) {
      isExhausted = false;
    }

    if (
      moveState.sprint &&
      !isExhausted &&
      playerStamina > 0 &&
      isMoving &&
      !isPlayerDying
    ) {
      currentSpeed = 400.0; // 달리기 속도 (기존 속도)
      playerStamina = Math.max(0, playerStamina - 30 * delta); // 스테미나 소모
      if (playerStamina <= 0) {
        isExhausted = true; // 스테미나 고갈 시 탈진 상태 진입
      }
    } else {
      playerStamina = Math.min(maxStamina, playerStamina + 10 * delta); // 스테미나 회복
    }

    updateStatusBars();

    // 화면 흔들림 효과
    if (shakeTimer > 0) {
      shakeTimer -= delta;
      const intensity = 0.3;
      camera.position.add(
        new THREE.Vector3(
          (Math.random() - 0.5) * intensity,
          (Math.random() - 0.5) * intensity,
          (Math.random() - 0.5) * intensity,
        ),
      );
    }

    // 파티클 업데이트
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.userData.life -= delta;
      p.position.add(p.userData.velocity.clone().multiplyScalar(delta));
      p.userData.velocity.y -= 9.8 * delta; // 중력 적용

      if (p.userData.life <= 0 || p.position.y < 0) {
        scene.remove(p);
        particles.splice(i, 1);
      }
    }

    const playerPos = controls.getObject().position;

    // Update Boss System (Projectiles, Particles, Boss AI)
    bossSystem.update(delta, time, enemies);

    // 이동 처리
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= 50.0 * delta; // 중력 적용 (마찰력 없이 일정하게)

    if (isMobileMode) {
      // 모바일: 조이스틱 입력 사용
      direction.z = joystickVector.y; // Forward/Back is Y on joystick
      direction.x = joystickVector.x; // Left/Right is X
    } else {
      direction.z = Number(moveState.forward) - Number(moveState.backward);
      direction.x = Number(moveState.right) - Number(moveState.left);
    }

    // 사망 시 이동 불가
    if (!isPlayerDying) {
      direction.normalize();

      if (moveState.forward || moveState.backward)
        velocity.z -= direction.z * currentSpeed * delta;
      if (moveState.left || moveState.right)
        velocity.x -= direction.x * currentSpeed * delta;

      if (isMobileMode && (joystickVector.x !== 0 || joystickVector.y !== 0)) {
        velocity.z -= direction.z * currentSpeed * delta;
        velocity.x -= direction.x * currentSpeed * delta;
      }
    }

    // 충돌 처리를 위해 이동 전 위치 저장
    const originalPos = controls.getObject().position.clone();

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    // 벽 충돌 감지 (충돌 시 이동 취소)
    if (checkCollision()) {
      controls.getObject().position.x = originalPos.x;
      controls.getObject().position.z = originalPos.z;
    }

    // 수직 이동 (점프/낙하)
    controls.getObject().position.y += velocity.y * delta;

    // 바닥 충돌 감지
    if (!isPlayerDying && controls.getObject().position.y < 2.0) {
      velocity.y = 0;
      controls.getObject().position.y = 2.0;
      canJump = true;
    }

    // 아이템 획득 처리
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      item.rotation.y += delta * 2; // 아이템 회전 효과

      // 아이템 획득 범위 확대 및 높이 무시 (XZ 평면 거리 계산)
      const distXZ = Math.sqrt(
        Math.pow(item.position.x - playerPos.x, 2) +
          Math.pow(item.position.z - playerPos.z, 2),
      );

      if (distXZ < 3) {
        // 범위 3으로 확대
        if (item.userData.type === "health") {
          if (playerHealth < maxHealth) {
            playerHealth = Math.min(maxHealth, playerHealth + 20); // 체력 20 회복
            showMessage("체력 회복!");
          } else {
            showMessage("체력이 가득 찼습니다.");
          }
        } else if (item.userData.type === "speed") {
          playerStamina = maxStamina; // 스테미나 100 회복
          showMessage("스테미나 완전 회복!");
        } else if (item.userData.type === "ammo") {
          weaponState.rifle.reserve += 60; // 탄약 60발 추가
          updateAmmoDisplay();
          showMessage("탄약 획득!");
        }

        scene.remove(item);
        items.splice(i, 1);
      }
    }

    // 총알 이동 및 충돌 처리
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const moveStep = b.userData.velocity.clone().multiplyScalar(delta);
      b.position.add(moveStep);

      // 적과의 충돌 검사
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const enemyType = e.userData.isBoss
          ? e.userData
          : enemyTypes[e.userData.type];
        const dist = b.position.distanceTo(e.position);

        // 충돌 판정: 좀비의 중심(허리 높이)을 기준으로 거리 계산
        // 좀비 스케일(2.0)을 고려하여 히트박스 중심과 크기 재조정
        const scaledSize = enemyType.size * 2.0;
        const enemyCenter = e.position
          .clone()
          .add(new THREE.Vector3(0, scaledSize / 2, 0));
        const distToCenter = b.position.distanceTo(enemyCenter);
        const hitBox = scaledSize / 2 + 0.5;

        if (distToCenter < hitBox) {
          // 총알 제거
          scene.remove(b);
          bullets.splice(i, 1);

          // 데미지 계산 (헤드샷 판정)
          let damage = weaponState[weaponState.current].damage;
          const bulletHeight = b.position.y - e.position.y; // 좀비 발바닥 기준 총알 높이

          // 머리 높이 근처(±0.6)에 맞으면 헤드샷
          if (Math.abs(bulletHeight - e.userData.headY) < 0.6) {
            damage *= 2;
            createBloodParticles(b.position); // 피 파티클 생성
            // showMessage("HEADSHOT!", 500); // 알림 제거
          }

          e.userData.health -= damage;

          // 보스 체력바 업데이트
          if (e.userData.isBoss) {
            bossHealthBar.style.width = `${(e.userData.health / e.userData.maxHealth) * 100}%`;
          }

          if (e.userData.health <= 0) {
            // 사망 처리 (즉시 제거하지 않고 상태 변경)
            if (!e.userData.isDying) {
              e.userData.isDying = true;

              // 점수 및 아이템 처리는 사망 순간 1회만 실행
              score += enemyType.score;
              scoreElement.textContent = `Score: ${score}`;

              if (Math.random() < 0.3) {
                spawnItem(e.position);
              }

              // 보스 사망 시 UI 숨김
              if (e.userData.isBoss) {
                activeBoss = null;
                bossHud.classList.add("hidden");

                if (e.userData.isFinalBoss) {
                  setTimeout(showEndingCredits, 3000); // 3초 후 엔딩
                }
              }
            }
          } else {
            // 넉백 효과 적용 (총알 진행 방향으로 밀어냄)
            const knockbackDir = b.userData.velocity.clone().normalize();
            e.userData.knockback.add(knockbackDir.multiplyScalar(15)); // 넉백 강도 15
          }
          break; // 총알 하나당 적 하나만
        }
      }
    }

    // 적 이동 (플레이어 추적)
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      // 사망 애니메이션 (뒤로 넘어짐)
      if (e.userData.isDying) {
        e.rotation.x -= 4.0 * delta; // 뒤로 회전
        if (e.rotation.x < -Math.PI / 2) {
          // 90도 넘어가면 제거
          scene.remove(e);
          enemies.splice(i, 1);
        }
        continue; // 이동 로직 건너뜀
      }

      const enemyType = e.userData.isBoss
        ? e.userData
        : enemyTypes[e.userData.type];
      const dir = new THREE.Vector3().subVectors(playerPos, e.position);
      dir.y = 0; // Y축 방향 제거 (수평 이동만)
      dir.normalize();

      // 이동 + 넉백 적용
      const moveStep = dir.multiplyScalar(e.userData.speed * delta);
      const knockbackStep = e.userData.knockback.clone().multiplyScalar(delta);
      knockbackStep.y = 0; // 넉백 Y축 제거
      e.position.add(moveStep).add(knockbackStep);

      // Boss position is handled by BossSystem.update, but we need to ensure normal zombies stay on ground
      if (!e.userData.isBoss) {
        e.position.y = -0.5;
      }

      e.userData.knockback.multiplyScalar(0.9); // 넉백 감쇠 (마찰력)

      // [수정] 좀비가 플레이어를 바라볼 때 수평으로만 회전 (눕는 현상 방지)
      e.lookAt(playerPos.x, e.position.y, playerPos.z);

      // 좀비 애니메이션 (팔다리 흔들기)
      if (e.userData.limbs) {
        const { leftArm, rightArm, leftLeg, rightLeg } = e.userData.limbs;
        const distToPlayer = e.position.distanceTo(playerPos);

        // 공격 모션 (가까울 때)
        if (distToPlayer < 3.0) {
          leftArm.rotation.x = -Math.PI / 2 + Math.sin(time * 15) * 0.5; // 팔을 위아래로 휘두름
          rightArm.rotation.x = -Math.PI / 2 - Math.sin(time * 15) * 0.5;
        } else if (e.userData.type === "runner") {
          // 러너: 달리기 모션 (빠르고 역동적)
          const runSpeed = 18;
          const runAngle =
            Math.sin(time * runSpeed + e.userData.animOffset) * 1.0;

          // 몸을 앞으로 기울임
          e.rotateX(0.4);

          // 다리: 빠르게 교차
          leftLeg.rotation.x = runAngle;
          rightLeg.rotation.x = -runAngle;

          // 팔: 달리기 자세 (옆에서 흔들기)
          leftArm.rotation.x = -runAngle;
          rightArm.rotation.x = runAngle;
        } else {
          // 일반/탱커: 좀비 걷기 (팔을 앞으로 뻗음)
          const walkSpeed = e.userData.type === "tank" ? 4 : 8;
          const walkAmp = 0.3;
          const walkAngle =
            Math.sin(time * walkSpeed + e.userData.animOffset) * walkAmp;

          // 다리: 걷기
          leftLeg.rotation.x = walkAngle;
          rightLeg.rotation.x = -walkAngle;

          // 팔: 앞으로 나란히 (-1.4 rad) + 약간의 흔들림
          const armBase = -1.4;
          leftArm.rotation.x = armBase + walkAngle * 0.5;
          rightArm.rotation.x = armBase - walkAngle * 0.5;

          // 탱커는 팔을 약간 벌림
          if (e.userData.type === "tank") {
            leftArm.rotation.z = 0.2;
            rightArm.rotation.z = -0.2;
          }
        }
      }

      // 플레이어와 충돌 시 게임 오버
      // 수평 거리(XZ)만 체크하여 판정 정확도 향상
      const distSq =
        (e.position.x - playerPos.x) ** 2 + (e.position.z - playerPos.z) ** 2;
      const hitRadius = enemyType.size / 2 + 0.5;

      if (distSq < hitRadius * hitRadius) {
        // 플레이어 피격 처리 (1초 무적 시간)
        if (time - lastDamageTime > 1000) {
          const damage = e.userData.isBoss ? 30 : enemyType.damage; // 보스 데미지 30
          playerHealth -= damage;
          lastDamageTime = time;

          // 플레이어 넉백 (경직 및 약한 밀림)
          const pushDir = new THREE.Vector3().subVectors(playerPos, e.position);
          pushDir.y = 0; // 위로 뜨지 않게 Y축 제거
          pushDir.normalize();

          // 기존 속도 초기화 (경직) 후 약한 넉백 적용
          velocity.set(0, 0, 0);
          velocity.add(pushDir.multiplyScalar(10));

          if (playerHealth <= 0) {
            if (!isPlayerDying) {
              isPlayerDying = true;
              showMessage("사망했습니다...");
              setTimeout(showGameOverScreen, 3000); // 3초 후 게임 오버 화면
            }
          } else {
            showMessage(`피가 ${playerHealth} 남았습니다!`);
          }
        }
      }
    }
  }

  // 사망 애니메이션 (카메라 쓰러짐)
  if (isPlayerDying) {
    // 바닥으로 쓰러짐 (높이 0.5까지)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.5, delta * 3);
    // 고개 꺾임 (Z축 회전)
    camera.rotation.z = THREE.MathUtils.lerp(
      camera.rotation.z,
      -Math.PI / 4,
      delta * 2,
    );
    // 시선 아래로 (X축 회전)
    camera.rotation.x = THREE.MathUtils.lerp(
      camera.rotation.x,
      -Math.PI / 6,
      delta * 2,
    );
  }

  prevTime = time;
  renderer.render(scene, camera);
}

function checkCollision() {
  const playerPos = controls.getObject().position;
  const playerRadius = 1.5; // 플레이어 충돌 범위

  for (const box of obstacleBoxes) {
    // 플레이어의 X, Z 좌표가 박스 내부에 있는지 확인 (Y축은 단순화를 위해 무시하거나 필요시 추가)
    // 여기서는 간단히 벽에 부딪히는 것만 처리 (점프해서 올라가는 것은 제외)
    if (
      playerPos.x > box.min.x - playerRadius &&
      playerPos.x < box.max.x + playerRadius &&
      playerPos.z > box.min.z - playerRadius &&
      playerPos.z < box.max.z + playerRadius
    ) {
      return true;
    }
  }

  // 벽 충돌 감지 추가
  for (const box of wallBoxes) {
    if (
      playerPos.x > box.min.x - playerRadius &&
      playerPos.x < box.max.x + playerRadius &&
      playerPos.z > box.min.z - playerRadius &&
      playerPos.z < box.max.z + playerRadius
    ) {
      return true;
    }
  }

  return false;
}

animate();

// 화면 크기 변경 대응
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 마우스 클릭 시 단발 무기 발사 처리
document.addEventListener("mousedown", () => {
  if ((controls.isLocked || isMobileMode) && gameStarted && !isPlayerDying) {
    isFiring = true;
    if (!weaponState[weaponState.current].automatic) {
      shoot();
    }
  }
});

// 엔딩 크레딧 표시 함수
function showEndingCredits() {
  document.exitPointerLock(); // 마우스 잠금 해제
  playBGM("ending"); // 엔딩 BGM 재생
  const endingScreen = document.getElementById("ending-screen");
  if (endingScreen) endingScreen.classList.remove("hidden");
  gameStarted = false;
}

document.getElementById("btn-ending-home")?.addEventListener("click", () => {
  window.location.href = "../../index.html";
});

// 게임 오버 화면 표시 함수
function showGameOverScreen() {
  gameStarted = false;
  document.exitPointerLock();
  stopBGM();

  const screen = document.getElementById("game-over-screen");
  const waveEl = document.getElementById("final-wave");
  const scoreEl = document.getElementById("final-score");

  if (waveEl) waveEl.textContent = currentWave;
  if (scoreEl) scoreEl.textContent = score;

  if (screen) screen.classList.remove("hidden");
}

document.getElementById("btn-return-title")?.addEventListener("click", () => {
  document.getElementById("game-over-screen").classList.add("hidden");
  returnToTitle();
});

// 일시정지 메뉴 버튼 이벤트
document.getElementById("btn-pause-resume")?.addEventListener("click", () => {
  document.getElementById("pause-menu").classList.add("hidden");
  if (isMobileMode) gameStarted = true;
  else controls.lock();
});

document.getElementById("btn-pause-restart")?.addEventListener("click", () => {
  document.getElementById("pause-menu").classList.add("hidden");
  resetGame();
  if (!isMobileMode) controls.lock();
});

document.getElementById("btn-pause-menu")?.addEventListener("click", () => {
  document.getElementById("pause-menu").classList.add("hidden");
  returnToTitle();
});
