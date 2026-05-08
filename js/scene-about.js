// Stillpoint — about scene: a slowly rotating low-poly mountain
// Calm, sculptural. Sage green peak, golden light, soft shadow.

import * as THREE from 'three';

const stage = document.getElementById('aboutArt');
if (!stage) throw new Error('No #aboutArt');

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
camera.position.set(0, 1.4, 5.6);
camera.lookAt(0, 0.4, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const resize = () => {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
};
stage.appendChild(renderer.domElement);
resize();

// gradient sky
const skyGeo = new THREE.SphereGeometry(40, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `
    varying vec3 vW;
    void main(){
      float h = normalize(vW).y;
      vec3 top = vec3(0.97, 0.94, 0.86);
      vec3 mid = vec3(0.95, 0.83, 0.62);
      vec3 col = mix(mid, top, smoothstep(-0.1, 0.6, h));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

scene.add(new THREE.HemisphereLight(0xfff5dc, 0xb8a974, 0.7));
const sun = new THREE.DirectionalLight(0xffe6b3, 0.9);
sun.position.set(-3, 4, 3);
scene.add(sun);

// Mountain — low-poly cone displaced by noise
function buildMountain() {
  const radius = 1.7;
  const height = 2.4;
  const seg = 16;
  const geo = new THREE.ConeGeometry(radius, height, seg, 4, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y > -height/2 + 0.05) {
      const ang = Math.atan2(v.z, v.x);
      const off = Math.sin(ang * 5) * 0.12 + Math.cos(ang * 9 + v.y * 2) * 0.08;
      v.x *= 1 + off * (v.y / height + 0.5) * 0.6;
      v.z *= 1 + off * (v.y / height + 0.5) * 0.6;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a9a73, roughness: 1, flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.2;
  return mesh;
}

const mountain = buildMountain();
scene.add(mountain);

// Snow cap (small lighter cone on top)
const cap = new THREE.Mesh(
  new THREE.ConeGeometry(0.55, 0.8, 16, 1, false),
  new THREE.MeshStandardMaterial({ color: 0xf3eedf, roughness: 0.9, flatShading: true })
);
cap.position.y = 0.7;
scene.add(cap);

// Ground disc with soft shadow look
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(4, 48),
  new THREE.MeshStandardMaterial({ color: 0xc39845, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.4;
scene.add(ground);

// A few small foreground rocks
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

// Drifting motes around the mountain
const count = 220;
const mp = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 1.6 + Math.random() * 1.8;
  mp[i*3]   = Math.cos(a) * r;
  mp[i*3+1] = -1 + Math.random() * 3;
  mp[i*3+2] = Math.sin(a) * r;
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
      p.x += sin(time*0.3 + p.y*1.2) * 0.04;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp(8.0 / -mv.z, 1.0, 4.0);
    }`,
  fragmentShader: `
    void main(){
      float a = smoothstep(0.5, 0.0, length(gl_PointCoord-0.5));
      gl_FragColor = vec4(1.0, 0.92, 0.7, a * 0.7);
    }`,
});
const motes = new THREE.Points(mGeo, moteMat);
scene.add(motes);

const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();
  mountain.rotation.y = t * 0.08;
  cap.rotation.y = t * 0.08;
  motes.rotation.y = t * -0.04;
  moteMat.uniforms.time.value = t;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', resize);
