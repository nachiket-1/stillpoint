// Stillpoint — about scene
// Slowly rotating low-poly mountain, sage peak, golden light, orbiting motes.
// ACESFilmic tone mapping — no EffectComposer (keeps it simple and stable).

import * as THREE from 'three';

const stage = document.getElementById('aboutArt');
if (!stage) throw new Error('No #aboutArt');

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
camera.position.set(0, 1.2, 6.2);
camera.lookAt(0, -0.2, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const resize = () => {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
};
stage.appendChild(renderer.domElement);
resize();

// ─── Sky gradient: warm golden horizon → pale blue zenith
{
  const skyGeo = new THREE.SphereGeometry(40, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      varying vec3 vW;
      void main(){
        float h = normalize(vW).y;
        vec3 zenith  = vec3(0.72, 0.82, 0.96);
        vec3 mid     = vec3(0.92, 0.84, 0.70);
        vec3 horizon = vec3(0.97, 0.80, 0.52);
        vec3 c = mix(horizon, mid, smoothstep(-0.1, 0.35, h));
        c = mix(c, zenith, smoothstep(0.25, 0.78, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ─── Lights
scene.add(new THREE.HemisphereLight(0xfff5dc, 0xb8a974, 0.75));
const sunLight = new THREE.DirectionalLight(0xffe8b4, 1.2);
sunLight.position.set(-3, 5, 3);
scene.add(sunLight);

// ─── Mountain — low-poly cone with angular noise displacement
function buildMountain() {
  const geo = new THREE.ConeGeometry(1.7, 2.4, 16, 4, false);
  const pos = geo.attributes.position;
  const v   = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y > -2.4 / 2 + 0.05) {
      const ang = Math.atan2(v.z, v.x);
      const off = Math.sin(ang * 5) * 0.12 + Math.cos(ang * 9 + v.y * 2) * 0.08;
      v.x *= 1 + off * (v.y / 2.4 + 0.5) * 0.6;
      v.z *= 1 + off * (v.y / 2.4 + 0.5) * 0.6;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x8a9a73, roughness: 0.95, flatShading: true,
  }));
  mesh.position.y = -0.2;
  return mesh;
}

const mountain = buildMountain();
scene.add(mountain);

// Snow cap
const cap = new THREE.Mesh(
  new THREE.ConeGeometry(0.55, 0.8, 16, 1, false),
  new THREE.MeshStandardMaterial({ color: 0xf3eedf, roughness: 0.85, flatShading: true })
);
cap.position.y = 0.7;
scene.add(cap);

// Golden ground disc
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(4, 48),
  new THREE.MeshStandardMaterial({ color: 0xc49a44, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.4;
scene.add(ground);

// Small foreground rocks
for (let i = 0; i < 6; i++) {
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.12 + Math.random() * 0.15, 0),
    new THREE.MeshStandardMaterial({ color: 0x6e6a55, roughness: 1, flatShading: true })
  );
  const a = (i / 6) * Math.PI * 2;
  rock.position.set(Math.cos(a) * 2.4, -1.34, Math.sin(a) * 2.4);
  rock.scale.y = 0.6 + Math.random() * 0.3;
  scene.add(rock);
}

// ─── Orbiting motes
const count = 220;
const mp    = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 1.6 + Math.random() * 1.8;
  mp[i * 3]     = Math.cos(a) * r;
  mp[i * 3 + 1] = -1 + Math.random() * 3;
  mp[i * 3 + 2] = Math.sin(a) * r;
}
const mGeo = new THREE.BufferGeometry();
mGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
const moteMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { time: { value: 0 } },
  vertexShader: `
    uniform float time;
    void main(){
      vec3 p = position;
      p.x += sin(time * 0.3 + p.y * 1.2) * 0.04;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(8.0 / -mv.z, 1.0, 4.0);
    }`,
  fragmentShader: `
    void main(){
      float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
      gl_FragColor = vec4(1.0, 0.92, 0.70, a * 0.75);
    }`,
});
const motes = new THREE.Points(mGeo, moteMat);
scene.add(motes);

const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();
  mountain.rotation.y = t * 0.08;
  cap.rotation.y      = t * 0.08;
  motes.rotation.y    = t * -0.04;
  moteMat.uniforms.time.value = t;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', resize);
