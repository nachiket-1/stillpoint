// Stillpoint — hero scene (home)
// ACESFilmic tone mapping, natural sun disc, atmospheric sky gradient,
// layered hills, drifting clouds, pollen particles, birds.

import * as THREE from 'three';

const stage = document.getElementById('stage');
if (!stage) throw new Error('No #stage element');

let W = window.innerWidth;
let H = window.innerHeight;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5ede0);

const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 200);
camera.position.set(0, 1.4, 6.2);
camera.lookAt(0, 1.6, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
stage.appendChild(renderer.domElement);

// ─── Sun position (for sky scatter direction)
const SUN_POS = new THREE.Vector3(-4.0, 4.5, -30);
const SUN_DIR = SUN_POS.clone().normalize();

// ─── Lights
scene.add(new THREE.HemisphereLight(0xfff5dc, 0xd9c79a, 0.95));
const dirLight = new THREE.DirectionalLight(0xffe8b4, 0.85);
dirLight.position.set(-4, 6, 3);
scene.add(dirLight);

// ─── Fog
scene.fog = new THREE.Fog(0xf5ede0, 14, 65);

// ─── Sky dome with gentle warm gradient + tight sun scatter
{
  const skyGeo = new THREE.SphereGeometry(80, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: `
      varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 sunDir;
      varying vec3 vWorld;
      void main(){
        vec3 dir = normalize(vWorld);
        float h  = dir.y;
        float sd = max(dot(dir, sunDir), 0.0);

        vec3 zenith  = vec3(0.78, 0.86, 0.96);
        vec3 midsky  = vec3(0.93, 0.87, 0.76);
        vec3 horizon = vec3(0.97, 0.83, 0.60);

        vec3 c = mix(horizon, midsky, smoothstep(-0.05, 0.32, h));
        c = mix(c, zenith, smoothstep(0.22, 0.72, h));

        // Very tight glow right around sun only
        c += vec3(1.0, 0.78, 0.42) * pow(sd, 18.0) * 0.60;
        c += vec3(1.0, 0.88, 0.60) * pow(sd, 8.0)  * 0.08;

        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ─── Noise helpers
const hash    = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
const noise1D = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
const fbm1    = (x) => noise1D(x) * 0.6 + noise1D(x * 2.13 + 5.7) * 0.25 + noise1D(x * 4.7 + 17.3) * 0.15;

// ─── Layered hills
const layerSpecs = [
  { z: -22, height: 3.6, baseY: -0.4, freq: 0.15, color: 0x8a9a73 },
  { z: -16, height: 3.2, baseY: -0.6, freq: 0.22, color: 0x7d8c64 },
  { z: -10, height: 2.6, baseY: -0.8, freq: 0.32, color: 0x6e8055 },
  { z:  -5, height: 2.2, baseY: -1.1, freq: 0.45, color: 0xc39845 },
  { z:  -1, height: 1.6, baseY: -1.4, freq: 0.70, color: 0xb46a4a },
];
layerSpecs.forEach((spec, idx) => {
  const segments = 220;
  const geo = new THREE.PlaneGeometry(90, spec.height, segments, 1);
  const pos = geo.attributes.position;
  const seed = idx * 9.3 + 11.7;
  for (let i = 0; i <= segments; i++) {
    const n = fbm1(pos.getX(i) * spec.freq + seed);
    pos.setY(i, spec.height / 2 + (n - 0.5) * spec.height * 0.85);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: spec.color, roughness: 1, metalness: 0,
  }));
  mesh.position.set(0, spec.baseY, spec.z);
  scene.add(mesh);
});

// ─── Sun: natural disc — NormalBlending so it looks like a real sky sun
{
  const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

  // Soft outer halo — NormalBlending, modest alpha
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.NormalBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = pow(1.0 - smoothstep(0.0, 0.5, d), 2.0) * 0.55;
        gl_FragColor = vec4(1.0, 0.88, 0.65, a);
      }`,
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(3.8, 64), haloMat);
  halo.position.set(SUN_POS.x, SUN_POS.y, SUN_POS.z);
  halo.renderOrder = 2;
  scene.add(halo);

  // Crisp core disc — warm white
  const coreMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.NormalBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = 1.0 - smoothstep(0.42, 0.5, d);
        vec3 col = mix(vec3(1.0, 0.98, 0.92), vec3(1.0, 0.90, 0.72), d * 2.0);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const core = new THREE.Mesh(new THREE.CircleGeometry(1.1, 64), coreMat);
  core.position.set(SUN_POS.x, SUN_POS.y, SUN_POS.z + 0.2);
  core.renderOrder = 3;
  scene.add(core);
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
      gl_FragColor = vec4(1.0, 0.97, 0.88, a);
    }`;
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { opacity: { value: 0.34 + Math.random() * 0.20 } },
      vertexShader: vert, fragmentShader: frag,
    });
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(5 + Math.random() * 7, 1.6 + Math.random() * 0.8),
      mat
    );
    m.position.set(
      (Math.random() - 0.5) * 40,
      3.5 + Math.random() * 2.0,
      -14 - Math.random() * 10
    );
    m.userData.speed = 0.03 + Math.random() * 0.05;
    m.userData.bobOffset = Math.random() * Math.PI * 2;
    scene.add(m);
    clouds.push(m);
  }
}

// ─── Pollen / wildflower particles
let particles, particleVel;
{
  const count = 700;
  const positions = new Float32Array(count * 3);
  const sizes     = new Float32Array(count);
  const phases    = new Float32Array(count);
  particleVel     = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 26;
    positions[i * 3 + 1] = -2 + Math.random() * 6;
    positions[i * 3 + 2] = -2 - Math.random() * 14;
    sizes[i]  = 0.04 + Math.random() * 0.08;
    phases[i] = Math.random() * Math.PI * 2;
    particleVel[i * 3 + 0] = (Math.random() - 0.5) * 0.06;
    particleVel[i * 3 + 1] = 0.04 + Math.random() * 0.07;
    particleVel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float aSize; attribute float aPhase; uniform float time; varying float vAlpha;
      void main(){
        vec3 p = position; p.x += sin(time * 0.6 + aPhase) * 0.18;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * 360.0 / -mv.z;
        vAlpha = 0.7 + 0.3 * sin(time * 1.2 + aPhase);
      }`,
    fragmentShader: `
      varying float vAlpha;
      void main(){
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(1.0, 0.82, 0.46, a * vAlpha * 0.8);
      }`,
  });
  particles = new THREE.Points(geo, mat);
  particles.userData.mat = mat;
  scene.add(particles);
}

