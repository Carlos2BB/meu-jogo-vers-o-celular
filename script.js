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

// --- VARIÁVEIS DAS ESTAÇÕES (ATUALIZADO COM TERROR) ---
let estacaoAtual = "VERAO"; 
// Chance de 10% para TERROR, senão escolhe entre as outras 4
const sorteioEstacao = Math.random();
const estacoesNormais = ["VERAO", "PRIMAVERA", "OUTONO", "INVERNO"];
if (sorteioEstacao < 0.1) {
    estacaoAtual = "TERROR";
} else {
    estacaoAtual = estacoesNormais[Math.floor(Math.random() * estacoesNormais.length)];
}

const estacoes = ["VERAO", "PRIMAVERA", "OUTONO", "INVERNO", "TERROR"];
let tempoUltimaEstacao = 0;
const estacaoDuracao = 30000; 
const folhasParticulas = [];
const neveParticulas = [];
const floresNoChao = [];
const listaArvores = [];
const arvoresTerror = []; // Lista para as 10 árvores especiais

const chatInput = document.getElementById('game-chat');
let joyX = 0, joyY = 0, joyActive = false, joyId = null;
const base = document.getElementById('joy-base');
const stick = document.getElementById('stick');

// Configuração Three.js
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 10, 150);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';

// Texturas e Luzes
const grassTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(100, 100);

// Textura de Abóbora para o rosto (usando uma cor básica pois não posso carregar texturas externas novas)
const pumpkinMat = new THREE.MeshStandardMaterial({ color: 0xff8800, roughness: 0.9 });

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(40, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, new THREE.AmbientLight(0xffffff, 0.4));

const groundMat = new THREE.MeshStandardMaterial({ map: grassTexture });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- FUNÇÕES DE AMBIENTE ---

function createBush(x, z) {
    const bushGroup = new THREE.Group();
    const size = 0.4 + Math.random() * 0.5; 
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a4a15, roughness: 0.9 }); 
    
    for(let i = 0; i < 5; i++) {
        const sphere = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 1), mat);
        sphere.position.set((Math.random()-0.5)*0.6, size/1.5 + (Math.random()*0.2), (Math.random()-0.5)*0.6);
        sphere.castShadow = true;
        bushGroup.add(sphere);
    }
    bushGroup.position.set(x, 0, z);
    scene.add(bushGroup);
}

function createRock(x, z) {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x707070, roughness: 0.8 }); 
    const rockGeo = new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.8, 0); 
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.scale.y = 0.4 + Math.random() * 0.6;
    rock.position.set(x, rock.scale.y * 0.15, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    scene.add(rock);
}

for(let i = 0; i < 25; i++) { 
    createBush(Math.random() * 250 - 125, Math.random() * 250 - 125);
}
for(let i = 0; i < 15; i++) { 
    createRock(Math.random() * 250 - 125, Math.random() * 250 - 125);
}

