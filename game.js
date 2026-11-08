import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game-canvas');
const isTouchDevice = matchMedia('(pointer: coarse)').matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x71828a);
scene.fog = new THREE.FogExp2(0x71828a, 0.0085);
const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 240);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;

const mat = (color, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const mats = {
  road: mat(0x343b3c), pavement: mat(0x737a78), line: mat(0xb9a878),
  player: mat(0x236e78, 0.55, 0.38), armor: mat(0x36464e, 0.55, 0.55),
  visor: new THREE.MeshStandardMaterial({ color: 0x7affed, emissive: 0x27e4ca, emissiveIntensity: 1.7, metalness: 0.6, roughness: 0.22 }),
  white: mat(0xe4e4d7, 0.28), ceramic: mat(0xf1eee2, 0.2),
  skin: mat(0xb8aa98), red: new THREE.MeshStandardMaterial({ color: 0xff443d, emissive: 0x8e0805, emissiveIntensity: 1.4 }),
  dark: mat(0x151c20), trim: mat(0x647171),
  bullet: new THREE.MeshBasicMaterial({ color: 0x8bfff0 }),
  hostileBullet: new THREE.MeshBasicMaterial({ color: 0xff683f })
};
const hemi = new THREE.HemisphereLight(0xc8e4ed, 0x303233, 2.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffdfb1, 3.2); sun.position.set(-32, 54, 30); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -48; sun.shadow.camera.right = 48; sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48; sun.shadow.bias = -0.0004; scene.add(sun);
const fill = new THREE.DirectionalLight(0x8dc9ff, 1.0); fill.position.set(25, 16, -24); scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat(0x606b69)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.12; ground.receiveShadow = true; scene.add(ground);

const game = { started: false, paused: true, over: false, wave: 1, waveRemaining: 0, spawnTimer: 0, intermission: false, health: 100, armor: 50, cash: 150, kills: 0, weapon: 0, damageLevel: 0, rateLevel: 0, armorLevel: 0, supportLevel: 0, droneUntil: 0, droneCooldown: 0, shotClock: 0, time: 0, enemies: [], effects: [], keys: {}, joystick: { x: 0, z: 0 }, firing: false, lastDamage: 0, bossSpawned: false };
const weapons = [
  { name: 'M7 SERVICE RIFLE', title: 'Ranger Carbine', damage: 30, cadence: 0.48, range: 27, price: 0, desc: 'Reliable burst rifle. Your starting weapon.' },
  { name: 'VX-12 SHOCK RIFLE', title: 'Shock Rifle', damage: 47, cadence: 0.62, range: 31, price: 260, desc: 'Heavy ion rounds punch through porcelain armor.' },
  { name: 'BREACHER 8', title: 'Breacher Shotgun', damage: 72, cadence: 0.94, range: 19, price: 390, desc: 'Close-range scatter blast. Ends a rush fast.' }
];
let player, playerAim, droneMesh, nextWaveTimer = 0, toastTimer = 0;
const world = new THREE.Group(); scene.add(world);
const shared = {};
const rand = (seed) => { let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
function addMesh(parent, geometry, material, pos, scale, cast = true) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...pos); mesh.scale.set(...scale); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function makeCity() {
  const buildings = [], windows = [], roofDetails = [];
  const buildingMats = [0x42494a, 0x505150, 0x3c474a, 0x555753, 0x41494b].map(c => mat(c, .94));
  const windowMat = new THREE.MeshStandardMaterial({ color: 0xffc777, emissive: 0xe9a34b, emissiveIntensity: 1.05, roughness: .4 });
  for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
    const cx = gx * 34, cz = gz * 34;
    if (Math.abs(cx) < 14 && Math.abs(cz) < 14) continue;
    const width = 17 + rand(gx * 19 + gz * 31 + 220) * 8;
    const depth = 16 + rand(gx * 23 + gz * 9 + 173) * 8;
    const height = 14 + rand(gx * 41 + gz * 17 + 97) * 35;
    const x = cx + (rand(gx * 59 + gz * 37 + 8) - .5) * 4;
    const z = cz + (rand(gx * 7 + gz * 73 + 3) - .5) * 4;
    const mesh = new THREE.Mesh(boxGeo, buildingMats[Math.floor(rand(gx * 83 + gz * 41 + 32) * buildingMats.length)]);
    mesh.position.set(x, height / 2 - .1, z); mesh.scale.set(width, height, depth); mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh); buildings.push(mesh);
    // One instance per lit window, facing the street-facing sides of each tower.
    const cols = Math.max(2, Math.floor(width / 3.2)), rows = Math.floor(height / 4.3);
    for (let side = 0; side < 4; side++) for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      if (rand(gx * 3000 + gz * 211 + side * 601 + row * 37 + col * 7) < .24) continue;
      let wx, wz, ry;
      const spacing = side % 2 === 0 ? width : depth;
      const span = side % 2 === 0 ? depth : width;
      const u = (col - (cols - 1) / 2) * spacing / cols;
      const v = (rand(gx * 53 + gz * 89 + col * 13 + side * 3) - .5) * span * .7;
      if (side === 0) { wx = x + u; wz = z - depth / 2 - .03; ry = 0; }
      if (side === 1) { wx = x + width / 2 + .03; wz = z + u; ry = Math.PI / 2; }
      if (side === 2) { wx = x + u; wz = z + depth / 2 + .03; ry = Math.PI; }
      if (side === 3) { wx = x - width / 2 - .03; wz = z + u; ry = -Math.PI / 2; }
      windows.push({ x: wx, y: 1.7 + row * 4.2, z: wz, ry, w: .95, h: 1.55 });
    }
    if (height > 30) roofDetails.push([x, height, z, width, depth]);
  }
  // Blocks, traffic lanes and painted road dashes make a navigable city grid.
  for (let i = -4; i <= 4; i++) {
    const p = i * 34;
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(8, 260), mats.road); roadX.rotation.x = -Math.PI / 2; roadX.position.set(p, -.055, 0); world.add(roadX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(260, 8), mats.road); roadZ.rotation.x = -Math.PI / 2; roadZ.position.set(0, -.052, p); world.add(roadZ);
    for (let d = -120; d <= 120; d += 11) {
      const dashX = new THREE.Mesh(new THREE.PlaneGeometry(.12, 3.1), mats.line); dashX.rotation.x = -Math.PI / 2; dashX.position.set(p, -.02, d); world.add(dashX);
      const dashZ = new THREE.Mesh(new THREE.PlaneGeometry(3.1, .12), mats.line); dashZ.rotation.x = -Math.PI / 2; dashZ.position.set(d, -.018, p); world.add(dashZ);
    }
  }
  const winGeo = new THREE.BoxGeometry(1, 1, 1), winInstances = new THREE.InstancedMesh(winGeo, windowMat, windows.length), dummy = new THREE.Object3D();
  windows.forEach((v, i) => { dummy.position.set(v.x, v.y, v.z); dummy.rotation.set(0, v.ry, 0); dummy.scale.set(v.w, v.h, .09); dummy.updateMatrix(); winInstances.setMatrixAt(i, dummy.matrix); });
  winInstances.instanceMatrix.needsUpdate = true; world.add(winInstances);
  roofDetails.forEach(([x, h, z, w, d], i) => {
    addMesh(world, boxGeo, mats.trim, [x + w * .17, h + .55, z - d * .12], [w * .22, 1.1, d * .18], false);
    if (i % 3 === 0) { const beacon = new THREE.PointLight(0xff5d47, 5, 15, 2); beacon.position.set(x, h + 2.2, z); world.add(beacon); }
  });
  // Streetlight silhouettes around the starting intersection.
  for (let x = -26; x <= 26; x += 17) for (const z of [-8.5, 8.5]) {
    addMesh(world, cylGeo, mats.dark, [x, 3.8, z], [.12, 7.6, .12], false);
    addMesh(world, boxGeo, mats.trim, [x, 7.6, z - 1.05], [1.9, .12, .16], false);
    const light = new THREE.PointLight(0xffd49a, 12, 13, 2); light.position.set(x, 7.15, z - 1.8); world.add(light);
  }
}
makeCity();

