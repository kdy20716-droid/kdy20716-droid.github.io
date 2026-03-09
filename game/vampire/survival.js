import { WEAPONS, PASSIVES } from "./Ability.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 화면 크기 설정
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// 게임 상태
let gameState = "MENU"; // MENU, PLAYING, PAUSED, GAMEOVER
let lastTime = 0;
let timer = 0;

// 웨이브 시스템 추가
let currentWave = 0;
let enemiesToSpawn = 0;
let waveCooldown = 0;
const WAVE_COOLDOWN_TIME = 180; // 3초 (60fps 기준)

// 플레이어 설정
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  speed: 3,
  hp: 100,
  maxHp: 100,
  level: 1,
  exp: 0,
  nextExp: 10,
  weapons: [],
  passives: {
    speed: 0,
    area: 0,
    cooldown: 0,
    might: 0,
  },
  passiveCounts: {}, // 패시브 레벨 추적용
};

// 입력 처리 (키보드)
const keys = {};
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    if (gameState === "PLAYING") {
      pauseGame();
    } else if (gameState === "PAUSED") {
      resumeGame();
    }
  }
  keys[e.code] = true;
});
window.addEventListener("keyup", (e) => (keys[e.code] = false));

// 입력 처리 (모바일 조이스틱)
const joystickZone = document.getElementById("joystick-zone");
const joystickKnob = document.getElementById("joystick-knob");
const joystickVector = { x: 0, y: 0 };
let joystickId = null;
const maxJoystickRadius = 35; // 조이스틱 이동 반경

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
      resetJoystick();
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

  joystickKnob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;

  // 정규화된 벡터 (-1 ~ 1)
  joystickVector.x = dx / maxJoystickRadius;
  joystickVector.y = dy / maxJoystickRadius;
}

function resetJoystick() {
  joystickId = null;
  joystickKnob.style.transform = `translate(-50%, -50%)`;
  joystickVector.x = 0;
  joystickVector.y = 0;
}

// 게임 오브젝트 배열
let enemies = [];
let projectiles = [];
let exps = [];
let damageNumbers = [];
let items = []; // 아이템 배열 추가

// 적 정의
const ENEMY_TYPES = [
  { name: "서류 더미", icon: "📄", hp: 10, speed: 1.5, exp: 1, damage: 5 },
  { name: "밀린 메일", icon: "📧", hp: 5, speed: 2.5, exp: 2, damage: 3 },
  { name: "버그", icon: "🐛", hp: 25, speed: 1.0, exp: 5, damage: 10 },
  { name: "전화", icon: "📞", hp: 15, speed: 2.0, exp: 3, damage: 8 },
];

const BOSS_TYPE = {
  name: "부장님",
  icon: "👹",
  hp: 3000,
  speed: 2.5,
  exp: 1000,
  damage: 20,
  size: 60,
};

const FINAL_BOSS_TYPE = {
  name: "꼰대 과장님",
  icon: "🤬",
  hp: 50000,
  speed: 3.5,
  exp: 10000,
  damage: 50,
  size: 100,
};

// 버튼 이벤트 리스너 연결
document.getElementById("start-btn").addEventListener("click", startGame);
document
  .getElementById("restart-btn")
  .addEventListener("click", () => location.reload());
document.getElementById("resume-btn").addEventListener("click", resumeGame);
document.getElementById("mobile-pause-btn").addEventListener("click", () => {
  if (gameState === "PLAYING") pauseGame();
  else if (gameState === "PAUSED") resumeGame();
});

// 게임 방법 및 뒤로가기 버튼 리스너
const howtoBtn = document.getElementById("howto-btn");
const backBtn = document.getElementById("back-btn");
const howtoModal = document.getElementById("howto-modal");
const closeHowtoBtn = document.getElementById("close-howto-btn");

if (howtoBtn && howtoModal && closeHowtoBtn) {
  howtoBtn.addEventListener("click", () => {
    howtoModal.classList.remove("hidden");
  });
  closeHowtoBtn.addEventListener("click", () => {
    howtoModal.classList.add("hidden");
  });
}

if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.location.href = "../game-list.html";
  });
}

