// Stillpoint — soundscapes mini-scenes — cinematic overhaul
// ACESFilmic tone mapping on all scenes; richer colors + lighting throughout.
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
  const key    = card.dataset.key;
  const canvas = card.querySelector('canvas');
  if (!canvas || !builders[key]) return;
  initScene(canvas, builders[key]);
});

// ─── Shared init — ACESFilmic tone mapping on every card
function initScene(canvas, build) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
  };
  resize();

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0.6, 4);
  camera.lookAt(0, 0.4, 0);

  const ctx = build(scene, camera);

  const clock = new THREE.Clock();
  let raf;
  function loop() {
    const t  = clock.getElapsedTime();
    const dt = Math.min(0.05, clock.getDelta());
    if (ctx.update) ctx.update(t, dt);
    const r = canvas.getBoundingClientRect();
    if (renderer.domElement.width !== Math.floor(r.width * renderer.getPixelRatio())) resize();
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) cancelAnimationFrame(raf);
      else if (!raf) loop();
    });
  }, { threshold: 0.05 });
  io.observe(canvas);

  window.addEventListener('resize', resize);
}

// ─────────────────────────────────────────────────────────────
// DAWN — vibrant rose/amber sky, silhouetted trees, sun disc, birds, mist
function buildDawn(scene, camera) {
  const skyGeo = new THREE.SphereGeometry(50, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      varying vec3 vW;
      void main(){
        float h = normalize(vW).y;
        vec3 glow   = vec3(1.0,  0.50, 0.18);
        vec3 rose   = vec3(0.98, 0.68, 0.54);
        vec3 violet = vec3(0.62, 0.60, 0.84);
        vec3 c = mix(glow, rose, smoothstep(0.0, 0.30, h));
        c = mix(c, violet, smoothstep(0.24, 0.90, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  scene.add(new THREE.HemisphereLight(0xffb070, 0x2c3820, 0.80));
  const sunDirLight = new THREE.DirectionalLight(0xffaa66, 1.0);
  sunDirLight.position.set(-4, 1, -6);
  scene.add(sunDirLight);

  // Rising sun — halo + core
  const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const halo = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = pow(1.0-smoothstep(0.0,0.5,d), 1.4) * 0.70;
        gl_FragColor = vec4(1.0, 0.60, 0.22, a);
      }`,
  }));
  halo.position.set(-5.0, 0.0, -12);
  halo.renderOrder = 2;
  scene.add(halo);

  const core = new THREE.Mesh(new THREE.CircleGeometry(0.65, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = 1.0-smoothstep(0.36, 0.5, d);
        vec3 col = mix(vec3(1.0,0.96,0.88), vec3(1.0,0.78,0.40), d*2.0);
        gl_FragColor = vec4(col * 2.5, a);
      }`,
  }));
  core.position.set(-5.0, 0.0, -11.8);
  core.renderOrder = 3;
  scene.add(core);

  // Silhouetted tree line
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x0a0e0c, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const h = 1.0 + Math.random() * 1.8;
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.13 + Math.random() * 0.1, h, 5), treeMat);
    tree.position.set((Math.random() - 0.5) * 24, -1.0 + h * 0.5, -3.5 - Math.random() * 5);
    scene.add(tree);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.3, 5), treeMat);
    trunk.position.set(tree.position.x, -1.0 + 0.15, tree.position.z);
    scene.add(trunk);
  }

  // Dark meadow
  scene.add(Object.assign(new THREE.Mesh(
    new THREE.PlaneGeometry(30, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1f14, roughness: 1 })
  ), { rotation: { x: -Math.PI / 2 }, position: { y: -1.0 } }));

  // Birds
  const birds = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-0.09, 0.045, 0, 0, 0, 0, 0.09, 0.045, 0]), 3
    ));
    const b = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x090d0c, transparent: true, opacity: 0.7 }));
    b.position.set(-10 + Math.random() * 5, 0.4 + Math.random() * 1.4, -3 - Math.random() * 5);
    b.scale.setScalar(0.5 + Math.random() * 0.5);
    b.userData.speed = 0.5 + Math.random() * 0.55;
    scene.add(b);
    birds.push(b);
  }

  // Morning mist
  const count = 140;
  const mp    = new Float32Array(count * 3);
  const ph    = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    mp[i*3]   = (Math.random()-0.5)*14;
    mp[i*3+1] = -0.7 + Math.random()*1.0;
    mp[i*3+2] = -1 - Math.random()*7;
    ph[i]     = Math.random()*6.28;
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
        vec3 p = position; p.x += sin(time*0.25+aPhase)*0.35;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = clamp(220.0/-mv.z, 4.0, 14.0);
        vA = 0.28+0.14*sin(time*0.4+aPhase);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        float a = smoothstep(0.5,0.0,length(gl_PointCoord-0.5));
        gl_FragColor = vec4(1.0, 0.78, 0.58, a*vA);
      }`,
  });
  scene.add(new THREE.Points(mistGeo, mistMat));

  camera.position.set(0, 0.3, 3.8);
  camera.lookAt(0, 0.0, -3);

  return {
    update(t, dt) {
      mistMat.uniforms.time.value = t;
      birds.forEach((b) => {
        b.position.x += b.userData.speed * dt;
        if (b.position.x > 11) { b.position.x = -11; b.position.y = 0.4 + Math.random() * 1.4; }
      });
      camera.position.x = Math.sin(t * 0.1) * 0.12;
    }
  };
}

// ─────────────────────────────────────────────────────────────
// FIREPLACE — rich amber glow, glowing logs, dancing embers
function buildFireplace(scene, camera) {
  scene.background = new THREE.Color(0x221410);
  scene.fog = new THREE.Fog(0x221410, 4, 12);
  scene.add(new THREE.HemisphereLight(0xffaa60, 0x1a0c08, 0.7));

  const flame = new THREE.PointLight(0xffaa55, 2.0, 6, 1.6);
  flame.position.set(0, 0.2, 0);
  scene.add(flame);

  // Back wall (dark, lit by fire)
  scene.add(Object.assign(new THREE.Mesh(
    new THREE.PlaneGeometry(6, 4),
    new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 1 })
  ), { position: { z: -1.2 } }));

  // Logs
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2819, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 12), logMat);
    log.position.set(-0.4 + i * 0.25, -0.3, 0);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (Math.random() - 0.5) * 0.3;
    scene.add(log);
  }

  // Glowing fire core
  const coreGeo = new THREE.SphereGeometry(0.25, 24, 24);
  const coreMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vN = normalize(normalMatrix*normal);
        vec4 mv = modelViewMatrix*vec4(position,1.0); vV=-normalize(mv.xyz);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `
      uniform float time; varying vec3 vN; varying vec3 vV;
      void main(){
        float fres = pow(1.0-max(dot(vN,vV),0.0), 1.8);
        float p    = 0.7+0.3*sin(time*4.5);
        vec3 hot   = mix(vec3(1.0,0.55,0.18), vec3(1.0,0.82,0.38), p);
        vec3 c     = mix(hot, vec3(1.0,0.40,0.10), fres);
        gl_FragColor = vec4(c * 1.8, 0.90);
      }`,
  });
  const fireCore = new THREE.Mesh(coreGeo, coreMat);
  fireCore.position.set(0, -0.05, 0);
  scene.add(fireCore);

  // Embers
  const count = 100;
  const positions = new Float32Array(count * 3);
  const phases    = new Float32Array(count);
  const vy        = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i*3]   = (Math.random()-0.5)*1.0;
    positions[i*3+1] = -0.3 + Math.random()*0.4;
    positions[i*3+2] = (Math.random()-0.5)*0.6;
    phases[i] = Math.random()*6.28;
    vy[i]     = 0.35 + Math.random()*0.5;
  }
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  eGeo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
  const eMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float aPhase; uniform float time; varying float vL;
      void main(){
        vec3 p = position; p.x += sin(time*1.3+aPhase)*0.06;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = 2.8*180.0/-mv.z;
        vL = clamp((1.0-p.y)*1.0, 0.0, 1.0);
      }`,
    fragmentShader: `
      varying float vL;
      void main(){
        float a = smoothstep(0.5,0.0,length(gl_PointCoord-0.5));
        vec3 col = mix(vec3(1.0,0.55,0.18), vec3(1.0,0.82,0.44), vL);
        gl_FragColor = vec4(col, a*0.65);
      }`,
  });
  const embers = new THREE.Points(eGeo, eMat);
  scene.add(embers);

  return {
    update(t, dt) {
      coreMat.uniforms.time.value = t;
      eMat.uniforms.time.value    = t;
      flame.intensity = 1.6 + Math.sin(t*5)*0.45 + Math.sin(t*13)*0.15;

      const arr = embers.geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i*3+1] += vy[i] * dt;
        if (arr[i*3+1] > 1.8) {
          arr[i*3+1] = -0.3;
          arr[i*3]   = (Math.random()-0.5)*1.0;
          arr[i*3+2] = (Math.random()-0.5)*0.6;
        }
      }
      embers.geometry.attributes.position.needsUpdate = true;
      camera.position.x = Math.sin(t * 0.2) * 0.15;
    }
  };
}