function makePlayer() {
  player = new THREE.Group(); scene.add(player); player.position.set(0, 0, 0);
  addMesh(player, boxGeo, mats.player, [0, 1.08, 0], [.72, 1.18, .52]);
  addMesh(player, boxGeo, mats.armor, [0, 1.68, -.03], [.83, .27, .61]);
  addMesh(player, sphereGeo, mats.armor, [0, 1.91, .02], [.34, .35, .32]);
  addMesh(player, boxGeo, mats.visor, [0, 1.97, .3], [.42, .105, .055], false);
  addMesh(player, boxGeo, mats.dark, [-.23, .42, .02], [.23, .78, .3]); addMesh(player, boxGeo, mats.dark, [.23, .42, .02], [.23, .78, .3]);
  addMesh(player, boxGeo, mats.armor, [.44, 1.22, .08], [.25, .48, .25]);
  playerAim = new THREE.Group(); playerAim.position.set(.03, 1.42, .47); player.add(playerAim);
  addMesh(playerAim, boxGeo, mats.dark, [0, 0, .38], [.14, .14, .85]);
  addMesh(playerAim, boxGeo, mats.armor, [0, -.1, .05], [.29, .21, .3]);
  addMesh(playerAim, boxGeo, mats.visor, [0, -.14, .43], [.04, .035, .26], false);
  // Alliance defense point: cover barricades and a cyan extraction beacon.
  for (const [x, z] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
    const crate = addMesh(world, boxGeo, mats.armor, [x, .7, z], [1.4, 1.4, 1.4]);
    const stripe = addMesh(crate, boxGeo, mats.line, [0, .2, .51], [1.01, .13, .025], false);
  }
  const beacon = new THREE.Group(); beacon.position.set(0, 0, -6.5); world.add(beacon);
  addMesh(beacon, cylGeo, mats.armor, [0, .15, 0], [.8, .3, .8]);
  addMesh(beacon, cylGeo, mats.visor, [0, 1.5, 0], [.055, 2.7, .055], false);
  const beam = new THREE.PointLight(0x61ffe7, 18, 12, 2); beam.position.set(0, 1.5, 0); beacon.add(beam);
  droneMesh = new THREE.Group(); scene.add(droneMesh); droneMesh.visible = false;
  addMesh(droneMesh, sphereGeo, mats.armor, [0, 0, 0], [.48, .2, .48]);
  addMesh(droneMesh, boxGeo, mats.visor, [0, -.02, .44], [.23, .09, .12], false);
  for (const x of [-.65, .65]) { addMesh(droneMesh, boxGeo, mats.trim, [x, 0, 0], [.52, .06, .08]); const glow = addMesh(droneMesh, sphereGeo, mats.visor, [x * 1.35, -.03, 0], [.16, .035, .16], false); }
}
makePlayer();

