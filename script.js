import * as THREE from 'three';

// --- VARIÁVEIS DE ESTADO E GLOBAIS ---
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

// --- CONFIGURAÇÃO THREE.JS (CLIMA AMAZÔNICO REALISTA) ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1a0a); // Verde selva profundo
scene.fog = new THREE.Fog(0x0a1a0a, 10, 145); // Neblina de floresta tropical

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';

const grassTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(120, 120);

const sun = new THREE.DirectionalLight(0xffffee, 0.9);
sun.position.set(40, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, new THREE.AmbientLight(0x224422, 0.5));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ map: grassTexture, color: 0x113311 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- MURO DE FLORESTA NO HORIZONTE ---
const jungleWallGeom = new THREE.CylinderGeometry(180, 180, 80, 32, 1, true);
const jungleWallMat = new THREE.MeshBasicMaterial({ color: 0x051005, side: THREE.BackSide, fog: true });
const jungleWall = new THREE.Mesh(jungleWallGeom, jungleWallMat);
jungleWall.position.y = 30;
scene.add(jungleWall);

// --- SISTEMA DE ÁRVORES E COLISÃO ---
const treeTrunks = [];

function createTree(x, z) {
    const group = new THREE.Group();
    const type = Math.floor(Math.random() * 3) + 1;
    const randomScale = 1.6 + Math.random() * 1.8;

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2311 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a331a });

    let trunkMesh;

    if (type === 1) {
        trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 6), trunkMat);
        trunkMesh.position.y = 3;
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.2, 8.5, 8), leafMat);
        leaves.position.y = 9;
        group.add(trunkMesh, leaves);
    } else if (type === 2) {
        trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 8), trunkMat);
        trunkMesh.position.y = 4;
        for(let i = 0; i < 4; i++) {
            const layer = new THREE.Mesh(new THREE.ConeGeometry(2.8 - (i * 0.4), 3, 8), leafMat);
            layer.position.y = 5 + (i * 1.8);
            group.add(layer);
        }
        group.add(trunkMesh);
    } else {
        trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 7), trunkMat);
        trunkMesh.position.y = 3.5;
        const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(3.8), leafMat);
        crown.position.y = 9;
        group.add(trunkMesh, crown);
    }

    group.scale.set(randomScale, randomScale, randomScale);
    group.position.set(x, 0, z);
    
    group.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.geometry.type === "CylinderGeometry" && child.position.y < 5) {
                treeTrunks.push(child);
            }
        }
    });
    scene.add(group);
}

for (let i = 0; i < 200; i++) {
    let rx = Math.random() * 260 - 130;
    let rz = Math.random() * 260 - 130;
    if (Math.abs(rx) > 20 || Math.abs(rz) > 20) createTree(rx, rz);
}

const collisionRaycaster = new THREE.Raycaster();
const collisionDistance = 1.25;

// --- OBJETOS DO MUNDO ---
const coins = [];
for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 }));
    c.position.set(Math.random() * 80 - 40, 0.3, Math.random() * 80 - 40);
    c.rotation.x = Math.PI / 2; c.castShadow = true;
    scene.add(c); coins.push(c);
}

const platforms = [], obstacles = [];
const platMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
for (let i = 0; i < 15; i++) {
    const a = i * 0.5, r = 10 + (i * 0.4), px = Math.cos(a) * r + 20, pz = Math.sin(a) * r - 20, py = 1 + (i * 1.0);
    const p = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 4), platMat);
    p.position.set(px, py, pz); p.receiveShadow = p.castShadow = true;
    scene.add(p); platforms.push(p);
}

const chestGroup = new THREE.Group();
const chestBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.8), new THREE.MeshStandardMaterial({ color: 0x4d2d18 }));
chestBase.position.y = 0.3; chestGroup.add(chestBase);
const chestLid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x5d3d28 }));
chestLid.rotation.z = Math.PI / 2; chestLid.position.y = 0.6; chestGroup.add(chestLid);
chestGroup.position.set(platforms[14].position.x, platforms[14].position.y + 0.25, platforms[14].position.z);
scene.add(chestGroup);

// --- ARMAS E MÃOS ---
const handGroup = new THREE.Group();
const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.6), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
handMesh.castShadow = true; handGroup.add(handMesh);

const knifeGroup = new THREE.Group();
const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35), new THREE.MeshStandardMaterial({ color: 0x222222 }));
handle.rotation.x = Math.PI / 2; handle.position.z = -0.4; knifeGroup.add(handle);
const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1 }));
blade.position.z = -0.6; knifeGroup.add(blade); handGroup.add(knifeGroup);

const gunGroup = new THREE.Group();
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
gunGroup.add(gunBody); 
const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 }));
muzzleFlash.position.z = -0.4;
const shotLight = new THREE.PointLight(0xffaa00, 0, 5);
shotLight.position.z = -0.4; gunGroup.add(muzzleFlash, shotLight);
gunGroup.position.set(0, 0, -0.4); handGroup.add(gunGroup);

