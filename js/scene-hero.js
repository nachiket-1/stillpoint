// Stillpoint — hero scene (home)
// Day/night aware: warm pastoral day ↔ cool moonlit night.
// Watches data-theme on <html> and smoothly transitions all scene elements.

import * as THREE from 'three';

const stage = document.getElementById('stage');
if (!stage) throw new Error('No #stage element');

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.4, 6.2);
camera.lookAt(0, 1.6, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

// ─── Night blend  (0 = day, 1 = night)
// Polled every frame so the initial value is correct even if theme.js runs later.
let nightBlend  = 0;
let targetNight = 0;

// ─── Lights
const hemiLight = new THREE.HemisphereLight(0xfff5dc, 0xd9c79a, 0.95);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xfff1cc, 0.7);
dirLight.position.set(-4, 6, 3);
scene.add(dirLight);

const D_HEMI_SKY = new THREE.Color(0xfff5dc);
const D_HEMI_GND = new THREE.Color(0xd9c79a);
const N_HEMI_SKY = new THREE.Color(0x1a2a4a);
const N_HEMI_GND = new THREE.Color(0x050810);
const D_DIR     = new THREE.Color(0xfff1cc);
const N_DIR     = new THREE.Color(0xaabcd8);

// ─── Fog
scene.fog = new THREE.Fog(0xf5ede0, 14, 65);
const D_FOG = new THREE.Color(0xf5ede0);
const N_FOG = new THREE.Color(0x04091a);

// ─── Noise helpers
const hash   = n => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
const noise1 = x => { const i = Math.floor(x); const f = x - i; const u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
const fbm1   = x => noise1(x) * 0.6 + noise1(x * 2.13 + 5.7) * 0.25 + noise1(x * 4.7 + 17.3) * 0.15;

// ─── Sky gradient  (day + night colors blended in shader)
let skyMat;
{
  const skyGeo = new THREE.SphereGeometry(80, 32, 16);
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0xf8f3ec) },
      midColor:    { value: new THREE.Color(0xf4e6cc) },
      bottomColor: { value: new THREE.Color(0xedd8b0) },
      nightTop:    { value: new THREE.Color(0x02040e) },
      nightMid:    { value: new THREE.Color(0x04091c) },
      nightBottom: { value: new THREE.Color(0x080e28) },
      uNight:      { value: nightBlend },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor, midColor, bottomColor;
      uniform vec3 nightTop, nightMid, nightBottom;
      uniform float uNight;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        float t = smoothstep(-0.1, 0.55, h);
        vec3 dLow = mix(bottomColor, midColor, smoothstep(0.0, 0.45, h + 0.2));
        vec3 day  = mix(dLow, topColor, t);
        vec3 nLow = mix(nightBottom, nightMid, smoothstep(0.0, 0.45, h + 0.2));
        vec3 night = mix(nLow, nightTop, t);
        gl_FragColor = vec4(mix(day, night, uNight), 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ─── Shared vertex shader for billboard quads
const billVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

// ─── Sun
const sunMats = [];
{
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: { uOp: { value: 1 } },
    vertexShader: billVert,
    fragmentShader: `
      varying vec2 vUv; uniform float uOp;
      void main() {
        float d = distance(vUv, vec2(0.5));
        float a = pow(1.0 - smoothstep(0.0, 0.5, d), 1.8) * 0.50 * uOp;
        gl_FragColor = vec4(1.0, 0.88, 0.60, a);
      }`,
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(5.4, 96), haloMat);
  halo.position.set(-3.4, 2.5, -30);
  scene.add(halo);
  sunMats.push(haloMat);

  const coreMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: { uOp: { value: 1 } },
    vertexShader: billVert,
    fragmentShader: `
      varying vec2 vUv; uniform float uOp;
      void main() {
        float d = distance(vUv, vec2(0.5));
        float a = (1.0 - smoothstep(0.44, 0.50, d)) * uOp;
        vec3 col = mix(vec3(1.0, 0.97, 0.86), vec3(1.0, 0.84, 0.56), smoothstep(0.0, 0.5, d));
        gl_FragColor = vec4(col, a);
      }`,
  });
  const core = new THREE.Mesh(new THREE.CircleGeometry(1.3, 64), coreMat);
  core.position.set(-3.4, 2.5, -29.9);
  scene.add(core);
  sunMats.push(coreMat);
}