const enemyParts = [];
function makeToilet(isBoss = false) {
  const root = new THREE.Group();
  const scale = isBoss ? 1.55 : 1;
  root.userData = { hp: isBoss ? 230 + game.wave * 22 : 70 + game.wave * 9, maxHp: 0, speed: isBoss ? 1.05 : 1.42 + Math.min(game.wave * .035, .58), attack: 0, value: isBoss ? 100 : 22, boss: isBoss, hitFlash: 0 };
  root.userData.maxHp = root.userData.hp;
  // unmistakable ceramic tank and exposed grinning head.
  const base = addMesh(root, cylGeo, mats.white, [0, .44 * scale, 0], [.67 * scale, .88 * scale, .67 * scale]);
  const bowl = addMesh(root, cylGeo, mats.ceramic, [0, .91 * scale, .02], [.84 * scale, .23 * scale, .84 * scale]);
  const seat = addMesh(root, cylGeo, mats.dark, [0, 1.025 * scale, .02], [.78 * scale, .05 * scale, .78 * scale]);
  const head = new THREE.Group(); root.add(head); head.position.set(0, 1.52 * scale, .02);
  addMesh(head, sphereGeo, mats.skin, [0, .02 * scale, .04 * scale], [.47 * scale, .51 * scale, .42 * scale]);
  addMesh(head, sphereGeo, mats.white, [-.17 * scale, .13 * scale, .4 * scale], [.105 * scale, .12 * scale, .055 * scale]);
  addMesh(head, sphereGeo, mats.white, [.17 * scale, .13 * scale, .4 * scale], [.105 * scale, .12 * scale, .055 * scale]);
  addMesh(head, sphereGeo, mats.red, [-.17 * scale, .13 * scale, .45 * scale], [.047 * scale, .058 * scale, .026 * scale]);
  addMesh(head, sphereGeo, mats.red, [.17 * scale, .13 * scale, .45 * scale], [.047 * scale, .058 * scale, .026 * scale]);
  addMesh(head, boxGeo, mats.dark, [0, -.15 * scale, .428 * scale], [.3 * scale, .065 * scale, .035 * scale]);
  for (let i = 0; i < 4; i++) addMesh(head, boxGeo, mats.white, [(-.105 + i * .07) * scale, -.16 * scale, .45 * scale], [.035 * scale, .06 * scale, .018 * scale]);
  // Lateral stubby porcelain legs animate from a shared parent group.
  const legs = new THREE.Group(); root.add(legs); legs.position.y = .34 * scale;
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .42 * scale, 0, -.02); legs.add(leg);
    addMesh(leg, cylGeo, mats.white, [side * .17 * scale, -.1 * scale, 0], [.19 * scale, .4 * scale, .19 * scale]);
    addMesh(leg, sphereGeo, mats.dark, [side * .19 * scale, -.3 * scale, .08 * scale], [.23 * scale, .1 * scale, .31 * scale]);
    enemyParts.push({ leg, side });
  }
  if (isBoss) {
    addMesh(root, boxGeo, mats.red, [0, .82 * scale, -.58 * scale], [1.05 * scale, .16 * scale, .09]);
    addMesh(root, boxGeo, mats.red, [0, .82 * scale, .58 * scale], [1.05 * scale, .16 * scale, .09]);
  }
  root.userData.head = head; root.userData.legs = legs; root.userData.base = base;
  root.scale.setScalar(scale); return root;
}