const handPosIdle = new THREE.Vector3(0.5, -0.5, -0.8), handPosHip = new THREE.Vector3(0.5, -1.8, -0.5);
handGroup.position.copy(handPosIdle); camera.add(handGroup); scene.add(camera);

// --- MÁQUINA DE GARRA ---
const machine = new THREE.Group();
const mBase = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.5, 3.5), new THREE.MeshStandardMaterial({ color: 0xaa0000 }));
mBase.castShadow = true; machine.add(mBase);
const mGlass = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4, 3.4), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, transparent: true, opacity: 0.2 }));
mGlass.position.y = 2.75; machine.add(mGlass);
machine.position.set(0, 0.75, -10); scene.add(machine);

const sistemaBloqueio = new THREE.Group();
const panoBloqueio = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 5, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
panoBloqueio.position.set(0, 2.5, -10); sistemaBloqueio.add(panoBloqueio); scene.add(sistemaBloqueio);

const prizesInside = [];
for (let i = 0; i < 20; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff }));
    p.position.set((Math.random() - 0.5) * 2.5, 1.5, (Math.random() - 0.5) * 2.5);
    p.visible = false; machine.add(p); prizesInside.push(p);
}

const clawSystem = new THREE.Group();
const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4)); cable.position.y = 2;
const clawHead = new THREE.Group(), pinchers = [];
for (let i = 0; i < 3; i++) {
    const pPivot = new THREE.Group();
    const pMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    pMesh.position.set(0, -0.35, 0.2); pPivot.add(pMesh);
    pPivot.rotation.y = (Math.PI * 2 / 3) * i; clawHead.add(pPivot); pinchers.push(pPivot);
}
clawSystem.add(cable, clawHead); clawSystem.position.set(0, 5, 0); machine.add(clawSystem);

// --- FUNÇÕES DE SETUP (WINDOW) ---
window.selectPlatform = (t) => { isMobile = (t === 'mobile'); document.getElementById('platform-screen').style.display = 'none'; document.getElementById('setup-screen').style.display = 'flex'; };
window.selectSlot = (t) => { if (t === 'KNIFE' && !hasKnife) return; if (t === 'GUN' && !hasGun) return; if (equipAnimPhase === "IDLE") { nextEquip = t; equipAnimPhase = "DOWN"; } };

window.startGame = () => {
    const nI = document.getElementById('player-name'); if (!nI.value.trim()) return alert("Nome!");
    pName = nI.value; prizesLeft = parseInt(document.getElementById('target-prizes').value) || 1; nbSpeed = parseFloat(document.getElementById('nb-difficulty').value);
    document.getElementById('setup-screen').style.display = 'none'; if (isMobile) document.getElementById('mobile-ui').style.display = 'block';
    camera.position.set(0, 1.7, -6); startTime = Date.now(); gameActive = true;
    prizesInside.forEach((p, i) => { p.visible = i < prizesLeft });
    monsters.forEach((m, i) => { if (i < parseInt(document.getElementById('nb-count').value)) { m.position.set(Math.random()*100-50, 1.75, Math.random()*100-50); m.visible = true; } });
    createAirdrop("FACA", 0x0044bb, 60000); createAirdrop("ARMA", 0x0044bb, 120000); createAirdrop("BOTAS", 0x00ff88, 180000);
    gameState = "WALK"; if (!isMobile) document.body.requestPointerLock(); updateLeaderboard(); updateEquipVisuals();
};
// --- AIRDROPS E NEXTBOTS ---
const airdrops = [];
function createAirdrop(item, color, time) {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshStandardMaterial({ color: color }));
    box.castShadow = true; group.add(box);
    const chute = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff3333, side: THREE.DoubleSide }));
    chute.position.y = 8; chute.rotation.x = Math.PI; group.add(chute);
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

// --- SISTEMA DE INPUTS E JOYSTICK ---
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

// --- LÓGICA DE COMBATE E CHAT ---
function shoot() {
    if (currentEquip !== "GUN" || ammo <= 0 || gameState !== "WALK") return;
    ammo--; document.getElementById('ammo-val').innerText = ammo;
    muzzleFlash.material.opacity = 1; shotLight.intensity = 5; handGroup.position.z += 0.25;
    setTimeout(() => { muzzleFlash.material.opacity = 0; shotLight.intensity = 0 }, 60);
    const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(0, 0), camera);
    const inters = r.intersectObjects(monsters);
    if (inters.length > 0) inters[0].object.stunnedUntil = Date.now() + 5000;
}

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const cmd = chatInput.value.trim().toLowerCase();
        if (cmd === 'itens = todos') airdrops.forEach(a => { a.userData.active = true; a.visible = true; a.position.y = 0.9; });
        else if (cmd === 'nextbot = pare') botsPaused = true;
        else if (cmd === 'nextbot = ande') botsPaused = false;
        else if (cmd === 'voar = eu') { podeVoar = true; document.getElementById('fly-status').style.display = 'block'; }
        else if (cmd === 'parar de voar = eu') { podeVoar = false; isFlying = false; document.getElementById('fly-status').style.display = 'none'; }
        else if (cmd === 'nextbot = lula e bolsonaro') monsters.forEach(m => m.material.map = monTexPolitica);
        else if (cmd === 'nextbot = foto normal') monsters.forEach(m => m.material.map = monTexNormal);
        chatInput.value = ''; chatInput.style.display = 'none';
        if (gameActive && !isMobile) document.body.requestPointerLock();
    }
    e.stopPropagation();
});

