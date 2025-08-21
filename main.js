// Game logic
(function(){
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const WIDTH = canvas.width, HEIGHT = canvas.height;
  const TILE = 64;

  const playerImg = new Image(); playerImg.src = "assets/player.png";
  const bulletImg = new Image(); bulletImg.src = "assets/bullet.png";
  const orbImg = new Image(); orbImg.src = "assets/orb.png";
  const shieldImg = new Image(); shieldImg.src = "assets/shield.png";
  const wallImg = new Image(); wallImg.src = "assets/wall.png";
  const floorImg = new Image(); floorImg.src = "assets/floor.png";
  const heartFull = new Image(); heartFull.src = "assets/heart_full.png";
  const heartHalf = new Image(); heartHalf.src = "assets/heart_half.png";
  const shieldFull = new Image(); shieldFull.src = "assets/shield_full.png";
  const shieldHalf = new Image(); shieldHalf.src = "assets/shield_half.png";

  // UI elements
  const ui = {
    root: document.getElementById("ui"),
    menu: document.getElementById("menu"),
    lobby: document.getElementById("lobby"),
    playerName: document.getElementById("playerName"),
    mapSelect: document.getElementById("mapSelect"),
    hostBtn: document.getElementById("hostBtn"),
    joinCode: document.getElementById("joinCode"),
    joinBtn: document.getElementById("joinBtn"),
    startBtn: document.getElementById("startBtn"),
    leaveBtn: document.getElementById("leaveBtn"),
    players: document.getElementById("players"),
    lobbyCode: document.getElementById("lobbyCode"),
  };

  // Populate maps
  MAPS.forEach((m, i)=>{
    const opt = document.createElement("option");
    opt.value = i; opt.textContent = `${i+1}. ${m.name}`;
    ui.mapSelect.appendChild(opt);
  });

  function showLobby(code, playersMap) {
    ui.menu.classList.add("hidden");
    ui.lobby.classList.remove("hidden");
    ui.lobbyCode.textContent = `— Code: ${code}`;
    ui.players.innerHTML = "";
    Object.values(playersMap).forEach(p=>{
      const el = document.createElement("div");
      el.className = "player-pill";
      el.textContent = p.name + (p.id === state.hostId ? " (Host)" : "");
      ui.players.appendChild(el);
    });
  }

  function lerp(a,b,t){return a+(b-a)*t;}
  function clamp(v,min,max){return Math.max(min, Math.min(max, v));}

  // Weapons definition
  const WEAPONS = {
    pistol: { name:"Pistol", cooldown: 350, speed: 7, damage: 1, spread: 0, pellets:1 },
    pistol_auto: { name:"Auto Pistol", cooldown: 150, speed: 7, damage: 1, spread: 0.04, pellets:1 },
    ar_semi: { name:"AR (Semi)", cooldown: 220, speed: 9, damage: 1, spread: 0.02, pellets:1 },
    ar_auto: { name:"AR (Auto)", cooldown: 100, speed: 9, damage: 1, spread: 0.03, pellets:1 },
    shotgun: { name:"Shotgun", cooldown: 650, speed: 8, damage: 1, spread: 0.15, pellets:6 },
  };
  const UPGRADE_POOL = ["pistol_auto","ar_semi","ar_auto","shotgun"];

  // Local state
  const state = {
    code: null,
    me: null,
    hostId: null,
    started: false,
    mapIndex: 0,
    players: {},
    bullets: {},
    pickups: {}, // { id: {x,y,type} } where type is "orb" or "shield"
    particles: [],
    lastShoot: 0,
    inputs: { up:false,down:false,left:false,right:false, mouse:false, mx:0,my:0 },
  };

  function isHost(){ return state.me && state.me.id === state.hostId; }

  // Spawn helpers
  function randomSpawn() {
    return { x: 160 + Math.random()* (WIDTH-320), y: 160 + Math.random()*(HEIGHT-320) };
  }

  // Create my player object
  function createPlayer(id, name){
    const pos = randomSpawn();
    return {
      id, name,
      x: pos.x, y: pos.y, vx:0, vy:0, dir: 0,
      speed: 3.0,
      weapon: "pistol",
      healthHalves: 10, // 5 hearts
      shieldHalves: 0,  // max 6 halves
      alive: true,
      score: 0,
    };
  }

  // Input handling
  const key = {};
  window.addEventListener("keydown",(e)=>{ key[e.key.toLowerCase()] = true; });
  window.addEventListener("keyup",(e)=>{ key[e.key.toLowerCase()] = false; });
  canvas.addEventListener("mousedown",()=> state.inputs.mouse = true);
  canvas.addEventListener("mouseup",()=> state.inputs.mouse = false);
  canvas.addEventListener("mousemove",(e)=> {
    const rect = canvas.getBoundingClientRect();
    state.inputs.mx = e.clientX - rect.left;
    state.inputs.my = e.clientY - rect.top;
  });

  function updateInputs(){
    state.inputs.up = key["w"]||key["arrowup"];
    state.inputs.down = key["s"]||key["arrowdown"];
    state.inputs.left = key["a"]||key["arrowleft"];
    state.inputs.right = key["d"]||key["arrowright"];
    if (state.code && state.me) NET.setInputs(state.code, state.me.id, state.inputs);
  }

  // Movement + collision
  function collideRect(r, x, y, w, h){
    return !(x+w < r.x || x > r.x + r.w || y+h < r.y || y > r.y + r.h);
  }
  function walls(){ return MAPS[state.mapIndex].walls; }

  function stepPlayer(p, dt){
    const spd = p.speed;
    let dx=0, dy=0;
    if (p.id===state.me.id){
      if (state.inputs.up) dy -= 1;
      if (state.inputs.down) dy += 1;
      if (state.inputs.left) dx -= 1;
      if (state.inputs.right) dx += 1;
    }
    const len = Math.hypot(dx,dy) || 1;
    dx = dx/len * spd;
    dy = dy/len * spd;

    // Try move with AABB colliders
    let nx = p.x + dx, ny = p.y;
    const bbox = {x:nx-16,y:ny-16,w:32,h:32};
    for (const r of walls()) if (collideRect(r,bbox.x,bbox.y,bbox.w,bbox.h)) nx = p.x;
    p.x = clamp(nx, 96, WIDTH-96);
    ny = p.y + dy;
    bbox.x = p.x-16; bbox.y = ny-16;
    for (const r of walls()) if (collideRect(r,bbox.x,bbox.y,bbox.w,bbox.h)) ny = p.y;
    p.y = clamp(ny, 96, HEIGHT-96);

    // Aim direction
    if (p.id===state.me.id){
      p.dir = Math.atan2(state.inputs.my - p.y, state.inputs.mx - p.x);
    }
  }

  // Shooting
  function tryShoot(p, now){
    if (p.id!==state.me.id) return;
    const wpn = WEAPONS[p.weapon];
    if (!wpn) return;
    if (!state.inputs.mouse) return;
    if (now - state.lastShoot < wpn.cooldown) return;
    state.lastShoot = now;

    for (let i=0;i<wpn.pellets;i++){
      const spread = (Math.random()*2-1)*wpn.spread;
      const ang = p.dir + spread;
      const vx = Math.cos(ang)*wpn.speed;
      const vy = Math.sin(ang)*wpn.speed;
      const bullet = {
        x: p.x + Math.cos(ang)*20, y: p.y + Math.sin(ang)*20,
        vx, vy, owner: p.id, damage: wpn.damage, born: now
      };
      NET.pushBullet(state.code, p.id, bullet);
    }
  }

  // Simple blood particles
  function spawnBlood(x,y){
    for (let i=0;i<6;i++){
      const ang = Math.random()*Math.PI*2;
      state.particles.push({
        x, y, vx: Math.cos(ang)* (1+Math.random()*2),
        vy: Math.sin(ang)* (1+Math.random()*2),
        life: 500 + Math.random()*400
      });
    }
  }

  function damagePlayer(p, halves){
    // Shields soak first
    let remaining = halves;
    if (p.shieldHalves > 0){
      const absorb = Math.min(p.shieldHalves, remaining);
      p.shieldHalves -= absorb;
      remaining -= absorb;
    }
    if (remaining>0){
      p.healthHalves = Math.max(0, p.healthHalves - remaining);
      if (p.healthHalves===0) {
        p.alive = false;
        spawnBlood(p.x,p.y);
        // respawn after delay
        setTimeout(()=>{
          const pos = randomSpawn();
          p.x=pos.x; p.y=pos.y;
          p.healthHalves=10; p.shieldHalves=0; p.alive=true; p.weapon="pistol";
          if (state.code) NET.setPlayer(state.code, p.id, p);
        }, 1500);
      }
    }
  }

  // Host controls pickups and cleans bullets
  function hostTick(now){
    // Periodically spawn pickups
    if (!state.pickups.lastSpawn || now - state.pickups.lastSpawn > 6000){
      state.pickups.lastSpawn = now;
      const id = Math.random().toString(36).slice(2,8);
      const pos = randomSpawn();
      const type = Math.random()<0.6 ? "orb" : "shield";
      state.pickups[id] = { id, x: pos.x, y: pos.y, type };
      NET.writePickups(state.code, state.pickups);
    }
    // Clear old bullets (> 2000 ms)
    for (const [owner, list] of Object.entries(state.bullets)){
      for (const [key, b] of Object.entries(list)){
        if (now - b.born > 2000){
          delete state.bullets[owner][key];
        }
      }
    }
  }

  function drawMap(){
    // floor tiling
    for (let y=0;y<HEIGHT;y+=TILE){
      for (let x=0;x<WIDTH;x+=TILE){
        ctx.drawImage(floorImg, x, y);
      }
    }
    // walls
    ctx.fillStyle = "#666";
    for (const r of MAPS[state.mapIndex].walls){
      // tile the wall texture within rect
      for (let y=r.y;y<r.y+r.h;y+=TILE){
        for (let x=r.x;x<r.x+r.w;x+=TILE){
          ctx.drawImage(wallImg, x, y);
        }
      }
    }
  }

  function drawHearts(p){
    // draw above head
    const x0 = p.x - 36;
    let x = x0, y = p.y - 42;
    // shields first (blue), max 6 halves
    let sh = p.shieldHalves;
    for (let i=0;i<Math.floor(sh/2);i++){ ctx.drawImage(shieldFull, x, y); x+=18; }
    if (sh%2===1){ ctx.drawImage(shieldHalf, x, y); x+=18; }
    // health next (red), 10 halves
    let hh = p.healthHalves;
    for (let i=0;i<Math.floor(hh/2);i++){ ctx.drawImage(heartFull, x, y); x+=18; }
    if (hh%2===1){ ctx.drawImage(heartHalf, x, y); x+=18; }
  }

  function draw(){
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    drawMap();

    // pickups
    for (const k in state.pickups){
      if (k==="lastSpawn") continue;
      const pk = state.pickups[k];
      const img = pk.type==="orb" ? orbImg : shieldImg;
      ctx.drawImage(img, pk.x-12, pk.y-12);
    }

    // bullets
    ctx.save();
    for (const owner in state.bullets){
      for (const key in state.bullets[owner]){
        const b = state.bullets[owner][key];
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy,b.vx));
        ctx.drawImage(bulletImg, -5, -2);
        ctx.setTransform(1,0,0,1,0,0);
      }
    }
    ctx.restore();

    // players
    for (const id in state.players){
      const p = state.players[id];
      if (!p) continue;
      if (!p.alive) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.dir);
      ctx.drawImage(playerImg, -24, -24);
      ctx.restore();

      // name
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.name, p.x, p.y-54);

      drawHearts(p);
    }

    // particles
    ctx.fillStyle = "rgba(200,30,30,0.7)";
    for (const part of state.particles){
      ctx.fillRect(part.x, part.y, 3, 3);
    }

    // HUD (my weapon)
    if (state.me){
      ctx.fillStyle="#ffffffcc"; ctx.font="14px sans-serif"; ctx.textAlign="left";
      ctx.fillText(`Weapon: ${state.players[state.me.id]?.weapon||"?"}`, 12, 20);
      ctx.fillText(`Players: ${Object.keys(state.players).length}`, 12, 38);
    }
  }

  function physics(now, dt){
    // step players (local motion for all for smoothness)
    for (const id in state.players){
      stepPlayer(state.players[id], dt);
    }
    // step bullets
    for (const owner in state.bullets){
      for (const key in state.bullets[owner]){
        const b = state.bullets[owner][key];
        b.x += b.vx; b.y += b.vy;
        // collide with walls
        const box = {x:b.x-2,y:b.y-2,w:4,h:4};
        let hitWall = false;
        for (const r of MAPS[state.mapIndex].walls){
          if (!(box.x+box.w < r.x || box.x > r.x+r.w || box.y+box.h < r.y || box.y > r.y+r.h)){
            hitWall = true; break;
          }
        }
        if (hitWall){ delete state.bullets[owner][key]; continue; }

        // collide with players
        for (const id in state.players){
          const p = state.players[id];
          if (!p.alive) continue;
          if (id === owner) continue;
          const dx = p.x - b.x, dy = p.y - b.y;
          if (dx*dx + dy*dy < 20*20){
            // hit
            damagePlayer(p, 1); // half-heart
            spawnBlood(p.x, p.y);
            delete state.bullets[owner][key];
            if (id===state.me.id){
              // publish my updated health
              NET.setPlayer(state.code, state.me.id, p);
            }
            break;
          }
        }
      }
    }

    // pickups overlap
    for (const k in state.pickups){
      if (k==="lastSpawn") continue;
      const pk = state.pickups[k];
      for (const id in state.players){
        const p = state.players[id];
        const d2 = (p.x-pk.x)*(p.x-pk.x) + (p.y-pk.y)*(p.y-pk.y);
        if (d2 < 26*26){
          if (pk.type==="orb"){
            // upgrade weapon cycling through pool
            const next = UPGRADE_POOL[Math.floor(Math.random()*UPGRADE_POOL.length)];
            p.weapon = next;
          } else if (pk.type==="shield"){
            p.shieldHalves = Math.min(6, p.shieldHalves + 1);
          }
          delete state.pickups[k];
          if (id===state.me.id) NET.setPlayer(state.code, id, p);
          NET.writePickups(state.code, state.pickups);
        }
      }
    }

    // fade particles
    for (const part of state.particles){
      part.x += part.vx; part.y += part.vy; part.life -= dt;
    }
    state.particles = state.particles.filter(p=>p.life>0);
  }

  // Networking wiring
  function bindRoom(code){
    NET.onLobby(code, (lob)=>{
      if (!lob) return;
      state.mapIndex = lob.mapIndex||0;
      state.hostId = lob.hostId || state.hostId;
      state.started = !!lob.started;
      if (state.started){
        ui.root.classList.add("hidden");
        canvas.style.display = "block";
      }
    });
    NET.onPlayers(code, (players)=>{
      state.players = players;
      if (!state.started) showLobby(code, players);
    });
    NET.onBullets(code, (bullets)=>{
      state.bullets = bullets;
    });
    NET.onPickups(code, (pickups)=>{
      state.pickups = pickups;
    });
  }

  // Menu handlers
  ui.hostBtn.onclick = async ()=>{
    const name = ui.playerName.value.trim() || "Player";
    const mapIndex = parseInt(ui.mapSelect.value || "0", 10);
    const code = await NET.createLobby(mapIndex, name);
    const me = createPlayer(Math.random().toString(36).slice(2,10), name);
    state.code = code; state.me = me;
    await NET.joinLobby(code, me);
    await NET.setHost(code, me.id);
    state.hostId = me.id;
    bindRoom(code);
  };

  ui.joinBtn.onclick = async ()=>{
    const name = ui.playerName.value.trim() || "Player";
    const code = (ui.joinCode.value || "").toUpperCase().replace(/[^A-Z]/g,"").slice(0,4);
    if (code.length!==4) { alert("Enter a 4-letter code"); return; }
    const me = createPlayer(Math.random().toString(36).slice(2,10), name);
    state.code = code; state.me = me;
    try {
      await NET.joinLobby(code, me);
      bindRoom(code);
    } catch (e){
      alert(e.message);
      state.code = null; state.me = null;
    }
  };

  ui.startBtn.onclick = async ()=>{
    if (state.code) await NET.startMatch(state.code);
  };
  ui.leaveBtn.onclick = async ()=>{
    if (state.code && state.me){
      await NET.leaveLobby(state.code, state.me.id);
      location.reload();
    }
  };

  // Game loop
  let last = performance.now();
  function loop(now){
    const dt = now-last; last = now;
    if (state.started){
      updateInputs();
      const me = state.players[state.me.id];
      if (me){
        tryShoot(me, now);
        // publish my state occasionally
        NET.setPlayer(state.code, state.me.id, me);
      }
      physics(now, dt);
      if (isHost()) hostTick(now);
      draw();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Resize canvas CSS to fit
  function fit(){
    const scale = Math.min(
      (window.innerWidth-32)/WIDTH,
      (window.innerHeight-32)/HEIGHT
    );
    canvas.style.transformOrigin = "top left";
    canvas.style.transform = `scale(${Math.max(0.6, Math.min(1.1, scale))})`;
  }
  window.addEventListener("resize", fit); fit();
})();