const bullets = [];
function muzzleEffect(position, color = 0x8bfff0) {
  const flash = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8 }));
  flash.position.copy(position); flash.scale.setScalar(.18); scene.add(flash); game.effects.push({ mesh: flash, life: .12, max: .12, expand: 2.7 });
}
function spawnEnemy() {
  const boss = game.wave % 5 === 0 && !game.bossSpawned;
  if (boss) game.bossSpawned = true;
  const enemy = makeToilet(boss);
  const angle = Math.random() * Math.PI * 2, radius = 17 + Math.random() * 8;
  enemy.position.set(player.position.x + Math.cos(angle) * radius, 0, player.position.z + Math.sin(angle) * radius);
  enemy.position.x = THREE.MathUtils.clamp(enemy.position.x, -125, 125); enemy.position.z = THREE.MathUtils.clamp(enemy.position.z, -125, 125);
  enemy.userData.phase = Math.random() * Math.PI * 2;
  scene.add(enemy); game.enemies.push(enemy); game.waveRemaining--;
  if (boss) showToast('ELITE UNIT DETECTED — CERAMIC OVERLORD');
}
function startWave() {
  if (game.over) return;
  game.intermission = false; game.bossSpawned = false; game.waveRemaining = 5 + game.wave * 2 + Math.floor(game.wave / 3); game.spawnTimer = .7;
  $('wave-label').textContent = `WAVE ${String(game.wave).padStart(2, '0')}`; $('wave-state').textContent = 'HOSTILES INBOUND';
  $('threat-label').textContent = game.wave >= 5 ? 'SEVERE' : game.wave >= 3 ? 'ELEVATED' : 'LOW';
  showToast(`WAVE ${String(game.wave).padStart(2, '0')} — HOLD THE LINE`);
}

