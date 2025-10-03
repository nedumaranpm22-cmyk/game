// Mobile Controls wiring
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnShoot = document.getElementById('btnShoot');

if (btnLeft && btnRight && btnShoot) {
  // Touch/Mouse Down: set key pressed
  btnLeft.addEventListener('touchstart', () => { game.keys['ArrowLeft'] = true; });
  btnLeft.addEventListener('mousedown', () => { game.keys['ArrowLeft'] = true; });
  btnRight.addEventListener('touchstart', () => { game.keys['ArrowRight'] = true; });
  btnRight.addEventListener('mousedown', () => { game.keys['ArrowRight'] = true; });
  btnShoot.addEventListener('touchstart', () => { game.keys[' '] = true; });
  btnShoot.addEventListener('mousedown', () => { game.keys[' '] = true; });

  // Touch/Mouse End: unset key
  btnLeft.addEventListener('touchend', () => { game.keys['ArrowLeft'] = false; });
  btnLeft.addEventListener('mouseup', () => { game.keys['ArrowLeft'] = false; });
  btnRight.addEventListener('touchend', () => { game.keys['ArrowRight'] = false; });
  btnRight.addEventListener('mouseup', () => { game.keys['ArrowRight'] = false; });
  btnShoot.addEventListener('touchend', () => { game.keys[' '] = false; });
  btnShoot.addEventListener('mouseup', () => { game.keys[' '] = false; });
}
/* Debugged & cleaned script.js for TECHNOTHIRST
   Levels:
   1 -> drones (kill X to advance)
   2 -> robots (waves, one-by-one)
   3 -> boss (kill boss)
   4 -> victory
*/

const CANVAS_WIDTH = 960, CANVAS_HEIGHT = 600;
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const intro = document.getElementById("intro");
const gameContainer = document.getElementById("gameContainer");
const levelNumEl = document.getElementById("levelNum");
const scoreNumEl = document.getElementById("scoreNum");
const healthNumEl = document.getElementById("healthNum");
const centerMsg = document.getElementById("centerMessage");

/* Audio assets (paths must exist) */
const sounds = {
  shoot: new Audio("assets/sounds/shoot.wav"),
  hit: new Audio("assets/sounds/hit.wav"),
  explosion: new Audio("assets/sounds/explosion.wav"),
  levelup: new Audio("assets/sounds/levelup.wav"),
  bossMusic: new Audio("assets/sounds/boss.mp3"),
  victory: new Audio("assets/sounds/victory.wav"),
  ambience: new Audio("assets/sounds/ambience.mp3")
};
try { sounds.ambience.loop = true; } catch(e){}
try { sounds.bossMusic.loop = true; } catch(e){}

/* Game state (template; will be reinitialized in startGame) */
let game = {};

/* Player factory */
function makePlayer() {
  // Keep the larger player size you requested, but position relative to size
  const w = 192, h = 192;
  return {
    x: Math.max(8, (CANVAS_WIDTH / 2) - (w / 2)),
    y: CANVAS_HEIGHT - h - 24,
    w, h,
    speed: 300,
    health: 4,
    maxHealth: 6,
    fireRate: 300,
    lastShot: 0,
    gunLevel: 1
  };
}

/* Shooting */
function shoot(p) {
  if (!p || !game.running) return;
  const now = Date.now();
  if (now - p.lastShot < p.fireRate) return;
  p.lastShot = now;

  // play shoot safely
  try { sounds.shoot.cloneNode().play(); } catch(e) {}

  const baseX = p.x + p.w / 2;
  // determine bullet size & damage from gun level
  // Increased visual and collision size for player bullets
  let bulletW = 20, bulletH = 36, bulletDmg = 1; // was 12x24
  if (p.gunLevel === 2) { bulletW = 28; bulletH = 42; bulletDmg = 2; }
  if (p.gunLevel >= 3) { bulletW = 36; bulletH = 48; bulletDmg = 3; }

  // Fire direction by level
  if (game.currentLevel === 2) {
    // Level 2: only right direction
    game.bullets.push({
      x: baseX - bulletW/2,
      y: p.y + p.h/2 - bulletH/2,
      w: bulletW, h: bulletH,
      vx: 520, vy: 0,
      damage: bulletDmg,
      enemy: false
    });
  } else {
    // Other levels: upward
    game.bullets.push({
      x: baseX - bulletW/2,
      y: p.y,
      w: bulletW, h: bulletH,
      vx: 0, vy: -520,
      damage: bulletDmg,
      enemy: false
    });
  }
}