// 게임 시작
function startGame() {
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  document.getElementById("mobile-controls").classList.remove("hidden");
  document.getElementById("mobile-pause-btn").classList.remove("hidden");

  // 초기화
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.hp = player.maxHp;
  player.level = 1;
  player.exp = 0;
  player.nextExp = 10;
  player.weapons = [{ ...WEAPONS.stapler, level: 1 }]; // 기본 무기
  player.passiveCounts = {}; // 패시브 카운트 초기화

  enemies = [];
  projectiles = [];
  exps = [];
  items = []; // 아이템 초기화
  timer = 0;

  // 웨이브 초기화
  currentWave = 0;
  enemiesToSpawn = 0;
  waveCooldown = WAVE_COOLDOWN_TIME; // 첫 웨이브 바로 시작하도록
  gameState = "PLAYING";

  requestAnimationFrame(gameLoop);
}

// 게임 루프
function gameLoop(timestamp) {
  if (gameState !== "PLAYING") return;

  const dt = timestamp - lastTime;
  lastTime = timestamp;

  update();
  draw();

  requestAnimationFrame(gameLoop);
}

function update() {
  // 1. 플레이어 이동
  let dx = 0;
  let dy = 0;

  // 키보드 입력
  if (keys["KeyW"] || keys["ArrowUp"]) dy -= 1;
  if (keys["KeyS"] || keys["ArrowDown"]) dy += 1;
  if (keys["KeyA"] || keys["ArrowLeft"]) dx -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) dx += 1;

  // 조이스틱 입력 (키보드 입력이 없을 때만 적용하거나 합산)
  if (
    dx === 0 &&
    dy === 0 &&
    (joystickVector.x !== 0 || joystickVector.y !== 0)
  ) {
    dx = joystickVector.x;
    dy = joystickVector.y;
  }

  if (dx !== 0 || dy !== 0) {
    // 키보드 입력은 정규화 필요, 조이스틱은 이미 정규화됨
    let length = Math.sqrt(dx * dx + dy * dy);
    if (length > 1) length = 1; // 조이스틱 최대값 제한

    // 키보드 대각선 이동 시 속도 일정하게 (조이스틱은 이미 처리됨)
    if (keys["KeyW"] || keys["KeyS"] || keys["KeyA"] || keys["KeyD"]) {
      if (length > 0) {
        dx /= length;
        dy /= length;
      }
    }

    const moveSpeed = player.speed + player.passives.speed;
    player.x += dx * moveSpeed;
    player.y += dy * moveSpeed;

    // 화면 밖 제한
    player.x = Math.max(
      player.size,
      Math.min(canvas.width - player.size, player.x),
    );
    player.y = Math.max(
      player.size,
      Math.min(canvas.height - player.size, player.y),
    );
  }

  // 2. 웨이브 및 스폰 관리
  timer++;

  // 웨이브 종료 체크
  if (enemies.length === 0 && enemiesToSpawn <= 0) {
    waveCooldown++;
    if (waveCooldown >= WAVE_COOLDOWN_TIME) {
      startNextWave();
    }
  }

  // 적 스폰
  if (enemiesToSpawn > 0 && timer % 20 === 0) {
    spawnEnemy();
    enemiesToSpawn--;
  }

  // 3. 적 이동 및 충돌
  enemies.forEach((enemy, index) => {
    // 플레이어 향해 이동
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed;
    enemy.y += Math.sin(angle) * enemy.speed;

    // 플레이어와 충돌
    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < player.size + enemy.size + 5) {
      // 보호막 체크
      const shield = player.weapons.find(
        (w) => w.type === "shield" && w.active,
      );
      if (shield) {
        // 보호막이 있으면 데미지 무효화 및 보호막 해제
        shield.active = false;
        shield.timer = 0;
        showDamage(player.x, player.y, "BLOCKED!", "cyan");
        // 적을 살짝 밀어냄
        enemy.x += Math.cos(angle) * -50;
        enemy.y += Math.sin(angle) * -50;
      } else {
        player.hp -= enemy.damage * 0.05; // 프레임당 데미지라 낮게 설정
        if (player.hp <= 0) gameOver();
      }
    }
  });

  // 4. 무기 발사 및 업데이트
  player.weapons.forEach((weapon) => {
    weapon.timer++;
    const cooldown = weapon.cooldown * (1 - player.passives.cooldown);

    // 보호막 쿨타임 로직
    if (weapon.type === "shield" && !weapon.active) {
      if (weapon.timer >= weapon.cooldown) {
        weapon.active = true;
        weapon.timer = 0;
        showDamage(player.x, player.y, "Shield Ready!", "cyan");
      }
      return; // 보호막은 발사되지 않음
    }

    if (weapon.timer >= cooldown) {
      weapon.timer = 0;
      useWeapon(weapon);
    }
  });

  // 4.5. 궤도형 무기 업데이트
  player.weapons.forEach((weapon) => {
    if (weapon.type === "orbiting") {
      // 회전 의자 로직
      const count = weapon.count || 1;
      for (let i = 0; i < count; i++) {
        // 의자 개수에 따라 각도 분배
        const offset = (Math.PI * 2 * i) / count;
        const angle = (timer * weapon.rotationSpeed + offset) % (Math.PI * 2);
        const orbitX = player.x + Math.cos(angle) * weapon.area;
        const orbitY = player.y + Math.sin(angle) * weapon.area;

        handleOrbitingWeaponCollision(orbitX, orbitY, weapon);
      }
    }
  });

  // 5. 투사체 이동 및 충돌
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];

    // 모든 투사체 수명 감소 (오라 포함)
    p.duration--;
    if (p.duration <= 0) {
      projectiles.splice(i, 1);
      continue;
    }

    if (p.type === "projectile") {
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      // 화면 밖 제거
      if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
        projectiles.splice(i, 1);
        continue;
      }
    } else if (p.type === "homing_projectile") {
      // 유도탄 로직
      if (p.target && p.target.hp > 0) {
        const angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
        p.angle = angle; // 방향 계속 업데이트
      }
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
    }

    // 적과 충돌 체크
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);

      // 투사체 크기 + 적 크기
      const hitDist = (p.type === "aura" ? p.area : 10) + enemy.size;

      if (dist < hitDist) {
        // 데미지 처리
        const dmg = p.damage * (1 + player.passives.might);
        enemy.hp -= dmg;

        // 데미지 텍스트
        if (Math.random() > 0.7) showDamage(enemy.x, enemy.y, Math.floor(dmg));

        // 적 사망
        if (enemy.hp <= 0) {
          // 경험치 드롭
          exps.push({ x: enemy.x, y: enemy.y, val: enemy.exp });
          enemies.splice(j, 1);

          // 아이템 드롭 (낮은 확률)
          const dropRoll = Math.random();
          if (dropRoll < 0.02) {
            // 2% 확률로 자석
            items.push({ x: enemy.x, y: enemy.y, type: "magnet", icon: "🧲" });
          } else if (dropRoll < 0.07) {
            // 5% 확률로 HP 회복 (자석 확률 제외)
            items.push({ x: enemy.x, y: enemy.y, type: "health", icon: "❤️" });
          }

          // 보스 처치 시 승리? 혹은 계속
          if (enemy.isFinalBoss) {
            gameClear();
          } else if (enemy.isBoss) {
            showDamage(enemy.x, enemy.y, "BOSS DOWN!", "gold");
            document.getElementById("boss-warning").style.display = "none";
          }
        }

        // 투사체 관통 여부 (오라는 관통)
        if (p.type === "projectile") {
          projectiles.splice(i, 1);
          break; // 투사체 하나당 적 하나만 (관통 없음)
        }
      }
    }
  }

  // 6. 경험치 획득
  const magnetRange = 50 * (1 + (player.passives.area || 0));
  for (let i = exps.length - 1; i >= 0; i--) {
    const exp = exps[i];
    const dist = Math.hypot(player.x - exp.x, player.y - exp.y);

    // 자석 효과
    if (dist < magnetRange) {
      const speed = exp.isMagnetized ? 0.4 : 0.2; // 자석에 끌리면 더 빠르게, 기본 속도 2배
      exp.x += (player.x - exp.x) * speed;
      exp.y += (player.y - exp.y) * speed;
    }

    if (dist < player.size) {
      player.exp += exp.val * (1 + (player.passives.exp_gain || 0)); // 경험치 획득량 증가 적용
      exps.splice(i, 1);
      if (player.exp >= player.nextExp) {
        levelUp();
      }
    }
  }

  // 7. 데미지 텍스트 업데이트
  damageNumbers.forEach((d, i) => {
    d.y -= 1;
    d.life--;
    if (d.life <= 0) damageNumbers.splice(i, 1);
  });

  // 8. 아이템 획득 (새로 추가)
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const dist = Math.hypot(player.x - item.x, player.y - item.y);

    if (dist < player.size + 15) {
      // 아이템 획득 범위
      if (item.type === "health") {
        player.hp = Math.min(player.maxHp, player.hp + 20);
        showDamage(player.x, player.y, "+20 HP", "lime");
      } else if (item.type === "magnet") {
        // 모든 경험치를 플레이어에게 끌어당김
        exps.forEach((exp) => {
          exp.isMagnetized = true;
        });
        showDamage(player.x, player.y, "경험치 흡수!", "gold");
      }
      items.splice(i, 1);
    }
  }

  // UI 업데이트
  updateUI();
}

