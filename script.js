import * as THREE from 'three';

// Variáveis de Estado e Globais
let isMobile = false;
let pName = "", coinsCount = 0, prizesLeft = 10, gameState = "SETUP";
let isClawDescending = false, caughtPrize = null, startTime = 0, gameActive = false;
let velocityY = 0, isGrounded = true;
let moveF = false, moveB = false, moveL = false, moveR = false, isRunning = false;
let yaw = 0, pitch = 0, clawOpen = 1, nbSpeed = 0.1, stamina = 100, ammo = 5;
let currentEquip = "NONE", nextEquip = "NONE", equipAnimPhase = "IDLE", botsPaused = false;
let podeVoar = false, isFlying = false, lastSpacePress = 0;
let hasKnife = false, hasGun = false, hasBoots = false;
let maquinaBloqueada = true, tempoCadeado = 30, segurandoR = false, nbScale = 1;
let clawKeys = { left: false, right: false, up: false, down: false };

const chatInput = document.getElementById('game-chat');
let joyX = 0, joyY = 0, joyActive = false, joyId = null;
const base = document.getElementById('joy-base');
const stick = document.getElementById('stick');

// Configuração Three.js
const scene = new THREE.Scene();
// --- RESTAURADO: Céu Azul Original ---
scene.background = new THREE.Color(0x87CEEB);
// --- REMOVIDO: scene.fog (Neblina) ---

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.shadowMap.element || renderer.domElement); // Correção leve para garantir compatibilidade

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';

// Texturas e Luzes
const grassTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(100, 100);

// --- RESTAURADO: Luz Branca Original ---
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(40, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
// --- RESTAURADO: Luz Ambiente Branca Original ---
scene.add(sun, new THREE.AmbientLight(0xffffff, 0.4));

// --- RESTAURADO: Cor da Grama Original ---
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ map: grassTexture })); 
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- FUNÇÕES DE INTERFACE (WINDOW) ---
window.selectPlatform = (type) => {
    isMobile = (type === 'mobile');
    document.getElementById('platform-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'flex';
};

window.selectSlot = (type) => {
    if (type === 'KNIFE' && !hasKnife) return;
    if (type === 'GUN' && !hasGun) return;
    if (equipAnimPhase === "IDLE") { nextEquip = type; equipAnimPhase = "DOWN"; }
};

window.startGame = () => {
    const nI = document.getElementById('player-name');
    if (!nI.value.trim()) return alert("Digite seu nome!");
    
    pName = nI.value;
    prizesLeft = Math.min(20, parseInt(document.getElementById('target-prizes').value) || 1);
    nbSpeed = parseFloat(document.getElementById('nb-difficulty').value);
    
    document.getElementById('setup-screen').style.display = 'none';
    if (isMobile) document.getElementById('mobile-ui').style.display = 'block';
    
    camera.position.set(0, 1.7, -6);
    startTime = Date.now();
    gameActive = true;
    
    prizesInside.forEach((p, i) => { p.visible = i < prizesLeft });
    monsters.forEach((m, i) => {
        if (i < parseInt(document.getElementById('nb-count').value)) {
            m.position.set((Math.random() - 0.5) * 150, 1.75, (Math.random() - 0.5) * 150);
            m.visible = true;
        } else m.visible = false;
    });

    let items = [{ type: "FACA", col: 0x0044bb }, { type: "ARMA", col: 0x0044bb }, { type: "BOTAS", col: 0x00ff88 }];
    items = items.sort(() => Math.random() - 0.5);
    createAirdrop(items[0].type, items[0].col, 60000);
    createAirdrop(items[1].type, items[1].col, 120000);
    createAirdrop(items[2].type, items[2].col, 180000);

    gameState = "WALK";
    if (!isMobile) document.body.requestPointerLock();
    updateLeaderboard();
    document.getElementById('prizes-val').innerText = prizesLeft;
    updateEquipVisuals();

    if (isMobile) {
        setupMBtn('btn-jump', 'Space');
        setupMBtn('btn-run', 'ShiftLeft');
        setupMBtn('btn-e', 'KeyE');
        setupMBtn('btn-r', 'KeyR');
        document.getElementById('btn-shoot').onclick = shoot;
        document.getElementById('btn-t').onclick = () => { handleKeyDown({ code: 'KeyT' }); };
    }
};

// --- ADIÇÃO DO SISTEMA DE ÁRVORES GRANDES (MANTIDO) ---
function createTree(x, z) {
    const g = new THREE.Group();
    // Mantendo a escala grande das árvores
    const height = 20 + Math.random() * 25;
    const radius = 1.2 + Math.random() * 1.5;

    // Tronco (Cor original restaurada implicitamente pela luz branca)
    const t = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.3, height, 8), new THREE.MeshStandardMaterial({ color: 0x4d2d18 }));
    t.position.y = height / 2; t.castShadow = true; g.add(t);

    // Copa (Cor original restaurada)
    const f = new THREE.Mesh(new THREE.DodecahedronGeometry(height * 0.6, 0), new THREE.MeshStandardMaterial({ color: 0x2d5a27 }));
    f.position.y = height; f.castShadow = true; g.add(f);
    
    g.position.set(x, 0, z);
    scene.add(g);
}