// ─── Sun rays
const rayMats = [];
{
  const rayFrag = `
    varying vec2 vUv; uniform float uOp;
    void main() {
      float v = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 1.4);
      float h = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 3.5);
      gl_FragColor = vec4(1.0, 0.92, 0.66, v * h * 0.22 * uOp);
    }`;
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      uniforms: { uOp: { value: 1 } },
      vertexShader: billVert, fragmentShader: rayFrag,
    });
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 13 + Math.random() * 5), mat);
    ray.position.set(-3.4, 2.5, -29.95);
    ray.rotation.z = angle;
    scene.add(ray);
    rayMats.push(mat);
  }
}

// ─── Moon  (upper right, rises as sun sets)
const moonMats = [];
{
  const moonHaloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uOp: { value: 0 } },
    vertexShader: billVert,
    fragmentShader: `
      varying vec2 vUv; uniform float uOp;
      void main() {
        float d = distance(vUv, vec2(0.5));
        float a = pow(1.0 - smoothstep(0.0, 0.5, d), 1.8) * 0.55 * uOp;
        gl_FragColor = vec4(0.58, 0.72, 1.0, a);
      }`,
  });
  const moonHalo = new THREE.Mesh(new THREE.CircleGeometry(6.5, 96), moonHaloMat);
  moonHalo.position.set(4.0, 5.0, -30);
  scene.add(moonHalo);
  moonMats.push(moonHaloMat);

  const moonCoreMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: { uOp: { value: 0 } },
    vertexShader: billVert,
    fragmentShader: `
      varying vec2 vUv; uniform float uOp;
      void main() {
        vec2 p = vUv - 0.5;
        float d = length(p);
        float edge = 1.0 - smoothstep(0.44, 0.50, d);
        float limb = 1.0 - smoothstep(0.0, 0.48, d) * 0.14;
        float nx = sin(p.x * 38.0) * sin(p.y * 31.0) * 0.04;
        vec3 col = vec3(0.94, 0.96, 1.0) * limb + nx;
        gl_FragColor = vec4(col, edge * uOp);
      }`,
  });
  const moonCore = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), moonCoreMat);
  moonCore.position.set(4.0, 5.0, -29.9);
  scene.add(moonCore);
  moonMats.push(moonCoreMat);
}

// ─── Stars
let starMat;
{
  const count = 320;
  const pos   = new Float32Array(count * 3);
  const sz    = new Float32Array(count);
  const ph    = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI * 0.46;
    const r     = 68;
    pos[i*3+0] = r * Math.sin(phi) * Math.cos(theta);
    pos[i*3+1] = r * Math.cos(phi) + 8;
    pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta) - 18;
    sz[i] = 0.5 + Math.random() * 1.6;
    ph[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sz, 1));
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(ph, 1));
  starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, uOp: { value: nightBlend } },
    vertexShader: `
      attribute float aSize; attribute float aPhase;
      uniform float time;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (280.0 / -mv.z);
      }`,
    fragmentShader: `
      uniform float time; uniform float uOp;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * uOp;
        gl_FragColor = vec4(0.86, 0.91, 1.0, a);
      }`,
  });
  scene.add(new THREE.Points(geo, starMat));
}

