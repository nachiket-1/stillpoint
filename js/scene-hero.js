// Stillpoint — hero scene
// Low-poly 3D terrain: Blender-style flat-shaded landscape with height-based
// vertex colours, cone pine trees, snow-capped peaks, golden directional light.

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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

// ─── Fog — atmospheric depth
scene.fog = new THREE.FogExp2(0xf0e8d8, 0.018);

// ─── Lights
const hemi = new THREE.HemisphereLight(0xfff5dc, 0xc4a86a, 0.75);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight(0xffe8c0, 1.4);
sunLight.position.set(-8, 14, 4);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far  = 80;
sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -30;
sunLight.shadow.camera.right = sunLight.shadow.camera.top  =  30;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xd8e8ff, 0.25);
fillLight.position.set(6, 4, 8);
scene.add(fillLight);

// ─── Sky dome (same warm cream-to-peach gradient the user liked)
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

// ─── Sun disc (same position that worked before)
{
  const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.NormalBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = pow(1.0 - smoothstep(0.0, 0.5, d), 1.8) * 0.50;
        gl_FragColor = vec4(1.0, 0.88, 0.60, a);
      }`,
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(5.4, 96), haloMat);
  halo.position.set(-3.4, 3.5, -30);
  halo.renderOrder = 2;
  scene.add(halo);

  const coreMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
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
  });
  const core = new THREE.Mesh(new THREE.CircleGeometry(1.3, 64), coreMat);
  core.position.set(-3.4, 3.5, -29.9);
  core.renderOrder = 3;
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
  n2(x*8.7, y*8.7) * 0.063 +
  n2(x*17,  y*17)  * 0.031;

// terrain height function (reused for tree placement)
const terrainH = (x, z) => {
  const nx = x * 0.065 + 0.5;
  const nz = z * 0.065 + 0.5;
  const base = fbm(nx, nz);
  // sharp peaks: raise high areas more aggressively
  return Math.pow(Math.max(base - 0.18, 0) / 0.82, 1.5) * 9.5;
};

// ─── 3D Terrain — flat-shaded, vertex-coloured
{
  const SIZE = 90, SEGS = 160;
  const geo  = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);

  const pos  = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);

  // colour palette (low-poly landscape)
  const cValley = new THREE.Color(0x5a7a42);  // lush green valley
  const cSlope  = new THREE.Color(0x8a9a66);  // sage slope
  const cRock   = new THREE.Color(0x8a7e6a);  // rocky grey-brown
  const cStone  = new THREE.Color(0xb0a898);  // pale stone
  const cSnow   = new THREE.Color(0xeeeae4);  // snow cap

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainH(x, z);
    pos.setY(i, h);

    // height-based colour
    let col;
    if      (h < 0.40) col = cValley;
    else if (h < 1.60) col = new THREE.Color().lerpColors(cValley, cSlope, (h-0.40)/1.20);
    else if (h < 3.20) col = new THREE.Color().lerpColors(cSlope,  cRock,  (h-1.60)/1.60);
    else if (h < 5.00) col = new THREE.Color().lerpColors(cRock,   cStone, (h-3.20)/1.80);
    else               col = new THREE.Color().lerpColors(cStone,  cSnow,  Math.min((h-5.00)/1.50, 1.0));

    cols[i * 3]     = col.r;
    cols[i * 3 + 1] = col.g;
    cols[i * 3 + 2] = col.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.0,
    flatShading: true,
  });

  const terrain = new THREE.Mesh(geo, mat);
  terrain.receiveShadow = true;
  terrain.castShadow    = false;
  terrain.position.set(0, -1.5, -10);
  scene.add(terrain);
}

// ─── Low-poly cone pine trees (Blender classic)
{
  const treeMat  = new THREE.MeshStandardMaterial({ color: 0x2e4a28, flatShading: true, roughness: 1 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d26, flatShading: true, roughness: 1 });

  const treePositions = [];
  // Scatter candidates across the terrain
  for (let attempt = 0; attempt < 600; attempt++) {
    const x = (Math.random() - 0.5) * 72;
    const z = (Math.random() - 0.5) * 72;
    const h = terrainH(x, z - 10); // offset matches terrain.position.z
    if (h > 0.25 && h < 2.2) {    // only in valley/slope zone, not peaks
      treePositions.push({ x, z: z - 10, h });
      if (treePositions.length >= 90) break;
    }
  }

  treePositions.forEach(({ x, z, h }) => {
    const scale  = 0.5 + Math.random() * 0.7;
    const layers = 2 + Math.floor(Math.random() * 2); // 2-3 cone layers

    for (let l = 0; l < layers; l++) {
      const r   = (0.55 - l * 0.12) * scale;
      const ht  = (0.85 + l * 0.1)  * scale;
      const yOff = l * 0.55 * scale;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, ht, 6, 1), treeMat);
      cone.position.set(x, h - 1.5 + yOff + ht * 0.5, z);
      cone.rotation.y = Math.random() * Math.PI * 2;
      cone.castShadow = true;
      scene.add(cone);
    }
    // Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.09 * scale, 0.4 * scale, 5), trunkMat);
    trunk.position.set(x, h - 1.5 + 0.2 * scale, z);
    trunk.castShadow = true;
    scene.add(trunk);
  });
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
  const count = 500;
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
        gl_FragColor = vec4(1.0,0.82,0.46, a*vA*0.65);
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

  // Gentle camera drift over 3D terrain
  camera.position.x = mouse.x * 0.8 + Math.sin(t * 0.10) * 0.3;
  camera.position.y = 6.5 - mouse.y * 0.4 + Math.sin(t * 0.15) * 0.1;
  camera.lookAt(mouse.x * 0.3, 0.5, -5);

  // particles
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

  // clouds
  clouds.forEach((c) => {
    c.position.x += c.userData.speed * dt * 0.4;
    c.position.y += Math.sin(t * 0.3 + c.userData.bobOffset) * 0.001;
    if (c.position.x > 44) c.position.x = -44;
  });

  // birds
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