/* Enemy factories */
function spawnDrone() {
  const w = 100, h = 72; // larger drone as per your modification
  game.enemies.push({
    type: "drone",
    x: Math.random() * (CANVAS_WIDTH - w),
    y: - (10 + Math.random() * 140),
    w, h,
    hp: 1,
    vx: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 40) * 0.5,
    vy: (40 + Math.random() * 40) * 0.5,
    // Reduced firing rate: longer initial delay before first shot
    shootTimer: 4 + Math.random() * 3
  });
}

function spawnRobot() {
  const w = 180, h = 180; // large robot
  // Always spawn from the right if currentLevel=2 (as you wrote), else alternate
  const fromRight = (game.currentLevel === 2);
  const x = fromRight ? CANVAS_WIDTH + 6 : -w - 6;
  const vx = fromRight ? -(70 + Math.random()*40) : (70 + Math.random()*40);

  game.enemies.push({
    type: "robot",
    x, y: CANVAS_HEIGHT - h - 40,
    w, h,
    hp: 3,
    vx,
    shootTimer: 1.0 + Math.random()*1.6
  });
  game.robotsSpawnedTotal++;
}

function spawnBoss() {
  const w = 220, h = 200;
  game.enemies.push({
    type: "boss",
    x: (CANVAS_WIDTH - w) / 2,
    y: 50,
    w, h,
    hp: 60,
    maxHp: 60,
    vx: 140,
    shootTimer: 1.0,
    blink: 0
  });
  game.bossAlive = true;
  try { sounds.ambience.pause(); } catch(e){}
  try { sounds.bossMusic.cloneNode().loop = true; sounds.bossMusic.play(); } catch(e){}
}