function showToast(message) {
  const node = $('toast'); node.textContent = message; node.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2200);
}
function showModal(content) { $('modal-card').innerHTML = content; $('modal-layer').classList.remove('hidden'); }
function closeModal() { $('modal-layer').classList.add('hidden'); if (game.started && !game.over) game.paused = false; }
function pauseGame() {
  if (!game.started || game.over) return;
  game.paused = true;
  showModal(`<div class="pause-content"><div class="modal-heading" style="justify-content:center;border:0;margin:0"><div><small>FIELD COMMAND</small><h2>PAUSED</h2></div></div><p>THE SECTOR IS WAITING FOR YOUR ORDERS.</p><div class="pause-actions"><button class="secondary-button primary" data-action="resume">RESUME</button><button class="secondary-button" data-action="shop">FIELD SHOP</button><button class="secondary-button" data-action="restart">REDEPLOY</button></div></div>`);
}
function openShop() {
  if (!game.started || game.over) return;
  game.paused = true; renderShop();
}
function renderShop() {
  const w = weapons[game.weapon];
  const upgrades = [
    { key: 'weapon1', symbol: '⌁', title: 'VX-12 SHOCK RIFLE', text: 'Ion rounds · 47 damage · long range', price: 260, bought: game.weapon >= 1, disabled: game.weapon >= 1 },
    { key: 'weapon2', symbol: '✳', title: 'BREACHER 8', text: 'Ceramic breaker · 72 damage · short range', price: 390, bought: game.weapon >= 2, disabled: game.weapon >= 2 || game.weapon < 1 },
    { key: 'damage', symbol: '↗', title: `CALIBRATE ROUNDS  ${game.damageLevel ? '· LV ' + game.damageLevel : ''}`, text: `+20% weapon damage${game.damageLevel >= 5 ? ' · MAXED' : ''}`, price: 125 + game.damageLevel * 90, disabled: game.damageLevel >= 5 },
    { key: 'rate', symbol: '»', title: `TRIGGER MOD  ${game.rateLevel ? '· LV ' + game.rateLevel : ''}`, text: `Fire 12% faster${game.rateLevel >= 5 ? ' · MAXED' : ''}`, price: 145 + game.rateLevel * 100, disabled: game.rateLevel >= 5 },
    { key: 'armor', symbol: '⬡', title: 'COMBAT PLATING', text: game.armorLevel >= 5 ? 'Maximum armor rating reached' : `+35 armor · current ${Math.round(game.armor)}`, price: 100 + game.armorLevel * 85, disabled: game.armorLevel >= 5 || game.armor >= 100 },
    { key: 'support', symbol: '◈', title: 'DRONE CAPACITOR', text: `+4s drone duration${game.supportLevel >= 4 ? ' · MAXED' : ''}`, price: 180 + game.supportLevel * 120, disabled: game.supportLevel >= 4 }
  ];
  const cards = upgrades.map(item => `<article class="shop-item"><div class="shop-symbol">${item.symbol}</div><div class="shop-info"><h3>${item.title}</h3><p>${item.text}</p></div><button class="buy-btn" data-buy="${item.key}" ${item.disabled || game.cash < item.price ? 'disabled' : ''}>${item.bought ? 'OWNED' : item.disabled ? 'MAX' : '¢' + item.price}</button></article>`).join('');
  showModal(`<div class="modal-heading"><div><small>ALLIANCE QUARTERMASTER · ${game.cash} CREDITS</small><h2>FIELD SHOP</h2></div><button class="close-modal" data-action="close">×</button></div><div style="font:9px 'DM Mono';color:#91a6ad;margin:-5px 0 12px;letter-spacing:.5px">EQUIPPED: ${w.name} · ${w.damage + game.damageLevel * 6} DMG · ${Math.round(game.armor)} ARMOR</div><div class="shop-grid">${cards}</div><div class="modal-foot"><span>ELIMINATIONS SALVAGE CERAMIC CORES</span><button data-action="resume">BACK TO FIGHT →</button></div>`);
}
function buy(key) {
  const costs = { weapon1: 260, weapon2: 390, damage: 125 + game.damageLevel * 90, rate: 145 + game.rateLevel * 100, armor: 100 + game.armorLevel * 85, support: 180 + game.supportLevel * 120 };
  const price = costs[key]; if (!price || game.cash < price) return;
  if ((key === 'weapon1' && game.weapon >= 1) || (key === 'weapon2' && (game.weapon >= 2 || game.weapon < 1)) || (key === 'damage' && game.damageLevel >= 5) || (key === 'rate' && game.rateLevel >= 5) || (key === 'armor' && (game.armorLevel >= 5 || game.armor >= 100)) || (key === 'support' && game.supportLevel >= 4)) return;
  game.cash -= price;
  if (key === 'weapon1') game.weapon = 1;
  if (key === 'weapon2') game.weapon = 2;
  if (key === 'damage') game.damageLevel++;
  if (key === 'rate') game.rateLevel++;
  if (key === 'armor') { game.armorLevel++; game.armor = Math.min(100, game.armor + 35); }
  if (key === 'support') game.supportLevel++;
  $('weapon-label').textContent = weapons[game.weapon].name; updateHUD(); renderShop();
}
function activateDrone() {
  if (!game.started || game.paused || game.over) return;
  if (game.time < game.droneCooldown) return showToast(`DRONE RECHARGING · ${Math.ceil(game.droneCooldown - game.time)}s`);
  game.droneUntil = game.time + 8 + game.supportLevel * 4; game.droneCooldown = game.time + 35; droneMesh.visible = true;
  showToast('SUPPORT DRONE ONLINE — AUTO-ENGAGING HOSTILES'); updateHUD();
}
function spawnProjectile(from, to, target, hostile = false, damage = 0) {
  const direction = new THREE.Vector3().subVectors(to, from).normalize();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(hostile ? .12 : .085, 8, 8), hostile ? mats.hostileBullet : mats.bullet);
  mesh.position.copy(from); scene.add(mesh);
  bullets.push({ mesh, velocity: direction.multiplyScalar(hostile ? 13 : 72), target, hostile, damage, life: hostile ? 3.2 : .8 });
}
function fireAt(target, drone = false) {
  const weapon = weapons[game.weapon];
  const origin = drone ? droneMesh.position.clone() : player.position.clone().add(new THREE.Vector3(0, 1.55, 0));
  const aim = target.position.clone().add(new THREE.Vector3(0, target.userData.boss ? 1.9 : 1.25, 0));
  const direction = new THREE.Vector3().subVectors(aim, origin).normalize();
  const muzzle = origin.clone().add(direction.clone().multiplyScalar(.8)); muzzleEffect(muzzle);
  const damage = Math.round(weapon.damage * (1 + game.damageLevel * .2) * (drone ? .53 : 1));
  if (game.weapon === 2 && !drone) {
    for (let i = 0; i < 5; i++) { const spread = direction.clone().add(new THREE.Vector3((Math.random() - .5) * .17, (Math.random() - .5) * .13, (Math.random() - .5) * .17)).normalize(); const point = origin.clone().add(spread.multiplyScalar(weapon.range)); applyShot(target, damage * .28, point); }
  } else {
    spawnProjectile(muzzle, aim, target, false, damage);
  }
  if (!drone) game.shotClock = weapon.cadence * (1 - game.rateLevel * .12);
  playerAim.rotation.y = Math.atan2(direction.x, direction.z);
}
function applyShot(target, damage, impact) {
  if (!game.enemies.includes(target)) return;
  target.userData.hp -= damage; target.userData.hitFlash = .12;
  muzzleEffect(impact, 0xffe6a1);
  if (target.userData.hp <= 0) killEnemy(target);
}
function killEnemy(enemy) {
  const index = game.enemies.indexOf(enemy); if (index < 0) return;
  game.enemies.splice(index, 1); scene.remove(enemy); game.kills++;
  game.cash += enemy.userData.value + game.wave * 2;
  const burst = new THREE.PointLight(0xff9d55, 26, 10, 2); burst.position.copy(enemy.position).add(new THREE.Vector3(0, 1.2, 0)); scene.add(burst); game.effects.push({ light: burst, life: .32, max: .32 });
  if (Math.random() < .08) game.health = Math.min(100, game.health + 7);
  updateHUD(); showToast(enemy.userData.boss ? 'ELITE DOWN · SALVAGE +100' : 'HOSTILE ELIMINATED · SALVAGE SECURED');
}

