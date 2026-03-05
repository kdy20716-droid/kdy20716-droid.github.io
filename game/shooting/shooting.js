import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

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
const ambientLight = new THREE.AmbientLight(0x333333);
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
const instructions = document.getElementById("instructions");

let gameStarted = false;
let isFiring = false; // 발사 상태 플래그

document.addEventListener("click", () => {
  if (!controls.isLocked) {
    controls.lock();
  }
});

document.addEventListener("mousedown", () => {
  if (controls.isLocked && gameStarted) isFiring = true;
});

document.addEventListener("mouseup", () => {
  isFiring = false;
});

controls.addEventListener("lock", () => {
  instructions.style.display = "none";
  if (!gameStarted) {
    gameStarted = true;
    resetGame();
  }
});

controls.addEventListener("unlock", () => {
  instructions.style.display = "block";
  if (gameStarted) {
    const h1 = instructions.querySelector("h1");
    if (h1) h1.textContent = "Click to Resume";
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
    case "Digit1":
      switchWeapon("rifle");
      break;
    case "Digit2":
      switchWeapon("pistol");
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
const vaccines = [];
let score = 0;
const scoreElement = document.getElementById("score-board");
const roundElement = document.getElementById("round-board");
const vaccineElement = document.getElementById("vaccine-board");

let currentRound = 0;
let vaccinesCollected = 0;
const VACCINES_TO_WIN = 3;
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
let isReloading = false; // 재장전 상태 플래그

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

// 적 생성 함수
function spawnEnemy(enemyTypeName) {
  if (!controls.isLocked) return; // 게임 중이 아니면 생성 안 함

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

// 백신 생성 함수 (누락된 함수 추가)
function spawnVaccines() {
  // 기존 백신 제거
  vaccines.forEach((v) => scene.remove(v));
  vaccines.length = 0;

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ffff }); // 청록색 빛나는 상자
  const mapRadius = getMapRadius(currentRound); // 현재 맵 크기 가져오기

  for (let i = 0; i < VACCINES_TO_WIN; i++) {
    const vaccine = new THREE.Mesh(geometry, material);

    // 맵 내부 랜덤 배치 (벽 안쪽에 생성되도록 보장)
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * (mapRadius - 20); // 벽보다 20만큼 안쪽
    vaccine.position.set(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);

    // 백신 위치 표시용 빛
    const light = new THREE.PointLight(0x00ffff, 1, 20);
    vaccine.add(light);

    scene.add(vaccine);
    vaccines.push(vaccine);
  }
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

// 웨이브 시작 함수
function startNextWave() {
  currentRound++;

  roundElement.textContent = `Round: ${currentRound}`;
  showMessage(`Round ${currentRound} 시작!`);

  // 웨이브에 맞춰 맵 크기 조절
  updateMapSize(currentRound);

  // 백신 초기화 및 생성
  vaccinesCollected = 0;
  vaccineElement.textContent = `Vaccines: 0/${VACCINES_TO_WIN}`;
  spawnVaccines();

  // 라운드별 난이도 설정 (무한 라운드)
  const totalZombies = 5 + Math.floor(currentRound * 2); // 라운드당 2마리씩 증가
  enemiesRemainingInWave = 0;

  // 좀비 타입 분포 결정
  const waveData = { grunt: 0, runner: 0, tank: 0 };

  for (let i = 0; i < totalZombies; i++) {
    const rand = Math.random();
    // 라운드가 높을수록 강력한 좀비 확률 증가
    if (currentRound > 4 && rand < 0.15) waveData.tank++;
    else if (currentRound > 2 && rand < 0.4) waveData.runner++;
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
  waveCooldown = 0; // 쿨다운 초기화
}

// 게임 리셋 함수
function resetGame() {
  score = 0;
  scoreElement.textContent = `Score: ${score}`;
  enemies.forEach((en) => scene.remove(en));
  enemies.length = 0;
  vaccines.forEach((v) => scene.remove(v));
  vaccines.length = 0;
  items.forEach((i) => scene.remove(i));
  items.length = 0;
  controls.getObject().position.set(0, 2.0, 0); // 높이 수정 (2m)
  velocity.set(0, 0, 0);
  currentRound = 0;
  enemiesRemainingInWave = 0;
  playerHealth = 100; // 체력 리셋
  playerStamina = 100; // 스테미나 리셋
  isExhausted = false; // 탈진 상태 초기화
  isReloading = false; // 재장전 상태 초기화

  // 탄약 리셋
  weaponState.rifle.mag = 60;
  weaponState.rifle.reserve = 240;
  switchWeapon("rifle"); // 소총으로 시작
  updateAmmoDisplay();

  startNextWave(); // 게임 리셋 후 바로 첫 웨이브 시작
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

  if (controls.isLocked) {
    // 연사 처리 (자동 무기만 animate 루프에서 발사)
    const currentW = weaponState[weaponState.current];
    if (isFiring && currentW.automatic) {
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

    if (moveState.sprint && !isExhausted && playerStamina > 0 && isMoving) {
      currentSpeed = 400.0; // 달리기 속도 (기존 속도)
      playerStamina = Math.max(0, playerStamina - 30 * delta); // 스테미나 소모
      if (playerStamina <= 0) {
        isExhausted = true; // 스테미나 고갈 시 탈진 상태 진입
      }
    } else {
      playerStamina = Math.min(maxStamina, playerStamina + 10 * delta); // 스테미나 회복
    }

    updateStatusBars();

    // 이동 처리
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= 50.0 * delta; // 중력 적용 (마찰력 없이 일정하게)

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize();

    if (moveState.forward || moveState.backward)
      velocity.z -= direction.z * currentSpeed * delta;
    if (moveState.left || moveState.right)
      velocity.x -= direction.x * currentSpeed * delta;

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
    if (controls.getObject().position.y < 2.0) {
      velocity.y = 0;
      controls.getObject().position.y = 2.0;
      canJump = true;
    }

    // 백신 획득 처리
    const playerPos = controls.getObject().position;
    for (let i = vaccines.length - 1; i >= 0; i--) {
      const v = vaccines[i];
      v.rotation.y += delta; // 회전 효과

      if (v.position.distanceTo(playerPos) < 3) {
        scene.remove(v);
        vaccines.splice(i, 1);
        vaccinesCollected++;
        vaccineElement.textContent = `Vaccines: ${vaccinesCollected}/${VACCINES_TO_WIN}`;

        if (vaccinesCollected >= VACCINES_TO_WIN) {
          startNextWave();
        }
      }
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
        const enemyType = enemyTypes[e.userData.type];
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
            showMessage("HEADSHOT!", 500); // 짧게 헤드샷 메시지 표시
          }

          e.userData.health -= damage;

          if (e.userData.health <= 0) {
            // 적 제거
            scene.remove(e);
            enemies.splice(j, 1);

            // 점수 증가
            score += enemyType.score;
            scoreElement.textContent = `Score: ${score}`;

            // 아이템 드롭 (30% 확률)
            if (Math.random() < 0.3) {
              spawnItem(e.position);
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
      const enemyType = enemyTypes[e.userData.type];
      const dir = new THREE.Vector3().subVectors(playerPos, e.position);
      dir.y = 0; // Y축 방향 제거 (수평 이동만)
      dir.normalize();

      // 이동 + 넉백 적용
      const moveStep = dir.multiplyScalar(e.userData.speed * delta);
      const knockbackStep = e.userData.knockback.clone().multiplyScalar(delta);
      knockbackStep.y = 0; // 넉백 Y축 제거
      e.position.add(moveStep).add(knockbackStep);
      e.position.y = -0.5; // [위치 조절] 좀비 Y축 높이 고정 (위와 동일하게 맞추세요)
      e.userData.knockback.multiplyScalar(0.9); // 넉백 감쇠 (마찰력)

      // 플레이어의 몸통 높이(y=0 또는 1)를 바라보게 하여 위를 쳐다보지 않게 함
      e.lookAt(playerPos.x, 1, playerPos.z);

      // 좀비 애니메이션 (팔다리 흔들기)
      if (e.userData.limbs) {
        const { leftArm, rightArm, leftLeg, rightLeg } = e.userData.limbs;

        if (e.userData.type === "runner") {
          // 러너: 달리기 모션 (빠르고 역동적)
          const runSpeed = 18;
          const runAngle =
            Math.sin(time * runSpeed + e.userData.animOffset) * 1.0;

          // 몸을 앞으로 기울임 (lookAt 후 로컬 회전 적용)
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
        if (time - lastDamageTime > 1.0) {
          playerHealth -= enemyType.damage; // 좀비 타입별 데미지 적용
          lastDamageTime = time;

          // 플레이어 넉백 (뒤로 밀려남)
          const pushDir = new THREE.Vector3()
            .subVectors(playerPos, e.position)
            .normalize();
          velocity.add(pushDir.multiplyScalar(40));

          if (playerHealth <= 0) {
            showMessage("사망했습니다...");
            setTimeout(resetGame, 1000);
          } else {
            showMessage(`피가 ${playerHealth} 남았습니다!`);
          }
        }
      }
    }
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
  if (controls.isLocked && gameStarted) {
    isFiring = true;
    if (!weaponState[weaponState.current].automatic) {
      shoot();
    }
  }
});
