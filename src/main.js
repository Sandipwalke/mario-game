const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  score: document.getElementById('score'),
  coins: document.getElementById('coins'),
  world: document.getElementById('world'),
  time: document.getElementById('time'),
  status: document.getElementById('status'),
  highscore: document.getElementById('highscore'),
  particles: document.getElementById('particlesToggle'),
  music: document.getElementById('musicToggle'),
  touchToggle: document.getElementById('touchToggle'),
  touchPanel: document.getElementById('touch')
};

const settings = {
  gravity: 0.7,
  friction: 0.84,
  moveSpeed: 3.3,
  runBoost: 1.55,
  jumpForce: -13.5,
  levelLength: 6200,
  timeLimit: 400,
  particleLimit: 220
};

const input = {
  left: false,
  right: false,
  jumpPressed: false,
  run: false,
  pause: false,
  mute: false
};

const SFX = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  const audio = AC ? new AC() : null;
  let musicTimer;
  function tone(freq, duration = 0.08, gain = 0.05, type = 'square') {
    if (!audio || input.mute || !ui.music.checked) return;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.stop(audio.currentTime + duration);
  }
  function startMusic() {
    if (!audio || musicTimer) return;
    let i = 0;
    const melody = [
      659, 659, 0, 659, 0, 523, 659, 0, 784, 0, 392,
      523, 392, 330, 440, 494, 466, 440, 392, 659
    ];
    musicTimer = setInterval(() => {
      if (!ui.music.checked || input.mute || game.state !== 'running') return;
      const note = melody[i % melody.length];
      if (note > 0) tone(note, 0.12, 0.03, 'triangle');
      i += 1;
    }, 180);
  }
  return {
    jump: () => tone(420, 0.08),
    coin: () => tone(900, 0.05, 0.05, 'triangle'),
    stomp: () => tone(190, 0.09),
    hit: () => tone(120, 0.25, 0.05, 'sawtooth'),
    fire: () => tone(320, 0.07, 0.04, 'sawtooth'),
    win: () => [784, 988, 1175].forEach((n, idx) => setTimeout(() => tone(n, 0.1), idx * 120)),
    music: startMusic
  };
})();

class Entity {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.dead = false;
  }
  get left() { return this.x; }
  get right() { return this.x + this.w; }
  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  intersects(other) {
    return this.right > other.left && this.left < other.right && this.bottom > other.top && this.top < other.bottom;
  }
}

class Player extends Entity {
  constructor() {
    super(80, 350, 34, 44);
    this.color = '#ff5252';
    this.onGround = false;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.facing = 1;
    this.power = 'small';
    this.invuln = 0;
    this.fireCooldown = 0;
  }
  update(level) {
    const speed = settings.moveSpeed * (input.run ? settings.runBoost : 1);
    if (input.left) {
      this.vx -= 0.45;
      this.facing = -1;
    }
    if (input.right) {
      this.vx += 0.45;
      this.facing = 1;
    }
    this.vx = Math.max(-speed, Math.min(speed, this.vx));
    this.vx *= settings.friction;

    if (input.jumpPressed) this.jumpBuffer = 8;
    if (this.jumpBuffer > 0) this.jumpBuffer -= 1;
    if (this.onGround) this.coyote = 6;
    else this.coyote -= 1;

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = settings.jumpForce * (this.power === 'small' ? 1 : 1.08);
      this.onGround = false;
      this.jumpBuffer = 0;
      this.coyote = 0;
      SFX.jump();
    }

    this.vy += settings.gravity;
    this.vy = Math.min(this.vy, 18);

    this.x += this.vx;
    resolveCollisions(this, level.solids, 'x');
    this.y += this.vy;
    this.onGround = false;
    resolveCollisions(this, level.solids, 'y', () => {
      this.onGround = true;
      this.vy = 0;
    });

    this.invuln = Math.max(0, this.invuln - 1);
    this.fireCooldown = Math.max(0, this.fireCooldown - 1);