// --- FUNÇÕES DE INTERFACE ---
window.selectPlatform = (type) => {
    isMobile = (type === 'mobile');
    document.getElementById('platform-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'flex';
    if (!isMobile) document.body.requestPointerLock();
};

window.selectSlot = (type) => {
    if (type === 'KNIFE' && !hasKnife) return;
    if (type === 'GUN' && !hasGun) return;
    if (type === 'SHOTGUN' && currentEquip !== 'SHOTGUN' && estacaoAtual !== 'TERROR') return; // Bloqueia shotgun fora do terror
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
    tempoUltimaEstacao = Date.now();
    gameActive = true;

    // Se a estação for TERROR, adiciona a Shotgun no slot 4
    if (estacaoAtual === "TERROR") {
        document.getElementById('slot-4').style.display = 'flex';
        document.getElementById('slot-4').innerText = "4: ESPINGARDA";
    }
    
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

    // Aplica os efeitos da estação inicial (incluindo o céu roxo se for TERROR)
    aplicarEfeitosEstacao();

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

// --- CRIAÇÃO DE OBJETOS (ATUALIZADO: ÁRVORES COM SUPORTE A TERROR) ---
function createTree(x, z, index) {
    const g = new THREE.Group();
    const trunkHeight = 15 + Math.random() * 15; 
    const trunkRadius = 0.8 + Math.random() * 0.7;
    const trunkColor = 0x5d3d28;

    // Tronco principal
    const tMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9 });
    const tGeo = new THREE.CylinderGeometry(trunkRadius * 0.8, trunkRadius, trunkHeight, 10);
    const t = new THREE.Mesh(tGeo, tMat);
    t.position.y = trunkHeight / 2; t.castShadow = true; g.add(t);

    // Folhagem principal
    const fColor = 0x2d5a27;
    const fMat = new THREE.MeshStandardMaterial({ color: fColor, roughness: 0.8 });
    const foliageSize = trunkHeight * 0.5;
    const fGeo = new THREE.DodecahedronGeometry(foliageSize, 1);
    const f = new THREE.Mesh(fGeo, fMat);
    f.position.y = trunkHeight + foliageSize * 0.4; f.castShadow = true; g.add(f);

    // Galhos
    const tBranchMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9 });
    const numGalhos = 3 + Math.floor(Math.random() * 3);
    for(let i = 0; i < numGalhos; i++) {
        const angle = (i / numGalhos) * Math.PI * 2 + Math.random();
        const branchHeight = trunkHeight * 0.4 + Math.random() * trunkHeight * 0.4;
        const branchLength = trunkRadius * 3 + Math.random() * trunkRadius * 2;
        const branchRadius = trunkRadius * 0.3;

        const branchGroup = new THREE.Group();
        const bGeo = new THREE.CylinderGeometry(branchRadius*0.7, branchRadius, branchLength, 8);
        const b = new THREE.Mesh(bGeo, tBranchMat);
        b.rotation.z = Math.PI / 2; 
        b.position.x = branchLength / 2;
        b.castShadow = true;
        branchGroup.add(b);

        const fbSize = branchLength * 0.4;
        const fbMat = new THREE.MeshStandardMaterial({ color: fColor, roughness: 0.8 });
        const fbGeo = new THREE.DodecahedronGeometry(fbSize, 0);
        const fb = new THREE.Mesh(fbGeo, fbMat);
        fb.position.x = branchLength;
        fb.castShadow = true;
        branchGroup.add(fb);

        branchGroup.position.set(Math.cos(angle)*trunkRadius*0.8, branchHeight, Math.sin(angle)*trunkRadius*0.8);
        branchGroup.rotation.y = angle;
        branchGroup.rotation.z = Math.PI / 4 + (Math.random()-0.5)*0.2; 

        g.add(branchGroup);
    }
    
    // --- ADICIONANDO ELEMENTOS DE TERROR (ESCONDIDOS POR PADRÃO) ---
    const terrorGroup = new THREE.Group();
    terrorGroup.visible = false; // Só aparece na estação TERROR

    // Rosto de Abóbora no tronco
    const faceGeo = new THREE.SphereGeometry(trunkRadius * 1.2, 16, 12);
    const face = new THREE.Mesh(faceGeo, pumpkinMat);
    face.position.y = trunkHeight * 0.6;
    face.position.z = trunkRadius; // À frente do tronco
    terrorGroup.add(face);

    // Pernas (Cilindros simples)
    const legGeo = new THREE.CylinderGeometry(branchRadius, branchRadius, trunkHeight * 0.4, 8);
    const legL = new THREE.Mesh(legGeo, tMat);
    legL.position.set(-trunkRadius * 0.5, trunkHeight * 0.2, 0);
    const legR = new THREE.Mesh(legGeo, tMat);
    legR.position.set(trunkRadius * 0.5, trunkHeight * 0.2, 0);
    terrorGroup.add(legL, legR);

    // Braços (Cilindros saindo do rosto/tronco)
    const armGeo = new THREE.CylinderGeometry(branchRadius, branchRadius, trunkHeight * 0.5, 8);
    const armL = new THREE.Mesh(armGeo, tMat);
    armL.rotation.z = Math.PI / 2;
    armL.position.set(-branchLength * 0.8, trunkHeight * 0.6, branchRadius);
    const armR = new THREE.Mesh(armGeo, tMat);
    armR.rotation.z = -Math.PI / 2;
    armR.position.set(branchLength * 0.8, trunkHeight * 0.6, branchRadius);
    terrorGroup.add(armL, armR);

    g.add(terrorGroup);
    
    g.position.set(x, 0, z);
    scene.add(g);
    
    const treeData = { group: g, leaf: f, trunk: t, terror: terrorGroup, isTerrorInstance: false, speed: nbSpeed * 0.5 };
    listaArvores.push(treeData);

    // Seleciona as primeiras 10 árvores para serem mutantes
    if (index < 10) {
        treeData.isTerrorInstance = true;
        arvoresTerror.push(treeData);
    }
}