// Mantendo a floresta densa e grande ao redor
for (let i = 0; i < 120; i++) {
    let rx = Math.random() * 400 - 200, rz = Math.random() * 400 - 200;
    // Evita árvores em cima da máquina
    if (Math.abs(rx) > 10 || (rz > -5 || rz < -15)) createTree(rx, rz);
}
// -----------------------------------------------------

const coins = [];
for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 }));
    c.position.set(Math.random() * 80 - 40, 0.3, Math.random() * 80 - 40);
    c.rotation.x = Math.PI / 2; c.castShadow = true;
    scene.add(c); coins.push(c);
}

// Plataformas e Chest
const platforms = [], obstacles = [];
const platMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
for (let i = 0; i < 15; i++) {
    const a = i * 0.5, r = 10 + (i * 0.4), px = Math.cos(a) * r + 20, pz = Math.sin(a) * r - 20, py = 1 + (i * 1.0);
    const p = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 4), platMat);
    p.position.set(px, py, pz); p.receiveShadow = p.castShadow = true;
    scene.add(p); platforms.push(p);
    if (i > 2 && i % 3 === 0) {
        const o = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4, 0.8), new THREE.MeshStandardMaterial({ color: 0xff3333 }));
        o.position.set(px, py + 2.2, pz); o.castShadow = true;
        scene.add(o); obstacles.push(o);
    }
}

const chestGroup = new THREE.Group();
const chestBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.8), new THREE.MeshStandardMaterial({ color: 0x4d2d18 }));
chestBase.position.y = 0.3; chestGroup.add(chestBase);
const chestLid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x5d3d28 }));
chestLid.rotation.z = Math.PI / 2; chestLid.position.y = 0.6; chestGroup.add(chestLid);
const lock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: 0xffd700 }));
lock.position.set(0, 0.5, 0.4); chestGroup.add(lock);
chestGroup.position.set(platforms[14].position.x, platforms[14].position.y + 0.25, platforms[14].position.z);
scene.add(chestGroup);

// Armas e Mãos
const handGroup = new THREE.Group();
const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.6), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
handMesh.castShadow = true; handGroup.add(handMesh);

const knifeGroup = new THREE.Group();
const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }));
handle.rotation.x = Math.PI / 2; handle.position.z = -0.4; knifeGroup.add(handle);
const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape().moveTo(0, 0).lineTo(0.08, 0).lineTo(0.08, 0.5).lineTo(0.01, 0.6).lineTo(0, 0.1).lineTo(0, 0), { depth: 0.01, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.1 }));
blade.rotation.x = -Math.PI / 2; blade.rotation.z = Math.PI / 2; blade.position.set(0.04, 0, -0.55);
knifeGroup.add(blade); handGroup.add(knifeGroup);

const gunGroup = new THREE.Group();
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
const gunHandle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.15), new THREE.MeshStandardMaterial({ color: 0x111111 }));
gunHandle.position.set(0, -0.2, 0.2); gunGroup.add(gunBody, gunHandle);
const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 }));
muzzleFlash.position.z = -0.4;
const shotLight = new THREE.PointLight(0xffaa00, 0, 5);
shotLight.position.z = -0.4; gunGroup.add(muzzleFlash, shotLight);
gunGroup.position.set(0, 0, -0.4); handGroup.add(gunGroup);