    if (this.y > canvas.height + 220) game.loseLife('You fell into a pit!');
  }
  hurt() {
    if (this.invuln > 0) return;
    if (this.power === 'fire') {
      this.power = 'big';
      this.h = 58;
    } else if (this.power === 'big') {
      this.power = 'small';
      this.h = 44;
    } else {
      game.loseLife('You were defeated!');
      return;
    }
    this.invuln = 120;
    SFX.hit();
  }
  draw(camX) {
    ctx.save();
    if (this.invuln > 0 && Math.floor(this.invuln / 5) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.fillStyle = this.power === 'fire' ? '#ffffff' : this.color;
    ctx.fillRect(this.x - camX, this.y, this.w, this.h);
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(this.x - camX + 4, this.y - 6, this.w - 8, 8);
    ctx.restore();
  }
}

class Enemy extends Entity {
  constructor(x, y, type = 'goomba') {
    super(x, y, 34, 34);
    this.type = type;
    this.vx = type === 'koopa' ? -1.1 : -0.85;
  }
  update(level) {
    this.vy += settings.gravity;
    this.x += this.vx;
    const hitWall = resolveCollisions(this, level.solids, 'x');
    if (hitWall) this.vx *= -1;
    this.y += this.vy;
    resolveCollisions(this, level.solids, 'y', () => { this.vy = 0; });
  }
  draw(camX) {
    ctx.fillStyle = this.type === 'koopa' ? '#43a047' : '#8d6e63';
    ctx.fillRect(this.x - camX, this.y, this.w, this.h);
    ctx.fillStyle = '#000';
    ctx.fillRect(this.x - camX + 6, this.y + 8, 5, 5);
    ctx.fillRect(this.x - camX + 22, this.y + 8, 5, 5);
  }
}

