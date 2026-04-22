import * as THREE from 'three';

// --- VARIÁVEIS DE ESTADO ---
let isMobile = false, pName = "", coinsCount = 0, prizesLeft = 10, gameState = "SETUP";
let gameActive = false, startTime = 0, velocityY = 0, isGrounded = true;
let moveF = false, moveB = false, moveL = false, moveR = false, isRunning = false;
let yaw = 0, pitch = 0, stamina = 100, ammo = 5, nbSpeed = 0.1;
let currentEquip = "NONE", nextEquip = "NONE", equipAnimPhase = "IDLE", botsPaused = false;
let podeVoar = false, isFlying = false, lastSpacePress = 0;
let hasKnife = false, hasGun = false, hasBoots = false;
let maquinaBloqueada = true, tempoCadeado = 30.0, segurandoR = false;

// --- CENA E RENDER ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1a0a);
scene.fog = new THREE.Fog(0x0a1a0a, 10, 145);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';

// --- ILUMINAÇÃO E CHÃO ---
const sun = new THREE.DirectionalLight(0xffffee, 0.9);
sun.position.set(40, 60, 20);
sun.castShadow = true;
scene.add(sun, new THREE.AmbientLight(0x224422, 0.5));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0x113311 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- ARMAS E MÃOS (CONSERTADO) ---
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
blade.position.z = -0.25;
knifeGroup.add(handle, blade);
knifeGroup.visible = false;
handGroup.add(knifeGroup);

// Arma
const gunGroup = new THREE.Group();
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
gunGroup.add(gunBody);
gunGroup.visible = false;
handGroup.add(gunGroup);

// --- MÁQUINA E BLOQUEIO ---
const machinePos = new THREE.Vector3(0, 0, -10);
const sistemaBloqueio = new THREE.Group();
const panoBloqueio = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 5, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
panoBloqueio.position.set(0, 2.5, -10);
sistemaBloqueio.add(panoBloqueio);
scene.add(sistemaBloqueio);

// --- FUNÇÕES DE SUPORTE ---
window.selectSlot = (t) => {
    if (t === 'KNIFE' && !hasKnife) return;
    if (t === 'GUN' && !hasGun) return;
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
// --- SISTEMA DE AIRDROPS ---
const airdrops = [];
function createAirdrop(item, color, time) {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshStandardMaterial({ color: color }));
    box.castShadow = true; group.add(box);
    const chute = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff3333, side: THREE.DoubleSide }));
    chute.position.y = 8; chute.rotation.x = Math.PI; group.add(chute);
    group.position.set(Math.random() * 100 - 50, 100, Math.random() * 100 - 50);
    group.userData = { item: item, opened: false, velocity: -0.05, active: false, spawnAt: time };
    group.visible = false; scene.add(group); airdrops.push(group);
}

// --- LOOP DE ANIMAÇÃO PRINCIPAL ---
function animate() {
    requestAnimationFrame(animate);
    if (!gameActive) return;

    let curT = Date.now() - startTime;
    document.getElementById('timer-val').innerText = (curT / 1000).toFixed(1);

    // 1. LÓGICA DO CADEADO (TECLA R)
    if (maquinaBloqueada && segurandoR) {
        tempoCadeado -= 0.016; // Aproximadamente 60fps
        document.getElementById('lock-sec').innerText = Math.max(0, Math.ceil(tempoCadeado));
        if (tempoCadeado <= 0) {
            desbloquearMaquina();
        }
    }

    // 2. TRANSIÇÃO DE ARMAS (PARA A MÃO)
    if (equipAnimPhase === "DOWN") {
        handGroup.position.lerp(handPosHip, 0.15);
        if (handGroup.position.distanceTo(handPosHip) < 0.1) {
            currentEquip = nextEquip;
            updateEquipVisuals();
            equipAnimPhase = "UP";
        }
    } else if (equipAnimPhase === "UP") {
        handGroup.position.lerp(handPosIdle, 0.15);
        if (handGroup.position.distanceTo(handPosIdle) < 0.1) {
            handGroup.position.copy(handPosIdle);
            equipAnimPhase = "IDLE";
        }
    }

    // 3. AIRDROPS (CAINDO)
    airdrops.forEach(a => {
        if (!a.userData.active && curT >= a.userData.spawnAt) { a.userData.active = true; a.visible = true; }
        if (a.userData.active && a.position.y > 0.9) a.position.y += a.userData.velocity;
    });

    if (gameState === "WALK") {
        // Gravidade
        if (!isFlying) {
            velocityY -= 0.01; camera.position.y += velocityY;
            if (camera.position.y <= 1.7) { camera.position.y = 1.7; velocityY = 0; isGrounded = true; }
        }

        // 4. LÓGICA DAS BOTAS (PARKOUR)
        if (hasBoots) {
            // Se tiver botas, checamos se estamos em cima das plataformas (Parte 1)
            // Aqui você usaria a lógica de colisão das plataformas que definimos antes
        }

        // Movimentação Simples
        const baseS = isRunning ? 0.35 : 0.2;
        const camDir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
        camDir.y = 0; camDir.normalize();
        if(moveF) camera.position.addScaledVector(camDir, baseS);
        if(moveB) camera.position.addScaledVector(camDir, -baseS);
    }
    renderer.render(scene, camera);
}

// --- EVENTOS DE TECLADO ---
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveF = true;
    if (e.code === 'KeyS') moveB = true;
    if (e.code === 'ShiftLeft') isRunning = true;
    
    // ATALHOS PARA ARMAS
    if (e.code === 'Digit1') window.selectSlot('NONE');
    if (e.code === 'Digit2') window.selectSlot('KNIFE');
    if (e.code === 'Digit3') window.selectSlot('GUN');

    // COLETAR ITENS (TECLA E)
    if (e.code === 'KeyE') {
        airdrops.forEach(a => {
            const dist = camera.position.distanceTo(a.position);
            if (a.userData.active && !a.userData.opened && dist < 5) {
                a.userData.opened = true;
                a.visible = false;
                if (a.userData.item === "FACA") { 
                    hasKnife = true; 
                    document.getElementById('slot-2').style.borderColor = "#ffd700"; 
                }
                if (a.userData.item === "ARMA") { 
                    hasGun = true; 
                    document.getElementById('slot-3').style.borderColor = "#ffd700"; 
                }
                if (a.userData.item === "BOTAS") hasBoots = true;
                console.log("Pegou: " + a.userData.item);
            }
        });
    }

    // BLOQUEIO (TECLA R)
    if (e.code === 'KeyR' && maquinaBloqueada) {
        if (currentEquip === "KNIFE") {
            desbloquearMaquina(); // Faca abre na hora
        } else {
            segurandoR = true;
            document.getElementById('timer-lock').style.display = 'block';
        }
    }

    if (e.code === 'Space' && isGrounded) { velocityY = 0.25; isGrounded = false; }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveF = false;
    if (e.code === 'KeyS') moveB = false;
    if (e.code === 'ShiftLeft') isRunning = false;
    if (e.code === 'KeyR') { 
        segurandoR = false; 
        if (maquinaBloqueada) document.getElementById('timer-lock').style.display = 'none'; 
    }
});

// --- INICIAR ---
window.startGame = () => {
    gameActive = true;
    startTime = Date.now();
    document.getElementById('setup-screen').style.display = 'none';
    
    // Spawn dos itens para teste (em milissegundos)
    createAirdrop("FACA", 0x0044bb, 2000); 
    createAirdrop("ARMA", 0x0044bb, 5000);
    createAirdrop("BOTAS", 0x00ff88, 8000);
    
    animate();
};