const handPosIdle = new THREE.Vector3(0.5, -0.5, -0.8), handPosHip = new THREE.Vector3(0.5, -1.8, -0.5);
handGroup.position.copy(handPosIdle); camera.add(handGroup); scene.add(camera);

// Máquina de Garra e Bloqueio
const machine = new THREE.Group();
const mBase = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.5, 3.5), new THREE.MeshStandardMaterial({ color: 0xaa0000, metalness: 0.5 }));
mBase.castShadow = true; machine.add(mBase);
const mGlass = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4, 3.4), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, transparent: true, opacity: 0.2 }));
mGlass.position.y = 2.75; machine.add(mGlass);
const mTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.4, 3.6), new THREE.MeshStandardMaterial({ color: 0xaa0000 }));
mTop.position.y = 4.8; machine.add(mTop);
const alavancaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222 }));
alavancaBase.position.set(0, 1.2, 1.8); alavancaBase.rotation.x = Math.PI / 2; machine.add(alavancaBase);
const alavancaHaste = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
alavancaHaste.position.set(0, 1.5, 1.9); alavancaHaste.rotation.x = 0.4; machine.add(alavancaHaste);
machine.position.set(0, 0.75, -10); scene.add(machine);

const sistemaBloqueio = new THREE.Group();
scene.add(sistemaBloqueio);
const panoBloqueio = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 5, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
panoBloqueio.position.set(0, 2.5, -10); sistemaBloqueio.add(panoBloqueio);
const cadeadoObj = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.15), new THREE.MeshStandardMaterial({ color: 0xffff00, metalness: 0.8 }));
cadeadoObj.position.set(0, 1.2, -7.4); sistemaBloqueio.add(cadeadoObj);

const prizesInside = [];
for (let i = 0; i < 20; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff }));
    p.position.set((Math.random() - 0.5) * 2.5, 1.5, (Math.random() - 0.5) * 2.5);
    p.castShadow = true; p.visible = false; machine.add(p); prizesInside.push(p);
}

const clawSystem = new THREE.Group();
const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4), new THREE.MeshStandardMaterial({ color: 0x222222 })); cable.position.y = 2;
const clawHead = new THREE.Group(), pinchers = [];
for (let i = 0; i < 3; i++) {
    const pPivot = new THREE.Group();
    const pMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    pMesh.position.set(0, -0.35, 0.2); pPivot.add(pMesh);
    pPivot.rotation.y = (Math.PI * 2 / 3) * i; clawHead.add(pPivot); pinchers.push(pPivot);
}
clawSystem.add(cable, clawHead); clawSystem.position.set(0, 5, 0); machine.add(clawSystem);

// Airdrops e Nextbots
const airdrops = [];
function createAirdrop(item, color, time) {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshStandardMaterial({ color: color }));
    box.castShadow = true; group.add(box);
    const chute = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff3333, side: THREE.DoubleSide }));
    chute.position.y = 8; chute.rotation.x = Math.PI; group.add(chute);
    for (let i = 0; i < 4; i++) {
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 8), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
        line.position.y = 4; line.position.x = (i < 2 ? 1.5 : -1.5); line.position.z = (i % 2 == 0 ? 1.5 : -1.5); group.add(line);
    }
    group.position.set(Math.random() * 140 - 70, 100, Math.random() * 140 - 70);
    group.userData = { item: item, opened: false, velocity: -0.05, active: false, spawnAt: time };
    group.visible = false; scene.add(group); airdrops.push(group);
}

const monsters = [];
const monTexNormal = new THREE.TextureLoader().load('https://i.postimg.cc/YqLX3gZs/Captura-de-tela-2026-04-21-115345.png');
const monTexPolitica = new THREE.TextureLoader().load('https://i.postimg.cc/4NvxyJTj/Captura-de-tela-2026-04-21-155924.png');
for (let i = 0; i < 15; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.5), new THREE.MeshBasicMaterial({ map: monTexNormal, side: THREE.DoubleSide, transparent: true }));
    m.visible = false; m.stunnedUntil = 0; scene.add(m); monsters.push(m);
}