const handleKeyDown = e => {
    if (e.code === 'KeyT' && gameActive) {
        if (chatInput.style.display === 'block') { chatInput.style.display = 'none'; if (!isMobile) document.body.requestPointerLock(); }
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
                    a.userData.opened = true; a.children[1].visible = false;
                    if (a.userData.item === "FACA") { hasKnife = true; document.getElementById('slot-2').style.color = "#ffd700"; }
                    if (a.userData.item === "ARMA") { hasGun = true; document.getElementById('slot-3').style.color = "#ffd700"; }
                    if (a.userData.item === "BOTAS") { hasBoots = true; }
                }
            });
            if (chestGroup.visible && camera.position.distanceTo(chestGroup.position) < 4) { chestGroup.visible = false; coinsCount += 10; document.getElementById('coin-val').innerText = coinsCount; }
            if (!maquinaBloqueada && camera.position.distanceTo(new THREE.Vector3(0, 1.7, -10)) < 4 && coinsCount > 0) {
                gameState = "CLAW"; if (!isMobile) document.exitPointerLock(); camera.position.set(0, 4.5, -6.5); camera.lookAt(0, 2, -10);
            }
        }
    } else if (gameState === "CLAW") {
        if (e.code === 'ArrowLeft') clawKeys.left = true; if (e.code === 'ArrowRight') clawKeys.right = true; if (e.code === 'ArrowUp') clawKeys.up = true; if (e.code === 'ArrowDown') clawKeys.down = true;
        if (e.code === 'Space') startFishing(); if (e.code === 'Escape') exitMachine();
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

// --- LOOP DE ANIMAÇÃO ---
function animate() {
    requestAnimationFrame(animate);
    if (gameActive) {
        let curT = Date.now() - startTime;
        document.getElementById('timer-val').innerText = (curT / 1000).toFixed(1);

        if (isRunning && (moveF || moveB || moveL || moveR || joyActive) && stamina > 0) stamina -= 0.2;
        else if (stamina < 100) stamina += 0.15;
        document.getElementById('stamina-bar').style.width = stamina + "%";

        airdrops.forEach(a => {
            if (!a.userData.active && curT >= a.userData.spawnAt) { a.userData.active = true; a.visible = true; }
            if (a.userData.active && a.position.y > 0.9) a.position.y += a.userData.velocity;
        });

        if (gameState === "WALK") {
            if (!isFlying) {
                velocityY -= 0.01; camera.position.y += velocityY;
                if (camera.position.y <= 1.7) { camera.position.y = 1.7; velocityY = 0; isGrounded = true }
            }

            monsters.forEach(m => {
                if (m.visible && !botsPaused && Date.now() > m.stunnedUntil) {
                    m.lookAt(camera.position.x, m.position.y, camera.position.z);
                    const d = new THREE.Vector3().subVectors(camera.position, m.position).normalize();
                    m.position.x += d.x * nbSpeed; m.position.z += d.z * nbSpeed;
                    if (m.position.distanceTo(camera.position) < 1.8) camera.position.set(0, 1.7, -6);
                }
            });

            // Movimentação com Colisão
            const baseS = isFlying ? 0.6 : (isRunning && stamina > 0 ? 0.32 : 0.18);
            const camDir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
            if(!isFlying) camDir.y = 0;
            const sideDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), camDir.normalize());
            const moveIntent = new THREE.Vector3(0,0,0);
            if(moveF) moveIntent.addScaledVector(camDir, baseS); if(moveB) moveIntent.addScaledVector(camDir, -baseS);
            if(moveL) moveIntent.addScaledVector(sideDir, baseS); if(moveR) moveIntent.addScaledVector(sideDir, -baseS);
            if(joyActive) { moveIntent.addScaledVector(camDir, -joyY*baseS); moveIntent.addScaledVector(sideDir, -joyX*baseS); }

            if(moveIntent.length() > 0) {
                collisionRaycaster.set(new THREE.Vector3(camera.position.x, 1, camera.position.z), moveIntent.clone().normalize());
                const hits = collisionRaycaster.intersectObjects(treeTrunks);
                if(hits.length === 0 || hits[0].distance > collisionDistance) camera.position.add(moveIntent);
            }
        }
    }
    renderer.render(scene, camera);
}
animate();

function updateEquipVisuals() {
    knifeGroup.visible = (currentEquip === "KNIFE"); gunGroup.visible = (currentEquip === "GUN");
}
function desbloquearMaquina() { maquinaBloqueada = false; sistemaBloqueio.visible = false; document.getElementById('timer-lock').style.display = 'none'; }
function exitMachine() { gameState = "WALK"; if (!isMobile) document.body.requestPointerLock(); camera.position.set(0, 1.7, -6) }
function updateLeaderboard() { /* Lógica de LocalStorage */ }

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