class Fireball extends Entity {
  constructor(x, y, dir) {
    super(x, y, 14, 14);
    this.vx = dir * 7;
    this.vy = -2;
    this.bounces = 3;
  }
  update(level) {
    this.vy += settings.gravity * 0.4;
    this.x += this.vx;
    resolveCollisions(this, level.solids, 'x', () => (this.dead = true));
    this.y += this.vy;
    const landed = resolveCollisions(this, level.solids, 'y', () => {
      this.vy = -5.5;
      this.bounces -= 1;
      if (this.bounces <= 0) this.dead = true;
    });
    if (!landed && this.y > canvas.height) this.dead = true;
  }
  draw(camX) {
    ctx.fillStyle = '#ff9800';
    ctx.beginPath();
    ctx.arc(this.x - camX + 7, this.y + 7, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function createLevel() {
  const solids = [];
  const coins = [];
  const blocks = [];
  const enemies = [];
  const powerups = [];

  solids.push({ x: -200, y: 500, w: settings.levelLength + 400, h: 200, type: 'ground' });
  const gaps = [[720, 190], [1740, 170], [2810, 210], [4180, 180]];
  gaps.forEach(([x, w]) => solids.push({ x, y: 500, w, h: 260, type: 'gap' }));

  for (let x = 280; x < settings.levelLength; x += 380) {
    solids.push({ x, y: 440 - ((x / 95) % 3) * 40, w: 120, h: 24, type: 'platform' });
  }

  for (let x = 240; x < settings.levelLength - 200; x += 120) {
    if (Math.random() < 0.6) coins.push({ x, y: 330 + Math.sin(x / 100) * 70, w: 16, h: 16, taken: false });
  }

  [620, 1040, 1480, 2250, 3320, 3900, 4700, 5480].forEach((x, idx) => {
    enemies.push(new Enemy(x, 465, idx % 2 ? 'koopa' : 'goomba'));
  });

  [540, 1360, 2480, 3600, 5100].forEach((x, idx) => {
    blocks.push({ x, y: 360, w: 42, h: 42, used: false, kind: idx % 2 ? 'coin' : 'power' });
  });

  powerups.push({ x: 2020, y: 458, w: 24, h: 24, kind: 'mushroom', active: true, vx: 1.2 });
  powerups.push({ x: 4240, y: 458, w: 24, h: 24, kind: 'flower', active: true, vx: -1.1 });

  const flag = { x: settings.levelLength - 180, y: 180, w: 16, h: 320 };
  return { solids, coins, enemies, blocks, powerups, flag };
}

function resolveCollisions(entity, solids, axis, onYLand) {
  let collided = false;
  for (const solid of solids) {
    if (solid.type === 'gap') {
      if (entity.bottom <= 510 && entity.right > solid.x && entity.left < solid.x + solid.w) continue;
      continue;
    }
    const temp = { left: solid.x, right: solid.x + solid.w, top: solid.y, bottom: solid.y + solid.h };
    if (entity.right > temp.left && entity.left < temp.right && entity.bottom > temp.top && entity.top < temp.bottom) {
      collided = true;
      if (axis === 'x') {
        if (entity.vx > 0) entity.x = temp.left - entity.w;
        if (entity.vx < 0) entity.x = temp.right;
        entity.vx = 0;
      } else {
        if (entity.vy > 0) {
          entity.y = temp.top - entity.h;
          onYLand?.();
        } else if (entity.vy < 0) {
          entity.y = temp.bottom;
          entity.vy = 0;
        }
      }
    }
  }
  return collided;
}

const game = {
  state: 'ready',
  world: '1-1',
  score: 0,
  coins: 0,
  time: settings.timeLimit,
  lives: 3,
  camX: 0,
  tick: 0,
  bestScore: Number(localStorage.getItem('mario_best_score') || 0),
  player: new Player(),
  level: createLevel(),
  particles: [],
  fireballs: [],

  resetLevel(keepScore = true) {
    this.level = createLevel();
    this.player = new Player();
    this.fireballs = [];
    this.particles = [];
    this.camX = 0;
    this.time = settings.timeLimit;
    this.tick = 0;
    if (!keepScore) {
      this.score = 0;
      this.coins = 0;
      this.lives = 3;
    }
    this.state = 'running';
    ui.status.textContent = 'Reach the flag and collect everything!';
    SFX.music();
  },

  addScore(points) {
    this.score += points;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('mario_best_score', String(this.bestScore));
    }
  },

  loseLife(msg) {
    this.lives -= 1;
    if (this.lives < 0) {
      this.state = 'gameover';
      ui.status.textContent = `Game Over — ${msg} Press Enter to restart.`;
    } else {
      this.state = 'respawn';
      ui.status.textContent = `${msg} Lives left: ${this.lives}. Restarting...`;
      setTimeout(() => this.resetLevel(true), 1250);
    }
  }
};

ui.highscore.textContent = String(game.bestScore);

function spawnParticles(x, y, color = '#ffd54f', count = 8) {
  if (!ui.particles.checked) return;
  for (let i = 0; i < count; i += 1) {
    game.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: Math.random() * -3.8,
      life: 25 + Math.random() * 20,
      color
    });
  }
  if (game.particles.length > settings.particleLimit) {
    game.particles.splice(0, game.particles.length - settings.particleLimit);
  }
}

function collectCoin() {
  game.coins += 1;
  game.addScore(100);
  SFX.coin();
  if (game.coins % 100 === 0) game.lives += 1;
}