function takeDamage(amount) {
  const absorbed = Math.min(game.armor, amount * .72); game.armor -= absorbed;
  game.health -= amount - absorbed; game.lastDamage = game.time;
  $('damage-flash').style.opacity = '.9'; setTimeout(() => { $('damage-flash').style.opacity = '0'; }, 100);
  updateHUD();
  if (game.health <= 0) endGame();
}
function endGame() {
  game.over = true; game.paused = true; droneMesh.visible = false;
  for (const enemy of game.enemies) scene.remove(enemy); game.enemies.length = 0;
  $('wave-state').textContent = 'SIGNAL LOST';
  showModal(`<div class="pause-content"><div class="modal-heading" style="justify-content:center;border:0;margin:0"><div><small>ALLIANCE RESPONSE // SIGNAL LOST</small><h2 style="color:#ff6b63">SECTOR FALLEN</h2></div></div><p>YOU HELD THROUGH WAVE ${String(game.wave).padStart(2, '0')} · ${game.kills} HOSTILES ELIMINATED</p><div class="pause-actions"><button class="secondary-button primary" data-action="restart">REDEPLOY</button></div></div>`);
}
function updateHUD() {
  $('health-text').textContent = Math.max(0, Math.ceil(game.health)); $('armor-text').textContent = Math.max(0, Math.ceil(game.armor));
  $('health-fill').style.width = `${Math.max(0, game.health)}%`; $('armor-fill').style.width = `${Math.max(0, game.armor)}%`;
  $('cash-text').textContent = game.cash; $('kills-text').textContent = game.kills;
  $('drone-status').textContent = game.time < game.droneCooldown ? `${Math.ceil(game.droneCooldown - game.time)}s` : 'READY';
  $('mission-text').textContent = game.intermission ? `SECTOR SECURED · NEXT WAVE IN ${Math.ceil(nextWaveTimer)}s` : `CLEAR THE BLOCK · ${game.enemies.length + game.waveRemaining} HOSTILES REMAIN`;
}
function closestEnemy(maxRange = Infinity) {
  let chosen = null, d2 = maxRange * maxRange;
  for (const enemy of game.enemies) { const distance = enemy.position.distanceToSquared(player.position); if (distance < d2) { chosen = enemy; d2 = distance; } }
  return chosen;
}
function movePlayer(delta) {
  const input = new THREE.Vector3();
  if (game.keys.KeyW || game.keys.ArrowUp) input.z -= 1;
  if (game.keys.KeyS || game.keys.ArrowDown) input.z += 1;
  if (game.keys.KeyA || game.keys.ArrowLeft) input.x -= 1;
  if (game.keys.KeyD || game.keys.ArrowRight) input.x += 1;
  input.x += game.joystick.x; input.z += game.joystick.z;
  if (input.lengthSq() > 0) {
    input.normalize(); const speed = 5.3;
    player.position.addScaledVector(input, speed * delta);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -125, 125); player.position.z = THREE.MathUtils.clamp(player.position.z, -125, 125);
    if (!closestEnemy()) player.rotation.y = Math.atan2(input.x, input.z);
  }
}
function updateEnemies(delta) {
  for (const enemy of [...game.enemies]) {
    const data = enemy.userData; data.phase += delta * (data.boss ? 3 : 5);
    const direction = new THREE.Vector3().subVectors(player.position, enemy.position); direction.y = 0;
    const distance = direction.length(); direction.normalize();
    enemy.rotation.y = Math.atan2(direction.x, direction.z);
    data.head.rotation.z = Math.sin(data.phase * .7) * .06;
    data.legs.children.forEach((leg, index) => { leg.rotation.z = Math.sin(data.phase + index * Math.PI) * .22; });
    if (distance > 2.45) enemy.position.addScaledVector(direction, data.speed * delta);
    else {
      data.attack -= delta;
      if (data.attack <= 0) { data.attack = data.boss ? .7 : 1.05; takeDamage(data.boss ? 13 : 7 + game.wave * .55); }
    }
    if (data.hitFlash > 0) data.hitFlash -= delta;
  }
}
function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i]; bullet.life -= delta;
    const previous = bullet.mesh.position.clone(); bullet.mesh.position.addScaledVector(bullet.velocity, delta);
    if (bullet.hostile) {
      if (bullet.mesh.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 1, 0))) < .6) { takeDamage(bullet.damage); bullet.life = -1; }
    } else if (bullet.target && game.enemies.includes(bullet.target)) {
      const target = bullet.target.position.clone().add(new THREE.Vector3(0, bullet.target.userData.boss ? 1.9 : 1.25, 0));
      const segment = new THREE.Line3(previous, bullet.mesh.position); const near = segment.closestPointToPoint(target, true, new THREE.Vector3());
      if (near.distanceTo(target) < (bullet.target.userData.boss ? 1.15 : .78)) { applyShot(bullet.target, bullet.damage, bullet.mesh.position); bullet.life = -1; }
    }
    if (bullet.life <= 0) { scene.remove(bullet.mesh); bullets.splice(i, 1); }
  }
}
function updateCamera(delta) {
  const desired = new THREE.Vector3(player.position.x, 11.5, player.position.z + 13.5);
  camera.position.lerp(desired, 1 - Math.exp(-4.2 * delta));
  camera.lookAt(player.position.x, .6, player.position.z - 1.2);
}
function updateGame(delta) {
  if (game.paused || !game.started || game.over) return;
  game.time += delta;
  movePlayer(delta);
  if (!game.intermission) {
    game.spawnTimer -= delta;
    if (game.waveRemaining > 0 && game.spawnTimer <= 0) { spawnEnemy(); game.spawnTimer = Math.max(.56, 1.5 - game.wave * .045); }
    if (game.waveRemaining <= 0 && !game.enemies.length) { /* wave clear handled below */ }
    if (game.waveRemaining <= 0 && game.enemies.length === 0) {
      game.intermission = true; nextWaveTimer = 12; game.cash += 50 + game.wave * 12; showToast(`BLOCK SECURED · +${50 + game.wave * 12} BONUS · FIELD SHOP OPEN`); updateHUD(); openShop();
    }
  } else {
    nextWaveTimer -= delta;
    if (nextWaveTimer <= 0) { game.wave++; startWave(); }
  }
  const target = closestEnemy(weapons[game.weapon].range);
  game.shotClock -= delta;
  const firingAllowed = !isTouchDevice || game.firing;
  if (target && game.shotClock <= 0 && firingAllowed) fireAt(target);
  if (game.time < game.droneUntil) {
    droneMesh.visible = true; droneMesh.position.set(player.position.x + Math.cos(game.time * 2.7) * 1.25, 3.2 + Math.sin(game.time * 5) * .22, player.position.z + Math.sin(game.time * 2.7) * 1.25);
    const droneTarget = closestEnemy(22); if (droneTarget) { game.droneFire = (game.droneFire || 0) - delta; if (game.droneFire <= 0) { fireAt(droneTarget, true); game.droneFire = .72; } }
  } else droneMesh.visible = false;
  updateEnemies(delta); updateBullets(delta); updateCamera(delta); updateHUD();
  if (game.enemies.length > 0) {
    const nearest = closestEnemy(10);
    if (nearest) { const point = nearest.position.clone().add(new THREE.Vector3(0, 2.5, 0)); const proj = point.project(camera); $('crosshair').style.left = `${(proj.x * .5 + .5) * innerWidth}px`; $('crosshair').style.top = `${(-proj.y * .5 + .5) * innerHeight}px`; }
    else { $('crosshair').style.left = '50%'; $('crosshair').style.top = '51%'; }
  } else { $('crosshair').style.left = '50%'; $('crosshair').style.top = '51%'; }
}

