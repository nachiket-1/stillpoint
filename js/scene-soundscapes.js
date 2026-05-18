// Stillpoint — soundscapes mini-scenes (one per card)
import * as THREE from 'three';

const builders = {
  dawn:      buildDawn,
  fireplace: buildFireplace,
  ocean:     buildOcean,
  forest:    buildForest,
  rain:      buildRain,
  stream:    buildStream,
};

document.querySelectorAll('.scape').forEach((card) => {
  const key = card.dataset.key;
  const canvas = card.querySelector('canvas');
  if (!canvas || !builders[key]) return;
  initScene(canvas, builders[key]);
});

// ─── shared init
function initScene(canvas, build) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
  };
  resize();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0.6, 4);
  camera.lookAt(0, 0.4, 0);

  const ctx = build(scene, camera);

  const clock = new THREE.Clock();
  let raf;
  function loop() {
    const t = clock.getElapsedTime();
    const dt = Math.min(0.05, clock.getDelta());
    if (ctx.update) ctx.update(t, dt);
    const r = canvas.getBoundingClientRect();
    if (renderer.domElement.width !== Math.floor(r.width * renderer.getPixelRatio())) resize();
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(loop);
    else raf = null;
  }
  loop();

  // Pause when offscreen for perf
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) {
        cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf && !reducedMotion.matches) {
        loop();
      }
    });
  }, { threshold: 0.05 });
  io.observe(canvas);

  window.addEventListener('resize', resize);
}