for (let i = 0; i < 50; i++) {
    const folha = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xd2691e, side: THREE.DoubleSide }));
    folha.visible = false;
    scene.add(folha);
    folhasParticulas.push(folha);
}

for (let i = 0; i < 150; i++) {
    const floco = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    floco.visible = false;
    scene.add(floco);
    neveParticulas.push(floco);
}

const coresFlores = [0xff69b4, 0xff0000, 0xffff00, 0xffffff];
for (let i = 0; i < 100; i++) {
    const flor = new THREE.Mesh(new THREE.CircleGeometry(0.15, 5), new THREE.MeshBasicMaterial({ color: coresFlores[Math.floor(Math.random()*coresFlores.length)] }));
    flor.rotation.x = -Math.PI / 2;
    flor.visible = false;
    scene.add(flor);
    floresNoChao.push(flor);
}

// Criação das árvores passando o índice
for (let i = 0; i < 120; i++) {
    let rx = Math.random() * 400 - 200, rz = Math.random() * 400 - 200;
    if (Math.abs(rx) > 10 || (rz > -5 || rz < -15)) createTree(rx, rz, i);
}

const coins = [];
for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 }));
    c.position.set(Math.random() * 80 - 40, 0.3, Math.random() * 80 - 40);
    c.rotation.x = Math.PI / 2; c.castShadow = true;
    scene.add(c); coins.push(c);
}

function atualizarEstacoes() {
    const agora = Date.now();
    if (agora - tempoUltimaEstacao > estacaoDuracao) {
        const index = estacoes.indexOf(estacaoAtual);
        estacaoAtual = estacoes[(index + 1) % estacoes.length];
        tempoUltimaEstacao = agora;
        aplicarEfeitosEstacao();
    }
}

function aplicarEfeitosEstacao() {
    // Resetar visibilidade e estados específicos
    folhasParticulas.forEach(f => f.visible = (estacaoAtual === "OUTONO"));
    neveParticulas.forEach(n => n.visible = (estacaoAtual === "INVERNO"));
    floresNoChao.forEach(fl => {
        fl.visible = (estacaoAtual === "PRIMAVERA");
        if (fl.visible) fl.position.set(Math.random() * 100 - 50, 0.01, Math.random() * 100 - 50);
    });

    // Resetar árvores de terror
    arvoresTerror.forEach(a => a.terror.visible = false);

    // Inventário Shotgun (Slot 4)
    if (estacaoAtual === "TERROR") {
        document.getElementById('slot-4').style.display = 'flex';
    } else {
        document.getElementById('slot-4').style.display = 'none';
        if (currentEquip === 'SHOTGUN') selectSlot('NONE'); // Desequipa se mudar de estação
    }

    if (estacaoAtual === "VERAO") {
        groundMat.color.set(0xffffff);
        listaArvores.forEach(a => {
            a.leaf.material.color.set(0x2d5a27);
            a.group.visible = true;
        });
        scene.background.set(0x87CEEB); // Céu Normal
    } else if (estacaoAtual === "PRIMAVERA") {
        groundMat.color.set(0x99ff99);
        listaArvores.forEach(a => {
            a.leaf.material.color.set(0x2d5a27);
            a.group.visible = true;
        });
        scene.background.set(0x87CEEB);
    } else if (estacaoAtual === "OUTONO") {
        groundMat.color.set(0xd2b48c);
        listaArvores.forEach(a => {
            a.leaf.material.color.set(Math.random() > 0.5 ? 0xffa500 : 0xffff00);
            a.group.visible = true;
        });
        folhasParticulas.forEach(f => { f.position.set(Math.random() * 100 - 50, 10 + Math.random() * 20, Math.random() * 100 - 50); });
        scene.background.set(0x87CEEB);
    } else if (estacaoAtual === "INVERNO") {
        groundMat.color.set(0xffffff);
        listaArvores.forEach(a => {
            a.leaf.material.color.set(0xeeeeee);
            a.group.visible = true;
        });
        neveParticulas.forEach(n => { n.position.set(Math.random() * 60 - 30 + camera.position.x, 20 + Math.random() * 10, Math.random() * 60 - 30 + camera.position.z); });
        scene.background.set(0x87CEEB);
    } else if (estacaoAtual === "TERROR") {
        groundMat.color.set(0x330033); // Chão escuro/roxo
        scene.background.set(0x440044); // Céu Roxo
        listaArvores.forEach(a => {
            a.leaf.material.color.set(0x111111); // Folhas pretas/escuras
            a.leaf.visible = true; // Garante que a folhagem principal esteja visível (sem flores)
            // Esconde galhos normais e suas folhagens para dar aspecto mais seco
            a.group.children.forEach(child => {
                if (child instanceof THREE.Group && child !== a.terror) {
                    child.visible = false;
                }
            });
        });
        // Ativa as 10 árvores mutantes
        arvoresTerror.forEach(a => {
            a.terror.visible = true;
        });
    }
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

// Armas e Mãos (ATUALIZADO COM SHOTGUN DE DUAS MÃOS)
const handGroup = new THREE.Group();
const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.6), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
handMesh.castShadow = true; handGroup.add(handMesh);