// ─────────────────────────────────────────────────────────────
// OCEAN — warm dusk, animated waves, glowing sun at horizon
function buildOcean(scene, camera) {
  const skyGeo = new THREE.SphereGeometry(50, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      varying vec3 vW;
      void main(){
        float h = normalize(vW).y;
        vec3 dusk   = vec3(0.96, 0.56, 0.32);
        vec3 rose   = vec3(0.95, 0.72, 0.56);
        vec3 violet = vec3(0.55, 0.52, 0.80);
        vec3 c = mix(dusk, rose, smoothstep(-0.05, 0.28, h));
        c = mix(c, violet, smoothstep(0.20, 0.80, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  scene.add(new THREE.HemisphereLight(0xffe0b0, 0x3a4866, 0.9));

  // Sun disc at dusk
  const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const sunHalo = new THREE.Mesh(new THREE.CircleGeometry(1.8, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = pow(1.0-smoothstep(0.0,0.5,d), 1.5) * 0.7;
        gl_FragColor = vec4(1.0, 0.68, 0.32, a);
      }`,
  }));
  sunHalo.position.set(0, 0.08, -8);
  sunHalo.renderOrder = 2;
  scene.add(sunHalo);

  const sunCore = new THREE.Mesh(new THREE.CircleGeometry(0.48, 40), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: vert,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float d = distance(vUv, vec2(0.5));
        float a = 1.0-smoothstep(0.38,0.5,d);
        vec3 col = mix(vec3(1.0,0.96,0.88), vec3(1.0,0.78,0.40), d*2.0);
        gl_FragColor = vec4(col*2.4, a);
      }`,
  }));
  sunCore.position.set(0, 0.08, -7.8);
  sunCore.renderOrder = 3;
  scene.add(sunCore);

  // Animated wave plane
  const waveGeo = new THREE.PlaneGeometry(20, 16, 80, 60);
  waveGeo.rotateX(-Math.PI / 2);
  const waveMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      uniform float time; varying float vH; varying vec3 vP;
      void main(){
        vec3 p = position;
        float w = sin(p.x*0.6+time*0.8)*0.08+sin(p.z*0.9+time*1.1)*0.06+sin((p.x+p.z)*0.4+time*0.5)*0.05;
        p.y += w; vH=w; vP=p;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader: `
      varying float vH; varying vec3 vP;
      void main(){
        vec3 deep    = vec3(0.14, 0.22, 0.42);
        vec3 shallow = vec3(0.42, 0.52, 0.72);
        float d = clamp(vP.z*-0.05+0.5, 0.0, 1.0);
        vec3 col = mix(deep, shallow, d);
        col += vec3(0.6, 0.38, 0.20) * smoothstep(0.0, 0.12, vH);
        float band = smoothstep(0.8, 0.0, abs(vP.x));
        col += band * vec3(0.7, 0.44, 0.22) * smoothstep(-3.0, -8.0, vP.z);
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
// FOREST — deep night, moonlit, fireflies
function buildForest(scene, camera) {
  scene.background = new THREE.Color(0x08160e);
  scene.fog = new THREE.Fog(0x08160e, 3, 12);

  scene.add(new THREE.HemisphereLight(0x3a5a6a, 0x020806, 0.50));
  const moon = new THREE.DirectionalLight(0xb0d0ff, 0.6);
  moon.position.set(2, 4, 1);
  scene.add(moon);

  // Moon disc
  scene.add(Object.assign(new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 32),
    new THREE.MeshBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 0.94 })
  ), { position: new THREE.Vector3(2.2, 1.6, -6) }));

  // Trees
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x0c1410, roughness: 1 });
  for (let i = 0; i < 20; i++) {
    const h = 2.5 + Math.random() * 2.5;
    const r = 0.06 + Math.random() * 0.1;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r*0.7, r, h, 6), trunkMat);
    trunk.position.set((Math.random()-0.5)*12, -0.4+h/2, -2-Math.random()*6);
    trunk.rotation.y = Math.random()*Math.PI;
    scene.add(trunk);
    const canopy = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5+Math.random()*0.4, 0),
      new THREE.MeshStandardMaterial({ color: 0x182a1e, roughness: 1, flatShading: true })
    );
    canopy.position.set(trunk.position.x, trunk.position.y+h/2+0.2, trunk.position.z);
    canopy.scale.setScalar(0.8 + Math.random() * 0.6);
    scene.add(canopy);
  }

  // Ground
  scene.add(Object.assign(new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x060e0a, roughness: 1 })
  ), { rotation: new THREE.Euler(-Math.PI/2, 0, 0), position: new THREE.Vector3(0, -0.4, 0) }));

  // Fireflies
  const count = 65;
  const positions = new Float32Array(count * 3);
  const phases    = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i*3]   = (Math.random()-0.5)*8;
    positions[i*3+1] = 0.2 + Math.random()*1.6;
    positions[i*3+2] = -1 - Math.random()*6;
    phases[i] = Math.random()*6.28;
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  fGeo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
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
        gl_PointSize = 1.8*180.0/-mv.z;
        vF = 0.35+0.65*sin(time*2.5+aPhase*3.1);
      }`,
    fragmentShader: `
      varying float vF;
      void main(){
        float a = smoothstep(0.5,0.0,length(gl_PointCoord-0.5));
        gl_FragColor = vec4(0.88, 1.0, 0.48, a*vF*0.78);
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
// STREAM — lush green forest brook, animated water, light motes
function buildStream(scene, camera) {
  const skyGeo = new THREE.SphereGeometry(50, 32, 16);
  scene.add(new THREE.Mesh(skyGeo, new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      varying vec3 vW;
      void main(){
        float h = normalize(vW).y;
        vec3 top = vec3(0.88, 0.92, 0.72);
        vec3 mid = vec3(0.70, 0.82, 0.52);
        vec3 low = vec3(0.42, 0.52, 0.30);
        vec3 c = mix(low, mid, smoothstep(-0.1, 0.4, h));
        c = mix(c, top, smoothstep(0.30, 0.85, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  })));

  scene.add(new THREE.HemisphereLight(0xe8f0b8, 0x1e2a12, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0c0, 1.1);
  sun.position.set(2, 5, -2);
  scene.add(sun);

  // Banks
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x3e5228, roughness: 1, flatShading: true });
  function bank(side) {
    const g = new THREE.PlaneGeometry(2.2, 16, 6, 30);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, Math.sin(y*0.6+x)*0.15 + Math.cos(y*1.4)*0.08 + (x > 0 ? 0.4 : 0.0));
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, bankMat);
    m.rotation.x = -Math.PI/2; m.rotation.z = Math.PI/2;
    m.position.set(side*1.1, -0.4, -3);
    scene.add(m);
  }
  bank(-1); bank(1);

  // Water
  const waterGeo = new THREE.PlaneGeometry(1.6, 16, 12, 80);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      uniform float time; varying float vF; varying vec2 vUv;
      void main(){
        vUv = uv; vec3 p = position;
        float ripple = sin(p.z*4.0+time*4.5)*0.02+sin(p.x*7.0+time*3.0)*0.012;
        p.y += ripple; vF = ripple;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader: `
      uniform float time; varying float vF; varying vec2 vUv;
      void main(){
        float flow = sin(vUv.y*32.0-time*3.5);
        flow = smoothstep(0.6, 1.0, flow);
        vec3 deep = vec3(0.15, 0.26, 0.28);
        vec3 mid  = vec3(0.36, 0.52, 0.48);
        vec3 col  = mix(deep, mid, vUv.y);
        col += vec3(0.80, 0.90, 0.70) * flow * 0.50;
        col += vec3(0.90, 0.96, 0.70) * smoothstep(0.012, 0.025, vF) * 0.7;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(0, -0.45, -3);
  scene.add(water);

  // Rocks
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a6a50, roughness: 1, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const r    = 0.10 + Math.random()*0.18;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat);
    const inWater = Math.random() < 0.35;
    const x = inWater ? (Math.random()-0.5)*1.2 : (Math.random()<0.5?-1:1)*(1.0+Math.random()*1.0);
    rock.position.set(x, -0.34, -1-Math.random()*7);
    rock.scale.y = 0.6+Math.random()*0.3;
    rock.rotation.y = Math.random()*Math.PI;
    scene.add(rock);
  }

  // Trees
  for (let i = 0; i < 10; i++) {
    const tree = new THREE.Mesh(
      new THREE.ConeGeometry(0.4+Math.random()*0.2, 1.6+Math.random()*0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x2e3e20, roughness: 1, flatShading: true })
    );
    tree.position.set((Math.random()-0.5)*12, 0.3, -7-Math.random()*3);
    scene.add(tree);
  }

  // Dappled light motes
  const count = 80;
  const positions = new Float32Array(count * 3);
  const phase     = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i*3]   = (Math.random()-0.5)*6;
    positions[i*3+1] = Math.random()*2.5;
    positions[i*3+2] = -1-Math.random()*6;
    phase[i] = Math.random()*6.28;
  }
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  mGeo.setAttribute('aPhase',   new THREE.BufferAttribute(phase, 1));
  const mMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float aPhase; uniform float time; varying float vA;
      void main(){
        vec3 p = position; p.x += sin(time*0.4+aPhase)*0.15;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = clamp(60.0/-mv.z, 1.5, 4.0);
        vA = 0.5+0.5*sin(time*1.0+aPhase);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        float a = smoothstep(0.5,0.0,length(gl_PointCoord-0.5));
        gl_FragColor = vec4(1.0,0.95,0.70, a*vA*0.50);
      }`,
  });
  scene.add(new THREE.Points(mGeo, mMat));

  camera.position.set(0, 0.55, 3.6);
  camera.lookAt(0, 0.1, -3);

  return {
    update(t) {
      waterMat.uniforms.time.value = t;
      mMat.uniforms.time.value = t;
      camera.position.x = Math.sin(t * 0.12) * 0.12;
      camera.position.y = 0.55 + Math.cos(t * 0.18) * 0.03;
      camera.lookAt(0, 0.1, -3);
    }
  };
}

// ─────────────────────────────────────────────────────────────
// RAIN — misty grey-blue, falling streaks, moody mountains
function buildRain(scene, camera) {
  scene.background = new THREE.Color(0x8a9aa4);
  scene.fog = new THREE.Fog(0x8a9aa4, 2, 10);
  scene.add(new THREE.HemisphereLight(0xdce8f2, 0x303840, 0.9));

  // Mountain silhouette
  const mGeo = new THREE.PlaneGeometry(20, 3, 80, 1);
  const mp   = mGeo.attributes.position;
  for (let i = 0; i <= 80; i++) {
    const x = mp.getX(i);
    mp.setY(i, 1.5 + Math.sin(x*0.6)*0.4 + Math.sin(x*1.4+1)*0.25);
  }
  mGeo.computeVertexNormals();
  scene.add(Object.assign(new THREE.Mesh(mGeo, new THREE.MeshBasicMaterial({ color: 0x606e78, fog: true })),
    { position: new THREE.Vector3(0, -0.4, -7) }));

  // Mid pines
  for (let i = 0; i < 14; i++) {
    const pine = new THREE.Mesh(
      new THREE.ConeGeometry(0.25+Math.random()*0.15, 1.4+Math.random()*0.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x424f58, roughness: 1, flatShading: true })
    );
    pine.position.set((Math.random()-0.5)*14, 0.3, -3-Math.random()*4);
    scene.add(pine);
  }

  // Rain streaks
  const count = 600;
  const positions = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const x = (Math.random()-0.5)*14;
    const z = -1 - Math.random()*7;
    const y = Math.random()*6;
    positions[i*6+0]=x;       positions[i*6+1]=y;        positions[i*6+2]=z;
    positions[i*6+3]=x+0.02;  positions[i*6+4]=y-0.18;   positions[i*6+5]=z;
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({
    color: 0xc8d8e4, transparent: true, opacity: 0.60,
  }));
  scene.add(rain);

  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) speeds[i] = 6 + Math.random()*3;

  camera.position.set(0, 0.6, 4);
  camera.lookAt(0, 0.6, -3);

  return {
    update(t, dt) {
      const arr = rain.geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i*6+1] -= speeds[i]*dt;
        arr[i*6+4] -= speeds[i]*dt;
        if (arr[i*6+1] < -0.5) {
          const x = (Math.random()-0.5)*14;
          const z = -1-Math.random()*7;
          arr[i*6+0]=x;      arr[i*6+1]=5;    arr[i*6+2]=z;
          arr[i*6+3]=x+0.02; arr[i*6+4]=4.82; arr[i*6+5]=z;
        }
      }
      rain.geometry.attributes.position.needsUpdate = true;
      camera.position.x = Math.sin(t * 0.13) * 0.18;
    }
  };
}