// --- SISTEMA DE INPUTS (TOUCH E TECLADO) ---
base.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; joyId = t.identifier; joyActive = true; updateJoy(t); });
base.addEventListener('touchmove', e => { e.preventDefault(); for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === joyId) updateJoy(e.changedTouches[i]); });
base.addEventListener('touchend', e => { for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === joyId) { joyActive = false; joyId = null; joyX = 0; joyY = 0; stick.style.left = '50%'; stick.style.top = '50%'; } });

function updateJoy(touch) {
    const rect = base.getBoundingClientRect();
    const x = touch.clientX - (rect.left + rect.width / 2), y = touch.clientY - (rect.top + rect.height / 2);
    const dist = Math.min(60, Math.sqrt(x * x + y * y)), angle = Math.atan2(y, x);
    joyX = (Math.cos(angle) * dist) / 60; joyY = (Math.sin(angle) * dist) / 60;
    stick.style.left = `calc(50% + ${Math.cos(angle) * dist}px)`; stick.style.top = `calc(50% + ${Math.sin(angle) * dist}px)`;
}

let lookId = null, lastX, lastY;
document.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (t.clientX > window.innerWidth / 2 && lookId === null) { lookId = t.identifier; lastX = t.clientX; lastY = t.clientY; } });
document.addEventListener('touchmove', e => { for (let i = 0; i < e.changedTouches.length; i++) { const t = e.changedTouches[i]; if (t.identifier === lookId) { yaw -= (t.clientX - lastX) * 0.005; pitch = Math.max(-1.5, Math.min(1.5, pitch - (t.clientY - lastY) * 0.005)); camera.rotation.set(pitch, yaw, 0, 'YXZ'); lastX = t.clientX; lastY = t.clientY; } } });
document.addEventListener('touchend', e => { for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === lookId) lookId = null; });

const setupMBtn = (id, code) => {
    const btn = document.getElementById(id);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); handleKeyDown({ code: code }); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); handleKeyUp({ code: code }); });
};

// --- LÓGICA DE COMBATE E CHAT ---
function shoot() {
    if (currentEquip !== "GUN" || ammo <= 0 || gameState !== "WALK" || (!document.pointerLockElement && !isMobile)) return;
    ammo--; document.getElementById('ammo-val').innerText = ammo;
    muzzleFlash.material.opacity = 1; shotLight.intensity = 5; handGroup.position.z += 0.25;
    setTimeout(() => { muzzleFlash.material.opacity = 0; shotLight.intensity = 0 }, 60);
    const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(0, 0), camera);
    const inters = r.intersectObjects(monsters);
    if (inters.length > 0) inters[0].object.stunnedUntil = Date.now() + 5000;
}

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const cmd = chatInput.value.trim().toLowerCase().replace(/\s+/g, ' ');
        if (cmd === 'itens = todos') airdrops.forEach(a => { a.userData.active = true; a.visible = true; a.position.y = 0.9; });
        else if (cmd === 'nextbot = pare') botsPaused = true;
        else if (cmd === 'nextbot = ande') botsPaused = false;
        else if (cmd === 'voar = eu') { podeVoar = true; document.getElementById('fly-status').style.display = 'block'; }
        else if (cmd === 'parar de voar = eu') { podeVoar = false; isFlying = false; document.getElementById('fly-status').style.display = 'none'; }
        else if (cmd === 'nextbot = lula e bolsonaro') monsters.forEach(m => m.material.map = monTexPolitica);
        else if (cmd === 'nextbot = foto normal') monsters.forEach(m => m.material.map = monTexNormal);
        chatInput.value = ''; chatInput.style.display = 'none'; chatInput.blur();
        if (gameActive && !isMobile) document.body.requestPointerLock();
    }
    e.stopPropagation();
});