// Mão Esquerda (para shotgun)
const handLeftGroup = new THREE.Group();
const handLeftMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.6), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
handLeftMesh.castShadow = true; handLeftGroup.add(handLeftMesh);
handLeftGroup.position.set(-1.0, -0.5, -0.8); // Posição para segurar com as duas mãos
camera.add(handLeftGroup);

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

// Espingarda (Shotgun) - Maior e segurada no centro
const shotgunGroup = new THREE.Group();
const sgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 }));
sgBarrel.rotation.x = Math.PI / 2; sgBarrel.position.z = -0.6;
const sgBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.8), new THREE.MeshStandardMaterial({ color: 0x4d2d18 })); // Coronha de madeira
sgBody.position.z = 0;
const sgMuzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 }));
sgMuzzleFlash.position.z = -1.2;
shotgunGroup.add(sgBarrel, sgBody, sgMuzzleFlash);
shotgunGroup.position.set(-0.5, -0.4, -0.5); // Centralizada entre as mãos
camera.add(shotgunGroup); // Adiciona direto à câmera para controle de duas mãos

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

// --- SISTEMA DE INPUTS ---
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

// --- LÓGICA DE COMBATE E CHAT (ATUALIZADO PARA SHOTGUN) ---
function shoot() {
    if (gameState !== "WALK" || (!document.pointerLockElement && !isMobile)) return;

    if (currentEquip === "GUN" && ammo > 0) {
        ammo--; document.getElementById('ammo-val').innerText = ammo;
        muzzleFlash.material.opacity = 1; shotLight.intensity = 5; handGroup.position.z += 0.25;
        setTimeout(() => { muzzleFlash.material.opacity = 0; shotLight.intensity = 0 }, 60);
        const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(0, 0), camera);
        const inters = r.intersectObjects(monsters);
        if (inters.length > 0) inters[0].object.stunnedUntil = Date.now() + 5000;
    } else if (currentEquip === "SHOTGUN") {
        // Lógica de tiro da espingarda (sem munição consumível pedida, apenas efeito e dano)
        sgMuzzleFlash.material.opacity = 1;
        shotgunGroup.position.z += 0.4; // Recuo maior
        handLeftGroup.position.z += 0.4;
        handGroup.position.z += 0.4;

        setTimeout(() => { sgMuzzleFlash.material.opacity = 0; }, 80);

        // Raio para atingir monstros
        const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(0, 0), camera);
        const inters = r.intersectObjects(monsters);
        if (inters.length > 0) {
            // Atordoa por mais tempo
            inters[0].object.stunnedUntil = Date.now() + 8000;
        }
    }
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
            if (e.code === 'Digit1') selectSlot('NONE'); if (e.code === 'Digit2') selectSlot('KNIFE'); if (e.code === 'Digit3') selectSlot('GUN'); if (e.code === 'Digit4') selectSlot('SHOTGUN');
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
    knifeGroup.visible = (currentEquip === "KNIFE"); 
    gunGroup.visible = (currentEquip === "GUN");
    shotgunGroup.visible = (currentEquip === "SHOTGUN");
    handLeftGroup.visible = (currentEquip === "SHOTGUN"); // Mão esquerda só aparece com shotgun

    document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('active'));
    if (currentEquip === "NONE") document.getElementById('slot-1').classList.add('active');
    if (currentEquip === "KNIFE") document.getElementById('slot-2').classList.add('active');
    if (currentEquip === "GUN") document.getElementById('slot-3').classList.add('active');
    if (currentEquip === "SHOTGUN") document.getElementById('slot-4').classList.add('active');
    if (hasBoots) { document.getElementById('slot-boots').style.borderColor = "#00ff88"; document.getElementById('slot-boots').style.color = "#00ff88"; }
}