function resize() {
  const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
  camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
}
window.addEventListener('resize', resize); resize();
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .045);
  updateGame(delta);
  if (!game.started) updateCamera(delta);
  for (let i = game.effects.length - 1; i >= 0; i--) {
    const effect = game.effects[i]; effect.life -= delta;
    if (effect.mesh) { const t = 1 - effect.life / effect.max; effect.mesh.material.opacity = Math.max(0, 1 - t); effect.mesh.scale.setScalar(.12 + t * (effect.expand || 1)); }
    if (effect.light) effect.light.intensity = Math.max(0, effect.life / effect.max * 26);
    if (effect.life <= 0) { if (effect.mesh) { scene.remove(effect.mesh); effect.mesh.material.dispose(); } if (effect.light) scene.remove(effect.light); game.effects.splice(i, 1); }
  }
  renderer.render(scene, camera);
}
updateCamera(.016); animate();

$('start-button').addEventListener('click', () => {
  game.started = true; game.paused = false; $('start-screen').classList.add('hidden');
  if (isTouchDevice) $('mobile-controls').style.display = 'flex';
  $('wave-state').textContent = 'DEPLOYMENT'; startWave(); updateHUD();
});
$('shop-button').addEventListener('click', openShop);
$('support-button').addEventListener('click', activateDrone);
$('pause-button').addEventListener('click', pauseGame);
$('modal-card').addEventListener('click', event => {
  const buyButton = event.target.closest('[data-buy]');
  if (buyButton) return buy(buyButton.dataset.buy);
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'resume' || action === 'close') closeModal();
  if (action === 'shop') renderShop();
  if (action === 'restart') location.reload();
});
$('modal-layer').addEventListener('click', event => { if (event.target === $('modal-layer') && !game.over) closeModal(); });
window.addEventListener('keydown', event => {
  game.keys[event.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'Space') game.firing = true;
  if (event.repeat) return;
  if (event.code === 'KeyB') game.paused && !$('modal-layer').classList.contains('hidden') ? null : openShop();
  if (event.code === 'KeyQ') activateDrone();
  if (event.code === 'Escape') { if (!$('modal-layer').classList.contains('hidden')) closeModal(); else pauseGame(); }
});
window.addEventListener('keyup', event => { game.keys[event.code] = false; if (event.code === 'Space') game.firing = false; });
window.addEventListener('blur', () => { game.keys = {}; game.firing = false; if (game.started && !game.paused) pauseGame(); });

