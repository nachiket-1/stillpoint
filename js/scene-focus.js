// Stillpoint — focus background scene
// Soft pastoral horizon with natural sun, ACESFilmic tone mapping.
// Calm so the timer reads first.

import * as THREE from 'three';

const stage = document.getElementById('focusStage');
if (!stage) throw new Error('No #focusStage element');

let W = window.innerWidth;
let H = window.innerHeight;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0e8d8);

const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 200);
camera.position.set(0, 1.2, 6);
camera.lookAt(0, 1.4, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
stage.appendChild(renderer.domElement);

// ─── Lights
scene.add(new THREE.HemisphereLight(0xfff5dc, 0xd9c79a, 1.0));
scene.fog = new THREE.Fog(0xefe6d2, 10, 50);

// ─── Sun position
const SUN_POS = new THREE.Vector3(3.0, 3.8, -18);
const SUN_DIR = SUN_POS.clone().normalize();

// ─── Sky dome with gentle sun scatter
{
  const skyGeo = new THREE.SphereGeometry(80, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: `
      varying vec3 vW; void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 sunDir; varying vec3 vW;
      void main(){
        vec3 dir = normalize(vW);
        float h  = dir.y;
        float sd = max(dot(dir, sunDir), 0.0);
        vec3 zenith  = vec3(0.80, 0.87, 0.95);
        vec3 midsky  = vec3(0.93, 0.87, 0.76);
        vec3 horizon = vec3(0.97, 0.83, 0.60);
        vec3 c = mix(horizon, midsky, smoothstep(-0.05, 0.32, h));
        c = mix(c, zenith, smoothstep(0.22, 0.72, h));
        c += vec3(1.0, 0.78, 0.42) * pow(sd, 18.0) * 0.55;
        c += vec3(1.0, 0.88, 0.60) * pow(sd,  8.0) * 0.07;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ─── Noise helpers
const hash    = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
const noise1D = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
const fbm1    = (x) => noise1D(x) * 0.6 + noise1D(x * 2.13 + 5.7) * 0.25 + noise1D(x * 4.7 + 17.3) * 0.15;

// ─── Hills
[
  { z: -18, h: 3.0, y: -0.6, f: 0.16, c: 0x9aac82 },
  { z: -10, h: 2.4, y: -0.9, f: 0.28, c: 0x7c8e64 },
  { z:  -3, h: 1.9, y: -1.3, f: 0.50, c: 0xc39845 },
].forEach((spec, idx) => {
  const seg = 200;
  const geo = new THREE.PlaneGeometry(90, spec.h, seg, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i <= seg; i++) {
    const n = fbm1(pos.getX(i) * spec.f + idx * 7.7);
    pos.setY(i, spec.h / 2 + (n - 0.5) * spec.h * 0.7);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: spec.c, roughness: 1 }));
  m.position.set(0, spec.y, spec.z);
  scene.add(m);
});

// ─── Sun: natural NormalBlending disc
{
  const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

  const halo = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.NormalBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = pow(1.0 - smoothstep(0.0, 0.5, d), 2.0) * 0.52;
        gl_FragColor = vec4(1.0, 0.88, 0.65, a);
      }`,
  }));
  halo.position.set(SUN_POS.x, SUN_POS.y, SUN_POS.z);
  halo.renderOrder = 2;
  scene.add(halo);

  const core = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), new THREE.ShaderMaterial({
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
  }));
  core.position.set(SUN_POS.x, SUN_POS.y, SUN_POS.z + 0.2);
  core.renderOrder = 3;
  scene.add(core);
}

// ─── Soft mote particles
let particles, vel;
{
  const count = 380;
  const pos   = new Float32Array(count * 3);
  vel         = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 28;
    pos[i * 3 + 1] = -1 + Math.random() * 6;
    pos[i * 3 + 2] = -1 - Math.random() * 14;
    vel[i * 3]     = (Math.random() - 0.5) * 0.05;
    vel[i * 3 + 1] = 0.03 + Math.random() * 0.05;
    phase[i]       = Math.random() * 6.28;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPhase',   new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float aPhase; uniform float time; varying float vA;
      void main(){
        vec3 p = position; p.x += sin(time * 0.5 + aPhase) * 0.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 1.4 * 240.0 / -mv.z;
        vA = 0.5 + 0.5 * sin(time * 1.1 + aPhase);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(1.0, 0.82, 0.46, a * vA * 0.32);
      }`,
  });
  particles = new THREE.Points(g, m);
  particles.userData.mat = m;
  scene.add(particles);
}

const clock = new THREE.Clock();
function animate() {
  const t  = clock.getElapsedTime();
  const dt = Math.min(0.05, clock.getDelta());

  if (particles) {
    particles.userData.mat.uniforms.time.value = t;
    const arr = particles.geometry.attributes.position.array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3]     += vel[i * 3]     * dt * 6;
      arr[i * 3 + 1] += vel[i * 3 + 1] * dt * 6;
      if (arr[i * 3 + 1] > 6) {
        arr[i * 3]     = (Math.random() - 0.5) * 28;
        arr[i * 3 + 1] = -1;
        arr[i * 3 + 2] = -1 - Math.random() * 14;
      }
    }
    particles.geometry.attributes.position.needsUpdate = true;
  }

  camera.position.x = Math.sin(t * 0.08) * 0.18;
  camera.position.y = 1.2 + Math.cos(t * 0.12) * 0.05;
  camera.lookAt(0, 1.5, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
  W = window.innerWidth; H = window.innerHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
});
