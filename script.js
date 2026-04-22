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

// --- CONFIGURAÇÃO THREE.JS ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1a0a);
scene.fog = new THREE.Fog(0x0a1a0a, 10, 145);

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

// --- FLORESTA E ÁRVORES ---
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
            if (child.geometry.type === "CylinderGeometry" && child.position.y < 5) treeTrunks.push(child);
        }
    });
    scene.add(group);
}
for (let i = 0; i < 200; i++) {
    let rx = Math.random() * 260 - 130, rz = Math.random() * 260 - 130;
    if (Math.abs(rx) > 20 || Math.abs(rz) > 20) createTree(rx, rz);
}

const collisionRaycaster = new THREE.Raycaster();
const collisionDistance = 1.25;

// --- OBJETOS E PARKOUR ---
const coins = [], platforms = [];
const platMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
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

// --- MÃOS E ARMAS ---
const handGroup = new THREE.Group();
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

// --- NEXTBOTS ---
const monsters = [];
const monTexNormal = new THREE.TextureLoader().load('https://i.postimg.cc/YqLX3gZs/Captura-de-tela-2026-04-21-115345.png');
for (let i = 0; i < 15; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.5), new THREE.MeshBasicMaterial({ map: monTexNormal, side: THREE.DoubleSide, transparent: true }));
    m.visible = false; m.stunnedUntil = 0; scene.add(m); monsters.push(m);
}

const airdrops = [];
function createAirdrop(item, color, time) {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshStandardMaterial({ color: color }));
    group.add(box);
    const chute = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff3333, side: THREE.DoubleSide }));
    chute.position.y = 8; chute.rotation.x = Math.PI; group.add(chute);
    group.position.set(Math.random() * 140 - 70, 100, Math.random() * 140 - 70);
    group.userData = { item: item, opened: false, velocity: -0.05, active: false, spawnAt: time };
    group.visible = false; scene.add(group); airdrops.push(group);
}

// --- FUNÇÕES DE CONTROLE ---
window.selectSlot = (t) => {
    if ((t === 'KNIFE' && !hasKnife) || (t === 'GUN' && !hasGun)) return;
    if (equipAnimPhase === "IDLE" && currentEquip !== t) { nextEquip = t; equipAnimPhase = "DOWN"; }
};

function updateEquipVisuals() {
    knifeGroup.visible = (currentEquip === "KNIFE");
    gunGroup.visible = (currentEquip === "GUN");
    document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('active'));
    if (currentEquip === "NONE") document.getElementById('slot-1').classList.add('active');
    if (currentEquip === "KNIFE") document.getElementById('slot-2').classList.add('active');
    if (currentEquip === "GUN") document.getElementById('slot-3').classList.add('active');
}

