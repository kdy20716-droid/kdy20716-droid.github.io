export function drawBackCard(
  ctx,
  cardImages,
  x,
  y,
  rotation,
  offsetX = 0,
  offsetY = 0,
  scaleX = 1,
  isSelected = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scaleX, 1);

  if (isSelected) {
    ctx.shadowColor = "rgba(255, 223, 0, 1)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
  }

  const w = 80;
  const h = 120;
  const r = 5;
  const cx = -w / 2;
  const cy = -h / 2;

  ctx.beginPath();
  ctx.moveTo(cx + r, cy);
  ctx.lineTo(cx + w - r, cy);
  ctx.quadraticCurveTo(cx + w, cy, cx + w, cy + r);
  ctx.lineTo(cx + w, cy + h - r);
  ctx.quadraticCurveTo(cx + w, cy + h, cx + w - r, cy + h);
  ctx.lineTo(cx + r, cy + h);
  ctx.quadraticCurveTo(cx, cy + h, cx, cy + h - r);
  ctx.lineTo(cx, cy + r);
  ctx.quadraticCurveTo(cx, cy, cx + r, cy);
  ctx.closePath();

  ctx.save();
  ctx.clip();
  if (
    cardImages.BACK &&
    cardImages.BACK.complete &&
    cardImages.BACK.naturalWidth > 0
  ) {
    ctx.drawImage(cardImages.BACK, cx, cy, w, h);
  } else {
    ctx.fillStyle = "#b71c1c";
    ctx.fillRect(cx, cy, w, h);
  }
  ctx.restore();

  ctx.strokeStyle = "#dcdcdc";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

export function drawFrontCard(
  ctx,
  cardImages,
  x,
  y,
  rotation,
  type,
  offsetX = 0,
  offsetY = 0,
  scaleX = 1,
  isSelected = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scaleX, 1);

  if (isSelected) {
    ctx.shadowColor = "rgba(255, 223, 0, 1)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
  }

  const w = 80;
  const h = 120;
  const r = 5;
  const cx = -w / 2;
  const cy = -h / 2;

  const drawCardPath = () => {
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    ctx.lineTo(cx + w - r, cy);
    ctx.quadraticCurveTo(cx + w, cy, cx + w, cy + r);
    ctx.lineTo(cx + w, cy + h - r);
    ctx.quadraticCurveTo(cx + w, cy + h, cx + w - r, cy + h);
    ctx.lineTo(cx + r, cy + h);
    ctx.quadraticCurveTo(cx, cy + h, cx, cy + h - r);
    ctx.lineTo(cx, cy + r);
    ctx.quadraticCurveTo(cx, cy, cx + r, cy);
    ctx.closePath();
  };

  ctx.save();
  drawCardPath();
  ctx.clip();

  if (
    cardImages[type] &&
    cardImages[type].complete &&
    cardImages[type].naturalWidth > 0
  ) {
    ctx.drawImage(cardImages[type], cx, cy, w, h);
  } else {
    ctx.fillStyle = "white";
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = "#dcdcdc";
  ctx.lineWidth = 1;
  drawCardPath();
  ctx.stroke();

  ctx.restore();
}

export function drawCardDeck(ctx, cardImages, x, y) {
  ctx.save();
  ctx.translate(x, y);

  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  const w = 80;
  const h = 120;
  const r = 5;

  const drawCardPath = (x, y) => {
    ctx.beginPath();
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
  };

  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate(0.05 * (i - 2));

    const cx = -w / 2;
    const cy = -h / 2;

    drawCardPath(cx, cy);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#dcdcdc";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (i === 4) {
      ctx.save();
      ctx.clip();
      if (
        cardImages.BACK &&
        cardImages.BACK.complete &&
        cardImages.BACK.naturalWidth > 0
      ) {
        ctx.drawImage(cardImages.BACK, cx, cy, w, h);
      } else {
        ctx.fillStyle = "#b71c1c";
        ctx.fillRect(cx, cy, w, h);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}