const handleKeyDown = e => {
    if (e.code === 'KeyT' && gameActive) {
        if (chatInput.style.display === 'block') { chatInput.style.display = 'none'; chatInput.blur(); if (!isMobile) document.body.requestPointerLock(); }
        else { chatInput.style.display = 'block'; chatInput.focus(); if (!isMobile) document.exitPointerLock(); }
        return;
    }
    if (document.activeElement === chatInput) return;
    if (gameState === "WALK") {
        if (e.code === 'KeyW') moveF = true; if (e.code === 'KeyS') moveB = true; if (e.code === 'KeyA') moveL = true; if (e.code === 'KeyD') moveR = true;
        if (e.code === 'ShiftLeft') isRunning = true;
        if (e.code === 'Space') {
            let now = Date.now();
            if (podeVoar && (now - lastSpacePress < 300)) { isFlying = !isFlying; velocityY = 0; }
            lastSpacePress = now;
            if (!isFlying && isGrounded) { velocityY = 0.22; isGrounded = false }
        }
        if (e.code === 'KeyR' && maquinaBloqueada && camera.position.distanceTo(new THREE.Vector3(0, 1.2, -7.4)) < 3) {
            if (currentEquip === "KNIFE") { desbloquearMaquina(); } else { segurandoR = true; document.getElementById('timer-lock').style.display = 'block'; }
        }
        if (e.code === 'KeyE') {
            coins.forEach(c => { if (c.visible && camera.position.distanceTo(c.position) < 3) { c.visible = false; coinsCount++; document.getElementById('coin-val').innerText = coinsCount } });
            airdrops.forEach(a => {
                if (a.userData.active && !a.userData.opened && camera.position.distanceTo(a.position) < 5) {
                    a.userData.opened = true; a.children[1].visible = false; a.children.slice(2).forEach(l => l.visible = false);
                    if (a.userData.item === "FACA") { hasKnife = true; document.getElementById('slot-2').style.color = "#ffd700"; }
                    if (a.userData.item === "ARMA") { hasGun = true; document.getElementById('slot-3').style.color = "#ffd700"; }
                    if (a.userData.item === "BOTAS") { hasBoots = true; updateEquipVisuals(); }
                }
            });
            if (chestGroup.visible && camera.position.distanceTo(chestGroup.position) < 4) { chestGroup.visible = false; coinsCount += 10; document.getElementById('coin-val').innerText = coinsCount; }
            if (!maquinaBloqueada && camera.position.distanceTo(new THREE.Vector3(0, 1.7, -10)) < 4 && coinsCount > 0) {
                gameState = "CLAW"; if (!isMobile) document.exitPointerLock(); document.getElementById('game-info').style.display = 'block'; camera.position.set(0, 4.5, -6.5); camera.lookAt(0, 2, -10); handGroup.position.copy(handPosHip)
            }
        }
        if (equipAnimPhase === "IDLE") {
            if (e.code === 'Digit1') selectSlot('NONE'); if (e.code === 'Digit2') selectSlot('KNIFE'); if (e.code === 'Digit3') selectSlot('GUN');
        }
    } else if (gameState === "CLAW") {
        if (e.code === 'ArrowLeft') clawKeys.left = true; if (e.code === 'ArrowRight') clawKeys.right = true; if (e.code === 'ArrowUp') clawKeys.up = true; if (e.code === 'ArrowDown') clawKeys.down = true;
        if (e.code === 'Space') startFishing(); if (e.code === 'Escape') exitMachine()
    }
};

const handleKeyUp = e => {
    if (e.code === 'KeyW') moveF = false; if (e.code === 'KeyS') moveB = false; if (e.code === 'KeyA') moveL = false; if (e.code === 'KeyD') moveR = false; if (e.code === 'ShiftLeft') isRunning = false;
    if (e.code === 'ArrowLeft') clawKeys.left = false; if (e.code === 'ArrowRight') clawKeys.right = false; if (e.code === 'ArrowUp') clawKeys.up = false; if (e.code === 'ArrowDown') clawKeys.down = false;
    if (e.code === 'KeyR') { segurandoR = false; tempoCadeado = 30; document.getElementById('timer-lock').style.display = 'none'; }
};

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
document.addEventListener('mousemove', e => { if (document.pointerLockElement && gameState === "WALK") { yaw -= e.movementX * 0.002; pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * 0.002)); camera.rotation.set(pitch, yaw, 0, 'YXZ') } });