// --- LOOP PRINCIPAL ---
function animate() {
    requestAnimationFrame(animate);
    if (!gameActive) return;

    let curT = Date.now() - startTime;
    document.getElementById('timer-val').innerText = (curT / 1000).toFixed(1);

    // Animação de Troca de Arma
    if (equipAnimPhase === "DOWN") {
        handGroup.position.lerp(handPosHip, 0.2);
        if (handGroup.position.distanceTo(handPosHip) < 0.1) { currentEquip = nextEquip; updateEquipVisuals(); equipAnimPhase = "UP"; }
    } else if (equipAnimPhase === "UP") {
        handGroup.position.lerp(handPosIdle, 0.2);
        if (handGroup.position.distanceTo(handPosIdle) < 0.1) { handGroup.position.copy(handPosIdle); equipAnimPhase = "IDLE"; }
    }

    airdrops.forEach(a => {
        if (!a.userData.active && curT >= a.userData.spawnAt) { a.userData.active = true; a.visible = true; }
        if (a.userData.active && a.position.y > 0.9) a.position.y += a.userData.velocity;
    });

    if (gameState === "WALK") {
        // Gravidade e Pulo
        if (!isFlying) {
            velocityY -= 0.01; camera.position.y += velocityY;
            if (camera.position.y <= 1.7) { camera.position.y = 1.7; velocityY = 0; isGrounded = true; }
        }

        // Lógica de Botas (Plataformas)
        if (hasBoots && !isFlying) {
            platforms.forEach(p => {
                if (Math.abs(camera.position.x - p.position.x) < 2.2 && Math.abs(camera.position.z - p.position.z) < 2.2) {
                    const top = p.position.y + 0.25;
                    if (velocityY <= 0 && (camera.position.y - 1.7) >= (top - 0.5) && (camera.position.y - 1.7) <= (top + 0.3)) {
                        camera.position.y = top + 1.7; velocityY = 0; isGrounded = true;
                    }
                }
            });
        }

        // Movimentação
        const baseS = isFlying ? 0.6 : (isRunning && stamina > 0 ? 0.32 : 0.18);
        const camDir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
        if(!isFlying) camDir.y = 0;
        const sideDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), camDir.normalize());
        const moveIntent = new THREE.Vector3(0,0,0);
        if(moveF) moveIntent.addScaledVector(camDir, baseS); if(moveB) moveIntent.addScaledVector(camDir, -baseS);
        if(moveL) moveIntent.addScaledVector(sideDir, baseS); if(moveR) moveIntent.addScaledVector(sideDir, -baseS);

        if(moveIntent.length() > 0) {
            collisionRaycaster.set(new THREE.Vector3(camera.position.x, 1, camera.position.z), moveIntent.clone().normalize());
            const hits = collisionRaycaster.intersectObjects(treeTrunks);
            if(hits.length === 0 || hits[0].distance > collisionDistance) camera.position.add(moveIntent);
        }

        monsters.forEach(m => {
            if (m.visible && !botsPaused && Date.now() > m.stunnedUntil) {
                m.lookAt(camera.position.x, m.position.y, camera.position.z);
                const d = new THREE.Vector3().subVectors(camera.position, m.position).normalize();
                m.position.x += d.x * nbSpeed; m.position.z += d.z * nbSpeed;
                if (m.position.distanceTo(camera.position) < 1.8) camera.position.set(0, 1.7, -6);
            }
        });
    }
    renderer.render(scene, camera);
}

// --- EVENTOS ---
document.addEventListener('keydown', e => {
    if (e.code === 'KeyW') moveF = true; if (e.code === 'KeyS') moveB = true; 
    if (e.code === 'KeyA') moveL = true; if (e.code === 'KeyD') moveR = true;
    if (e.code === 'ShiftLeft') isRunning = true;
    if (e.code === 'Digit1') window.selectSlot('NONE');
    if (e.code === 'Digit2') window.selectSlot('KNIFE');
    if (e.code === 'Digit3') window.selectSlot('GUN');
    if (e.code === 'Space' && isGrounded && !isFlying) { velocityY = 0.22; isGrounded = false; }
    if (e.code === 'KeyE') {
        airdrops.forEach(a => {
            if (a.userData.active && !a.userData.opened && camera.position.distanceTo(a.position) < 5) {
                a.userData.opened = true; a.visible = false;
                if (a.userData.item === "FACA") { hasKnife = true; document.getElementById('slot-2').style.color = "#ffd700"; }
                if (a.userData.item === "ARMA") { hasGun = true; document.getElementById('slot-3').style.color = "#ffd700"; }
                if (a.userData.item === "BOTAS") hasBoots = true;
            }
        });
    }
});
document.addEventListener('keyup', e => {
    if (e.code === 'KeyW') moveF = false; if (e.code === 'KeyS') moveB = false; 
    if (e.code === 'KeyA') moveL = false; if (e.code === 'KeyD') moveR = false;
    if (e.code === 'ShiftLeft') isRunning = false;
});

// Inicialização Final
window.startGame = () => {
    gameActive = true; startTime = Date.now();
    document.getElementById('setup-screen').style.display = 'none';
    createAirdrop("FACA", 0x0044bb, 5000); // 5 seg para teste
    createAirdrop("ARMA", 0x0044bb, 15000);
    createAirdrop("BOTAS", 0x00ff88, 25000);
    animate();
};
