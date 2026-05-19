// Stillpoint — hero scene (home)
// Layered procedural Namaqualand-inspired hills, soft sun, drifting clouds,
// pollen particles, gentle parallax. Light, warm, premium.

import * as THREE from 'three';

const stage = document.getElementById('stage');
if (!stage) throw new Error('No #stage element');

const scene = new THREE.Scene();
scene.background = null; // let the cream CSS show through edges

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.4, 6.2);
camera.lookAt(0, 1.6, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

// ─── Lights (warm hemisphere + soft sun)
scene.add(new THREE.HemisphereLight(0xfff5dc, 0xd9c79a, 0.95));
const sun = new THREE.DirectionalLight(0xfff1cc, 0.7);
sun.position.set(-4, 6, 3);
scene.add(sun);

// Atmospheric fog (soft, light haze)
scene.fog = new THREE.Fog(0xf5ede0, 14, 65);

// ─── Pseudo-noise (no deps)
const hash = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
const noise1D = (x) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
};
const fbm1 = (x) =>
  noise1D(x) * 0.6 + noise1D(x * 2.13 + 5.7) * 0.25 + noise1D(x * 4.7 + 17.3) * 0.15;

// ─── Sky gradient (soft light dome — airy, less golden)
{
  const skyGeo = new THREE.SphereGeometry(80, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:    { value: new THREE.Color(0xf8f3ec) }, // pale white-cream
      midColor:    { value: new THREE.Color(0xf4e6cc) }, // very light peach
      bottomColor: { value: new THREE.Color(0xedd8b0) }, // soft warm horizon
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
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        float t = smoothstep(-0.1, 0.55, h);
        vec3 lower = mix(bottomColor, midColor, smoothstep(0.0, 0.45, h + 0.2));
        vec3 col = mix(lower, topColor, t);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ─── Sun: soft halo + crisp core (NormalBlending — no additive bloom/flicker)
{
  const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

  // Outer halo — wide, very soft glow
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.NormalBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float d = distance(vUv, vec2(0.5));
        float a = pow(1.0 - smoothstep(0.0, 0.5, d), 1.8) * 0.50;
        gl_FragColor = vec4(1.0, 0.88, 0.60, a);
      }`,
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(5.4, 96), haloMat);
  halo.position.set(-3.4, 2.5, -30);
  scene.add(halo);

  // Inner core — bright solid disc with feathered edge
  const coreMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.NormalBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float d = distance(vUv, vec2(0.5));
        float a = 1.0 - smoothstep(0.44, 0.5, d);
        vec3 col = mix(vec3(1.0, 0.97, 0.86), vec3(1.0, 0.84, 0.56), smoothstep(0.0, 0.5, d));
        gl_FragColor = vec4(col, a);
      }`,
  });
  const core = new THREE.Mesh(new THREE.CircleGeometry(1.3, 64), coreMat);
  core.position.set(-3.4, 2.5, -29.9);
  scene.add(core);

  scene.userData.sun = null; // no per-frame update needed
}

// ─── Sun rays — soft beams radiating outward (depthTest so mountains occlude lower rays)
{
  const rayVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const rayFrag = `
    varying vec2 vUv;
    void main() {
      float vMask = 1.0 - abs(vUv.y - 0.5) * 2.0;
      vMask = pow(vMask, 1.4);
      float hMask = 1.0 - abs(vUv.x - 0.5) * 2.0;
      hMask = pow(hMask, 3.5);
      float a = vMask * hMask * 0.22;
      gl_FragColor = vec4(1.0, 0.92, 0.66, a);
    }`;
  const rayCount = 7;
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
    const length = 13 + Math.random() * 5;
    const rayMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.NormalBlending,
      vertexShader: rayVert, fragmentShader: rayFrag,
    });
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.65, length), rayMat);
    ray.position.set(-3.4, 2.5, -29.95);
    ray.rotation.z = angle;
    scene.add(ray);
  }
}

// ─── Layered hills
const hillLayers = [];
const layerSpecs = [
  { z: -22, height: 3.6, baseY: -0.4, freq: 0.15, color: 0x8a9a73, swayAmp: 0.0 }, // distant sage
  { z: -16, height: 3.2, baseY: -0.6, freq: 0.22, color: 0x7d8c64, swayAmp: 0.0 }, // mid sage
  { z: -10, height: 2.6, baseY: -0.8, freq: 0.32, color: 0x6e8055, swayAmp: 0.0 }, // foreground sage
  { z:  -5, height: 2.2, baseY: -1.1, freq: 0.45, color: 0xc39845, swayAmp: 0.0 }, // ochre meadow
  { z:  -1, height: 1.6, baseY: -1.4, freq: 0.7,  color: 0xb46a4a, swayAmp: 0.0 }, // terracotta foreground
];

function buildHill(spec, idx) {
  const width = 90;
  const segments = 220;
  const geo = new THREE.PlaneGeometry(width, spec.height, segments, 1);

  const pos = geo.attributes.position;
  const seed = idx * 9.3 + 11.7;
  for (let i = 0; i <= segments; i++) {
    const x = pos.getX(i);
    // sample top edge only (i for top row, i + segments+1 for bottom)
    const n = fbm1(x * spec.freq + seed);
    const yOffset = (n - 0.5) * spec.height * 0.85;
    pos.setY(i, spec.height / 2 + yOffset);
  }
  // bottom row stays at -height/2 (anchored)
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: 1.0,
    metalness: 0.0,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, spec.baseY, spec.z);
  scene.add(mesh);
  hillLayers.push({ mesh, spec });
}
layerSpecs.forEach(buildHill);