function update() {
  if (game.state !== 'running') return;
  game.tick += 1;
  if (game.tick % 60 === 0) {
    game.time -= 1;
    if (game.time <= 0) game.loseLife('Time up!');
  }

  game.player.update(game.level);

  if (input.run && game.player.power === 'fire' && game.player.fireCooldown === 0) {
    game.fireballs.push(new Fireball(game.player.x + (game.player.facing > 0 ? game.player.w : -14), game.player.y + 18, game.player.facing));
    game.player.fireCooldown = 16;
    SFX.fire();
  }

  for (const enemy of game.level.enemies) {
    if (enemy.dead) continue;
    enemy.update(game.level);
    if (game.player.intersects(enemy)) {
      if (game.player.vy > 0 && game.player.bottom - 8 < enemy.top + 12) {
        enemy.dead = true;
        game.player.vy = -9;
        game.addScore(250);
        spawnParticles(enemy.x, enemy.y, '#ffb74d', 12);
        SFX.stomp();
      } else {
        game.player.hurt();
      }
    }
  }

  for (const ball of game.fireballs) {
    ball.update(game.level);
    for (const enemy of game.level.enemies) {
      if (!enemy.dead && ball.intersects(enemy)) {
        enemy.dead = true;
        ball.dead = true;
        spawnParticles(enemy.x, enemy.y, '#ff7043', 8);
        game.addScore(200);
      }
    }
  }
  game.fireballs = game.fireballs.filter((f) => !f.dead);

  for (const coin of game.level.coins) {
    if (!coin.taken && game.player.intersects({ left: coin.x, right: coin.x + coin.w, top: coin.y, bottom: coin.y + coin.h })) {
      coin.taken = true;
      collectCoin();
      spawnParticles(coin.x, coin.y);
    }
  }

  for (const block of game.level.blocks) {
    if (block.used) continue;
    const nearX = game.player.right > block.x && game.player.left < block.x + block.w;
    const hitFromBelow = game.player.vy < 0 && game.player.top <= block.y + block.h && game.player.top >= block.y + block.h - 12;
    if (nearX && hitFromBelow) {
      block.used = true;
      game.player.vy = 2;
      if (block.kind === 'coin') {
        collectCoin();
      } else {
        game.player.power = game.player.power === 'small' ? 'big' : 'fire';
        game.player.h = game.player.power === 'small' ? 44 : 58;
        game.addScore(500);
      }
      spawnParticles(block.x + 20, block.y, '#fff176', 10);
    }
  }

  for (const p of game.level.powerups) {
    if (!p.active) continue;
    p.vy = (p.vy || 0) + settings.gravity;
    p.x += p.vx;
    p.y += p.vy;
    const entityProxy = { x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy, get left() { return this.x; }, get right() { return this.x + this.w; }, get top() { return this.y; }, get bottom() { return this.y + this.h; } };
    if (resolveCollisions(entityProxy, game.level.solids, 'x')) p.vx *= -1;
    const landed = resolveCollisions(entityProxy, game.level.solids, 'y', () => {
      p.vy = 0;
      p.y = entityProxy.y;
    });
    p.x = entityProxy.x;
    p.y = entityProxy.y;
    if (!landed) p.vy = entityProxy.vy;

    if (game.player.intersects({ left: p.x, right: p.x + p.w, top: p.y, bottom: p.y + p.h })) {
      p.active = false;
      game.player.power = p.kind === 'flower' ? 'fire' : game.player.power === 'small' ? 'big' : game.player.power;
      game.player.h = game.player.power === 'small' ? 44 : 58;
      game.addScore(1000);
      spawnParticles(p.x, p.y, '#81c784', 14);
    }
  }

  if (game.player.intersects({ left: game.level.flag.x - 10, right: game.level.flag.x + 20, top: game.level.flag.y, bottom: game.level.flag.y + game.level.flag.h })) {
    game.state = 'win';
    game.addScore(game.time * 10);
    ui.status.textContent = 'Course clear! Press Enter for a new run.';
    SFX.win();
  }

  for (const particle of game.particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.18;
    particle.life -= 1;
  }
  game.particles = game.particles.filter((p) => p.life > 0);

  game.camX = Math.max(0, Math.min(game.player.x - 240, settings.levelLength - canvas.width));
}