/* Collision helper */
function rectsOverlap(a, b) {
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

/* Update loop */
function update(dt) {
  const p = game.player;
  if (!p) return;

  // Movement
  if (game.keys["ArrowLeft"] || game.keys["a"]) p.x -= p.speed * dt;
  if (game.keys["ArrowRight"] || game.keys["d"]) p.x += p.speed * dt;
  p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.w, p.x));

  // Shooting
  if (game.keys[" "] || game.keys["Spacebar"]) shoot(p);

  // Move bullets (reverse loop for safe splicing)
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.x += (b.vx || 0) * dt;
    b.y += (b.vy || 0) * dt;
    if (b.x < -200 || b.x > CANVAS_WIDTH + 200 || b.y < -200 || b.y > CANVAS_HEIGHT + 200) {
      game.bullets.splice(i, 1);
    }
  }

  // Move enemies and their behavior
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const e = game.enemies[i];

    if (e.type === "drone") {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < 8) { e.x = 8; e.vx *= -1; }
      if (e.x + e.w > CANVAS_WIDTH - 8) { e.x = CANVAS_WIDTH - 8 - e.w; e.vx *= -1; }
      // drone reaching ground causes game over in level 1
      if (e.y + e.h >= CANVAS_HEIGHT - 6 && game.currentLevel === 1) {
        return gameOver();
      }
      // drone downward shot occasionally (reduced frequency)
      e.shootTimer = e.shootTimer || (4 + Math.random()*3);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        game.bullets.push({
          x: e.x + e.w/2 - 6,
          y: e.y + e.h,
          w: 12, h: 18,
          vx: 0, vy: 180,
          enemy: true,
          damage: 0.5
        });
        // longer delay between subsequent shots
        e.shootTimer = 4.5 + Math.random()*2.5;
      }

    } else if (e.type === "robot") {
      e.x += e.vx * dt;
      // keep robots inside bounds (bounce)
      if (e.x < 6) { e.x = 6; e.vx *= -1; }
      if (e.x + e.w > CANVAS_WIDTH - 6) { e.x = CANVAS_WIDTH - 6 - e.w; e.vx *= -1; }

      // robot shoots horizontally toward player occasionally
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        const dir = (p.x + p.w/2 >= e.x + e.w/2) ? 1 : -1;
        game.bullets.push({
          x: e.x + e.w/2 - 8,
          y: e.y + e.h/2 - 6,
          w: 14, h: 14,
          vx: dir * 260, vy: 0,
          enemy: true,
          damage: 1
        });
        e.shootTimer = 1.0 + Math.random()*1.8;
      }

    } else if (e.type === "boss") {
      e.x += e.vx * dt;
      if (e.x < 6) { e.x = 6; e.vx *= -1; }
      if (e.x + e.w > CANVAS_WIDTH - 6) { e.x = CANVAS_WIDTH - 6 - e.w; e.vx *= -1; }

      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        for (let s = -1; s <= 1; s++) {
          game.bullets.push({
            x: e.x + e.w/2 - 10 + s*16,
            y: e.y + e.h - 8,
            w: 18, h: 18,
            vx: s * 80,
            vy: 200,
            enemy: true,
            damage: 1,
            bossPower: true
          });
        }
        e.shootTimer = 1.7 + Math.random()*0.7;
      }
    }
  }

  // Collisions: player bullets -> enemies
  for (let bi = game.bullets.length - 1; bi >= 0; bi--) {
    const b = game.bullets[bi];
    if (b.enemy) continue; // skip enemy bullets
    let removed = false;
    for (let ei = game.enemies.length - 1; ei >= 0; ei--) {
      const e = game.enemies[ei];
      if (!rectsOverlap(b, e)) continue;

      // apply damage
      e.hp = (typeof e.hp === "number") ? e.hp - (b.damage || 1) : (e.hp - 1);
      if (e.type === "boss") e.blink = 14;

      // remove the bullet
      game.bullets.splice(bi, 1);
      removed = true;
      try { sounds.hit.cloneNode().play(); } catch (err) {}

      // enemy death handling
      if (e.hp <= 0) {
        try { sounds.explosion.cloneNode().play(); } catch (err) {}
        game.enemies.splice(ei, 1);
        game.killCount++;
        game.score += (e.type === "boss") ? 1000 : (e.type === "robot" ? 200 : 100);
        if (e.type === "boss") {
          game.bossAlive = false;
          // progress to victory sequence via nextLevel()
          nextLevel();
        }
      }

      break; // stop checking other enemies for this bullet
    }
    if (removed) continue;
  }

  // Enemy bullets hitting player
  for (let bi = game.bullets.length - 1; bi >= 0; bi--) {
    const b = game.bullets[bi];
    if (!b.enemy) continue;
    if (rectsOverlap(b, game.player)) {
      game.player.health -= (b.damage || 1);
      try { sounds.hit.cloneNode().play(); } catch(e) {}
      game.bullets.splice(bi, 1);
      // player blink and short invulnerability frames
      game.playerBlink = 24;
      if (game.player.health <= 0) return gameOver();
    }
  }

  // Level 2: spawn robots one-by-one until limit
  if (game.currentLevel === 2) {
    const robotsInPlay = game.enemies.filter(e => e.type === "robot").length;
    const maxRobots = 6;
    if (robotsInPlay === 0 && game.robotsSpawnedTotal < maxRobots) {
      game.robotWaveDelay += dt;
      if (game.robotWaveDelay >= 1.2) {
        spawnRobot();
        game.robotWaveDelay = 0;
      }
    }
  }

  // Progression thresholds
  // Level 1: advance ONLY when all drones are destroyed
  if (game.currentLevel === 1) {
    const dronesRemaining = game.enemies.some(e => e.type === "drone");
    if (!dronesRemaining) nextLevel();
  }
  if (game.currentLevel === 2 && game.killCount >= 6) nextLevel();

  // Update HUD
  levelNumEl.textContent = game.currentLevel;
  scoreNumEl.textContent = game.score;
  healthNumEl.textContent = Math.max(0, Math.floor(game.player.health));
}

/* Preload backgrounds and entity images (optional) */
const bgImages = [ new Image(), new Image(), new Image() ];
bgImages[0].src = "images/bg_level1.png";
bgImages[1].src = "images/bg_level2.png";
bgImages[2].src = "images/bg_level3.png";

const entityImages = {
  player: new Image(),
  drone: new Image(),
  robot: new Image(),
  boss: new Image(),
  bullet: new Image()
};
entityImages.player.src = "images/player.png";
entityImages.drone.src = "images/drone.png";
entityImages.robot.src = "images/robot.png";
entityImages.boss.src = "images/boss.png";
entityImages.bullet.src = "images/bullet.png";

let bgLoaded = [false,false,false];
bgImages.forEach((img,i) => {
  img.onload = () => bgLoaded[i] = true;
  img.onerror = () => bgLoaded[i] = false;
});