// ─── Hills
const hillLayers = [];
const D_HILLS = [0x8a9a73, 0x7d8c64, 0x6e8055, 0xc39845, 0xb46a4a];
const N_HILLS = [0x0c1828, 0x091220, 0x070e18, 0x0e0b05, 0x0a0704];
const layerSpecs = [
  { z: -22, height: 3.6, baseY: -0.4, freq: 0.15 },
  { z: -16, height: 3.2, baseY: -0.6, freq: 0.22 },
  { z: -10, height: 2.6, baseY: -0.8, freq: 0.32 },
  { z:  -5, height: 2.2, baseY: -1.1, freq: 0.45 },
  { z:  -1, height: 1.6, baseY: -1.4, freq: 0.7  },
];
layerSpecs.forEach((spec, idx) => {
  const segs = 220;
  const geo  = new THREE.PlaneGeometry(90, spec.height, segs, 1);
  const p    = geo.attributes.position;
  const seed = idx * 9.3 + 11.7;
  for (let i = 0; i <= segs; i++) {
    const n = fbm1(p.getX(i) * spec.freq + seed);
    p.setY(i, spec.height / 2 + (n - 0.5) * spec.height * 0.85);
  }
  geo.computeVertexNormals();
  const mat  = new THREE.MeshStandardMaterial({ color: D_HILLS[idx], roughness: 1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, spec.baseY, spec.z);
  scene.add(mesh);
  hillLayers.push({ mat, day: new THREE.Color(D_HILLS[idx]), night: new THREE.Color(N_HILLS[idx]) });
});

// ─── Clouds
const clouds = [];
{
  const cloudFrag = `
    varying vec2 vUv; uniform float opacity;
    void main(){
      vec2 p = (vUv - 0.5) * 2.0; p.y *= 2.4;
      float a = pow(1.0 - smoothstep(0.0, 0.88, length(p)), 2.2) * opacity;
      gl_FragColor = vec4(1.0, 0.97, 0.88, a);
    }`;
  for (let i = 0; i < 9; i++) {
    const base = 0.36 + Math.random() * 0.22;
    const mat  = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { opacity: { value: base } },
      vertexShader: billVert, fragmentShader: cloudFrag,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5 + Math.random() * 7, 1.6 + Math.random() * 0.8), mat);
    m.position.set((Math.random() - 0.5) * 40, 3.0 + Math.random() * 2.4, -14 - Math.random() * 10);
    m.userData.speed     = 0.03 + Math.random() * 0.05;
    m.userData.bobOffset = Math.random() * Math.PI * 2;
    m.userData.base      = base;
    scene.add(m);
    clouds.push(m);
  }
}

// ─── Pollen particles (become cool wisps at night)
let particleMat, particleVel;
{
  const count = 700;
  const pos   = new Float32Array(count * 3);
  const sz    = new Float32Array(count);
  const ph    = new Float32Array(count);
  particleVel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i*3+0] = (Math.random() - 0.5) * 26;
    pos[i*3+1] = -2 + Math.random() * 6;
    pos[i*3+2] = -2 - Math.random() * 14;
    sz[i]  = 0.04 + Math.random() * 0.08;
    ph[i]  = Math.random() * Math.PI * 2;
    particleVel[i*3+0] = (Math.random() - 0.5) * 0.06;
    particleVel[i*3+1] = 0.04 + Math.random() * 0.07;
    particleVel[i*3+2] = (Math.random() - 0.5) * 0.02;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sz, 1));
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(ph, 1));
  particleMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, uNight: { value: nightBlend } },
    vertexShader: `
      attribute float aSize; attribute float aPhase;
      uniform float time; varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(time * 0.6 + aPhase) * 0.18;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * 360.0 / -mv.z;
        vAlpha = 0.7 + 0.3 * sin(time * 1.2 + aPhase);
      }`,
    fragmentShader: `
      varying float vAlpha; uniform float uNight;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(vec3(1.0, 0.82, 0.46), vec3(0.48, 0.68, 1.0), uNight);
        gl_FragColor = vec4(col, a * vAlpha * mix(0.8, 0.35, uNight));
      }`,
  });
  const pts = new THREE.Points(geo, particleMat);
  scene.add(pts);
}

// ─── Birds
const birds = [];
{
  for (let i = 0; i < 7; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-0.12, 0.06, 0,  0, 0, 0,  0.12, 0.06, 0]), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x4a4b44, transparent: true, opacity: 0.55 });
    const b   = new THREE.Line(g, mat);
    b.position.set(-10 - i * 3.5, 2.6 + Math.random() * 2.2, -7 - Math.random() * 9);
    b.scale.setScalar(0.7 + Math.random() * 0.7);
    b.userData.speed = 0.55 + Math.random() * 0.55;
    b.userData.flap  = Math.random() * Math.PI * 2;
    scene.add(b);
    birds.push(b);
  }
}

