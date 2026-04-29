(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const canvas = $("#gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    score: $("#scoreText"),
    crystals: $("#crystalText"),
    wave: $("#waveText"),
    best: $("#bestText"),
    mission: $("#missionText"),
    missionBar: $("#missionBar"),
    start: $("#startBtn"),
    bigStart: $("#bigStartBtn"),
    pause: $("#pauseBtn"),
    shop: $("#shopBtn"),
    reset: $("#resetBtn"),
    center: $("#centerMessage"),
    shopModal: $("#shopModal"),
    closeShop: $("#closeShopBtn"),
    upgradeGrid: $("#upgradeGrid"),
    confirmModal: $("#confirmModal"),
    cancelReset: $("#cancelResetBtn"),
    confirmReset: $("#confirmResetBtn"),
    toast: $("#toast"),
    achievements: $("#achievementList"),
    shipName: $("#shipName"),
    shipInfo: $("#shipInfo"),
    joystick: $("#joystick"),
    stick: $("#stick"),
    boost: $("#boostBtn")
  };

  const SAVE_KEY = "astro-miner-save-v1";
  const TAU = Math.PI * 2;
  const rand = (min, max) => Math.random() * (max - min) + min;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const format = (number) => Math.floor(number).toLocaleString("en-US");

  const defaultSave = () => ({
    crystals: 0,
    best: 0,
    totalCrystals: 0,
    totalRuns: 0,
    upgrades: {
      engine: 0,
      magnet: 0,
      shield: 0,
      multiplier: 0,
      repair: 0,
      boost: 0
    },
    achievements: {}
  });

  let save = loadSave();

  const upgrades = [
    {
      id: "engine",
      icon: "⚡",
      title: "Ion Engine",
      description: "Move faster and dodge tight asteroid storms.",
      base: 40,
      max: 8,
      effect: (level) => 1 + level * 0.12
    },
    {
      id: "magnet",
      icon: "🧲",
      title: "Crystal Magnet",
      description: "Pull nearby crystals toward your ship.",
      base: 55,
      max: 8,
      effect: (level) => 90 + level * 28
    },
    {
      id: "shield",
      icon: "🛡️",
      title: "Shield Cells",
      description: "Start each run with extra shield charges.",
      base: 85,
      max: 5,
      effect: (level) => level
    },
    {
      id: "multiplier",
      icon: "💎",
      title: "Crystal Multiplier",
      description: "Gain more crystals from every pickup.",
      base: 120,
      max: 7,
      effect: (level) => 1 + level * 0.35
    },
    {
      id: "repair",
      icon: "🔧",
      title: "Auto Repair",
      description: "Slowly repair hull while you survive.",
      base: 150,
      max: 5,
      effect: (level) => level * 0.65
    },
    {
      id: "boost",
      icon: "🔥",
      title: "Boost Core",
      description: "Space / boost button gives stronger burst speed.",
      base: 180,
      max: 6,
      effect: (level) => 1 + level * 0.18
    }
  ];

  const achievements = [
    { id: "first_launch", icon: "🚀", title: "First Launch", text: "Start your first run.", check: () => save.totalRuns >= 1 },
    { id: "collector", icon: "💎", title: "Crystal Collector", text: "Collect 100 total crystals.", check: () => save.totalCrystals >= 100 },
    { id: "rich", icon: "👑", title: "Space Rich", text: "Own 1,000 crystals at once.", check: () => save.crystals >= 1000 },
    { id: "survivor", icon: "🛡️", title: "Survivor", text: "Reach wave 5.", check: () => game.wave >= 5 },
    { id: "legend", icon: "🌌", title: "Nebula Legend", text: "Score 10,000 in one run.", check: () => game.score >= 10000 }
  ];

  const missions = [
    {
      text: "Collect 20 crystals in one run.",
      target: 20,
      progress: () => game.runCrystals,
      reward: 45
    },
    {
      text: "Survive 60 seconds.",
      target: 60,
      progress: () => game.time,
      reward: 70
    },
    {
      text: "Reach wave 5.",
      target: 5,
      progress: () => game.wave,
      reward: 90
    },
    {
      text: "Score 5,000 points.",
      target: 5000,
      progress: () => game.score,
      reward: 100
    }
  ];

  const game = {
    w: 960,
    h: 600,
    mode: "title",
    score: 0,
    time: 0,
    wave: 1,
    runCrystals: 0,
    missionIndex: 0,
    missionDone: false,
    shake: 0,
    last: 0,
    spawnCrystal: 0,
    spawnAsteroid: 0,
    spawnPower: 10,
    stars: [],
    crystals: [],
    asteroids: [],
    powers: [],
    particles: [],
    floatingTexts: []
  };

  const ship = {
    x: 480,
    y: 300,
    r: 18,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    shield: 0,
    invincible: 0,
    boostEnergy: 100,
    angle: 0
  };

  const keys = new Set();
  const pointer = { active: false, x: 0, y: 0, dx: 0, dy: 0 };
  let boostHeld = false;
  let toastTimer = 0;

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      return { ...defaultSave(), ...JSON.parse(raw) };
    } catch {
      return defaultSave();
    }
  }

  function persist() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    game.w = rect.width;
    game.h = rect.height;
  }

  function makeStars() {
    game.stars = Array.from({ length: 95 }, () => ({
      x: rand(0, game.w),
      y: rand(0, game.h),
      r: rand(0.6, 2.2),
      speed: rand(12, 64),
      alpha: rand(0.25, 0.95)
    }));
  }

  function startGame() {
    game.mode = "running";
    game.score = 0;
    game.time = 0;
    game.wave = 1;
    game.runCrystals = 0;
    game.missionDone = false;
    game.crystals = [];
    game.asteroids = [];
    game.powers = [];
    game.particles = [];
    game.floatingTexts = [];
    game.spawnCrystal = 0;
    game.spawnAsteroid = 0;
    game.spawnPower = 8;
    ship.x = game.w / 2;
    ship.y = game.h / 2;
    ship.vx = 0;
    ship.vy = 0;
    ship.hp = ship.maxHp;
    ship.shield = Math.floor(upgradeValue("shield"));
    ship.invincible = 1.25;
    ship.boostEnergy = 100;
    save.totalRuns++;
    persist();
    ui.center.style.display = "none";
    showToast("Launch successful. Mine those crystals! 🚀");
    checkAchievements();
  }

  function pauseGame() {
    if (game.mode === "running") {
      game.mode = "paused";
      ui.center.style.display = "block";
      ui.center.querySelector("h2").textContent = "Paused";
      ui.center.querySelector("p").textContent = "Take a breather. Your ship is floating safely.";
      ui.bigStart.textContent = "Resume";
    } else if (game.mode === "paused") {
      game.mode = "running";
      ui.center.style.display = "none";
    }
  }

  function endGame(reason = "Ship destroyed") {
    if (game.mode !== "running") return;
    game.mode = "ended";
    save.best = Math.max(save.best, Math.floor(game.score));
    persist();
    checkAchievements();
    ui.center.style.display = "block";
    ui.center.querySelector("h2").textContent = reason;
    ui.center.querySelector("p").textContent = `Score ${format(game.score)} • Crystals ${format(game.runCrystals)} • Wave ${game.wave}`;
    ui.bigStart.textContent = "Launch Again 🚀";
    showToast("Run saved. Upgrade your ship and go again! ✨");
  }

  function upgradeLevel(id) {
    return save.upgrades[id] || 0;
  }

  function upgradeValue(id) {
    const item = upgrades.find((upgrade) => upgrade.id === id);
    return item ? item.effect(upgradeLevel(id)) : 0;
  }

  function upgradeCost(item) {
    const level = upgradeLevel(item.id);
    return Math.floor(item.base * Math.pow(1.74, level));
  }

  function buyUpgrade(id) {
    const item = upgrades.find((upgrade) => upgrade.id === id);
    if (!item) return;
    const level = upgradeLevel(id);
    if (level >= item.max) return showToast("That upgrade is already maxed ✅");
    const cost = upgradeCost(item);
    if (save.crystals < cost) return showToast(`Need ${format(cost - save.crystals)} more crystals.`);
    save.crystals -= cost;
    save.upgrades[id] = level + 1;
    persist();
    renderUpgrades();
    renderUI();
    showToast(`${item.title} upgraded to level ${level + 1}!`);
  }

  function spawnCrystal() {
    game.crystals.push({
      x: rand(30, game.w - 30),
      y: -30,
      r: rand(8, 13),
      value: Math.random() < 0.08 ? 5 : 1,
      vy: rand(60, 105) + game.wave * 4,
      phase: rand(0, TAU)
    });
  }

  function spawnAsteroid() {
    const side = Math.floor(rand(0, 4));
    const radius = rand(16, 38) + game.wave * 0.6;
    let x = rand(0, game.w);
    let y = -radius;
    let vx = rand(-45, 45);
    let vy = rand(90, 170) + game.wave * 9;

    if (side === 1) {
      x = game.w + radius;
      y = rand(40, game.h * 0.7);
      vx = -rand(80, 150) - game.wave * 4;
      vy = rand(20, 90);
    }
    if (side === 2) {
      x = -radius;
      y = rand(40, game.h * 0.7);
      vx = rand(80, 150) + game.wave * 4;
      vy = rand(20, 90);
    }

    game.asteroids.push({
      x,
      y,
      vx,
      vy,
      r: radius,
      rot: rand(0, TAU),
      spin: rand(-2.4, 2.4),
      hp: Math.ceil(radius / 18)
    });
  }

  function spawnPower() {
    const types = ["heal", "shield", "burst"];
    game.powers.push({
      type: types[Math.floor(rand(0, types.length))],
      x: rand(40, game.w - 40),
      y: -40,
      r: 17,
      vy: rand(55, 90),
      phase: rand(0, TAU)
    });
  }

  function addParticles(x, y, count, kind = "spark") {
    for (let i = 0; i < count; i++) {
      game.particles.push({
        x,
        y,
        vx: rand(-160, 160),
        vy: rand(-160, 160),
        r: rand(1.4, kind === "boom" ? 4.5 : 3),
        life: rand(0.35, 0.9),
        maxLife: rand(0.35, 0.9),
        kind
      });
    }
  }

  function floatText(text, x, y) {
    game.floatingTexts.push({ text, x, y, life: 1.15, maxLife: 1.15 });
  }

  function inputVector() {
    let x = 0;
    let y = 0;
    if (keys.has("arrowleft") || keys.has("a")) x -= 1;
    if (keys.has("arrowright") || keys.has("d")) x += 1;
    if (keys.has("arrowup") || keys.has("w")) y -= 1;
    if (keys.has("arrowdown") || keys.has("s")) y += 1;
    if (pointer.active) {
      x += pointer.dx;
      y += pointer.dy;
    }
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  function update(dt) {
    if (game.mode !== "running") return;

    game.time += dt;
    game.wave = 1 + Math.floor(game.time / 24);
    game.score += dt * (70 + game.wave * 14);
    ship.invincible = Math.max(0, ship.invincible - dt);
    game.shake = Math.max(0, game.shake - dt * 18);

    const vector = inputVector();
    const boosting = (keys.has(" ") || boostHeld) && ship.boostEnergy > 0;
    const boostPower = boosting ? 1.75 * upgradeValue("boost") : 1;
    const speed = 260 * upgradeValue("engine") * boostPower;
    const friction = Math.pow(0.0005, dt);

    ship.vx = ship.vx * friction + vector.x * speed * dt * 5.2;
    ship.vy = ship.vy * friction + vector.y * speed * dt * 5.2;
    ship.x = clamp(ship.x + ship.vx * dt, ship.r + 4, game.w - ship.r - 4);
    ship.y = clamp(ship.y + ship.vy * dt, ship.r + 4, game.h - ship.r - 4);
    if (Math.abs(ship.vx) + Math.abs(ship.vy) > 10) ship.angle = Math.atan2(ship.vy, ship.vx);

    if (boosting) {
      ship.boostEnergy = Math.max(0, ship.boostEnergy - dt * 32);
      addParticles(ship.x - Math.cos(ship.angle) * 18, ship.y - Math.sin(ship.angle) * 18, 1, "boost");
    } else {
      ship.boostEnergy = Math.min(100, ship.boostEnergy + dt * 18);
    }

    if (upgradeLevel("repair") > 0) {
      ship.hp = Math.min(ship.maxHp, ship.hp + upgradeValue("repair") * dt);
    }

    game.spawnCrystal -= dt;
    game.spawnAsteroid -= dt;
    game.spawnPower -= dt;

    while (game.spawnCrystal <= 0) {
      spawnCrystal();
      game.spawnCrystal += Math.max(0.16, 0.65 - game.wave * 0.026);
    }

    while (game.spawnAsteroid <= 0) {
      spawnAsteroid();
      game.spawnAsteroid += Math.max(0.22, 1.12 - game.wave * 0.055);
    }

    if (game.spawnPower <= 0) {
      spawnPower();
      game.spawnPower = rand(13, 22);
    }

    updateEntities(dt);
    updateMission();
    checkAchievements();
  }

  function updateEntities(dt) {
    const magnetRadius = upgradeValue("magnet");

    for (const star of game.stars) {
      star.y += star.speed * dt;
      if (star.y > game.h + 6) {
        star.y = -6;
        star.x = rand(0, game.w);
      }
    }

    for (const crystal of game.crystals) {
      const d = distance(crystal, ship);
      if (d < magnetRadius) {
        const pull = (1 - d / magnetRadius) * 450 * dt;
        crystal.x += ((ship.x - crystal.x) / Math.max(1, d)) * pull;
        crystal.y += ((ship.y - crystal.y) / Math.max(1, d)) * pull;
      }
      crystal.y += crystal.vy * dt;
      crystal.phase += dt * 4;

      if (distance(crystal, ship) < crystal.r + ship.r) {
        const gained = Math.ceil(crystal.value * upgradeValue("multiplier"));
        save.crystals += gained;
        save.totalCrystals += gained;
        game.runCrystals += gained;
        game.score += gained * 80;
        crystal.dead = true;
        addParticles(crystal.x, crystal.y, 12, "spark");
        floatText(`+${gained} 💎`, crystal.x, crystal.y);
        persist();
      }
    }

    for (const asteroid of game.asteroids) {
      asteroid.x += asteroid.vx * dt;
      asteroid.y += asteroid.vy * dt;
      asteroid.rot += asteroid.spin * dt;

      if (distance(asteroid, ship) < asteroid.r + ship.r && ship.invincible <= 0) {
        hitShip(Math.round(asteroid.r * 0.72 + game.wave * 2));
        asteroid.dead = true;
        addParticles(asteroid.x, asteroid.y, 26, "boom");
      }
    }

    for (const power of game.powers) {
      power.y += power.vy * dt;
      power.phase += dt * 3;
      if (distance(power, ship) < power.r + ship.r) {
        applyPower(power.type);
        power.dead = true;
        addParticles(power.x, power.y, 18, "spark");
      }
    }

    for (const particle of game.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(0.05, dt);
      particle.vy *= Math.pow(0.05, dt);
      particle.life -= dt;
    }

    for (const text of game.floatingTexts) {
      text.y -= 44 * dt;
      text.life -= dt;
    }

    game.crystals = game.crystals.filter((item) => !item.dead && item.y < game.h + 80);
    game.asteroids = game.asteroids.filter((item) => !item.dead && item.y < game.h + 100 && item.x > -120 && item.x < game.w + 120);
    game.powers = game.powers.filter((item) => !item.dead && item.y < game.h + 80);
    game.particles = game.particles.filter((item) => item.life > 0);
    game.floatingTexts = game.floatingTexts.filter((item) => item.life > 0);
  }

  function hitShip(damage) {
    ship.invincible = 0.85;
    game.shake = 10;
    if (ship.shield > 0) {
      ship.shield--;
      floatText("Shield blocked!", ship.x, ship.y - 28);
      showToast("Shield absorbed the hit 🛡️");
      return;
    }
    ship.hp -= damage;
    floatText(`-${damage}`, ship.x, ship.y - 26);
    if (ship.hp <= 0) endGame("Ship destroyed 💥");
  }

  function applyPower(type) {
    if (type === "heal") {
      ship.hp = Math.min(ship.maxHp, ship.hp + 28);
      floatText("Repair +28", ship.x, ship.y - 30);
    }
    if (type === "shield") {
      ship.shield++;
      floatText("Shield +1", ship.x, ship.y - 30);
    }
    if (type === "burst") {
      ship.boostEnergy = 100;
      game.score += 350;
      floatText("Boost full!", ship.x, ship.y - 30);
    }
    showToast("Power-up collected ✨");
  }

  function updateMission() {
    const mission = missions[game.missionIndex];
    const progress = Math.min(mission.target, mission.progress());
    if (!game.missionDone && progress >= mission.target) {
      game.missionDone = true;
      save.crystals += mission.reward;
      save.totalCrystals += mission.reward;
      game.score += mission.reward * 55;
      persist();
      showToast(`Mission complete! +${mission.reward} crystals 🎯`);
      setTimeout(() => {
        game.missionIndex = (game.missionIndex + 1) % missions.length;
        game.missionDone = false;
        renderUI();
      }, 1000);
    }
  }

  function render() {
    resizeCanvas();
    const shakeX = game.shake > 0 ? rand(-game.shake, game.shake) : 0;
    const shakeY = game.shake > 0 ? rand(-game.shake, game.shake) : 0;

    ctx.clearRect(0, 0, game.w, game.h);
    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawSpaceBackground();
    game.crystals.forEach(drawCrystal);
    game.powers.forEach(drawPower);
    game.asteroids.forEach(drawAsteroid);
    drawShip();
    game.particles.forEach(drawParticle);
    game.floatingTexts.forEach(drawFloatingText);
    drawHud();

    ctx.restore();
  }

  function drawSpaceBackground() {
    const gradient = ctx.createRadialGradient(game.w * 0.5, game.h * 0.38, 40, game.w * 0.5, game.h * 0.5, game.w * 0.72);
    gradient.addColorStop(0, "rgba(128, 247, 255, 0.11)");
    gradient.addColorStop(0.5, "rgba(167, 139, 250, 0.08)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, game.w, game.h);

    for (const star of game.stars) {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(128,247,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = -80; x < game.w + 80; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x + (game.time * 18) % 90, 0);
      ctx.lineTo(x - 160 + (game.time * 18) % 90, game.h);
      ctx.stroke();
    }
  }

  function drawShip() {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    if (ship.invincible > 0) {
      ctx.globalAlpha = 0.55 + Math.sin(game.time * 25) * 0.25;
    }

    ctx.shadowColor = "rgba(128,247,255,0.55)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#e0f2fe";
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-16, -15);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-16, 15);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath();
    ctx.arc(1, 0, 8, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(128,247,255,0.8)";
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.lineTo(-34 - Math.random() * 14, 0);
    ctx.lineTo(-18, 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;

    if (ship.shield > 0) {
      ctx.strokeStyle = "rgba(52,211,153,0.78)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r + 12 + Math.sin(game.time * 4) * 2, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "rgba(52,211,153,0.16)";
      ctx.fill();
    }
  }

  function drawCrystal(crystal) {
    const bob = Math.sin(crystal.phase) * 3;
    ctx.save();
    ctx.translate(crystal.x, crystal.y + bob);
    ctx.rotate(crystal.phase * 0.45);
    ctx.shadowColor = crystal.value > 1 ? "rgba(251,191,36,0.8)" : "rgba(128,247,255,0.8)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = crystal.value > 1 ? "#fbbf24" : "#67e8f9";
    ctx.beginPath();
    ctx.moveTo(0, -crystal.r);
    ctx.lineTo(crystal.r * 0.75, 0);
    ctx.lineTo(0, crystal.r);
    ctx.lineTo(-crystal.r * 0.75, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawAsteroid(asteroid) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.rot);
    ctx.fillStyle = "#64748b";
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    const points = 11;
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * TAU;
      const radius = asteroid.r * rand(0.72, 1.08);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPower(power) {
    const icons = { heal: "+", shield: "◇", burst: "»" };
    const y = power.y + Math.sin(power.phase) * 5;
    ctx.save();
    ctx.translate(power.x, y);
    ctx.shadowColor = "rgba(52,211,153,0.8)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "rgba(52,211,153,0.92)";
    ctx.beginPath();
    ctx.arc(0, 0, power.r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#04111f";
    ctx.font = "900 22px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icons[power.type], 0, -1);
    ctx.restore();
  }

  function drawParticle(particle) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    if (particle.kind === "boom") ctx.fillStyle = "#fb7185";
    else if (particle.kind === "boost") ctx.fillStyle = "#fbbf24";
    else ctx.fillStyle = "#67e8f9";
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawFloatingText(text) {
    ctx.globalAlpha = clamp(text.life / text.maxLife, 0, 1);
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 4;
    ctx.strokeText(text.text, text.x, text.y);
    ctx.fillText(text.text, text.x, text.y);
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    const barWidth = Math.min(250, game.w * 0.34);
    drawBar(18, 18, barWidth, 14, ship.hp / ship.maxHp, "#fb7185", "Hull");
    drawBar(18, 42, barWidth, 12, ship.boostEnergy / 100, "#fbbf24", "Boost");

    if (game.mode === "running") {
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.font = "800 14px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(`Shield: ${ship.shield}`, game.w - 20, 28);
      ctx.fillText(`Time: ${Math.floor(game.time)}s`, game.w - 20, 50);
    }
  }

  function drawBar(x, y, w, h, value, color, label) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(x, y, w * clamp(value, 0, 1), h, h / 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "800 11px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(label, x + 6, y + h - 3);
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function renderUI() {
    ui.score.textContent = format(game.score);
    ui.crystals.textContent = format(save.crystals);
    ui.wave.textContent = game.wave;
    ui.best.textContent = format(save.best);

    const mission = missions[game.missionIndex];
    const progress = Math.min(mission.target, mission.progress());
    const percent = mission.target === 0 ? 0 : (progress / mission.target) * 100;
    ui.mission.textContent = `${mission.text} Reward: ${mission.reward} 💎`;
    ui.missionBar.style.width = `${clamp(percent, 0, 100)}%`;

    const engine = upgradeLevel("engine");
    const magnet = upgradeLevel("magnet");
    const shield = upgradeLevel("shield");
    ui.shipName.textContent = engine >= 5 ? "Nebula Falcon" : engine >= 2 ? "Ion Sparrow" : "Starter Comet";
    ui.shipInfo.textContent = `Speed ${engine + 1} • Magnet ${magnet + 1} • Shield ${shield}`;
    renderAchievements();
  }

  function renderAchievements() {
    ui.achievements.innerHTML = achievements.map((ach) => {
      const unlocked = Boolean(save.achievements[ach.id]);
      return `<div class="achievement ${unlocked ? "" : "locked"}">
        <strong>${ach.icon} ${ach.title}</strong>
        <small>${unlocked ? "Unlocked" : ach.text}</small>
      </div>`;
    }).join("");
  }

  function renderUpgrades() {
    ui.upgradeGrid.innerHTML = upgrades.map((item) => {
      const level = upgradeLevel(item.id);
      const maxed = level >= item.max;
      const cost = upgradeCost(item);
      const affordable = save.crystals >= cost;
      return `<article class="upgrade-card">
        <h3>${item.icon} ${item.title}</h3>
        <p>${item.description}</p>
        <small>Level ${level}/${item.max}</small>
        <button data-upgrade="${item.id}" ${maxed || !affordable ? "disabled" : ""}>
          ${maxed ? "MAXED" : `Buy — ${format(cost)} 💎`}
        </button>
      </article>`;
    }).join("");

    ui.upgradeGrid.querySelectorAll("[data-upgrade]").forEach((button) => {
      button.addEventListener("click", () => buyUpgrade(button.dataset.upgrade));
    });
  }

  function checkAchievements() {
    let changed = false;
    for (const ach of achievements) {
      if (!save.achievements[ach.id] && ach.check()) {
        save.achievements[ach.id] = true;
        changed = true;
        showToast(`Achievement unlocked: ${ach.title} ${ach.icon}`);
      }
    }
    if (changed) persist();
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2300);
  }

  function loop(timestamp) {
    const dt = Math.min(0.033, (timestamp - game.last) / 1000 || 0);
    game.last = timestamp;
    update(dt);
    render();
    renderUI();
    requestAnimationFrame(loop);
  }

  function setupEvents() {
    window.addEventListener("resize", () => {
      resizeCanvas();
      makeStars();
    });

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      keys.add(key);
      if (key === "p" || key === "escape") pauseGame();
      if (key === "enter" && game.mode !== "running") startGame();
    });

    window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

    ui.start.addEventListener("click", startGame);
    ui.bigStart.addEventListener("click", () => {
      if (game.mode === "paused") pauseGame();
      else startGame();
    });
    ui.pause.addEventListener("click", pauseGame);
    ui.shop.addEventListener("click", () => {
      renderUpgrades();
      ui.shopModal.showModal();
    });
    ui.closeShop.addEventListener("click", () => ui.shopModal.close());
    ui.reset.addEventListener("click", () => ui.confirmModal.showModal());
    ui.cancelReset.addEventListener("click", () => ui.confirmModal.close());
    ui.confirmReset.addEventListener("click", () => {
      save = defaultSave();
      persist();
      ui.confirmModal.close();
      renderUpgrades();
      renderUI();
      showToast("Save reset. Clean launch bay! 🧹");
    });

    setupJoystick();
    setupBoostButton();
  }

  function setupJoystick() {
    const joystick = ui.joystick;
    const stick = ui.stick;

    const updateStick = (clientX, clientY) => {
      const rect = joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rawX = clientX - centerX;
      const rawY = clientY - centerY;
      const max = rect.width * 0.31;
      const length = Math.hypot(rawX, rawY);
      const scale = length > max ? max / length : 1;
      const x = rawX * scale;
      const y = rawY * scale;
      stick.style.transform = `translate(${x}px, ${y}px)`;
      pointer.dx = clamp(rawX / max, -1, 1);
      pointer.dy = clamp(rawY / max, -1, 1);
    };

    joystick.addEventListener("pointerdown", (event) => {
      pointer.active = true;
      joystick.setPointerCapture(event.pointerId);
      updateStick(event.clientX, event.clientY);
    });

    joystick.addEventListener("pointermove", (event) => {
      if (pointer.active) updateStick(event.clientX, event.clientY);
    });

    const release = () => {
      pointer.active = false;
      pointer.dx = 0;
      pointer.dy = 0;
      stick.style.transform = "translate(0, 0)";
    };

    joystick.addEventListener("pointerup", release);
    joystick.addEventListener("pointercancel", release);
    joystick.addEventListener("lostpointercapture", release);
  }

  function setupBoostButton() {
    const setBoost = (value) => { boostHeld = value; };
    ui.boost.addEventListener("pointerdown", () => setBoost(true));
    ui.boost.addEventListener("pointerup", () => setBoost(false));
    ui.boost.addEventListener("pointercancel", () => setBoost(false));
    ui.boost.addEventListener("pointerleave", () => setBoost(false));
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").then((registration) => {
        if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }).catch(() => {
        console.warn("Service worker registration failed. The game still works online.");
      });
    });
  }

  function init() {
    resizeCanvas();
    makeStars();
    setupEvents();
    renderUpgrades();
    renderUI();
    registerServiceWorker();
    requestAnimationFrame(loop);
  }

  init();
})();