/* Draw */
function draw() {
  // background
  const bgIdx = Math.max(0, Math.min(2, game.currentLevel - 1));
  if (bgLoaded[bgIdx]) ctx.drawImage(bgImages[bgIdx], 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  else { ctx.fillStyle = "#071022"; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT); }

  // enemies
  for (let e of game.enemies) {
    let img = (e.type==="drone" ? entityImages.drone : e.type==="robot" ? entityImages.robot : entityImages.boss);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, e.x, e.y, e.w, e.h);
    } else {
      ctx.fillStyle = e.type === "boss" ? "#ff6b6b" : (e.type === "robot" ? "#ffaf3b" : "#41c7ff");
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }

    // small hp bar (drones/robots)
    if (e.type !== "boss") {
      ctx.fillStyle = "#000";
      ctx.fillRect(e.x, e.y-8, e.w, 6);
      ctx.fillStyle = "#76ff7a";
      const maxHp = (e.type==="robot" ? 3 : 1);
      ctx.fillRect(e.x, e.y-8, e.w * Math.max(0, e.hp) / maxHp, 6);
    }
  }

  // bullets
  for (let b of game.bullets) {
    if (b.enemy && b.bossPower) {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = "#ff5b5b";
      ctx.shadowColor = "#ff5b5b";
      ctx.shadowBlur = 18;
      ctx.arc(b.x + b.w/2, b.y + b.h/2, Math.max(8, b.w/2), 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    } else if (entityImages.bullet.complete && entityImages.bullet.naturalWidth > 0) {
      // player bullets: draw bullet.png slightly smaller for better visibility
      if (!b.enemy) {
        const scale = 1.3; // reduced visual scale for player bullets
        const drawW = Math.max(8, b.w * scale);
        const drawH = Math.max(8, b.h * scale);
        ctx.drawImage(entityImages.bullet, b.x - (drawW - b.w)/2, b.y - (drawH - b.h)/2, drawW, drawH);
      } else {
        // enemy bullets (drones/robots): slightly larger for visibility; boss handled above
        const scale = 1.35;
        const drawW = Math.max(8, b.w * scale);
        const drawH = Math.max(8, b.h * scale);
        ctx.drawImage(entityImages.bullet, b.x - (drawW - b.w)/2, b.y - (drawH - b.h)/2, drawW, drawH);
      }
    } else {
      ctx.fillStyle = b.enemy ? "#ffb3b3" : "#fff57a";
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }

  // player HP bar (fixed width, above player, clamped; no inner gap)
  ctx.save();
  const hpWidth = 100;
  let hpX = game.player.x + (game.player.w - hpWidth) / 2;
  hpX = Math.max(6, Math.min(CANVAS_WIDTH - hpWidth - 6, hpX));
  hpX = Math.round(hpX);
  const hpY = Math.max(4, Math.round(game.player.y - 6));
  ctx.fillStyle = "#222"; ctx.fillRect(hpX, hpY, hpWidth, 8);
  const maxH = game.player.maxHealth || 4;
  const hpRatio = Math.min(1, Math.max(0, game.player.health) / maxH);
  const fillW = Math.max(0, Math.round(hpWidth * hpRatio));
  ctx.fillStyle = "#76ff7a"; ctx.fillRect(hpX, hpY, fillW, 8);
  ctx.strokeStyle = "#fff"; ctx.strokeRect(hpX, hpY, hpWidth, 8);
  ctx.restore();

  // player (blink if hit)
  let pImg = entityImages.player;
  const blink = game.playerBlink > 0 && Math.floor(game.playerBlink / 3) % 2 === 0;
  if (blink) { ctx.save(); ctx.globalAlpha = 0.35; }
  if (pImg && pImg.complete && pImg.naturalWidth > 0) {
    ctx.drawImage(pImg, game.player.x, game.player.y, game.player.w, game.player.h);
  } else {
    ctx.fillStyle = "#7df59a";
    ctx.fillRect(game.player.x, game.player.y, game.player.w, game.player.h);
  }
  if (blink) ctx.restore();

  // boss small bar (above boss)
  const boss = game.enemies.find(e => e.type === "boss");
  if (boss) {
    const barW = boss.w * 0.6, barH = 10;
    const barX = boss.x + (boss.w - barW)/2, barY = boss.y - barH - 8;
    const bossBlink = boss.blink > 0 && Math.floor(boss.blink / 3) % 2 === 0;
    ctx.save();
    if (bossBlink) ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#222"; ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = "#ff6b6b"; ctx.fillRect(barX, barY, barW * Math.max(0, boss.hp)/boss.maxHp, barH);
    ctx.strokeStyle = "#fff"; ctx.strokeRect(barX, barY, barW, barH);
    ctx.restore();
  }
}

/* Level transitions */
function nextLevel() {
  try { sounds.levelup.cloneNode().play(); } catch(e) {}
  if (game.currentLevel === 1) {
    showMessage("Level Up! Gun Upgraded!");
    game.running = false; // pause game loop
    setTimeout(() => {
      game.player.gunLevel = 2;
      game.player.health = Math.min(game.player.maxHealth || 6, game.player.health + 1);
      game.currentLevel = 2;
      game.killCount = 0;
      // prepare level 2
      game.enemies = [];
      game.bullets = [];
      game.robotsSpawnedTotal = 0;
      game.robotWaveDelay = 0;
      spawnRobot();
      game.running = true; // resume game loop
      requestAnimationFrame(loop);
    }, 1500); // 1.5 second pause
  } else if (game.currentLevel === 2) {
    showMessage("Level Up! Boss Incoming!");
    game.player.gunLevel = 3;
    // Enter final round with full HP
    game.player.health = game.player.maxHealth || 6;
    game.currentLevel = 3;
    game.killCount = 0;
    game.enemies = [];
    game.bullets = [];
    spawnBoss();
  } else if (game.currentLevel === 3) {
    game.currentLevel = 4;
    victory();
  }
}

/* Messages */
let messageTimeout = null;
function showMessage(txt) {
  if (!centerMsg) return;
  // If victory is active, do NOT overwrite or hide the victory message
  if (game.currentLevel === 4 && centerMsg.innerHTML.includes('GRAND VICTORY')) {
    centerMsg.classList.remove("hidden");
    return;
  }
  centerMsg.textContent = txt;
  centerMsg.classList.remove("hidden");
  if (messageTimeout) clearTimeout(messageTimeout);
  // Only set timeout if not in victory state
  if (game.currentLevel !== 4) {
    messageTimeout = setTimeout(() => centerMsg.classList.add("hidden"), 1800);
  }
}

/* End & Victory */
function gameOver() {
  if (!game.running) return;
  game.running = false;
  centerMsg.textContent = "💀 Game Over";
  centerMsg.classList.remove("hidden");
  restartBtn.classList.remove("hidden");
  try { sounds.ambience.pause(); } catch(e) {}
  try { sounds.bossMusic.pause(); } catch(e) {}
}

function victory() {
  game.running = false;
  centerMsg.innerHTML = `<span style='font-size:3em;'>🏆 GRAND VICTORY!</span><br><span style='font-size:2em;color:#ffd700;'>You are the TECH PHOENIX!</span>`;
  centerMsg.classList.remove("hidden");
  restartBtn.classList.remove("hidden");
  try { sounds.bossMusic.pause(); } catch(e) {}
  try { sounds.victory.cloneNode().play(); } catch(e) {}

  // confetti simple loop
  const confetti = [];
  for (let i=0;i<120;i++) confetti.push({x: Math.random()*CANVAS_WIDTH, y: -Math.random()*800, vy: 2+Math.random()*6, color: `hsl(${Math.random()*360},90%,60%)`});
  (function confettiAnim(){
    draw(); // draw game scene under confetti
    ctx.save();
    confetti.forEach(c => {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, 8, 14);
      c.y += c.vy;
      if (c.y > CANVAS_HEIGHT + 20) c.y = -20 - Math.random()*600;
    });
    ctx.restore();
    if (game.currentLevel === 4) requestAnimationFrame(confettiAnim);
  })();
  // Do NOT auto-hide the victory message; keep it visible until restart
}

