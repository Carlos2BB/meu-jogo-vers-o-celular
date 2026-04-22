import * as THREE from 'three';

// --- VARIÁVEIS DE ESTADO E GLOBAIS ---
let isMobile = false;
let pName = "", coinsCount = 0, prizesLeft = 10, gameState = "PLATFORM";
let gameActive = false, startTime = 0, velocityY = 0, isGrounded = true;
let moveF = false, moveB = false, moveL = false, moveR = false, isRunning = false;
let yaw = 0, pitch = 0, stamina = 100, ammo = 5, nbSpeed = 0.1;
let currentEquip = "NONE", nextEquip = "NONE", equipAnimPhase = "IDLE", botsPaused = false;
let hasKnife = false, hasGun = false, hasBoots = false;
let maquinaBloqueada = true, tempoCadeado = 30.0, segurandoR = false;
let joyX = 0, joyY = 0, joyActive = false, joyId = null;

// --- CONFIGURAÇÃO THREE.JS ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1a0a);
scene.fog = new THREE.Fog(0x0a1a0a, 10, 145);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';

const sun = new THREE.DirectionalLight(0xffffee, 0.9);
sun.position.set(40, 60, 20);
sun.castShadow = true;
scene.add(sun, new THREE.AmbientLight(0x224422, 0.5));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0x113311 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- MÃOS E MODELOS DE ARMAS ---
const handGroup = new THREE.Group();
const handPosIdle = new THREE.Vector3(0.5, -0.5, -0.8);
const handPosHip = new THREE.Vector3(0.5, -1.8, -0.5);
handGroup.position.copy(handPosIdle);
camera.add(handGroup);
scene.add(camera);

// Faca
const knifeGroup = new THREE.Group();
const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35), new THREE.MeshStandardMaterial({ color: 0x222222 }));
handle.rotation.x = Math.PI / 2;
const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1 }));
blade.position.z = -0.3;
knifeGroup.add(handle, blade);
knifeGroup.visible = false;
handGroup.add(knifeGroup);

// Arma
const gunGroup = new THREE.Group();
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
gunGroup.add(gunBody);
gunGroup.visible = false;
handGroup.add(gunGroup);

// --- MÁQUINA DE PRÊMIOS E BLOQUEIO ---
const sistemaBloqueio = new THREE.Group();
const panoBloqueio = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 5, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
panoBloqueio.position.set(0, 2.5, -10);
sistemaBloqueio.add(panoBloqueio);
scene.add(sistemaBloqueio);

// --- SISTEMA DE AIRDROPS ---
const airdrops = [];
function createAirdrop(item, color, time) {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshStandardMaterial({ color: color }));
    group.add(box);
    const chute = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff3333, side: THREE.DoubleSide }));
    chute.position.y = 8; chute.rotation.x = Math.PI; group.add(chute);
    group.position.set(Math.random() * 80 - 40, 100, Math.random() * 80 - 40);
    group.userData = { item: item, opened: false, velocity: -0.06, active: false, spawnAt: time };
    group.visible = false; scene.add(group); airdrops.push(group);
}

// --- FUNÇÕES DE INTERFACE ---
window.selectPlatform = (platform) => {
    isMobile = (platform === 'mobile');
    document.getElementById('platform-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'flex';
};

window.selectSlot = (t) => {
    if ((t === 'KNIFE' && !hasKnife) || (t === 'GUN' && !hasGun)) return;
    if (equipAnimPhase === "IDLE" && currentEquip !== t) {
        nextEquip = t;
        equipAnimPhase = "DOWN";
    }
};

function updateEquipVisuals() {
    knifeGroup.visible = (currentEquip === "KNIFE");
    gunGroup.visible = (currentEquip === "GUN");
    document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('active'));
    if (currentEquip === "NONE") document.getElementById('slot-1').classList.add('active');
    if (currentEquip === "KNIFE") document.getElementById('slot-2').classList.add('active');
    if (currentEquip === "GUN") document.getElementById('slot-3').classList.add('active');
}