// --- UTILITÁRIOS ---
function updateEquipVisuals() {
    knifeGroup.visible = (currentEquip === "KNIFE"); gunGroup.visible = (currentEquip === "GUN");
    document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('active'));
    if (currentEquip === "NONE") document.getElementById('slot-1').classList.add('active');
    if (currentEquip === "KNIFE") document.getElementById('slot-2').classList.add('active');
    if (currentEquip === "GUN") document.getElementById('slot-3').classList.add('active');
    if (hasBoots) { document.getElementById('slot-boots').style.borderColor = "#00ff88"; document.getElementById('slot-boots').style.color = "#00ff88"; }
}

function desbloquearMaquina() { maquinaBloqueada = false; sistemaBloqueio.visible = false; segurandoR = false; document.getElementById('timer-lock').style.display = 'none'; }
function exitMachine() { gameState = "WALK"; document.getElementById('game-info').style.display = 'none'; if (!isMobile) document.body.requestPointerLock(); camera.position.set(0, 1.7, -6) }

function updateLeaderboard() { const s = JSON.parse(localStorage.getItem('arcadeScores') || "[]"); document.getElementById('score-list').innerHTML = s.sort((a, b) => a.time - b.time).slice(0, 5).map(x => `<div>${x.name}: ${x.time}s</div>`).join('') }

function startFishing() {
    if (isClawDescending || coinsCount <= 0) return;
    isClawDescending = true; let stg = "DOWN";
    const i = setInterval(() => {
        if (stg === "DOWN") {
            clawOpen = 1; clawSystem.position.y -= 0.05;
            if (clawSystem.position.y <= 1.8) stg = "GRAB"
        } else if (stg === "GRAB") {
            clawOpen -= 0.1; if (clawOpen <= 0) {
                prizesInside.forEach(p => { if (p.visible && p.position.distanceTo(new THREE.Vector3(clawSystem.position.x, 1.5, clawSystem.position.z)) < 0.6) caughtPrize = p });
                stg = "UP"
            }
        } else if (stg === "UP") {
            clawSystem.position.y += 0.04;
            if (caughtPrize) caughtPrize.position.set(clawSystem.position.x, clawSystem.position.y - 0.5, clawSystem.position.z);
            if (clawSystem.position.y >= 5) stg = "DONE"
        } else {
            if (caughtPrize) { caughtPrize.visible = false; prizesLeft--; document.getElementById('prizes-val').innerText = Math.max(0, prizesLeft); caughtPrize = null; if (prizesLeft <= 0) endGame() }
            coinsCount--; document.getElementById('coin-val').innerText = coinsCount; clearInterval(i); isClawDescending = false; if (coinsCount <= 0) exitMachine()
        }
    }, 20)
}

function endGame() {
    gameActive = false; let ft = ((Date.now() - startTime) / 1000).toFixed(1);
    const s = JSON.parse(localStorage.getItem('arcadeScores') || "[]"); s.push({ name: pName, time: parseFloat(ft) });
    localStorage.setItem('arcadeScores', JSON.stringify(s)); if (!isMobile) document.exitPointerLock();
    document.getElementById('final-stats').innerText = `${pName} finalizou em ${ft}s!`;
    document.getElementById('end-screen').style.display = 'flex'; gameState = "END"
}

