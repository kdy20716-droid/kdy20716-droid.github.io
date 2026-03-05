// c:\project\kdy20716-droid.github.io\game\shooting\boss.js
import * as THREE from "three";

export class BossSystem {
  constructor(scene, player, gameContext) {
    this.scene = scene;
    this.player = player; // controls.getObject()
    this.context = gameContext; // Callbacks for game interactions
    this.projectiles = [];
    this.fireParticles = [];
  }

  // Boss Spawning Logic
  spawnBoss(wave) {
    let name, color, size, health, speed;
    let isFinalBoss = false;
    let bossType = -1;
    let tier = 1;

    if (wave === 100) {
      isFinalBoss = true;
      name = "FINAL BOSS: THE KAIJU";
      color = 0x330000;
      size = 25;
      health = 10000;
      speed = 15;
    } else {
      bossType = (wave / 10) % 3; // 1: Alpha, 2: Beta, 0: Gamma
      tier = Math.ceil(wave / 30); // 1, 2, 3

      if (bossType === 1) {
        name = `Subject Alpha ${tier > 1 ? tier : ""} (The Giant)`;
        size = 8;
        health = 500 + wave * 10;
        speed = 5;
        if (tier === 1) color = 0x8b0000;
        else if (tier === 2) color = 0xa52a2a;
        else color = 0xff0000;
      } else if (bossType === 2) {
        name = `Subject Beta ${tier > 1 ? tier : ""} (The Speedster)`;
        size = 4;
        health = 300 + wave * 10;
        speed = 15;
        if (tier === 1) color = 0x00008b;
        else if (tier === 2) color = 0x4169e1;
        else color = 0x00bfff;
      } else {
        name = `Subject Gamma ${tier > 1 ? tier : ""} (The Parasite)`;
        size = 10;
        health = 800 + wave * 20;
        speed = 3;
        if (tier === 1) color = 0x4b0082;
        else if (tier === 2) color = 0x800080;
        else color = 0x9932cc;
      }
    }

    const boss = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ color: color });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    if (isFinalBoss) {
      // Kaiju Geometry
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size * 2),
        material,
      );
      boss.add(body);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(size * 0.6, size * 0.6, size * 0.8),
        material,
      );
      head.position.set(0, size * 0.5, size * 1.2);
      boss.add(head);
      const wings = new THREE.Mesh(
        new THREE.BoxGeometry(size * 2.5, size * 0.1, size),
        material,
      );
      wings.position.set(0, size * 0.5, 0);
      boss.add(wings);
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(size * 0.4, size * 0.4, size * 1.5),
        material,
      );
      tail.position.set(0, 0, -size * 1.5);
      boss.add(tail);
    } else if (bossType === 1) {
      // Alpha Geometry
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(size * 1.5, size * 2, size),
        material,
      );
      boss.add(body);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(size * 0.5, size * 0.5, size * 0.5),
        headMat,
      );
      head.position.y = size * 1.25;
      boss.add(head);
      const spikeGeo = new THREE.ConeGeometry(size * 0.2, size * 0.8, 4);
      const spikeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const s1 = new THREE.Mesh(spikeGeo, spikeMat);
      s1.position.set(-size * 0.6, size * 1.0, 0);
      boss.add(s1);
      const s2 = new THREE.Mesh(spikeGeo, spikeMat);
      s2.position.set(size * 0.6, size * 1.0, 0);
      boss.add(s2);
    } else if (bossType === 2) {
      // Beta Geometry
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(size * 0.3, size * 0.3, size * 2, 8),
        material,
      );
      boss.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(size * 0.4, 8, 8),
        headMat,
      );
      head.position.y = size * 1.1;
      boss.add(head);
      const armGeo = new THREE.BoxGeometry(size * 1.5, size * 0.1, size * 0.1);
      const a1 = new THREE.Mesh(armGeo, material);
      a1.position.y = size * 0.5;
      boss.add(a1);
      const a2 = new THREE.Mesh(armGeo, material);
      a2.position.y = 0;
      boss.add(a2);
    } else {
      // Gamma Geometry
      const body = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size, 0),
        material,
      );
      boss.add(body);
      const head = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size * 0.6, 0),
        headMat,
      );
      head.position.set(0, size * 0.8, size * 0.5);
      boss.add(head);
      for (let i = 0; i < 6; i++) {
        const t = new THREE.Mesh(
          new THREE.CylinderGeometry(size * 0.1, size * 0.05, size * 2, 8),
          material,
        );
        t.position.set(
          Math.cos((i * Math.PI) / 3) * size * 0.5,
          size * 0.5,
          Math.sin((i * Math.PI) / 3) * size * 0.5,
        );
        t.rotation.set(Math.random(), Math.random(), Math.random());
        boss.add(t);
      }
    }

    const playerPos = this.player.position;
    boss.position.set(playerPos.x + 50, size, playerPos.z + 50);

    boss.userData = {
      isBoss: true,
      bossType: bossType,
      tier: tier,
      isFinalBoss: isFinalBoss,
      name: name,
      maxHealth: health,
      health: health,
      speed: speed,
      size: size,
      headY: size * 1.2,
      knockback: new THREE.Vector3(),
      patternTimer: 0,
      patternState: 0,
    };

    this.scene.add(boss);
    return boss;
  }

  // Main Update Loop
  update(delta, time, enemies) {
    const playerPos = this.player.position;

    // 1. Update Projectiles
    this.updateProjectiles(delta, playerPos);

    // 2. Update Fire Particles
    this.updateFireParticles(delta, playerPos);

    // 3. Update Bosses
    enemies.forEach((e) => {
      if (!e.userData.isBoss) return;
      if (e.userData.isDying) return;

      e.userData.patternTimer += delta;

      if (e.userData.isFinalBoss) {
        this.updateFinalBoss(e, delta, time, playerPos);
      } else {
        this.updateNormalBoss(e, delta, playerPos);
      }
    });
  }

  updateFinalBoss(boss, delta, time, playerPos) {
    boss.position.y = 40 + Math.sin(time) * 10;
    boss.lookAt(playerPos);

    if (boss.userData.patternTimer > 0.05) {
      boss.userData.patternTimer = 0;
      const mouthPos = boss.position.clone();
      mouthPos.y -= 5;
      this.createFireBreath(mouthPos, playerPos);
    }
  }

  updateNormalBoss(boss, delta, playerPos) {
    const data = boss.userData;

    // Alpha (Giant)
    if (data.bossType === 1) {
      if (data.patternState === 0) {
        // Chasing
        if (data.patternTimer > 4) {
          data.patternTimer = 0;
          const r = Math.random();
          let skill = 1; // Charge

          if (data.tier === 2 && r < 0.5)
            skill = 2; // Earthquake
          else if (data.tier >= 3) {
            if (r < 0.33) skill = 2;
            else if (r < 0.66) skill = 3; // Rock Throw
          }

          if (skill === 1) {
            data.patternState = 1;
            this.context.showMessage("크아아앙! (돌진 준비)", 100);
          } else if (skill === 2) {
            data.patternState = 3;
            this.context.showMessage("지진 강타 준비!", 100);
          } else if (skill === 3) {
            data.patternState = 5;
            this.context.showMessage("바위 투척!", 100);
          }
        }
      }
      // Charge Logic
      else if (data.patternState === 1) {
        boss.lookAt(playerPos.x, boss.position.y, playerPos.z);
        if (data.patternTimer > 1.5) {
          data.patternState = 2;
          data.patternTimer = 0;
          data.chargeDir = new THREE.Vector3()
            .subVectors(playerPos, boss.position)
            .normalize();
          data.chargeDir.y = 0;
        }
      } else if (data.patternState === 2) {
        boss.position.add(data.chargeDir.clone().multiplyScalar(40 * delta));
        if (data.patternTimer > 1.0) {
          data.patternState = 0;
          data.patternTimer = 0;
        }
        if (boss.position.distanceTo(playerPos) < data.size + 2) {
          this.context.damagePlayer(
            20,
            data.chargeDir.clone().multiplyScalar(80),
          );
          this.context.showMessage("돌진 피격!", 100);
          data.patternState = 0;
        }
      }
      // Earthquake Logic
      else if (data.patternState === 3) {
        boss.position.y += 30 * delta;
        if (data.patternTimer > 1.0) {
          data.patternState = 4;
          data.patternTimer = 0;
        }
      } else if (data.patternState === 4) {
        boss.position.y -= 60 * delta;
        if (boss.position.y <= data.size) {
          boss.position.y = data.size;
          if (boss.position.distanceTo(playerPos) < 25) {
            this.context.damagePlayer(30, new THREE.Vector3(0, 20, 0));
            this.context.showMessage("지진 강타!", 100);
            this.context.shakeCamera(1.0);
          }
          data.patternState = 0;
        }
      }
      // Rock Throw Logic
      else if (data.patternState === 5) {
        if (data.patternTimer > 1.0) {
          this.throwRock(boss.position, playerPos);
          data.patternState = 0;
        }
      }
    }

    // Beta (Speedster)
    else if (data.bossType === 2) {
      if (data.patternTimer > 4) {
        data.patternTimer = 0;
        const r = Math.random();
        let skill = 1; // Teleport

        if (data.tier === 2 && r < 0.5)
          skill = 2; // Frenzy
        else if (data.tier >= 3) {
          if (r < 0.33) skill = 2;
          else if (r < 0.66) skill = 3; // Blind
        }

        if (skill === 1) {
          this.teleport(boss, playerPos);
        } else if (skill === 2) {
          // Frenzy (3 teleports)
          for (let i = 0; i < 3; i++) {
            setTimeout(() => {
              if (boss.parent) this.teleport(boss, playerPos);
            }, i * 500);
          }
          this.context.showMessage("연속 이동!", 100);
        } else if (skill === 3) {
          // Blind
          this.context.setFog(0, 5);
          this.context.showMessage("시야 차단!", 100);
          setTimeout(() => this.context.setFog(30, 150), 3000);
        }
      }
    }

    // Gamma (Parasite)
    else {
      if (data.patternTimer > 2.5) {
        data.patternTimer = 0;
        const r = Math.random();
        let skill = 1; // Projectile

        if (data.tier === 2 && r < 0.5)
          skill = 2; // Acid Rain
        else if (data.tier >= 3) {
          if (r < 0.33) skill = 2;
          else if (r < 0.66) skill = 3; // Summon
        }

        if (skill === 1) {
          const shootPos = boss.position.clone();
          shootPos.y += data.size * 0.5;
          this.shootProjectile(shootPos, playerPos);
        } else if (skill === 2) {
          // Acid Rain
          for (let i = 0; i < 10; i++) {
            const offset = new THREE.Vector3(
              (Math.random() - 0.5) * 30,
              30,
              (Math.random() - 0.5) * 30,
            );
            const start = playerPos.clone().add(offset);
            const target = new THREE.Vector3(start.x, 0, start.z);
            this.shootProjectile(start, target, 10);
          }
          this.context.showMessage("산성비!", 100);
        } else if (skill === 3) {
          // Summon
          for (let i = 0; i < 3; i++) this.context.spawnMinion("runner");
          this.context.showMessage("하수인 소환!", 100);
        }
      }
    }
  }

  // Skills Implementation
  teleport(boss, playerPos) {
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      0,
      (Math.random() - 0.5) * 20,
    );
    boss.position.copy(playerPos).add(offset);
    boss.position.y = boss.userData.size;
    this.context.showMessage("순간이동!", 50);
    this.context.createBloodParticles(boss.position);
  }

  createFireBreath(startPos, targetPos) {
    const particleGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xff4500 });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.position.copy(startPos);

    const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
    dir.x += (Math.random() - 0.5) * 0.2;
    dir.y += (Math.random() - 0.5) * 0.2;
    dir.z += (Math.random() - 0.5) * 0.2;
    dir.normalize();

    particle.userData = { velocity: dir.multiplyScalar(25), life: 3.0 };
    this.scene.add(particle);
    this.fireParticles.push(particle);
  }

  shootProjectile(startPos, targetPos, damage = 15) {
    const geometry = new THREE.SphereGeometry(0.8, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const projectile = new THREE.Mesh(geometry, material);
    projectile.position.copy(startPos);

    const direction = new THREE.Vector3()
      .subVectors(targetPos, startPos)
      .normalize();
    projectile.userData = {
      velocity: direction.multiplyScalar(20),
      life: 5.0,
      damage: damage,
    };

    const light = new THREE.PointLight(0x00ff00, 1, 10);
    projectile.add(light);
    this.scene.add(projectile);
    this.projectiles.push(projectile);
  }

  throwRock(startPos, targetPos) {
    const geometry = new THREE.DodecahedronGeometry(2, 0);
    const material = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const rock = new THREE.Mesh(geometry, material);
    rock.position.copy(startPos);

    const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
    rock.userData = { velocity: dir.multiplyScalar(25), life: 5.0, damage: 40 };
    this.scene.add(rock);
    this.projectiles.push(rock);
  }

  updateProjectiles(delta, playerPos) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.position.add(p.userData.velocity.clone().multiplyScalar(delta));
      p.userData.life -= delta;

      if (p.position.distanceTo(playerPos) < 2.0) {
        this.context.damagePlayer(p.userData.damage || 15);
        this.context.showMessage("피격!", 100);
        this.scene.remove(p);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.userData.life <= 0) {
        this.scene.remove(p);
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateFireParticles(delta, playerPos) {
    for (let i = this.fireParticles.length - 1; i >= 0; i--) {
      const p = this.fireParticles[i];
      p.userData.life -= delta;
      p.position.add(p.userData.velocity.clone().multiplyScalar(delta));
      p.rotation.x += delta * 5;
      p.rotation.y += delta * 5;

      if (p.position.distanceTo(playerPos) < 2.0) {
        this.context.damagePlayer(1);
      }

      if (p.userData.life <= 0) {
        this.scene.remove(p);
        this.fireParticles.splice(i, 1);
      }
    }
  }

  clear() {
    this.projectiles.forEach((p) => this.scene.remove(p));
    this.projectiles = [];
    this.fireParticles.forEach((p) => this.scene.remove(p));
    this.fireParticles = [];
  }
}