const joystick = $('joystick'), knob = $('joy-knob'); let joyPointer = null;
function joyMove(event) {
  const rect = joystick.getBoundingClientRect(), dx = event.clientX - (rect.left + rect.width / 2), dy = event.clientY - (rect.top + rect.height / 2);
  const max = 37, length = Math.hypot(dx, dy), scale = length > max ? max / length : 1;
  const x = dx * scale, y = dy * scale; knob.style.transform = `translate(${x}px, ${y}px)`;
  game.joystick.x = x / max; game.joystick.z = y / max;
}
joystick.addEventListener('pointerdown', event => { joyPointer = event.pointerId; joystick.setPointerCapture(joyPointer); joyMove(event); });
joystick.addEventListener('pointermove', event => { if (event.pointerId === joyPointer) joyMove(event); });
function joyEnd(event) { if (event.pointerId !== joyPointer) return; joyPointer = null; game.joystick.x = 0; game.joystick.z = 0; knob.style.transform = 'translate(0,0)'; }
joystick.addEventListener('pointerup', joyEnd); joystick.addEventListener('pointercancel', joyEnd);
$('fire-button').addEventListener('pointerdown', event => { event.preventDefault(); $('fire-button').setPointerCapture(event.pointerId); game.firing = true; });
function stopFiring() { game.firing = false; }
$('fire-button').addEventListener('pointerup', stopFiring);
$('fire-button').addEventListener('pointercancel', stopFiring);
$('fire-button').addEventListener('lostpointercapture', stopFiring);
window.addEventListener('contextmenu', event => event.preventDefault());