function draw() {
  // 배경
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 그리드 그리기 (오피스 타일 느낌)
  ctx.strokeStyle = "#34495e";
  ctx.lineWidth = 1;
  const gridSize = 50;
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // 경험치 보석
  exps.forEach((e) => {
    ctx.fillStyle = "#3498db";
    ctx.beginPath();
    ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // 회전 의자 그리기
  player.weapons.forEach((w) => {
    if (w.type === "orbiting") {
      const count = w.count || 1;
      for (let i = 0; i < count; i++) {
        const offset = (Math.PI * 2 * i) / count;
        const angle = (timer * w.rotationSpeed + offset) % (Math.PI * 2);
        const orbitX = player.x + Math.cos(angle) * w.area;
        const orbitY = player.y + Math.sin(angle) * w.area;
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(w.icon, orbitX, orbitY);
      }
    }
  });

  // 보호막 그리기
  player.weapons.forEach((w) => {
    if (w.type === "shield" && w.active) {
      ctx.strokeStyle = "cyan";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.size + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // 적 그리기
  enemies.forEach((e) => {
    ctx.font = `${e.size * 1.5}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e.icon, e.x, e.y);

    // 보스 체력바
    if (e.isBoss) {
      ctx.fillStyle = "red";
      ctx.fillRect(e.x - 30, e.y - 40, 60, 5);
      ctx.fillStyle = "green";
      ctx.fillRect(e.x - 30, e.y - 40, 60 * (e.hp / e.maxHp), 5);
    }
  });

  // 플레이어 그리기
  ctx.font = "30px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🧑‍💼", player.x, player.y);

  // 오라(커피) 그리기
  player.weapons.forEach((w) => {
    if (w.type === "aura") {
      ctx.fillStyle = "rgba(139, 69, 19, 0.2)";
      ctx.beginPath();
      ctx.arc(
        player.x,
        player.y,
        w.area * (1 + player.passives.area),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  });

  // 투사체 그리기
  projectiles.forEach((p) => {
    if (p.type === "projectile") {
      ctx.font = "20px Arial";
      ctx.fillText(p.icon, p.x, p.y);
    }
  });

  // 데미지 텍스트
  damageNumbers.forEach((d) => {
    ctx.fillStyle = d.color || "white";
    ctx.font = "bold 16px Arial";
    ctx.fillText(d.val, d.x, d.y);
  });
}

// 유틸리티 함수들
function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4); // 0:상, 1:우, 2:하, 3:좌
  let x, y;
  const buffer = 50;

  if (edge === 0) {
    x = Math.random() * canvas.width;
    y = -buffer;
  } else if (edge === 1) {
    x = canvas.width + buffer;
    y = Math.random() * canvas.height;
  } else if (edge === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + buffer;
  } else {
    x = -buffer;
    y = Math.random() * canvas.height;
  }

  // 랜덤 타입 (웨이브 지날수록 강한 적)
  let typeIdx = 0;
  if (currentWave > 2) typeIdx = Math.floor(Math.random() * 2);
  if (currentWave > 5) typeIdx = Math.floor(Math.random() * 3);
  if (currentWave > 10) typeIdx = Math.floor(Math.random() * 4);

  const type = ENEMY_TYPES[typeIdx] || ENEMY_TYPES[0];

  // 웨이브 비례 체력 증가
  let hpMultiplier = 1 + (currentWave - 1) * 0.15;
  let finalHp = type.hp * hpMultiplier;

  // 초반 웨이브는 한 방에 죽도록 체력 조절
  if (currentWave < 3) {
    finalHp = 5;
  }

  enemies.push({
    x,
    y,
    ...type,
    size: 15,
    hp: finalHp,
    maxHp: finalHp,
  });
}

function spawnBoss() {
  const boss = {
    x: canvas.width / 2,
    y: -100,
    ...BOSS_TYPE,
    isBoss: true,
    hp: BOSS_TYPE.hp * (1 + (currentWave / 5 - 1) * 0.5),
    maxHp: BOSS_TYPE.hp * (1 + (currentWave / 5 - 1) * 0.5),
  };
  enemies.push(boss);

  const warning = document.getElementById("boss-warning");
  warning.style.display = "block";
  setTimeout(() => (warning.style.display = "none"), 3000);
}

function spawnFinalBoss() {
  const boss = {
    x: canvas.width / 2,
    y: -100,
    ...FINAL_BOSS_TYPE,
    isBoss: true,
    isFinalBoss: true,
    hp: FINAL_BOSS_TYPE.hp,
    maxHp: FINAL_BOSS_TYPE.hp,
  };
  enemies.push(boss);

  const warning = document.getElementById("boss-warning");
  warning.innerText = "⚠️ 꼰대 과장님 출현! (FINAL BOSS) ⚠️";
  warning.style.display = "block";
  setTimeout(() => {
    warning.style.display = "none";
    warning.innerText = "⚠️ 퇴근 시간 임박! (BOSS) ⚠️";
  }, 5000);
}

function handleOrbitingWeaponCollision(orbitX, orbitY, weapon) {
  for (let j = enemies.length - 1; j >= 0; j--) {
    const enemy = enemies[j];
    const dist = Math.hypot(orbitX - enemy.x, orbitY - enemy.y);

    // 충돌 판정 (의자 크기 + 적 크기 + 여유분)
    // 의자(궤도 무기)의 판정이 잘 안된다면 여유분을 늘려줍니다.
    if (dist < 30 + enemy.size) {
      // 쿨다운 적용 (너무 빠르게 연속 히트 방지)
      if (!enemy.orbitHitCooldown || timer > enemy.orbitHitCooldown) {
        enemy.orbitHitCooldown = timer + 30; // 0.5초 쿨다운

        const dmg = weapon.damage * (1 + player.passives.might);
        enemy.hp -= dmg;

        if (Math.random() > 0.7) showDamage(enemy.x, enemy.y, Math.floor(dmg));

        if (enemy.hp <= 0) {
          exps.push({
            x: enemy.x,
            y: enemy.y,
            val: enemy.exp * (1 + (player.passives.exp_gain || 0)),
          });
          enemies.splice(j, 1);

          if (enemy.isBoss) {
            showDamage(enemy.x, enemy.y, "BOSS DOWN!", "gold");
            document.getElementById("boss-warning").style.display = "none";
          }
        }
      }
    }
  }
}

function useWeapon(weapon) {
  if (weapon.type === "projectile") {
    // 가장 가까운 적 찾기
    let target = null;
    let minDist = Infinity;

    enemies.forEach((e) => {
      const dist = Math.hypot(e.x - player.x, e.y - player.y);
      if (dist < minDist) {
        minDist = dist;
        target = e;
      }
    });

    if (target) {
      const angle = Math.atan2(target.y - player.y, target.x - player.x);
      projectiles.push({
        x: player.x,
        y: player.y,
        angle: angle,
        speed: weapon.speed,
        damage: weapon.damage,
        duration: 60, // 1초
        icon: weapon.icon,
        type: "projectile",
      });
    } else if (weapon.name.includes("키보드")) {
      // 키보드는 적 없어도 랜덤 발사
      const angle = Math.random() * Math.PI * 2;
      projectiles.push({
        x: player.x,
        y: player.y,
        angle: angle,
        speed: weapon.speed,
        damage: weapon.damage,
        duration: weapon.duration,
        icon: weapon.icon,
        type: "projectile",
      });
    }
  } else if (weapon.type === "aura") {
    // 오라는 매 프레임 충돌 체크하므로 여기선 생성만 (이미 projectiles 배열 대신 별도 처리 혹은 매 프레임 생성)
    // 여기서는 projectiles 배열에 넣고 1프레임만 살게 하여 충돌 처리 로직 공유
    projectiles.push({
      x: player.x,
      y: player.y,
      type: "aura",
      area: weapon.area,
      damage: weapon.damage,
      duration: 1, // 즉시 소멸 (매 틱마다 생성)
    });
  }
}

function showDamage(x, y, val, color) {
  damageNumbers.push({ x, y, val, life: 30, color });
}

function updateUI() {
  // 경험치 바
  const expPct = (player.exp / player.nextExp) * 100;
  document.getElementById("exp-bar").style.width = `${expPct}%`;

  // 레벨 및 체력
  document.getElementById("level").innerText = player.level;
  document.getElementById("wave").innerText = currentWave;
  document.getElementById("hp").innerText = Math.floor(player.hp);

  // 타이머
  const m = Math.floor(timer / 3600)
    .toString()
    .padStart(2, "0");
  const s = Math.floor((timer % 3600) / 60)
    .toString()
    .padStart(2, "0");
  document.getElementById("timer").innerText = `${m}:${s}`;

  // 능력 목록 업데이트 (오른쪽 UI)
  updateAbilityDock();
}

function updateAbilityDock() {
  const dock = document.getElementById("ability-dock");
  dock.innerHTML = "";

  // 무기 아이콘
  player.weapons.forEach((w) => {
    const div = document.createElement("div");
    div.className = "ability-icon";
    div.innerHTML = `${w.icon}<div class="ability-level">${w.level}</div>`;
    div.title = w.name;
    dock.appendChild(div);
  });

  // 패시브 아이콘 (PASSIVES 객체 참조 필요)
  for (const [key, count] of Object.entries(player.passiveCounts)) {
    const passive = Object.values(PASSIVES).find((p) => p.name === key);
    if (passive) {
      const div = document.createElement("div");
      div.className = "ability-icon";
      div.innerHTML = `${passive.icon}<div class="ability-level">${count}</div>`;
      div.title = passive.name;
      dock.appendChild(div);
    }
  }
}

function startNextWave() {
  currentWave++;
  waveCooldown = 0;
  enemiesToSpawn = 5 + currentWave * 3; // 웨이브당 3마리씩 증가

  // 100 웨이브 최종 보스, 5 웨이브마다 중간 보스
  if (currentWave === 100) {
    spawnFinalBoss();
    enemiesToSpawn = 0;
  } else if (currentWave > 0 && currentWave % 5 === 0) {
    spawnBoss();
    enemiesToSpawn = Math.floor(enemiesToSpawn / 2); // 보스 웨이브는 일반 몹 감소
  }

  showWaveStartMessage();
}

function showWaveStartMessage() {
  const msgEl = document.getElementById("wave-start-message");
  if (!msgEl) return;
  msgEl.textContent = `Wave ${currentWave}`;
  msgEl.classList.add("show");
  setTimeout(() => {
    msgEl.classList.remove("show");
  }, 1500);
}

function levelUp() {
  gameState = "PAUSED";
  player.level++;
  player.exp = 0;
  player.nextExp = Math.floor(player.nextExp * 1.5);

  // 랜덤 업그레이드 3개 선택
  const options = [];
  const pool = [...Object.values(WEAPONS), ...Object.values(PASSIVES)];

  while (options.length < 3) {
    const rand = pool[Math.floor(Math.random() * pool.length)];
    // 중복 제거 (단순화)
    if (!options.includes(rand)) options.push(rand);
  }

  const container = document.getElementById("upgrade-cards");
  container.innerHTML = "";

  options.forEach((opt) => {
    const card = document.createElement("div");
    card.className = "card";

    let desc = opt.desc;

    if (opt.isUpgrade) {
      const nextLevel = opt.level + 1;
      desc = `[Lv.${nextLevel}] 데미지/범위/속도 증가`;
      if (nextLevel % 3 === 0) {
        desc += `\n★ 특수 강화: 개수/발사체 증가!`;
      }
    }

    // 패시브 게이지 바 생성
    let gaugeHtml = "";
    if (opt.stat) {
      const currentLevel = player.passiveCounts[opt.name] || 0;
      gaugeHtml = `<div class="gauge-container">`;
      for (let i = 0; i < 3; i++) {
        // 현재 레벨만큼 채워진 상태로 표시 (선택하면 다음 칸이 채워질 예정)
        // 사용자 요청: "고르기 전에 게이지 바 3개가 있고 고를때 마다 게이지가 하나씩 차서 보이게 해줘"
        // 즉, 현재 상태를 보여주는 것이 직관적임.
        const filledClass = i < currentLevel ? "filled" : "";
        gaugeHtml += `<div class="gauge-segment ${filledClass}"></div>`;
      }
      gaugeHtml += `</div>`;
      desc += ` (Lv.${currentLevel}/3)`;
    }

    card.innerHTML = `
      <div class="card-icon">${opt.icon}</div>
      <div class="card-title">${opt.name}</div>
      <div class="card-desc">${desc}</div>
      ${gaugeHtml}
    `;

    card.onclick = () => selectUpgrade(opt, opt.isUpgrade);
    container.appendChild(card);
  });

  document.getElementById("levelup-modal").classList.remove("hidden");
}

function selectUpgrade(opt, isUpgrade) {
  // 무기인지 패시브인지 확인
  if (opt.stat) {
    // 패시브
    if (opt.stat === "max_hp") {
      player.maxHp *= 1 + opt.val;
      player.hp *= 1 + opt.val; // 현재 체력도 비율만큼 증가
    } else {
      player.passives[opt.stat] = (player.passives[opt.stat] || 0) + opt.val;
    }
    // 패시브 레벨 증가
    player.passiveCounts[opt.name] = (player.passiveCounts[opt.name] || 0) + 1;
  } else {
    // 무기
    if (isUpgrade) {
      const existing = player.weapons.find((w) => w.name === opt.name);
      existing.level++;
      existing.damage *= 1.2;
      existing.area *= 1.1;
      existing.cooldown *= 0.9;

      // 3레벨마다 특수 강화 (개수 증가)
      if (existing.level % 3 === 0) {
        existing.count = (existing.count || 1) + 1;
      }
    } else {
      player.weapons.push({ ...WEAPONS[opt.name], level: 1, timer: 0 });
    }
  }

  document.getElementById("levelup-modal").classList.add("hidden");
  gameState = "PLAYING";
  lastTime = performance.now(); // 델타 타임 튀는 것 방지
  requestAnimationFrame(gameLoop);
}

function pauseGame() {
  if (gameState !== "PLAYING") return;
  gameState = "PAUSED";
  document.getElementById("pause-modal").classList.remove("hidden");
}

function resumeGame() {
  // 레벨업 창이 떠있을 때는 ESC로 재개하지 않음
  if (!document.getElementById("levelup-modal").classList.contains("hidden"))
    return;
  document.getElementById("pause-modal").classList.add("hidden");
  gameState = "PLAYING";
  lastTime = performance.now(); // 델타 타임 튀는 것 방지
  requestAnimationFrame(gameLoop);
}

function gameClear() {
  gameState = "GAMEOVER";
  document.getElementById("gameover-modal").classList.remove("hidden");

  const m = Math.floor(timer / 3600)
    .toString()
    .padStart(2, "0");
  const s = Math.floor((timer % 3600) / 60)
    .toString()
    .padStart(2, "0");
  document.getElementById("final-time").innerText = `${m}:${s}`;

  document.getElementById("gameover-text").innerText =
    "꼰대 과장님 처치! 칼퇴 성공!";
  document.getElementById("gameover-text").style.color = "#2ecc71";
}

function gameOver() {
  gameState = "GAMEOVER";
  document.getElementById("gameover-modal").classList.remove("hidden");

  const m = Math.floor(timer / 3600)
    .toString()
    .padStart(2, "0");
  const s = Math.floor((timer % 3600) / 60)
    .toString()
    .padStart(2, "0");
  document.getElementById("final-time").innerText = `${m}:${s}`;

  document.getElementById("gameover-text").innerText = "야근 확정...";
  document.getElementById("gameover-text").style.color = "#e74c3c";
}