function drawBackground() {
  ctx.fillStyle = '#7ec8ff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 7; i += 1) {
    const x = (i * 260 - (game.camX * 0.35) % 260);
    ctx.fillStyle = '#ffffffaa';
    ctx.beginPath();
    ctx.ellipse(x + 120, 120 + (i % 2) * 40, 56, 24, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  drawBackground();

  for (const solid of game.level.solids) {
    if (solid.type === 'gap') continue;
    ctx.fillStyle = solid.type === 'ground' ? '#6d4c41' : '#8d6e63';
    ctx.fillRect(solid.x - game.camX, solid.y, solid.w, solid.h);
    if (solid.type !== 'ground') {
      ctx.fillStyle = '#a1887f';
      ctx.fillRect(solid.x - game.camX, solid.y + 6, solid.w, 5);
    }
  }

  for (const gap of game.level.solids.filter((s) => s.type === 'gap')) {
    ctx.fillStyle = '#0a1b3f';
    ctx.fillRect(gap.x - game.camX, 500, gap.w, 76);
  }

  for (const coin of game.level.coins) {
    if (coin.taken) continue;
    ctx.fillStyle = '#fdd835';
    ctx.beginPath();
    ctx.arc(coin.x - game.camX + 8, coin.y + 8, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const block of game.level.blocks) {
    ctx.fillStyle = block.used ? '#757575' : '#c77832';
    ctx.fillRect(block.x - game.camX, block.y, block.w, block.h);
    ctx.fillStyle = '#fff';
    ctx.fillText('?', block.x - game.camX + 16, block.y + 25);
  }

  for (const p of game.level.powerups) {
    if (!p.active) continue;
    ctx.fillStyle = p.kind === 'flower' ? '#f06292' : '#ef5350';
    ctx.fillRect(p.x - game.camX, p.y, p.w, p.h);
  }

  for (const enemy of game.level.enemies) {
    if (!enemy.dead) enemy.draw(game.camX);
  }

  for (const ball of game.fireballs) ball.draw(game.camX);
  game.player.draw(game.camX);

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(game.level.flag.x - game.camX, game.level.flag.y, game.level.flag.w, game.level.flag.h);
  ctx.fillStyle = '#e53935';
  ctx.fillRect(game.level.flag.x - game.camX + 12, game.level.flag.y + 22, 58, 38);

  for (const particle of game.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / 40);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - game.camX, particle.y, 4, 4);
  }
  ctx.globalAlpha = 1;

  if (game.state === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('PAUSED', canvas.width / 2 - 90, canvas.height / 2);
  }
}

function renderHud() {
  ui.score.textContent = String(game.score).padStart(6, '0');
  ui.coins.textContent = `x${String(game.coins).padStart(2, '0')}`;
  ui.world.textContent = `${game.world} • L${Math.max(0, game.lives)}`;
  ui.time.textContent = String(Math.max(0, game.time));
  ui.highscore.textContent = String(game.bestScore);
}

function loop() {
  if (game.state === 'running') update();
  draw();
  renderHud();
  requestAnimationFrame(loop);
}

function setupInput() {
  const keyMap = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ShiftLeft: 'run',
    ShiftRight: 'run',
    ArrowUp: 'jump',
    KeyW: 'jump',
    Space: 'jump'
  };

  addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
      if (game.state === 'ready' || game.state === 'gameover' || game.state === 'win') game.resetLevel(false);
    }
    if (e.code === 'KeyP' && game.state === 'running') {
      game.state = 'paused';
      ui.status.textContent = 'Paused. Press P to continue.';
      return;
    } else if (e.code === 'KeyP' && game.state === 'paused') {
      game.state = 'running';
      ui.status.textContent = 'Back in action!';
      return;
    }
    if (e.code === 'KeyM') input.mute = !input.mute;
    if (e.code === 'KeyR') game.resetLevel(true);

    const action = keyMap[e.code];
    if (!action) return;
    if (action === 'jump') input.jumpPressed = true;
    else input[action] = true;
  });

  addEventListener('keyup', (e) => {
    const action = keyMap[e.code];
    if (!action) return;
    if (action === 'jump') input.jumpPressed = false;
    else input[action] = false;
  });

  ui.touchToggle.addEventListener('change', () => {
    ui.touchPanel.hidden = !ui.touchToggle.checked;
  });

  ui.touchPanel.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const key = btn.dataset.key;
    if (key === 'jump') input.jumpPressed = true;
    else input[key] = true;
  });

  ui.touchPanel.addEventListener('pointerup', () => {
    input.left = false;
    input.right = false;
    input.run = false;
    input.jumpPressed = false;
  });
}

setupInput();
loop();