// ─────────────────────────────────────────────────────────────
// DAWN — rose/amber sky, silhouetted trees, drifting birds, morning mist
function buildDawn(scene, camera) {
  // Sky — amber/rose at horizon fading to soft steel-blue at top
  const skyGeo = new THREE.SphereGeometry(50, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      varying vec3 vW;
      void main(){
        float h = normalize(vW).y;
        vec3 glow = vec3(1.0,  0.60, 0.28);
        vec3 rose = vec3(0.96, 0.74, 0.62);
        vec3 blue = vec3(0.58, 0.68, 0.84);
        vec3 c = mix(glow, rose, smoothstep(0.0, 0.38, h));
        c = mix(c, blue, smoothstep(0.22, 0.90, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  scene.add(new THREE.HemisphereLight(0xffd0a0, 0x3c4430, 0.65));
  const sunLight = new THREE.DirectionalLight(0xffbb77, 0.7);
  sunLight.position.set(-4, 1, -6);
  scene.add(sunLight);

  // Rising sun soft halo at the horizon
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.NormalBlending,
    uniforms: {},
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = pow(1.0 - smoothstep(0.0, 0.5, d), 1.6) * 0.55;
        gl_FragColor = vec4(1.0, 0.68, 0.32, a);
      }`,
  });
  const sunHalo = new THREE.Mesh(new THREE.CircleGeometry(3.4, 64), haloMat);
  sunHalo.position.set(-5.2, -0.5, -12);
  scene.add(sunHalo);

  // Silhouetted tree line
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x0e1210, roughness: 1 });
  for (let i = 0; i < 24; i++) {
    const h = 1.0 + Math.random() * 1.6;
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.14 + Math.random() * 0.11, h, 5), treeMat);
    tree.position.set((Math.random() - 0.5) * 22, -1.0 + h * 0.5, -4 - Math.random() * 5);
    scene.add(tree);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.3, 5), treeMat);
    trunk.position.set(tree.position.x, -1.0 + 0.15, tree.position.z);
    scene.add(trunk);
  }

  // Dark meadow ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 8),
    new THREE.MeshStandardMaterial({ color: 0x222918, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.0;
  scene.add(ground);

  // Birds — small V-shapes drifting left to right
  const birds = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-0.09, 0.045, 0,  0, 0, 0,  0.09, 0.045, 0]), 3
    ));
    const b = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x0e1210, transparent: true, opacity: 0.65 }));
    b.position.set(-10 + Math.random() * 5, 0.5 + Math.random() * 1.4, -3 - Math.random() * 5);
    b.scale.setScalar(0.5 + Math.random() * 0.5);
    b.userData.speed = 0.5 + Math.random() * 0.55;
    scene.add(b);
    birds.push(b);
  }

  // Morning mist — soft warm particles floating low
  const count = 130;
  const mp = new Float32Array(count * 3);
  const ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    mp[i*3]   = (Math.random() - 0.5) * 14;
    mp[i*3+1] = -0.7 + Math.random() * 1.0;
    mp[i*3+2] = -1   - Math.random() * 7;
    ph[i] = Math.random() * 6.28;
  }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  mistGeo.setAttribute('aPhase',   new THREE.BufferAttribute(ph, 1));
  const mistMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float aPhase; uniform float time; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(time*0.25 + aPhase) * 0.35;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = clamp(220.0 / -mv.z, 4.0, 14.0);
        vA = 0.25 + 0.15*sin(time*0.4 + aPhase);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord-0.5));
        gl_FragColor = vec4(1.0, 0.88, 0.76, a*vA);
      }`,
  });
  const mist = new THREE.Points(mistGeo, mistMat);
  scene.add(mist);

  camera.position.set(0, 0.3, 3.8);
  camera.lookAt(0, 0.0, -3);

  return {
    update(t, dt) {
      mistMat.uniforms.time.value = t;
      birds.forEach((b) => {
        b.position.x += b.userData.speed * dt;
        if (b.position.x > 11) {
          b.position.x = -11;
          b.position.y = 0.5 + Math.random() * 1.4;
        }
      });
      camera.position.x = Math.sin(t * 0.1) * 0.12;
    }
  };
}

// ─────────────────────────────────────────────────────────────
// FIREPLACE — warm cabin glow, embers
function buildFireplace(scene, camera) {
  scene.background = new THREE.Color(0x2a1a14);
  scene.fog = new THREE.Fog(0x2a1a14, 4, 12);
  scene.add(new THREE.HemisphereLight(0xffb37a, 0x2a1410, 0.6));

  const flame = new THREE.PointLight(0xffaa55, 1.4, 6, 1.6);
  flame.position.set(0, 0.2, 0);
  scene.add(flame);

  // Logs (simple cylinders)
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2419, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 12), logMat);
    log.position.set(-0.4 + i * 0.25, -0.3, 0);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (Math.random() - 0.5) * 0.3;
    scene.add(log);
  }

  // Glowing core (soft, not blown out)
  const coreGeo = new THREE.SphereGeometry(0.22, 24, 24);
  const coreMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix*vec4(position,1.0);
        vV = -normalize(mv.xyz);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `
      uniform float time; varying vec3 vN; varying vec3 vV;
      void main(){
        float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.0);
        float p = 0.7 + 0.3 * sin(time * 4.0);
        vec3 hot = mix(vec3(1.0,0.55,0.18), vec3(1.0,0.78,0.34), p);
        vec3 c = mix(hot, vec3(1.0,0.45,0.12), fres);
        gl_FragColor = vec4(c, 0.95);
      }`,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.set(0, -0.05, 0);
  scene.add(core);

  // Embers
  const count = 90;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const vy = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i*3] = (Math.random() - 0.5) * 1.0;
    positions[i*3+1] = -0.3 + Math.random() * 0.4;
    positions[i*3+2] = (Math.random() - 0.5) * 0.6;
    phases[i] = Math.random() * 6.28;
    vy[i] = 0.35 + Math.random() * 0.5;
  }
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  eGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const eMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float aPhase; uniform float time; varying float vL;
      void main(){
        vec3 p = position;
        p.x += sin(time*1.3+aPhase)*0.06;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = 2.4 * 180.0 / -mv.z;
        vL = clamp((1.0 - p.y) * 1.0, 0.0, 1.0);
      }`,
    fragmentShader: `
      varying float vL;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(c));
        vec3 col = mix(vec3(1.0,0.55,0.18), vec3(1.0,0.78,0.4), vL);
        gl_FragColor = vec4(col, a * 0.55);
      }`,
  });
  const embers = new THREE.Points(eGeo, eMat);
  scene.add(embers);

  return {
    update(t, dt) {
      coreMat.uniforms.time.value = t;
      eMat.uniforms.time.value = t;
      flame.intensity = 1.2 + Math.sin(t * 5) * 0.35 + Math.sin(t * 13) * 0.12;

      const arr = embers.geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i*3+1] += vy[i] * dt;
        if (arr[i*3+1] > 1.6) {
          arr[i*3+1] = -0.3;
          arr[i*3] = (Math.random() - 0.5) * 1.0;
          arr[i*3+2] = (Math.random() - 0.5) * 0.6;
        }
      }
      embers.geometry.attributes.position.needsUpdate = true;

      camera.position.x = Math.sin(t * 0.2) * 0.15;
    }
  };
}

// ─────────────────────────────────────────────────────────────
// OCEAN — warm dusk, animated wave plane, low sun
function buildOcean(scene, camera) {
  // gradient sky
  const skyGeo = new THREE.SphereGeometry(50, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `varying vec3 vW; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      varying vec3 vW;
      void main(){
        float h = normalize(vW).y;
        vec3 top = vec3(0.94, 0.78, 0.62);
        vec3 mid = vec3(0.96, 0.68, 0.45);
        vec3 low = vec3(0.55, 0.55, 0.78);
        vec3 c = mix(low, mid, smoothstep(-0.1, 0.3, h));
        c = mix(c, top, smoothstep(0.2, 0.8, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  scene.add(new THREE.HemisphereLight(0xffe6c7, 0x405d8a, 0.8));

  // Sun
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 48),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {},
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv;
        void main(){ float d = distance(vUv, vec2(0.5));
          float core = smoothstep(0.4, 0.0, d);
          float glow = smoothstep(0.5, 0.2, d) * 0.6;
          gl_FragColor = vec4(mix(vec3(1.0,0.85,0.55), vec3(1.0,0.65,0.35), 1.0-core), core+glow);
        }`,
    })
  );
  sun.position.set(0, 0.05, -8);
  scene.add(sun);

  // Wave plane with shader
  const waveGeo = new THREE.PlaneGeometry(20, 16, 80, 60);
  waveGeo.rotateX(-Math.PI / 2);
  const waveMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      uniform float time; varying float vH; varying vec3 vP;
      void main(){
        vec3 p = position;
        float w = sin(p.x*0.6 + time*0.8) * 0.08
                + sin(p.z*0.9 + time*1.1) * 0.06
                + sin((p.x+p.z)*0.4 + time*0.5) * 0.05;
        p.y += w; vH = w; vP = p;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader: `
      varying float vH; varying vec3 vP;
      void main(){
        vec3 deep = vec3(0.16, 0.27, 0.44);
        vec3 shallow = vec3(0.55, 0.6, 0.75);
        float d = clamp(vP.z * -0.05 + 0.5, 0.0, 1.0);
        vec3 col = mix(deep, shallow, d);
        col += vec3(0.5, 0.35, 0.18) * smoothstep(0.0, 0.12, vH); // crests
        // sun reflection band
        float band = smoothstep(0.8, 0.0, abs(vP.x));
        col += band * vec3(0.6, 0.4, 0.2) * smoothstep(-3.0, -8.0, vP.z);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const water = new THREE.Mesh(waveGeo, waveMat);
  water.position.y = -0.4;
  scene.add(water);

  camera.position.set(0, 0.4, 3.8);
  camera.lookAt(0, 0.1, -2);

  return {
    update(t) {
      waveMat.uniforms.time.value = t;
      camera.position.x = Math.sin(t * 0.15) * 0.2;
      camera.position.y = 0.4 + Math.sin(t * 0.25) * 0.04;
      camera.lookAt(0, 0.1, -2);
    }
  };
}

// ─────────────────────────────────────────────────────────────
// FOREST — night, silhouetted trees, fireflies
function buildForest(scene, camera) {
  scene.background = new THREE.Color(0x0a1a16);
  scene.fog = new THREE.Fog(0x0a1a16, 3, 12);

  scene.add(new THREE.HemisphereLight(0x4a6a78, 0x040a08, 0.45));
  const moon = new THREE.DirectionalLight(0xb8d8ff, 0.5);
  moon.position.set(2, 4, 1);
  scene.add(moon);

  // Moon disc
  const moonMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 32),
    new THREE.MeshBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 0.92 })
  );
  moonMesh.position.set(2.2, 1.6, -6);
  scene.add(moonMesh);

  // Tree trunks (boxes/cylinders silhouetted)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x101814, roughness: 1 });
  for (let i = 0; i < 18; i++) {
    const h = 2.5 + Math.random() * 2.5;
    const r = 0.06 + Math.random() * 0.1;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, h, 6), trunkMat);
    trunk.position.set((Math.random() - 0.5) * 12, -0.4 + h / 2, -2 - Math.random() * 6);
    trunk.rotation.y = Math.random() * Math.PI;
    scene.add(trunk);

    // sparse canopy ball
    const canopy = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.4, 0),
      new THREE.MeshStandardMaterial({ color: 0x1c2c22, roughness: 1, flatShading: true })
    );
    canopy.position.set(trunk.position.x, trunk.position.y + h / 2 + 0.2, trunk.position.z);
    canopy.scale.setScalar(0.8 + Math.random() * 0.6);
    scene.add(canopy);
  }

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x081814, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.4;
  scene.add(ground);

  // Fireflies
  const count = 60;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i*3]   = (Math.random() - 0.5) * 8;
    positions[i*3+1] = 0.2 + Math.random() * 1.6;
    positions[i*3+2] = -1 - Math.random() * 6;
    phases[i] = Math.random() * 6.28;
    speeds[i] = 0.4 + Math.random() * 0.8;
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  fGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const fMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float aPhase; uniform float time; varying float vF;
      void main(){
        vec3 p = position;
        p.x += sin(time*0.6+aPhase)*0.4;
        p.y += sin(time*0.4+aPhase*1.7)*0.2;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = 1.6 * 180.0 / -mv.z;
        vF = 0.4 + 0.6*sin(time*2.5+aPhase*3.1);
      }`,
    fragmentShader: `
      varying float vF;
      void main(){
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord-0.5));
        gl_FragColor = vec4(0.95, 1.0, 0.55, a * vF * 0.7);
      }`,
  });
  const flies = new THREE.Points(fGeo, fMat);
  scene.add(flies);

  camera.position.set(0, 0.3, 3.6);
  camera.lookAt(0, 0.5, -3);

  return {
    update(t) {
      fMat.uniforms.time.value = t;
      camera.position.x = Math.sin(t * 0.18) * 0.2;
    }
  };
}

// ─────────────────────────────────────────────────────────────
// STREAM — looking down at a clear brook flowing left-to-right
function buildStream(scene, camera) {
  scene.add(new THREE.HemisphereLight(0xd4eec0, 0x2c3a18, 0.75));
  const sun = new THREE.DirectionalLight(0xfffae0, 1.4);
  sun.position.set(4, 10, 3);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb8d8a0, 0.35);
  fill.position.set(-3, 4, -2);
  scene.add(fill);

  // ── Pebble stream bed ──
  const bedGeo = new THREE.PlaneGeometry(12, 6, 1, 1);
  bedGeo.rotateX(-Math.PI / 2);
  const bedMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec2 g = floor(vUv * 28.0);
        float r = h21(g);
        vec3 col = mix(vec3(0.48,0.44,0.38), vec3(0.64,0.60,0.52), r);
        col = mix(col, vec3(0.34,0.32,0.28), h21(g+7.3)*0.4);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const bed = new THREE.Mesh(bedGeo, bedMat);
  bed.position.set(0, -0.60, 0);
  scene.add(bed);

  // ── Mossy banks (near + far) ──
  function makeBank(zPos, flip) {
    const g = new THREE.PlaneGeometry(12, 3.5, 50, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, Math.sin(x * 0.7 + y) * 0.12 + Math.cos(x * 1.9) * 0.07 + (flip ? 0.18 : 0));
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a5224, roughness: 1 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, -0.50, zPos);
    scene.add(m);
  }
  makeBank(2.4, false);
  makeBank(-2.4, true);

  // ── Water surface — clear, flowing left-to-right ──
  const waterGeo = new THREE.PlaneGeometry(12, 3.8, 90, 30);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float time; varying vec2 vUv; varying float vH;
      void main(){
        vUv = uv;
        vec3 p = position;
        float w = sin(p.x * 2.8 - time * 3.8) * 0.020
                + sin(p.z * 4.5 + time * 2.0) * 0.012
                + sin(p.x * 6.5 - time * 5.5) * 0.008;
        p.y += w; vH = w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float time; varying vec2 vUv; varying float vH;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),
                   mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);
      }
      void main(){
        // Caustics — scroll left to right (x direction)
        vec2 ca = vec2(vUv.x * 5.0 - time * 1.2, vUv.y * 4.0 + time * 0.3);
        vec2 cb = vec2(vUv.x * 4.0 - time * 0.9 + 3.1, vUv.y * 5.0 - time * 0.4);
        float caustic = pow(noise(ca) * noise(cb), 1.8) * 2.4;

        // Water body colour — shallow teal fading to deep blue
        vec3 shallow = vec3(0.38, 0.72, 0.68);
        vec3 deep    = vec3(0.12, 0.32, 0.52);
        vec3 col = mix(deep, shallow, smoothstep(0.1, 0.9, vUv.y));

        // Sunlight caustics
        col += vec3(0.88, 1.0, 0.82) * caustic * 0.30;

        // Wave crests (foam)
        col += vec3(0.95, 1.0, 1.0) * smoothstep(0.013, 0.025, vH) * 0.85;

        // Bank edge foam
        float foam = smoothstep(0.10, 0.0, vUv.y) + smoothstep(0.90, 1.0, vUv.y);
        col = mix(col, vec3(0.90, 0.96, 0.92), foam * 0.65);

        gl_FragColor = vec4(col, 0.84);
      }`,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(0, -0.38, 0);
  scene.add(water);

  // ── Rocks ──
  const rMat1 = new THREE.MeshStandardMaterial({ color: 0x787868, roughness: 0.9, flatShading: true });
  const rMat2 = new THREE.MeshStandardMaterial({ color: 0x585850, roughness: 1, flatShading: true });
  for (let i = 0; i < 22; i++) {
    const r = 0.07 + Math.random() * 0.22;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), Math.random() > 0.5 ? rMat1 : rMat2);
    const inStream = Math.random() < 0.45;
    const z = inStream ? (Math.random() - 0.5) * 3.0 : (Math.random() < 0.5 ? 1.8 : -1.8) + (Math.random() - 0.5) * 0.6;
    rock.position.set((Math.random() - 0.5) * 11, -0.40 + r * 0.25, z);
    rock.scale.set(1.0 + Math.random() * 0.4, 0.45 + Math.random() * 0.4, 0.8 + Math.random() * 0.5);
    rock.rotation.y = Math.random() * Math.PI;
    scene.add(rock);
  }

  // ── Bankside trees ──
  for (let i = 0; i < 14; i++) {
    const h = 1.6 + Math.random() * 1.2;
    const side = Math.random() < 0.5 ? 2.8 : -2.8;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.07, h, 5),
      new THREE.MeshStandardMaterial({ color: 0x2e1e0e, roughness: 1 })
    );
    trunk.position.set((Math.random() - 0.5) * 12, h * 0.5 - 0.5, side + (Math.random() - 0.5) * 0.6);
    scene.add(trunk);
    const canopy = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.45 + Math.random() * 0.35, 1),
      new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x2a4a1a : 0x3a5e22, roughness: 1, flatShading: true })
    );
    canopy.position.set(trunk.position.x, trunk.position.y + h * 0.5, trunk.position.z);
    scene.add(canopy);
  }

  // ── Floating light motes ──
  const mc = 70;
  const mPos = new Float32Array(mc * 3);
  const mPhase = new Float32Array(mc);
  for (let i = 0; i < mc; i++) {
    mPos[i*3]   = (Math.random() - 0.5) * 12;
    mPos[i*3+1] = 0.05 + Math.random() * 1.2;
    mPos[i*3+2] = (Math.random() - 0.5) * 5;
    mPhase[i] = Math.random() * 6.28;
  }
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  mGeo.setAttribute('aPhase', new THREE.BufferAttribute(mPhase, 1));
  const mMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float aPhase; uniform float time; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(time*0.35 + aPhase) * 0.18;
        p.y += sin(time*0.55 + aPhase*1.3) * 0.08;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = clamp(55.0/-mv.z, 1.5, 4.0);
        vA = 0.35 + 0.65*sin(time*0.9+aPhase);
      }`,
    fragmentShader: `varying float vA;
      void main(){
        float a = smoothstep(0.5,0.0,length(gl_PointCoord-0.5));
        gl_FragColor = vec4(0.95,1.0,0.78, a*vA*0.48);
      }`,
  });
  scene.add(new THREE.Points(mGeo, mMat));

  camera.position.set(0, 2.2, 1.8);
  camera.lookAt(0, -0.4, -0.6);

  return {
    update(t) {
      waterMat.uniforms.time.value = t;
      mMat.uniforms.time.value = t;
      camera.position.x = Math.sin(t * 0.09) * 0.18;
      camera.lookAt(0, -0.4, -0.6);
    }
  };
}

// ─────────────────────────────────────────────────────────────
// RAIN — misty, falling streaks
function buildRain(scene, camera) {
  scene.background = new THREE.Color(0x9aa6ad);
  scene.fog = new THREE.Fog(0x9aa6ad, 2, 10);
  scene.add(new THREE.HemisphereLight(0xe6edf2, 0x3a4046, 0.85));

  // Distant mountain silhouette
  const mGeo = new THREE.PlaneGeometry(20, 3, 80, 1);
  const mp = mGeo.attributes.position;
  for (let i = 0; i <= 80; i++) {
    const x = mp.getX(i);
    const y = Math.sin(x * 0.6) * 0.4 + Math.sin(x * 1.4 + 1) * 0.25;
    mp.setY(i, 1.5 + y);
  }
  mGeo.computeVertexNormals();
  const m = new THREE.Mesh(mGeo, new THREE.MeshBasicMaterial({ color: 0x6c7880, fog: true }));
  m.position.set(0, -0.4, -7);
  scene.add(m);

  // Mid pines
  for (let i = 0; i < 14; i++) {
    const pine = new THREE.Mesh(
      new THREE.ConeGeometry(0.25 + Math.random() * 0.15, 1.4 + Math.random() * 0.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a5862, roughness: 1, flatShading: true })
    );
    pine.position.set((Math.random() - 0.5) * 14, 0.3, -3 - Math.random() * 4);
    scene.add(pine);
  }

  // Rain (line segments)
  const count = 600;
  const positions = new Float32Array(count * 6);
  const offsets = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 14;
    const z = -1 - Math.random() * 7;
    const y = Math.random() * 6;
    positions[i*6+0] = x;       positions[i*6+1] = y;        positions[i*6+2] = z;
    positions[i*6+3] = x + 0.02; positions[i*6+4] = y - 0.18; positions[i*6+5] = z;
    offsets[i] = Math.random();
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rMat = new THREE.LineBasicMaterial({
    color: 0xdde4ea, transparent: true, opacity: 0.55,
  });
  const rain = new THREE.LineSegments(rGeo, rMat);
  scene.add(rain);

  camera.position.set(0, 0.6, 4);
  camera.lookAt(0, 0.6, -3);

  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) speeds[i] = 6 + Math.random() * 3;

  return {
    update(t, dt) {
      const arr = rain.geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i*6+1] -= speeds[i] * dt;
        arr[i*6+4] -= speeds[i] * dt;
        if (arr[i*6+1] < -0.5) {
          const x = (Math.random() - 0.5) * 14;
          const z = -1 - Math.random() * 7;
          arr[i*6+0] = x;       arr[i*6+1] = 5;       arr[i*6+2] = z;
          arr[i*6+3] = x + 0.02; arr[i*6+4] = 4.82;    arr[i*6+5] = z;
        }
      }
      rain.geometry.attributes.position.needsUpdate = true;
      camera.position.x = Math.sin(t * 0.13) * 0.18;
    }
  };
}
