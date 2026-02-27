/* import { drawFrontCard } from "./graphics-utils.js";

export function drawPlayerRevolvers(ctx, players, gameState, cardImages) {
  players.forEach((player, index) => {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    const restX = 130;
    const restY = -150;
    const restRotation = -Math.PI / 2 + 0.2;

    let currentX = restX;
    let currentY = restY;
    let currentRotation = restRotation;

    if (
      gameState.phase === "ROULETTE" &&
      gameState.victimIndices.includes(index)
    ) {
      const aimX = 60;
      const aimY = -80;
      let aimRotation = Math.atan2(-aimY, -aimX);

      if (aimRotation - restRotation > Math.PI) {
        aimRotation -= Math.PI * 2;
      } else if (aimRotation - restRotation < -Math.PI) {
        aimRotation += Math.PI * 2;
      }

      const elapsed = Date.now() - gameState.rouletteStartTime;
      const duration = 5000;
      let progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      currentX = restX + (aimX - restX) * ease;
      currentY = restY + (aimY - restY) * ease;
      currentRotation = restRotation + (aimRotation - restRotation) * ease;

      if (progress > 0.8) {
        currentX += (Math.random() - 0.5) * 3;
        currentY += (Math.random() - 0.5) * 3;
      }
    }

    ctx.translate(currentX, currentY);
    ctx.rotate(currentRotation);

    const scale = 0.9;
    ctx.scale(scale, scale);

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 20, 60, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    const w = 100;
    const h = 60;

    const metalColor = "#546e7a";
    const gripColor = "#5d4037";
    const darkMetal = "#263238";

    if (
      cardImages.REVOLVER &&
      cardImages.REVOLVER.complete &&
      cardImages.REVOLVER.naturalWidth > 0
    ) {
      ctx.drawImage(cardImages.REVOLVER, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = gripColor;
      ctx.beginPath();
      ctx.moveTo(-40, 10);
      ctx.quadraticCurveTo(-55, 30, -50, 50);
      ctx.lineTo(-30, 50);
      ctx.quadraticCurveTo(-25, 30, -20, 20);
      ctx.lineTo(-40, 10);
      ctx.fill();

      ctx.fillStyle = "#3e2723";
      ctx.beginPath();
      ctx.arc(-40, 30, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = metalColor;
      ctx.beginPath();
      ctx.moveTo(-40, 10);
      ctx.lineTo(20, 10);
      ctx.lineTo(20, 35);
      ctx.lineTo(-20, 35);
      ctx.lineTo(-40, 20);
      ctx.fill();

      ctx.fillStyle = darkMetal;
      ctx.fillRect(-15, 5, 35, 25);
      ctx.fillStyle = "#37474f";
      ctx.fillRect(-10, 8, 25, 6);
      ctx.fillRect(-10, 20, 25, 6);

      ctx.fillStyle = metalColor;
      ctx.fillRect(20, 5, 60, 12);
      ctx.fillStyle = "#455a64";
      ctx.fillRect(20, 5, 60, 3);
      ctx.fillStyle = darkMetal;
      ctx.beginPath();
      ctx.moveTo(75, 5);
      ctx.lineTo(80, 5);
      ctx.lineTo(80, -2);
      ctx.lineTo(75, 5);
      ctx.fill();

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

export function updateAndDrawSlam(
  ctx,
  slamState,
  players,
  cardImages,
  setShakeTimer,
) {
  slamState.progress += 0.08;

  if (slamState.progress >= 1) {
    slamState.active = false;
    return;
  }

  const player = players[slamState.playerIndex];
  let scale = 1;
  let alpha = 1;
  const yOffset = -180;
  const xOffset = 60;

  if (slamState.progress < 0.3) {
    const t = slamState.progress / 0.3;
    scale = 2.5 - t * 1.5;
    alpha = Math.min(1, t * 3);
  } else if (slamState.progress > 0.7) {
    alpha = 1 - (slamState.progress - 0.7) / 0.3;
  }

  if (slamState.progress >= 0.3 && slamState.progress < 0.38) {
    if (setShakeTimer) setShakeTimer(10);
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
    ctx.drawImage(cardImages.FIST, -size / 2, -size / 2, size, size);
  } else {
    // Fallback drawing for fist if image not loaded
    const skinColor = "#e0ac69";
    const shadowColor = "#8d6e63";
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(10, 10, size / 2.2, size / 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    const r = 20;
    const x = -size / 2.2;
    const y = -size / 2.5;
    const w = size * 0.9;
    const h = size * 0.7;
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
    for (let i = 0; i < 4; i++) {
      const fingerX = -size / 2.8 + i * (size * 0.23);
      const fingerY = size * 0.2;
      ctx.fillStyle = shadowColor;
      ctx.beginPath();
      ctx.arc(fingerX, fingerY + 3, size * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(fingerX, fingerY, size * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shadowColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(fingerX, fingerY, size * 0.08, 0.5, 2.6);
      ctx.stroke();
    }
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(-size * 0.35, 0, size * 0.12, size * 0.22, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-size * 0.35, 0, size * 0.12, size * 0.22, 0.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSitdownCharacters(ctx, players, sitdownCharImages) {
  players.forEach((player) => {
    if (player.charIndex !== undefined && sitdownCharImages[player.charIndex]) {
      const img = sitdownCharImages[player.charIndex];
      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle + Math.PI);
        const scale = player.animScale || 1.0;
        ctx.scale(scale, scale);
        const targetHeight = 350;
        const ratio = img.naturalWidth / img.naturalHeight;
        const targetWidth = targetHeight * ratio;
        ctx.translate(0, -120);
        ctx.drawImage(
          img,
          -targetWidth / 2,
          -targetHeight / 2,
          targetWidth,
          targetHeight,
        );
        ctx.restore();
      }
    }
  });
}

export function updateAndDrawDevilCardAnim(
  ctx,
  devilCardAnim,
  cardImages,
  width,
  height,
) {
  if (!devilCardAnim.active) return;

  // 화면 오른쪽 아래 좌표 설정
  const startX = width + 150;
  const startY = height + 200;
  const endX = width - 150;
  const endY = height - 150;

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

export function updateAndDrawDevilCardAnim(
  ctx,
  devilCardAnim,
  cardImages,
  width,
  height,
) {
  if (!devilCardAnim.active) return;

  const startX = width + 150;
  const startY = height + 200;
  const endX = width - 150;
  const endY = height - 150;

  if (devilCardAnim.phase === "ENTER") {
    devilCardAnim.progress += 0.04;
    if (devilCardAnim.progress >= 1) {
      devilCardAnim.progress = 1;
      devilCardAnim.phase = "STAY";
      devilCardAnim.timer = 90;
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

  const t = devilCardAnim.progress;
  const ease = 1 - Math.pow(1 - t, 3);

  const curX = startX + (endX - startX) * ease;
  const curY = startY + (endY - startY) * ease;
  const rotation = 0.5 - ease * 0.8;

  ctx.save();
  ctx.translate(curX, curY);
  ctx.rotate(rotation);

  ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
  ctx.shadowBlur = 40;

  ctx.scale(3, 3);

  drawFrontCard(ctx, cardImages, 0, 0, 0, "D");

  ctx.restore();
  import { drawFrontCard } from "./graphics-utils.js";

  export function drawPlayerRevolvers(ctx, players, gameState, cardImages) {
    players.forEach((player, index) => {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);

      const restX = 130;
      const restY = -150;
      const restRotation = -Math.PI / 2 + 0.2;

      let currentX = restX;
      let currentY = restY;
      let currentRotation = restRotation;

      if (
        gameState.phase === "ROULETTE" &&
        gameState.victimIndices.includes(index)
      ) {
        const aimX = 60;
        const aimY = -80;
        let aimRotation = Math.atan2(-aimY, -aimX);

        if (aimRotation - restRotation > Math.PI) {
          aimRotation -= Math.PI * 2;
        } else if (aimRotation - restRotation < -Math.PI) {
          aimRotation += Math.PI * 2;
        }

        const elapsed = Date.now() - gameState.rouletteStartTime;
        const duration = 5000;
        let progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        currentX = restX + (aimX - restX) * ease;
        currentY = restY + (aimY - restY) * ease;
        currentRotation = restRotation + (aimRotation - restRotation) * ease;

        if (progress > 0.8) {
          currentX += (Math.random() - 0.5) * 3;
          currentY += (Math.random() - 0.5) * 3;
        }
      }

      ctx.translate(currentX, currentY);
      ctx.rotate(currentRotation);

      const scale = 0.9;
      ctx.scale(scale, scale);

      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.ellipse(0, 20, 60, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      const w = 100;
      const h = 60;

      const metalColor = "#546e7a";
      const gripColor = "#5d4037";
      const darkMetal = "#263238";

      if (
        cardImages.REVOLVER &&
        cardImages.REVOLVER.complete &&
        cardImages.REVOLVER.naturalWidth > 0
      ) {
        ctx.drawImage(cardImages.REVOLVER, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = gripColor;
        ctx.beginPath();
        ctx.moveTo(-40, 10);
        ctx.quadraticCurveTo(-55, 30, -50, 50);
        ctx.lineTo(-30, 50);
        ctx.quadraticCurveTo(-25, 30, -20, 20);
        ctx.lineTo(-40, 10);
        ctx.fill();

        ctx.fillStyle = "#3e2723";
        ctx.beginPath();
        ctx.arc(-40, 30, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = metalColor;
        ctx.beginPath();
        ctx.moveTo(-40, 10);
        ctx.lineTo(20, 10);
        ctx.lineTo(20, 35);
        ctx.lineTo(-20, 35);
        ctx.lineTo(-40, 20);
        ctx.fill();

        ctx.fillStyle = darkMetal;
        ctx.fillRect(-15, 5, 35, 25);
        ctx.fillStyle = "#37474f";
        ctx.fillRect(-10, 8, 25, 6);
        ctx.fillRect(-10, 20, 25, 6);

        ctx.fillStyle = metalColor;
        ctx.fillRect(20, 5, 60, 12);
        ctx.fillStyle = "#455a64";
        ctx.fillRect(20, 5, 60, 3);
        ctx.fillStyle = darkMetal;
        ctx.beginPath();
        ctx.moveTo(75, 5);
        ctx.lineTo(80, 5);
        ctx.lineTo(80, -2);
        ctx.lineTo(75, 5);
        ctx.fill();

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

  export function updateAndDrawSlam(
    ctx,
    slamState,
    players,
    cardImages,
    setShakeTimer,
  ) {
    slamState.progress += 0.08;

    if (slamState.progress >= 1) {
      slamState.active = false;
      return;
    }

    const player = players[slamState.playerIndex];
    let scale = 1;
    let alpha = 1;
    const yOffset = -180;
    const xOffset = 60;

    if (slamState.progress < 0.3) {
      const t = slamState.progress / 0.3;
      scale = 2.5 - t * 1.5;
      alpha = Math.min(1, t * 3);
    } else if (slamState.progress > 0.7) {
      alpha = 1 - (slamState.progress - 0.7) / 0.3;
    }

    if (slamState.progress >= 0.3 && slamState.progress < 0.38) {
      if (setShakeTimer) setShakeTimer(10);
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
      ctx.drawImage(cardImages.FIST, -size / 2, -size / 2, size, size);
    } else {
      // Fallback drawing for fist if image not loaded
      const skinColor = "#e0ac69";
      const shadowColor = "#8d6e63";
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.ellipse(10, 10, size / 2.2, size / 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      const r = 20;
      const x = -size / 2.2;
      const y = -size / 2.5;
      const w = size * 0.9;
      const h = size * 0.7;
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
      for (let i = 0; i < 4; i++) {
        const fingerX = -size / 2.8 + i * (size * 0.23);
        const fingerY = size * 0.2;
        ctx.fillStyle = shadowColor;
        ctx.beginPath();
        ctx.arc(fingerX, fingerY + 3, size * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(fingerX, fingerY, size * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(fingerX, fingerY, size * 0.08, 0.5, 2.6);
        ctx.stroke();
      }
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.ellipse(
        -size * 0.35,
        0,
        size * 0.12,
        size * 0.22,
        0.2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.strokeStyle = shadowColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(
        -size * 0.35,
        0,
        size * 0.12,
        size * 0.22,
        0.2,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  export function drawSitdownCharacters(ctx, players, sitdownCharImages) {
    players.forEach((player) => {
      if (
        player.charIndex !== undefined &&
        sitdownCharImages[player.charIndex]
      ) {
        const img = sitdownCharImages[player.charIndex];
        if (img.complete && img.naturalWidth > 0) {
          ctx.save();
          ctx.translate(player.x, player.y);
          ctx.rotate(player.angle + Math.PI);
          const scale = player.animScale || 1.0;
          ctx.scale(scale, scale);
          const targetHeight = 350;
          const ratio = img.naturalWidth / img.naturalHeight;
          const targetWidth = targetHeight * ratio;
          ctx.translate(0, -120);
          ctx.drawImage(
            img,
            -targetWidth / 2,
            -targetHeight / 2,
            targetWidth,
            targetHeight,
          );
          ctx.restore();
        }
      }
    });
  }

  export function updateAndDrawDevilCardAnim(
    ctx,
    devilCardAnim,
    cardImages,
    width,
    height,
  ) {
    if (!devilCardAnim.active) return;

    // 화면 오른쪽 아래 좌표 설정
    const startX = width + 150;
    const startY = height + 200;
    const endX = width - 150;
    const endY = height - 150;

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
    import { drawFrontCard } from "./graphics-utils.js";

    export function drawPlayerRevolvers(ctx, players, gameState, cardImages) {
      players.forEach((player, index) => {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);

        const restX = 130;
        const restY = -150;
        const restRotation = -Math.PI / 2 + 0.2;

        let currentX = restX;
        let currentY = restY;
        let currentRotation = restRotation;

        if (
          gameState.phase === "ROULETTE" &&
          gameState.victimIndices.includes(index)
        ) {
          const aimX = 60;
          const aimY = -80;
          let aimRotation = Math.atan2(-aimY, -aimX);

          if (aimRotation - restRotation > Math.PI) {
            aimRotation -= Math.PI * 2;
          } else if (aimRotation - restRotation < -Math.PI) {
            aimRotation += Math.PI * 2;
          }

          const elapsed = Date.now() - gameState.rouletteStartTime;
          const duration = 5000;
          let progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);

          currentX = restX + (aimX - restX) * ease;
          currentY = restY + (aimY - restY) * ease;
          currentRotation = restRotation + (aimRotation - restRotation) * ease;

          if (progress > 0.8) {
            currentX += (Math.random() - 0.5) * 3;
            currentY += (Math.random() - 0.5) * 3;
          }
        }

        ctx.translate(currentX, currentY);
        ctx.rotate(currentRotation);

        const scale = 0.9;
        ctx.scale(scale, scale);

        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.ellipse(0, 20, 60, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        const w = 100;
        const h = 60;

        const metalColor = "#546e7a";
        const gripColor = "#5d4037";
        const darkMetal = "#263238";

        if (
          cardImages.REVOLVER &&
          cardImages.REVOLVER.complete &&
          cardImages.REVOLVER.naturalWidth > 0
        ) {
          ctx.drawImage(cardImages.REVOLVER, -w / 2, -h / 2, w, h);
        } else {
          ctx.fillStyle = gripColor;
          ctx.beginPath();
          ctx.moveTo(-40, 10);
          ctx.quadraticCurveTo(-55, 30, -50, 50);
          ctx.lineTo(-30, 50);
          ctx.quadraticCurveTo(-25, 30, -20, 20);
          ctx.lineTo(-40, 10);
          ctx.fill();

          ctx.fillStyle = "#3e2723";
          ctx.beginPath();
          ctx.arc(-40, 30, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = metalColor;
          ctx.beginPath();
          ctx.moveTo(-40, 10);
          ctx.lineTo(20, 10);
          ctx.lineTo(20, 35);
          ctx.lineTo(-20, 35);
          ctx.lineTo(-40, 20);
          ctx.fill();

          ctx.fillStyle = darkMetal;
          ctx.fillRect(-15, 5, 35, 25);
          ctx.fillStyle = "#37474f";
          ctx.fillRect(-10, 8, 25, 6);
          ctx.fillRect(-10, 20, 25, 6);

          ctx.fillStyle = metalColor;
          ctx.fillRect(20, 5, 60, 12);
          ctx.fillStyle = "#455a64";
          ctx.fillRect(20, 5, 60, 3);
          ctx.fillStyle = darkMetal;
          ctx.beginPath();
          ctx.moveTo(75, 5);
          ctx.lineTo(80, 5);
          ctx.lineTo(80, -2);
          ctx.lineTo(75, 5);
          ctx.fill();

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

    export function updateAndDrawSlam(
      ctx,
      slamState,
      players,
      cardImages,
      setShakeTimer,
    ) {
      slamState.progress += 0.08;

      if (slamState.progress >= 1) {
        slamState.active = false;
        return;
      }

      const player = players[slamState.playerIndex];
      let scale = 1;
      let alpha = 1;
      const yOffset = -180;
      const xOffset = 60;

      if (slamState.progress < 0.3) {
        const t = slamState.progress / 0.3;
        scale = 2.5 - t * 1.5;
        alpha = Math.min(1, t * 3);
      } else if (slamState.progress > 0.7) {
        alpha = 1 - (slamState.progress - 0.7) / 0.3;
      }

      if (slamState.progress >= 0.3 && slamState.progress < 0.38) {
        if (setShakeTimer) setShakeTimer(10);
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
        ctx.drawImage(cardImages.FIST, -size / 2, -size / 2, size, size);
      } else {
        // Fallback drawing for fist if image not loaded
        const skinColor = "#e0ac69";
        const shadowColor = "#8d6e63";
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.ellipse(10, 10, size / 2.2, size / 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        const r = 20;
        const x = -size / 2.2;
        const y = -size / 2.5;
        const w = size * 0.9;
        const h = size * 0.7;
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
        for (let i = 0; i < 4; i++) {
          const fingerX = -size / 2.8 + i * (size * 0.23);
          const fingerY = size * 0.2;
          ctx.fillStyle = shadowColor;
          ctx.beginPath();
          ctx.arc(fingerX, fingerY + 3, size * 0.11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = skinColor;
          ctx.beginPath();
          ctx.arc(fingerX, fingerY, size * 0.11, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = shadowColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(fingerX, fingerY, size * 0.08, 0.5, 2.6);
          ctx.stroke();
        }
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.ellipse(
          -size * 0.35,
          0,
          size * 0.12,
          size * 0.22,
          0.2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(
          -size * 0.35,
          0,
          size * 0.12,
          size * 0.22,
          0.2,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    export function drawSitdownCharacters(ctx, players, sitdownCharImages) {
      players.forEach((player) => {
        if (
          player.charIndex !== undefined &&
          sitdownCharImages[player.charIndex]
        ) {
          const img = sitdownCharImages[player.charIndex];
          if (img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(player.angle + Math.PI);
            const scale = player.animScale || 1.0;
            ctx.scale(scale, scale);
            const targetHeight = 350;
            const ratio = img.naturalWidth / img.naturalHeight;
            const targetWidth = targetHeight * ratio;
            ctx.translate(0, -120);
            ctx.drawImage(
              img,
              -targetWidth / 2,
              -targetHeight / 2,
              targetWidth,
              targetHeight,
            );
            ctx.restore();
          }
        }
      });
    }

    export function updateAndDrawDevilCardAnim(
      ctx,
      devilCardAnim,
      cardImages,
      width,
      height,
    ) {
      if (!devilCardAnim.active) return;

      // 화면 오른쪽 아래 좌표 설정
      const startX = width + 150;
      const startY = height + 200;
      const endX = width - 150;
      const endY = height - 150;

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
  }
  import { drawFrontCard } from "./graphics-utils.js";

  export function drawPlayerRevolvers(ctx, players, gameState, cardImages) {
    players.forEach((player, index) => {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);

      const restX = 130;
      const restY = -150;
      const restRotation = -Math.PI / 2 + 0.2;

      let currentX = restX;
      let currentY = restY;
      let currentRotation = restRotation;

      if (
        gameState.phase === "ROULETTE" &&
        gameState.victimIndices.includes(index)
      ) {
        const aimX = 60;
        const aimY = -80;
        let aimRotation = Math.atan2(-aimY, -aimX);

        if (aimRotation - restRotation > Math.PI) {
          aimRotation -= Math.PI * 2;
        } else if (aimRotation - restRotation < -Math.PI) {
          aimRotation += Math.PI * 2;
        }

        const elapsed = Date.now() - gameState.rouletteStartTime;
        const duration = 5000;
        let progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        currentX = restX + (aimX - restX) * ease;
        currentY = restY + (aimY - restY) * ease;
        currentRotation = restRotation + (aimRotation - restRotation) * ease;

        if (progress > 0.8) {
          currentX += (Math.random() - 0.5) * 3;
          currentY += (Math.random() - 0.5) * 3;
        }
      }

      ctx.translate(currentX, currentY);
      ctx.rotate(currentRotation);

      const scale = 0.9;
      ctx.scale(scale, scale);

      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.ellipse(0, 20, 60, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      const w = 100;
      const h = 60;

      const metalColor = "#546e7a";
      const gripColor = "#5d4037";
      const darkMetal = "#263238";

      if (
        cardImages.REVOLVER &&
        cardImages.REVOLVER.complete &&
        cardImages.REVOLVER.naturalWidth > 0
      ) {
        ctx.drawImage(cardImages.REVOLVER, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = gripColor;
        ctx.beginPath();
        ctx.moveTo(-40, 10);
        ctx.quadraticCurveTo(-55, 30, -50, 50);
        ctx.lineTo(-30, 50);
        ctx.quadraticCurveTo(-25, 30, -20, 20);
        ctx.lineTo(-40, 10);
        ctx.fill();

        ctx.fillStyle = "#3e2723";
        ctx.beginPath();
        ctx.arc(-40, 30, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = metalColor;
        ctx.beginPath();
        ctx.moveTo(-40, 10);
        ctx.lineTo(20, 10);
        ctx.lineTo(20, 35);
        ctx.lineTo(-20, 35);
        ctx.lineTo(-40, 20);
        ctx.fill();

        ctx.fillStyle = darkMetal;
        ctx.fillRect(-15, 5, 35, 25);
        ctx.fillStyle = "#37474f";
        ctx.fillRect(-10, 8, 25, 6);
        ctx.fillRect(-10, 20, 25, 6);

        ctx.fillStyle = metalColor;
        ctx.fillRect(20, 5, 60, 12);
        ctx.fillStyle = "#455a64";
        ctx.fillRect(20, 5, 60, 3);
        ctx.fillStyle = darkMetal;
        ctx.beginPath();
        ctx.moveTo(75, 5);
        ctx.lineTo(80, 5);
        ctx.lineTo(80, -2);
        ctx.lineTo(75, 5);
        ctx.fill();

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

  export function updateAndDrawSlam(
    ctx,
    slamState,
    players,
    cardImages,
    setShakeTimer,
  ) {
    slamState.progress += 0.08;

    if (slamState.progress >= 1) {
      slamState.active = false;
      return;
    }

    const player = players[slamState.playerIndex];
    let scale = 1;
    let alpha = 1;
    const yOffset = -180;
    const xOffset = 60;

    if (slamState.progress < 0.3) {
      const t = slamState.progress / 0.3;
      scale = 2.5 - t * 1.5;
      alpha = Math.min(1, t * 3);
    } else if (slamState.progress > 0.7) {
      alpha = 1 - (slamState.progress - 0.7) / 0.3;
    }

    if (slamState.progress >= 0.3 && slamState.progress < 0.38) {
      if (setShakeTimer) setShakeTimer(10);
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
      ctx.drawImage(cardImages.FIST, -size / 2, -size / 2, size, size);
    } else {
      // Fallback drawing for fist if image not loaded
      const skinColor = "#e0ac69";
      const shadowColor = "#8d6e63";
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.ellipse(10, 10, size / 2.2, size / 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      const r = 20;
      const x = -size / 2.2;
      const y = -size / 2.5;
      const w = size * 0.9;
      const h = size * 0.7;
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
      for (let i = 0; i < 4; i++) {
        const fingerX = -size / 2.8 + i * (size * 0.23);
        const fingerY = size * 0.2;
        ctx.fillStyle = shadowColor;
        ctx.beginPath();
        ctx.arc(fingerX, fingerY + 3, size * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(fingerX, fingerY, size * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(fingerX, fingerY, size * 0.08, 0.5, 2.6);
        ctx.stroke();
      }
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.ellipse(
        -size * 0.35,
        0,
        size * 0.12,
        size * 0.22,
        0.2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.strokeStyle = shadowColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(
        -size * 0.35,
        0,
        size * 0.12,
        size * 0.22,
        0.2,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  export function drawSitdownCharacters(ctx, players, sitdownCharImages) {
    players.forEach((player) => {
      if (
        player.charIndex !== undefined &&
        sitdownCharImages[player.charIndex]
      ) {
        const img = sitdownCharImages[player.charIndex];
        if (img.complete && img.naturalWidth > 0) {
          ctx.save();
          ctx.translate(player.x, player.y);
          ctx.rotate(player.angle + Math.PI);
          const scale = player.animScale || 1.0;
          ctx.scale(scale, scale);
          const targetHeight = 350;
          const ratio = img.naturalWidth / img.naturalHeight;
          const targetWidth = targetHeight * ratio;
          ctx.translate(0, -120);
          ctx.drawImage(
            img,
            -targetWidth / 2,
            -targetHeight / 2,
            targetWidth,
            targetHeight,
          );
          ctx.restore();
        }
      }
    });
  }

  export function updateAndDrawDevilCardAnim(
    ctx,
    devilCardAnim,
    cardImages,
    width,
    height,
  ) {
    if (!devilCardAnim.active) return;

    // 화면 오른쪽 아래 좌표 설정
    const startX = width + 150;
    const startY = height + 200;
    const endX = width - 150;
    const endY = height - 150;

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
}