// --- LOOP DE ANIMAÇÃO ---
function animate() {
    requestAnimationFrame(animate);
    if (gameActive) {
        let curT = Date.now() - startTime;
        document.getElementById('timer-val').innerText = (curT / 1000).toFixed(1);

        if (isRunning && (moveF || moveB || moveL || moveR || joyActive) && stamina > 0) stamina -= 0.2;
        else if (stamina < 100) stamina += 0.15;
        document.getElementById('stamina-bar').style.width = Math.max(0, stamina) + "%";

        airdrops.forEach(a => {
            if (!a.userData.active && curT >= a.userData.spawnAt) { a.userData.active = true; a.visible = true; }
            if (a.userData.active) {
                if (a.position.y > 0.9) a.position.y += a.userData.velocity;
                else { a.position.y = 0.9; a.children[1].visible = false; a.children.slice(2).forEach(l => l.visible = false); }
            }
        });
    }

    if (gameState === "CLAW" && !isClawDescending) {
        const s = 0.05;
        if (clawKeys.left) clawSystem.position.x -= s; if (clawKeys.right) clawSystem.position.x += s;
        if (clawKeys.up) clawSystem.position.z -= s; if (clawKeys.down) clawSystem.position.z += s;
        if (isMobile && joyActive) { clawSystem.position.x -= joyX * s; clawSystem.position.z += joyY * s; }
        clawSystem.position.x = Math.max(-1.5, Math.min(1.5, clawSystem.position.x));
        clawSystem.position.z = Math.max(-1.5, Math.min(1.5, clawSystem.position.z));
    }

    pinchers.forEach(p => { p.rotation.z = clawOpen * 0.5 });

    if (gameState === "WALK") {
        if (equipAnimPhase === "DOWN") {
            handGroup.position.lerp(handPosHip, 0.15);
            if (handGroup.position.distanceTo(handPosHip) < 0.05) { currentEquip = nextEquip; updateEquipVisuals(); equipAnimPhase = "UP" }
        } else if (equipAnimPhase === "UP") {
            handGroup.position.lerp(handPosIdle, 0.15);
            if (handGroup.position.distanceTo(handPosIdle) < 0.05) { handGroup.position.copy(handPosIdle); equipAnimPhase = "IDLE" }
        }

        if (!isFlying) {
            velocityY -= 0.01; camera.position.y += velocityY;
            if (camera.position.y <= 1.7) { camera.position.y = 1.7; velocityY = 0; isGrounded = true } else isGrounded = false;
        }

        if (segurandoR && maquinaBloqueada) {
            tempoCadeado -= 0.016; document.getElementById('timer-lock').innerText = Math.ceil(tempoCadeado);
            if (tempoCadeado <= 0) desbloquearMaquina();
        }

        if (hasBoots && !isFlying) {
            platforms.forEach(p => {
                if (Math.abs(camera.position.x - p.position.x) < 2.1 && Math.abs(camera.position.z - p.position.z) < 2.1) {
                    const pt = p.position.y + 0.25;
                    if (velocityY <= 0 && camera.position.y - 1.7 >= pt - 0.5 && camera.position.y - 1.7 <= pt + 0.1) {
                        camera.position.y = pt + 1.7; velocityY = 0; isGrounded = true
                    }
                }
            });
        }

        monsters.forEach(m => {
            if (m.visible && !botsPaused) {
                m.lookAt(camera.position.x, m.position.y, camera.position.z);
                if (Date.now() > m.stunnedUntil) {
                    const d = new THREE.Vector3().subVectors(camera.position, m.position).normalize();
                    m.position.x += d.x * nbSpeed; m.position.z += d.z * nbSpeed;
                    if (m.position.distanceTo(camera.position) < 1.8 * nbScale) camera.position.set(0, 1.7, -6)
                }
            }
        });

        if (document.pointerLockElement || isMobile) {
            const baseS = isFlying ? 0.6 : (isRunning && stamina > 0 ? 0.32 : 0.18);
            const d = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); if (!isFlying) d.y = 0; d.normalize();
            const s = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d);
            if (moveF) camera.position.addScaledVector(d, baseS); if (moveB) camera.position.addScaledVector(d, -baseS);
            if (moveL) camera.position.addScaledVector(s, baseS); if (moveR) camera.position.addScaledVector(s, -baseS);
            if (joyActive) { camera.position.addScaledVector(d, -joyY * baseS); camera.position.addScaledVector(s, -joyX * baseS); }

            let nearObj = false;
            if (maquinaBloqueada && camera.position.distanceTo(new THREE.Vector3(0, 1.2, -7.4)) < 3) { document.getElementById('prompt').innerText = "Segure [R] para desbloquear"; nearObj = true; }
            else if (!maquinaBloqueada && camera.position.distanceTo(new THREE.Vector3(0, 1.7, -10)) < 4) { document.getElementById('prompt').innerText = "Pressione [E] para a Máquina"; nearObj = true; }
            document.getElementById('prompt').style.display = nearObj ? 'block' : 'none';
        }
    }
    renderer.render(scene, camera);
}
animate();

// Listener de redimensionamento
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
