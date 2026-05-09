// Stillpoint — hero scene
// Photographic-textured 3D Namaqualand landscape: sand → gravel → cliff
// blended on terrain, scattered boulders, flower-bloom billboards.

import * as THREE from 'three';

const stage = document.getElementById('stage');
if (!stage) throw new Error('No #stage element');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5ede0);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 6.5, 14);
camera.lookAt(0, 0.5, -5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

scene.fog = new THREE.FogExp2(0xf0e8d8, 0.018);

// ─── Sun direction (used by terrain shader)
const SUN_POS = new THREE.Vector3(-3.4, 3.5, -30);
const SUN_DIR_FROM = new THREE.Vector3(-8, 14, 4).normalize(); // direction toward sun

// ─── Texture loading
const loader = new THREE.TextureLoader();
function loadTiling(path) {
  const t = loader.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function loadFlat(path, isColor = true) {
  const t = loader.load(path);
  if (isColor) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const tSand    = loadTiling('assets/textures/sand.jpg');
const tGravel  = loadTiling('assets/textures/gravel.jpg');
const tCliff   = loadTiling('assets/textures/cliff.jpg');
const tBoulder = loadTiling('assets/textures/boulder.jpg');

// flower textures
const tGazania        = loadFlat('assets/textures/gazania.jpg');
const tGazaniaAlpha   = loadFlat('assets/textures/gazania_alpha.png', false);
const tUrsinia        = loadFlat('assets/textures/ursinia.jpg');
const tUrsiniaAlpha   = loadFlat('assets/textures/ursinia_alpha.png', false);
const tHelio          = loadFlat('assets/textures/heliophila.jpg');
const tHelioAlpha     = loadFlat('assets/textures/heliophila_alpha.png', false);

// ─── Sky dome (warm cream gradient — matches user's preferred look)
{
  const skyGeo = new THREE.SphereGeometry(180, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0xf8f3ec) },
      midColor:    { value: new THREE.Color(0xf4e6cc) },
      bottomColor: { value: new THREE.Color(0xedd8b0) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 topColor, midColor, bottomColor;
      varying vec3 vWorld;
      void main(){
        float h = normalize(vWorld).y;
        vec3 lower = mix(bottomColor, midColor, smoothstep(0.0, 0.45, h + 0.2));
        vec3 col   = mix(lower, topColor, smoothstep(-0.1, 0.55, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ─── Sun disc
{
  const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

  const halo = new THREE.Mesh(new THREE.CircleGeometry(5.4, 96), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.NormalBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = pow(1.0 - smoothstep(0.0, 0.5, d), 1.8) * 0.50;
        gl_FragColor = vec4(1.0, 0.88, 0.60, a);
      }`,
  }));
  halo.position.set(SUN_POS.x, SUN_POS.y, SUN_POS.z);
  scene.add(halo);

  const core = new THREE.Mesh(new THREE.CircleGeometry(1.3, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.NormalBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = 1.0 - smoothstep(0.44, 0.5, d);
        vec3 col = mix(vec3(1.0, 0.97, 0.86), vec3(1.0, 0.84, 0.56), smoothstep(0.0, 0.5, d));
        gl_FragColor = vec4(col, a);
      }`,
  }));
  core.position.set(SUN_POS.x, SUN_POS.y, SUN_POS.z + 0.1);
  scene.add(core);
}

// ─── 2D value noise + FBM
const h2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
const n2 = (x, y) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return h2(ix,iy)*(1-ux)*(1-uy) + h2(ix+1,iy)*ux*(1-uy) + h2(ix,iy+1)*(1-ux)*uy + h2(ix+1,iy+1)*ux*uy;
};
const fbm = (x, y) =>
  n2(x,     y)     * 0.500 +
  n2(x*2.1, y*2.1) * 0.250 +
  n2(x*4.3, y*4.3) * 0.125 +
  n2(x*8.7, y*8.7) * 0.063;

const TERRAIN_OFFSET_Y = -1.5;
const TERRAIN_OFFSET_Z = -10;

const terrainH = (x, z) => {
  const nx = x * 0.065 + 0.5;
  const nz = z * 0.065 + 0.5;
  return Math.pow(Math.max(fbm(nx, nz) - 0.18, 0) / 0.82, 1.5) * 9.5;
};

// ─── Textured 3D terrain — sand/gravel/cliff blended by height + slope
{
  const SIZE = 100, SEGS = 180;
  const geo  = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainH(x, z));
  }
  geo.computeVertexNormals();

  const terrainMat = new THREE.ShaderMaterial({
    uniforms: {
      tSand:   { value: tSand },
      tGravel: { value: tGravel },
      tCliff:  { value: tCliff },
      sunDir:  { value: SUN_DIR_FROM },
      ambient: { value: new THREE.Color(0xa8b8c4).convertSRGBToLinear() },
      sunCol:  { value: new THREE.Color(0xffe8c0).convertSRGBToLinear() },
      fogColor:    { value: new THREE.Color(0xf0e8d8).convertSRGBToLinear() },
      fogDensity:  { value: 0.018 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vViewDist;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 mv = viewMatrix * wp;
        vViewDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D tSand, tGravel, tCliff;
      uniform vec3 sunDir, ambient, sunCol, fogColor;
      uniform float fogDensity;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vViewDist;

      void main(){
        // Sample at varied tiling for natural look
        vec3 sand   = texture2D(tSand,   vUv * 22.0).rgb;
        vec3 gravel = texture2D(tGravel, vUv * 16.0).rgb;
        vec3 cliff  = texture2D(tCliff,  vUv * 10.0).rgb;

        float h     = vWorldPos.y;
        float slope = clamp(vWorldNormal.y, 0.0, 1.0); // 1=flat, 0=vertical

        // Height blends
        float m1 = smoothstep(-0.5, 1.4, h);   // sand → gravel
        float m2 = smoothstep( 1.8, 4.5, h);   // gravel → cliff
        vec3 col = mix(sand, gravel, m1);
        col      = mix(col,  cliff,  m2);

        // Steep faces always show cliff regardless of altitude
        float steepness = 1.0 - smoothstep(0.45, 0.78, slope);
        col = mix(col, cliff, steepness);

        // Lambert lighting
        float diff = max(dot(vWorldNormal, sunDir), 0.0);
        vec3 lit   = col * (ambient + sunCol * diff);

        // Distance fog
        float fogF = 1.0 - exp(-fogDensity * fogDensity * vViewDist * vViewDist);
        lit = mix(lit, fogColor, fogF);

        gl_FragColor = vec4(lit, 1.0);
      }`,
  });

  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.position.set(0, TERRAIN_OFFSET_Y, TERRAIN_OFFSET_Z);
  scene.add(terrain);
}

// ─── Boulders scattered across lower terrain
{
  const boulderMat = new THREE.MeshStandardMaterial({
    map: tBoulder,
    roughness: 0.95,
    metalness: 0.0,
  });

  let placed = 0;
  for (let attempt = 0; attempt < 600 && placed < 22; attempt++) {
    const x = (Math.random() - 0.5) * 70;
    const z = (Math.random() - 0.5) * 70 + TERRAIN_OFFSET_Z;
    const localZ = z - TERRAIN_OFFSET_Z;
    const h = terrainH(x, localZ);
    if (h < 0.3 || h > 3.5) continue;

    const r = 0.35 + Math.random() * 0.7;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), boulderMat);
    rock.position.set(x, TERRAIN_OFFSET_Y + h - r * 0.25, z);
    rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    rock.scale.set(1, 0.75 + Math.random() * 0.4, 1);
    scene.add(rock);
    placed++;
  }
}

// ─── Flower bloom billboards (Namaqualand spring colour)
{
  const flowerDefs = [
    { map: tGazania,    alpha: tGazaniaAlpha,   scale: 0.55 },
    { map: tUrsinia,    alpha: tUrsiniaAlpha,   scale: 0.50 },
    { map: tHelio,      alpha: tHelioAlpha,     scale: 0.45 },
  ];
  const flowerMats = flowerDefs.map((def) => new THREE.SpriteMaterial({
    map: def.map,
    alphaMap: def.alpha,
    transparent: true,
    alphaTest: 0.4,
    depthWrite: false,
  }));

  let placed = 0;
  for (let attempt = 0; attempt < 1200 && placed < 140; attempt++) {
    const x = (Math.random() - 0.5) * 60;
    const z = (Math.random() - 0.5) * 50 + TERRAIN_OFFSET_Z + 5;
    const localZ = z - TERRAIN_OFFSET_Z;
    const h = terrainH(x, localZ);
    if (h < 0.05 || h > 1.6) continue;

    const idx = Math.floor(Math.random() * flowerDefs.length);
    const sprite = new THREE.Sprite(flowerMats[idx]);
    const scale = flowerDefs[idx].scale * (0.7 + Math.random() * 0.7);
    sprite.scale.set(scale, scale, 1);
    sprite.position.set(x, TERRAIN_OFFSET_Y + h + scale * 0.45, z);
    scene.add(sprite);
    placed++;
  }
}

// ─── Drifting cloud wisps
const clouds = [];
{
  const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const frag = `
    varying vec2 vUv; uniform float opacity;
    void main(){
      vec2 p = (vUv - 0.5) * 2.0; p.y *= 2.4;
      float a = pow(1.0 - smoothstep(0.0, 0.88, length(p)), 2.2) * opacity;
      gl_FragColor = vec4(1.0, 0.97, 0.90, a);
    }`;
  for (let i = 0; i < 10; i++) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { opacity: { value: 0.30 + Math.random() * 0.22 } },
      vertexShader: vert, fragmentShader: frag,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7 + Math.random() * 9, 2 + Math.random() * 1.2), mat);
    m.position.set(
      (Math.random() - 0.5) * 80,
      8 + Math.random() * 4,
      -20 - Math.random() * 40
    );
    m.userData.speed     = 0.8 + Math.random() * 1.2;
    m.userData.bobOffset = Math.random() * Math.PI * 2;
    scene.add(m);
    clouds.push(m);
  }
}

// ─── Pollen motes
let particles, particleVel;
{
  const count = 480;
  const positions = new Float32Array(count * 3);
  const sizes     = new Float32Array(count);
  const phases    = new Float32Array(count);
  particleVel     = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i*3+0] = (Math.random() - 0.5) * 40;
    positions[i*3+1] = Math.random() * 6;
    positions[i*3+2] = -2 - Math.random() * 20;
    sizes[i]  = 0.04 + Math.random() * 0.07;
    phases[i] = Math.random() * Math.PI * 2;
    particleVel[i*3+0] = (Math.random() - 0.5) * 0.04;
    particleVel[i*3+1] = 0.03 + Math.random() * 0.05;
    particleVel[i*3+2] = (Math.random() - 0.5) * 0.02;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float aSize; attribute float aPhase; uniform float time; varying float vA;
      void main(){
        vec3 p = position; p.x += sin(time*0.6+aPhase)*0.14;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = aSize*340.0/-mv.z;
        vA = 0.6+0.4*sin(time*1.2+aPhase);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        float a = smoothstep(0.5,0.0,length(gl_PointCoord-0.5));
        gl_FragColor = vec4(1.0,0.82,0.46, a*vA*0.55);
      }`,
  });
  particles = new THREE.Points(geo, mat);
  particles.userData.mat = mat;
  scene.add(particles);
}

// ─── Birds
const birds = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array([-0.18, 0.08, 0, 0, 0, 0, 0.18, 0.08, 0]), 3
  ));
  const b = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x3a3b34, transparent: true, opacity: 0.5 }));
  b.position.set(-16 - i * 5, 5 + Math.random() * 2, -12 - Math.random() * 10);
  b.userData.speed = 1.2 + Math.random() * 0.8;
  b.userData.flap  = Math.random() * Math.PI * 2;
  scene.add(b);
  birds.push(b);
}