// ─── Drifting cloud wisps (soft radial shader, no hard rectangle edges)
const clouds = [];
{
  const cloudGroup = new THREE.Group();
  const cloudVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const cloudFrag = `
    varying vec2 vUv;
    uniform float opacity;
    void main(){
      vec2 p = (vUv - 0.5) * 2.0;
      p.y *= 2.4;
      float r = length(p);
      float a = pow(1.0 - smoothstep(0.0, 0.88, r), 2.2) * opacity;
      gl_FragColor = vec4(1.0, 0.97, 0.88, a);
    }`;

  for (let i = 0; i < 9; i++) {
    const w = 5 + Math.random() * 7;
    const h = 1.6 + Math.random() * 0.8;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { opacity: { value: 0.36 + Math.random() * 0.22 } },
      vertexShader: cloudVert, fragmentShader: cloudFrag,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(
      (Math.random() - 0.5) * 40,
      3.0 + Math.random() * 2.4,
      -14 - Math.random() * 10
    );
    m.userData.speed = 0.03 + Math.random() * 0.05;
    m.userData.bobOffset = Math.random() * Math.PI * 2;
    cloudGroup.add(m);
    clouds.push(m);
  }
  scene.add(cloudGroup);
}

// ─── Pollen / wildflower particles
let particles, particleVel;
{
  const count = 700;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  particleVel = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 26;
    positions[i * 3 + 1] = -2 + Math.random() * 6;
    positions[i * 3 + 2] = -2 - Math.random() * 14;
    sizes[i] = 0.04 + Math.random() * 0.08;
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
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      uniform float time;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(time * 0.6 + aPhase) * 0.18;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * 360.0 / -mv.z;
        vAlpha = 0.7 + 0.3 * sin(time * 1.2 + aPhase);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        // warm pollen color
        gl_FragColor = vec4(1.0, 0.82, 0.46, a * vAlpha * 0.8);
      }
    `,
  });

  particles = new THREE.Points(geo, mat);
  particles.userData.mat = mat;
  scene.add(particles);
}

// ─── Birds (simple V-shapes that sweep across)
const birds = [];
{
  function makeBird() {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([
      -0.12, 0.06, 0,
       0.0,  0.0, 0,
       0.12, 0.06, 0,
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    const m = new THREE.LineBasicMaterial({
      color: 0x4a4b44, transparent: true, opacity: 0.55,
    });
    return new THREE.Line(g, m);
  }
  for (let i = 0; i < 7; i++) {
    const b = makeBird();
    b.position.set(
      -10 - i * 3.5,
      2.6 + Math.random() * 2.2,
      -7 - Math.random() * 9
    );
    const s = 0.7 + Math.random() * 0.7; // varied bird sizes
    b.scale.setScalar(s);
    b.userData.speed = 0.55 + Math.random() * 0.55;
    b.userData.flap = Math.random() * Math.PI * 2;
    scene.add(b);
    birds.push(b);
  }
}

// ─── Mouse parallax + animation
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('mousemove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
});
window.addEventListener('deviceorientation', (e) => {
  if (e.gamma == null) return;
  mouse.tx = Math.max(-1, Math.min(1, e.gamma / 30));
  mouse.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
});

const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();
  const dt = Math.min(0.05, clock.getDelta());

  // ease mouse
  mouse.x += (mouse.tx - mouse.x) * 0.04;
  mouse.y += (mouse.ty - mouse.y) * 0.04;

  // gentle camera drift + parallax
  camera.position.x = mouse.x * 0.6 + Math.sin(t * 0.12) * 0.15;
  camera.position.y = 1.4 - mouse.y * 0.25 + Math.cos(t * 0.18) * 0.06;
  camera.lookAt(0, 1.6 + mouse.y * 0.05, 0);

  // particles drift
  if (particles) {
    particles.userData.mat.uniforms.time.value = t;
    const pos = particles.geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3 + 0] += particleVel[i * 3 + 0] * dt * 6;
      arr[i * 3 + 1] += particleVel[i * 3 + 1] * dt * 6;
      arr[i * 3 + 2] += particleVel[i * 3 + 2] * dt * 6;
      // wrap upward
      if (arr[i * 3 + 1] > 6) {
        arr[i * 3 + 0] = (Math.random() - 0.5) * 26;
        arr[i * 3 + 1] = -2;
        arr[i * 3 + 2] = -2 - Math.random() * 14;
      }
      if (arr[i * 3 + 0] > 14) arr[i * 3 + 0] = -14;
      if (arr[i * 3 + 0] < -14) arr[i * 3 + 0] = 14;
    }
    pos.needsUpdate = true;
  }

  // clouds drift
  clouds.forEach((c) => {
    c.position.x += c.userData.speed * dt;
    c.position.y += Math.sin(t * 0.4 + c.userData.bobOffset) * 0.0006;
    if (c.position.x > 22) c.position.x = -22;
  });

  // birds sweep
  birds.forEach((b, i) => {
    b.position.x += b.userData.speed * dt;
    b.position.y += Math.sin(t * 4 + b.userData.flap) * 0.005;
    if (b.position.x > 14) {
      b.position.x = -14;
      b.position.y = 2.4 + Math.random() * 1.6;
      b.position.z = -8 - Math.random() * 6;
    }
  });

  renderer.render(scene, camera);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(animate);
}
animate();

// ─── Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
