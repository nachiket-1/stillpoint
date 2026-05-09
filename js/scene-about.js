// Stillpoint — about scene — cinematic overhaul
// ACESFilmic tone mapping, mild bloom, vignette.
// Slowly rotating low-poly mountain, sage green peak, golden light.

import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }      from 'three/addons/postprocessing/ShaderPass.js';

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
renderer.toneMappingExposure = 1.05;

const resize = () => {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height);
  composer.setSize(r.width, r.height);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
};
stage.appendChild(renderer.domElement);

// ─── Sky gradient
const skyGeo = new THREE.SphereGeometry(40, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `
    varying vec3 vW;
    void main(){
      float h   = normalize(vW).y;
      vec3 zenith  = vec3(0.82, 0.88, 0.94);
      vec3 mid     = vec3(0.94, 0.86, 0.72);
      vec3 horizon = vec3(0.97, 0.80, 0.55);
      vec3 c = mix(horizon, mid, smoothstep(-0.1, 0.35, h));
      c = mix(c, zenith, smoothstep(0.25, 0.75, h));
      gl_FragColor = vec4(c, 1.0);
    }`,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

scene.add(new THREE.HemisphereLight(0xfff5dc, 0xb8a974, 0.75));
const sunLight = new THREE.DirectionalLight(0xffe8b4, 1.1);
sunLight.position.set(-3, 4, 3);
scene.add(sunLight);

// ─── Small sun disc on about page (subtle)
{
  const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const halo = new THREE.Mesh(new THREE.CircleGeometry(3.0, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = pow(1.0-smoothstep(0.0,0.5,d), 1.5) * 0.45;
        gl_FragColor = vec4(1.0, 0.84, 0.54, a);
      }`,
  }));
  halo.position.set(-3.5, 3.2, -18);
  halo.renderOrder = 2;
  scene.add(halo);

  const core = new THREE.Mesh(new THREE.CircleGeometry(0.8, 40), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = 1.0-smoothstep(0.38,0.5,d);
        vec3 col = mix(vec3(1.0,0.96,0.88), vec3(1.0,0.82,0.46), d*2.0);
        gl_FragColor = vec4(col*2.2, a);
      }`,
  }));
  core.position.set(-3.5, 3.2, -17.8);
  core.renderOrder = 3;
  scene.add(core);
}

// ─── Mountain — low-poly cone with noise displacement
function buildMountain() {
  const geo = new THREE.ConeGeometry(1.7, 2.4, 16, 4, false);
  const pos = geo.attributes.position;
  const v   = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y > -2.4/2 + 0.05) {
      const ang = Math.atan2(v.z, v.x);
      const off = Math.sin(ang*5)*0.12 + Math.cos(ang*9+v.y*2)*0.08;
      v.x *= 1 + off*(v.y/2.4+0.5)*0.6;
      v.z *= 1 + off*(v.y/2.4+0.5)*0.6;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x8a9a73, roughness: 1, flatShading: true,
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

// Golden ground
scene.add(Object.assign(new THREE.Mesh(
  new THREE.CircleGeometry(4, 48),
  new THREE.MeshStandardMaterial({ color: 0xc49a44, roughness: 1 })
), { rotation: new THREE.Euler(-Math.PI/2, 0, 0), position: new THREE.Vector3(0, -1.4, 0) }));

// Foreground rocks
for (let i = 0; i < 6; i++) {
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.12+Math.random()*0.15, 0),
    new THREE.MeshStandardMaterial({ color: 0x6e6a55, roughness: 1, flatShading: true })
  );
  const a = (i / 6) * Math.PI * 2;
  rock.position.set(Math.cos(a)*2.4, -1.34, Math.sin(a)*2.4);
  rock.scale.y = 0.6 + Math.random()*0.3;
  scene.add(rock);
}

// Orbiting motes
const count = 220;
const mp    = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  const a = Math.random()*Math.PI*2;
  const r = 1.6 + Math.random()*1.8;
  mp[i*3]   = Math.cos(a)*r;
  mp[i*3+1] = -1 + Math.random()*3;
  mp[i*3+2] = Math.sin(a)*r;
}
const mGeo = new THREE.BufferGeometry();
mGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
const moteMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { time: { value: 0 } },
  vertexShader: `
    uniform float time;
    void main(){
      vec3 p = position; p.x += sin(time*0.3+p.y*1.2)*0.04;
      vec4 mv = modelViewMatrix*vec4(p,1.0);
      gl_Position = projectionMatrix*mv;
      gl_PointSize = clamp(8.0/-mv.z, 1.0, 4.0);
    }`,
  fragmentShader: `
    void main(){
      float a = smoothstep(0.5,0.0,length(gl_PointCoord-0.5));
      gl_FragColor = vec4(1.0,0.92,0.70, a*0.75);
    }`,
});
const motes = new THREE.Points(mGeo, moteMat);
scene.add(motes);

// ─── Post-processing: mild bloom + vignette
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.60, 0.55, 0.30);
composer.addPass(bloomPass);

const vignettePass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    time:     { value: 0 },
  },
  vertexShader:   `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time;
    varying vec2 vUv;
    void main(){
      vec4 col = texture2D(tDiffuse, vUv);
      float d   = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.90, 0.32, d);
      col.rgb  *= vig;
      float n   = fract(sin(dot(vUv+time*0.007, vec2(12.9898,78.233)))*43758.5453)*0.014 - 0.007;
      col.rgb  += n;
      gl_FragColor = col;
    }`,
});
composer.addPass(vignettePass);

// resize must happen after composer is defined
resize();

const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();
  mountain.rotation.y = t * 0.08;
  cap.rotation.y      = t * 0.08;
  motes.rotation.y    = t * -0.04;
  moteMat.uniforms.time.value   = t;
  vignettePass.uniforms.time.value = t;
  composer.render();
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', resize);