function desbloquearMaquina() { maquinaBloqueada = false; sistemaBloqueio.visible = false; segurandoR = false; document.getElementById('timer-lock').style.display = 'none'; }

function exitMachine() { 
    gameState = "WALK"; 
    document.getElementById('game-info').style.display = 'none'; 
    camera.position.set(0, 1.7, -6);
    if (!isMobile) document.body.requestPointerLock();
}

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
        atualizarEstacoes();
        let curT = Date.now() - startTime;
        document.getElementById('timer-val').innerText = (curT / 1000).toFixed(1);

        // --- SISTEMA DE BIOMAS ---
        // Se estiver longe (X ou Z > 100), vira bioma de DESERTO
        if(Math.abs(camera.position.x) > 100 || Math.abs(camera.position.z) > 100) {
            groundMat.color.lerp(new THREE.Color(0xedc9af), 0.01); // Areia
            if (estacaoAtual !== "TERROR") scene.background.lerp(new THREE.Color(0xffd700), 0.01); // Céu mais amarelado
        } else {
            // Volta para Grama se estiver perto do centro
            if (estacaoAtual !== "TERROR") {
                groundMat.color.lerp(new THREE.Color(0xffffff), 0.01); 
                scene.background.lerp(new THREE.Color(0x87CEEB), 0.01);
            }
        }

        if (estacaoAtual === "OUTONO") {
            folhasParticulas.forEach(f => {
                f.position.y -= 0.05;
                f.rotation.z += 0.02;
                if (f.position.y < 0) f.position.y = 20;
            });
        }

        if (estacaoAtual === "INVERNO") {
            neveParticulas.forEach(n => {
                n.position.y -= 0.1;
                n.position.x += Math.sin(Date.now() * 0.001 + n.position.z) * 0.02;
                if (n.position.y < 0) {
                    n.position.y = 20;
                    n.position.x = camera.position.x + (Math.random() * 60 - 30);
                    n.position.z = camera.position.z + (Math.random() * 60 - 30);
                }
            });
        }

        // --- LÓGICA ARVORES TERROR ---
        if (estacaoAtual === "TERROR" && !botsPaused) {
            arvoresTerror.forEach(a => {
                // Olha para o jogador
                a.group.lookAt(camera.position.x, a.group.position.y, camera.position.z);
                // Move em direção ao jogador
                const d = new THREE.Vector3().subVectors(camera.position, a.group.position).normalize();
                a.group.position.x += d.x * a.speed;
                a.group.position.z += d.z * a.speed;

                // Colisão (reseta posição se muito perto)
                if (a.group.position.distanceTo(camera.position) < 3.0) {
                    camera.position.set(0, 1.7, -6);
                }
            });
        }

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
        
        // Lerp Suave para recuo das armas
        muzzleFlash.material.opacity = THREE.MathUtils.lerp(muzzleFlash.material.opacity, 0, 0.1);
        sgMuzzleFlash.material.opacity = THREE.MathUtils.lerp(sgMuzzleFlash.material.opacity, 0, 0.1);
        
        if (currentEquip === "SHOTGUN") {
            shotgunGroup.position.z = THREE.MathUtils.lerp(shotgunGroup.position.z, -0.5, 0.2);
            handLeftGroup.position.z = THREE.MathUtils.lerp(handLeftGroup.position.z, -0.8, 0.2);
            handGroup.position.z = THREE.MathUtils.lerp(handGroup.position.z, -0.8, 0.2);
        } else {
            handGroup.position.z = THREE.MathUtils.lerp(handGroup.position.z, -0.8, 0.2);
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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.domElement.addEventListener('click', () => {
    if (gameActive && gameState === "WALK" && !isMobile) {
        document.body.requestPointerLock();
    }
});