// ─── Birds
const birds = [];
for (let i = 0; i < 3; i++) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array([-0.12, 0.06, 0, 0, 0, 0, 0.12, 0.06, 0]), 3
  ));
  const b = new THREE.Line(g, new THREE.LineBasicMaterial({
    color: 0x4a4b44, transparent: true, opacity: 0.55,
  }));
  b.position.set(-10 - i * 4, 2.4 + Math.random() * 1.6, -8 - Math.random() * 6);
  b.userData.speed = 0.6 + Math.random() * 0.4;
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

  camera.position.x = mouse.x * 0.6 + Math.sin(t * 0.12) * 0.15;
  camera.position.y = 1.4 - mouse.y * 0.25 + Math.cos(t * 0.18) * 0.06;
  camera.lookAt(0, 1.6 + mouse.y * 0.05, 0);

  if (particles) {
    particles.userData.mat.uniforms.time.value = t;
    const pos = particles.geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3 + 0] += particleVel[i * 3 + 0] * dt * 6;
      arr[i * 3 + 1] += particleVel[i * 3 + 1] * dt * 6;
      arr[i * 3 + 2] += particleVel[i * 3 + 2] * dt * 6;
      if (arr[i * 3 + 1] > 6)  { arr[i*3+0] = (Math.random()-0.5)*26; arr[i*3+1] = -2; arr[i*3+2] = -2-Math.random()*14; }
      if (arr[i * 3 + 0] >  14) arr[i * 3 + 0] = -14;
      if (arr[i * 3 + 0] < -14) arr[i * 3 + 0] =  14;
    }
    pos.needsUpdate = true;
  }

  clouds.forEach((c) => {
    c.position.x += c.userData.speed * dt;
    c.position.y += Math.sin(t * 0.4 + c.userData.bobOffset) * 0.0006;
    if (c.position.x > 22) c.position.x = -22;
  });

  birds.forEach((b) => {
    b.position.x += b.userData.speed * dt;
    b.position.y += Math.sin(t * 4 + b.userData.flap) * 0.005;
    if (b.position.x > 14) {
      b.position.x = -14;
      b.position.y =  2.4 + Math.random() * 1.6;
      b.position.z = -8   - Math.random() * 6;
    }
  });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// ─── Resize
window.addEventListener('resize', () => {
  W = window.innerWidth; H = window.innerHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
});