// ─── Mouse parallax
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('mousemove', e => {
  mouse.tx = (e.clientX / window.innerWidth  - 0.5) * 2;
  mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
});
window.addEventListener('deviceorientation', e => {
  if (e.gamma == null) return;
  mouse.tx = Math.max(-1, Math.min(1, e.gamma / 30));
  mouse.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
});

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  const t  = clock.elapsedTime;

  // ── Smooth night blend — poll every frame so it catches the initial theme set by theme.js
  targetNight = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
  nightBlend += (targetNight - nightBlend) * Math.min(1, dt * 3.0);
  if (Math.abs(nightBlend - targetNight) < 0.001) nightBlend = targetNight;

  const nb = nightBlend;

  // ── Sky
  skyMat.uniforms.uNight.value = nb;

  // ── Lights
  hemiLight.color.copy(D_HEMI_SKY).lerp(N_HEMI_SKY, nb);
  hemiLight.groundColor.copy(D_HEMI_GND).lerp(N_HEMI_GND, nb);
  hemiLight.intensity = 0.95 - nb * 0.58;
  dirLight.color.copy(D_DIR).lerp(N_DIR, nb);
  dirLight.intensity = 0.70 - nb * 0.48;
  // sun direction → moon direction
  dirLight.position.set(-4 + nb * 8, 6 + nb * 2, 3 - nb * 1);

  // ── Fog
  scene.fog.color.copy(D_FOG).lerp(N_FOG, nb);
  scene.fog.near = 14 - nb * 4;
  scene.fog.far  = 65 - nb * 22;

  // ── Sun fades first half, moon appears second half
  const sunOp  = Math.max(0, 1 - nb * 2.5);
  const moonOp = Math.max(0, (nb - 0.25) / 0.75);
  sunMats.forEach(m => { m.uniforms.uOp.value = sunOp; });
  rayMats.forEach(m => { m.uniforms.uOp.value = sunOp; });
  moonMats.forEach(m => { m.uniforms.uOp.value = moonOp; });

  // ── Stars appear after moon
  starMat.uniforms.uOp.value  = Math.max(0, (nb - 0.45) / 0.55);
  starMat.uniforms.time.value = t;

  // ── Hills
  hillLayers.forEach(h => { h.mat.color.copy(h.day).lerp(h.night, nb); });

  // ── Clouds fade at night
  clouds.forEach(c => {
    c.material.uniforms.opacity.value = c.userData.base * (1 - nb * 0.9);
    c.position.x += c.userData.speed * dt;
    c.position.y += Math.sin(t * 0.4 + c.userData.bobOffset) * 0.0006;
    if (c.position.x > 22) c.position.x = -22;
  });

  // ── Birds fade at night
  birds.forEach(b => {
    b.material.opacity = 0.55 * (1 - nb);
    b.position.x += b.userData.speed * dt;
    b.position.y += Math.sin(t * 4 + b.userData.flap) * 0.005;
    if (b.position.x > 14) {
      b.position.x = -14;
      b.position.y = 2.4 + Math.random() * 1.6;
      b.position.z = -8  - Math.random() * 6;
    }
  });

  // ── Particles
  particleMat.uniforms.time.value   = t;
  particleMat.uniforms.uNight.value = nb;
  {
    const pa  = particles_geo_ref.array;
    for (let i = 0; i < pa.length / 3; i++) {
      pa[i*3+0] += particleVel[i*3+0] * dt * 6;
      pa[i*3+1] += particleVel[i*3+1] * dt * 6;
      pa[i*3+2] += particleVel[i*3+2] * dt * 6;
      if (pa[i*3+1] > 6) {
        pa[i*3+0] = (Math.random() - 0.5) * 26;
        pa[i*3+1] = -2;
        pa[i*3+2] = -2 - Math.random() * 14;
      }
      if (pa[i*3+0] >  14) pa[i*3+0] = -14;
      if (pa[i*3+0] < -14) pa[i*3+0] =  14;
    }
    particles_geo_ref.needsUpdate = true;
  }

  // ── Camera
  mouse.x += (mouse.tx - mouse.x) * 0.04;
  mouse.y += (mouse.ty - mouse.y) * 0.04;
  camera.position.x = mouse.x * 0.6 + Math.sin(t * 0.12) * 0.15;
  camera.position.y = 1.4 - mouse.y * 0.25 + Math.cos(t * 0.18) * 0.06;
  camera.lookAt(0, 1.6 + mouse.y * 0.05, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// expose particle position array for the animate loop
const particles_geo_ref = (() => {
  // find the Points object we added
  let ref;
  scene.traverse(o => { if (o.isPoints && o.material === particleMat) ref = o.geometry.attributes.position; });
  return ref;
})();

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