/* Main loop */
function loop(ts) {
  if (!game.running) return;
  const dt = Math.min(0.033, (ts - game.lastTime) / 1000);
  game.lastTime = ts;

  // decrement blink timers
  if (game.playerBlink > 0) game.playerBlink--;
  for (let e of game.enemies) if (e.type === "boss" && e.blink > 0) e.blink--;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* Start / Restart */
function startGame() {
  intro.classList.add("hidden");
  gameContainer.classList.remove("hidden");
  restartBtn.classList.add("hidden");
  centerMsg.classList.add("hidden");

  game = {
    running: true,
    currentLevel: 1,
    score: 0,
    player: makePlayer(),
    bullets: [],
    enemies: [],
    explosions: [],
    keys: {},
    killCount: 0,
    lastTime: performance.now(),
    bossAlive: false,
    robotsSpawnedTotal: 0,
    robotWaveDelay: 0,
    playerBlink: 0
  };
  // Always start with full HP
  game.player.health = game.player.maxHealth;

  // initial drones for level1
  for (let i = 0; i < 10; i++) spawnDrone();

  try { let a = sounds.ambience.cloneNode(); a.loop = true; a.volume = 0.45; a.play(); sounds.ambience = a; } catch(e){}
  requestAnimationFrame(loop);
}

/* Input handling */
window.addEventListener("keydown", (e) => {
  if (!game.keys) game.keys = {};
  game.keys[e.key] = true;
  if (e.key === " ") e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  if (!game.keys) return;
  game.keys[e.key] = false;
});

startBtn.onclick = startGame;
restartBtn.onclick = startGame;

