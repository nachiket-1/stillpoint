// Stillpoint — focus background scene
// Soft pastoral horizon: gradient sky, low rolling sage hill, drifting motes.
// Intentionally calm so the timer reads first.

import * as THREE from 'three';

const stage = document.getElementById('focusStage');
if (!stage) throw new Error('No #focusStage element');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.2, 6);
camera.lookAt(0, 1.4, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xfff5dc, 0xd9c79a, 1.0));
scene.fog = new THREE.Fog(0xefe6d2, 10, 50);

// Soft sky dome
{
  const skyGeo = new THREE.SphereGeometry(80, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      varying vec3 vW;
      void main(){
        float h = normalize(vW).y;
        vec3 top = vec3(0.96, 0.93, 0.85);
        vec3 mid = vec3(0.95, 0.86, 0.68);
        vec3 low = vec3(0.92, 0.78, 0.56);
        vec3 c = mix(low, mid, smoothstep(-0.1, 0.4, h));
        c = mix(c, top, smoothstep(0.3, 0.8, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// Hash noise (same as hero)
const hash = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
const noise1D = (x) => { const i = Math.floor(x), f = x - i, u = f*f*(3-2*f); return hash(i)*(1-u) + hash(i+1)*u; };
const fbm1 = (x) => noise1D(x)*0.6 + noise1D(x*2.13+5.7)*0.25 + noise1D(x*4.7+17.3)*0.15;

// Gentle hills (3 layers)
function hill(spec, idx) {
  const w = 90;
  const seg = 200;
  const g = new THREE.PlaneGeometry(w, spec.h, seg, 1);
  const p = g.attributes.position;
  for (let i = 0; i <= seg; i++) {
    const x = p.getX(i);
    const n = fbm1(x * spec.f + idx * 7.7);
    p.setY(i, spec.h / 2 + (n - 0.5) * spec.h * 0.7);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: spec.c, roughness: 1 }));
  m.position.set(0, spec.y, spec.z);
  scene.add(m);
}
hill({ z: -18, h: 3.0, y: -0.6, f: 0.16, c: 0x9aac82 }, 0);
hill({ z: -10, h: 2.4, y: -0.9, f: 0.28, c: 0x7c8e64 }, 1);
hill({ z:  -3, h: 1.9, y: -1.3, f: 0.5,  c: 0xc39845 }, 2);

// Particles (soft motes)
let particles, vel;
{
  const count = 380;
  const pos = new Float32Array(count * 3);
  vel = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 28;
    pos[i*3+1] = -1 + Math.random() * 6;
    pos[i*3+2] = -1 - Math.random() * 14;
    vel[i*3]   = (Math.random() - 0.5) * 0.05;
    vel[i*3+1] = 0.03 + Math.random() * 0.05;
    vel[i*3+2] = 0;
    phase[i] = Math.random() * 6.28;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `attribute float aPhase; uniform float time; varying float vA;
      void main(){ vec3 p = position; p.x += sin(time*0.5+aPhase)*0.2;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = 1.4 * 240.0 / -mv.z;
        vA = 0.5 + 0.5*sin(time*1.1+aPhase); }`,
    fragmentShader: `varying float vA;
      void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord-0.5));
        gl_FragColor = vec4(1.0, 0.82, 0.46, a*vA*0.32); }`,
  });
  particles = new THREE.Points(g, m);
  particles.userData.mat = m;
  scene.add(particles);
}

const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();
  const dt = Math.min(0.05, clock.getDelta());
  if (particles) {
    particles.userData.mat.uniforms.time.value = t;
    const arr = particles.geometry.attributes.position.array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i*3]   += vel[i*3] * dt * 6;
      arr[i*3+1] += vel[i*3+1] * dt * 6;
      if (arr[i*3+1] > 6) {
        arr[i*3]   = (Math.random() - 0.5) * 28;
        arr[i*3+1] = -1;
        arr[i*3+2] = -1 - Math.random() * 14;
      }
    }
    particles.geometry.attributes.position.needsUpdate = true;
  }
  camera.position.x = Math.sin(t * 0.08) * 0.18;
  camera.position.y = 1.2 + Math.cos(t * 0.12) * 0.05;
  camera.lookAt(0, 1.5, 0);
  renderer.render(scene, camera);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
