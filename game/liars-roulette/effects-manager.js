/* export const particles = [];
export const fireworks = [];
export const embers = [];
export const bloodSplatters = [];

export function initParticles(width, height) {
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random(),
      changeAlpha: (Math.random() - 0.5) * 0.01,
    });
  }
}

export function updateAndDrawParticles(ctx, width, height) {
  ctx.fillStyle = "#f0e6d2";
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha += p.changeAlpha;

    if (p.alpha <= 0 || p.alpha >= 0.3) {
      p.changeAlpha *= -1;
    }
    if (p.alpha < 0) p.alpha = 0;
    if (p.alpha > 0.3) p.alpha = 0.3;

    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;

    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1.0;
}

export function createFirework(x, y) {
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

export function updateAndDrawFireworks(ctx) {
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

export function createBloodSplatter(cx, cy) {
  // 1. Main Pool
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
    bloodSplatters.push({
      x: cx + (Math.random() - 0.5) * 20,
      y: cy + (Math.random() - 0.5) * 20,
      points: points,
      color: `rgba(${100 + Math.random() * 40}, 0, 0, ${0.8 + Math.random() * 0.2})`,
      scaleX: 1,
      scaleY: 1,
      rotation: Math.random() * Math.PI * 2,
    });
  }
  // 2. Droplets
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
    bloodSplatters.push({
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

export function drawBloodSplatters(ctx) {
  bloodSplatters.forEach((splat) => {
    ctx.save();
    ctx.translate(splat.x, splat.y);
    ctx.rotate(splat.rotation);
    ctx.scale(splat.scaleX, splat.scaleY);
    ctx.fillStyle = splat.color;

    ctx.beginPath();
    if (splat.points && splat.points.length > 0) {
      ctx.moveTo(splat.points[0].x, splat.points[0].y);
      for (let i = 1; i < splat.points.length; i++) {
        const p = splat.points[i];
        const prev = splat.points[i - 1];
        const cpX = (prev.x + p.x) / 2;
        const cpY = (prev.y + p.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cpX, cpY);
      }
      const last = splat.points[splat.points.length - 1];
      const first = splat.points[0];
      const cpX = (last.x + first.x) / 2;
      const cpY = (last.y + first.y) / 2;
      ctx.quadraticCurveTo(last.x, last.y, cpX, cpY);
      ctx.quadraticCurveTo(cpX, cpY, first.x, first.y);
    } else {
      ctx.arc(0, 0, splat.radius || 10, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  });
}

export function addEmber(ember) {
  embers.push(ember);
}

export function updateAndDrawEmbers(ctx, height, intensity) {
  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    e.x += e.vx + Math.sin(Date.now() * 0.01 + e.y * 0.02);
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
  export const particles = [];
  export const fireworks = [];
  export const embers = [];
  export const bloodSplatters = [];

  export function initParticles(width, height) {
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random(),
        changeAlpha: (Math.random() - 0.5) * 0.01,
      });
    }
  }

  export function updateAndDrawParticles(ctx, width, height) {
    ctx.fillStyle = "#f0e6d2";
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha += p.changeAlpha;

      if (p.alpha <= 0 || p.alpha >= 0.3) {
        p.changeAlpha *= -1;
      }
      if (p.alpha < 0) p.alpha = 0;
      if (p.alpha > 0.3) p.alpha = 0.3;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }

  export function createFirework(x, y) {
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

  export function updateAndDrawFireworks(ctx) {
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

  export function createBloodSplatter(cx, cy) {
    // 1. Main Pool
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
      bloodSplatters.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        points: points,
        color: `rgba(${100 + Math.random() * 40}, 0, 0, ${0.8 + Math.random() * 0.2})`,
        scaleX: 1,
        scaleY: 1,
        rotation: Math.random() * Math.PI * 2,
      });
    }
    // 2. Droplets
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
      bloodSplatters.push({
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

  export function drawBloodSplatters(ctx) {
    bloodSplatters.forEach((splat) => {
      ctx.save();
      ctx.translate(splat.x, splat.y);
      ctx.rotate(splat.rotation);
      ctx.scale(splat.scaleX, splat.scaleY);
      ctx.fillStyle = splat.color;

      ctx.beginPath();
      if (splat.points && splat.points.length > 0) {
        ctx.moveTo(splat.points[0].x, splat.points[0].y);
        for (let i = 1; i < splat.points.length; i++) {
          const p = splat.points[i];
          const prev = splat.points[i - 1];
          const cpX = (prev.x + p.x) / 2;
          const cpY = (prev.y + p.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, cpX, cpY);
        }
        const last = splat.points[splat.points.length - 1];
        const first = splat.points[0];
        const cpX = (last.x + first.x) / 2;
        const cpY = (last.y + first.y) / 2;
        ctx.quadraticCurveTo(last.x, last.y, cpX, cpY);
        ctx.quadraticCurveTo(cpX, cpY, first.x, first.y);
      } else {
        ctx.arc(0, 0, splat.radius || 10, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    });
  }

  export function addEmber(ember) {
    embers.push(ember);
  }

  export function updateAndDrawEmbers(ctx, height, intensity) {
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.x += e.vx + Math.sin(Date.now() * 0.01 + e.y * 0.02);
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
  }
}