function desbloquearMaquina() {
    maquinaBloqueada = false;
    sistemaBloqueio.visible = false;
    document.getElementById('timer-lock').style.display = 'none';
}

// --- LOOP DE ANIMAÇÃO ---
function animate() {
    requestAnimationFrame(animate);
    if (!gameActive) return;

    let curT = Date.now() - startTime;
    document.getElementById('timer-val').innerText = (curT / 1000).toFixed(1);

    // Lógica do Cadeado (R)
    if (maquinaBloqueada && segurandoR) {
        tempoCadeado -= 0.016; 
        document.getElementById('lock-sec').innerText = Math.max(0, Math.ceil(tempoCadeado));
        if (tempoCadeado <= 0) desbloquearMaquina();
    }

    // Animação de Troca de Arma
    if (equipAnimPhase === "DOWN") {
        handGroup.position.lerp(handPosHip, 0.2);
        if (handGroup.position.distanceTo(handPosHip) < 0.1) {
            currentEquip = nextEquip;
            updateEquipVisuals();
            equipAnimPhase = "UP";
        }
    } else if (equipAnimPhase === "UP") {
        handGroup.position.lerp(handPosIdle, 0.2);
        if (handGroup.position.distanceTo(handPosIdle) < 0.1) {
            handGroup.position.copy(handPosIdle);
            equipAnimPhase = "IDLE";
        }
    }

    // Airdrops
    airdrops.forEach(a => {
        if (!a.userData.active && curT >= a.userData.spawnAt) { a.userData.active = true; a.visible = true; }
        if (a.userData.active && a.position.y > 0.9) a.position.y += a.userData.velocity;
    });

    // Movimentação e Gravidade
    if (gameState === "WALK") {
        if (!isFlying) {
            velocityY -= 0.01; camera.position.y += velocityY;
            if (camera.position.y <= 1.7) { camera.position.y = 1.7; velocityY = 0; isGrounded = true; }
        }
        
        const baseS = isRunning ? 0.35 : 0.2;
        const camDir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
        camDir.y = 0; camDir.normalize();
        if (moveF) camera.position.addScaledVector(camDir, baseS);
        if (moveB) camera.position.addScaledVector(camDir, -baseS);
    }

    renderer.render(scene, camera);
}

// --- CONTROLES ---
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveF = true;
    if (e.code === 'KeyS') moveB = true;
    if (e.code === 'ShiftLeft') isRunning = true;
    if (e.code === 'Digit1') window.selectSlot('NONE');
    if (e.code === 'Digit2') window.selectSlot('KNIFE');
    if (e.code === 'Digit3') window.selectSlot('GUN');

    // Pegar Item (E)
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

    // Abrir Máquina (R)
    if (e.code === 'KeyR' && maquinaBloqueada) {
        if (currentEquip === "KNIFE") desbloquearMaquina();
        else { segurandoR = true; document.getElementById('timer-lock').style.display = 'block'; }
    }

    if (e.code === 'Space' && isGrounded) { velocityY = 0.25; isGrounded = false; }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveF = false; if (e.code === 'KeyS') moveB = false;
    if (e.code === 'ShiftLeft') isRunning = false;
    if (e.code === 'KeyR') { segurandoR = false; document.getElementById('timer-lock').style.display = 'none'; }
});

// Mouse Look
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement && gameActive) {
        yaw -= e.movementX * 0.002;
        pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * 0.002));
        camera.rotation.set(pitch, yaw, 0, 'YXZ');
    }
});

// --- INICIAR JOGO ---
window.startGame = () => {
    const nameInput = document.getElementById('player-name');
    pName = nameInput.value || "Jogador";
    document.getElementById('setup-screen').style.display = 'none';
    if (isMobile) document.getElementById('mobile-ui').style.display = 'block';
    else document.body.requestPointerLock();

    gameActive = true;
    startTime = Date.now();
    
    createAirdrop("FACA", 0x0044bb, 3000); 
    createAirdrop("ARMA", 0x0044bb, 10000);
    createAirdrop("BOTAS", 0x00ff88, 20000);
    
    animate();
};