// ─── Add hemisphere + directional light for boulders (MeshStandardMaterial)
scene.add(new THREE.HemisphereLight(0xfff5dc, 0xc4a86a, 0.75));
const sunLight = new THREE.DirectionalLight(0xffe8c0, 1.4);
sunLight.position.set(-8, 14, 4);
scene.add(sunLight);

// ─── Mouse parallax
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('mousemove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth  - 0.5) * 2;
  mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
});
window.addEventListener('deviceorientation', (e) => {
  if (e.gamma == null) return;
  mouse.tx = Math.max(-1, Math.min(1, e.gamma / 30));
  mouse.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
});

const clock = new THREE.Clock();

function animate() {
  const t  = clock.getElapsedTime();
  const dt = Math.min(0.05, clock.getDelta());

  mouse.x += (mouse.tx - mouse.x) * 0.04;
  mouse.y += (mouse.ty - mouse.y) * 0.04;

  camera.position.x = mouse.x * 0.8 + Math.sin(t * 0.10) * 0.3;
  camera.position.y = 6.5 - mouse.y * 0.4 + Math.sin(t * 0.15) * 0.1;
  camera.lookAt(mouse.x * 0.3, 0.5, -5);

  if (particles) {
    particles.userData.mat.uniforms.time.value = t;
    const pos = particles.geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i*3+0] += particleVel[i*3+0] * dt * 5;
      arr[i*3+1] += particleVel[i*3+1] * dt * 5;
      arr[i*3+2] += particleVel[i*3+2] * dt * 5;
      if (arr[i*3+1] > 8)  { arr[i*3+0]=(Math.random()-0.5)*40; arr[i*3+1]=0; arr[i*3+2]=-2-Math.random()*20; }
      if (arr[i*3+0] >  20) arr[i*3+0] = -20;
      if (arr[i*3+0] < -20) arr[i*3+0] =  20;
    }
    pos.needsUpdate = true;
  }

  clouds.forEach((c) => {
    c.position.x += c.userData.speed * dt * 0.4;
    c.position.y += Math.sin(t * 0.3 + c.userData.bobOffset) * 0.001;
    if (c.position.x > 44) c.position.x = -44;
  });

  birds.forEach((b) => {
    b.position.x += b.userData.speed * dt;
    b.position.y += Math.sin(t * 3.5 + b.userData.flap) * 0.006;
    if (b.position.x > 20) { b.position.x = -20; b.position.y = 5 + Math.random() * 2; }
  });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
