/* AI 오피스 3D 엔진 — three.js(r186, vendor/three-office.js) 위에서 동작.
 * 원칙: 애니메이션은 실제 이벤트(채용·업무 시작·전달·완료)에만 바인딩한다. 상태를 지어내지 않는다.
 * 캐릭터/가구는 CC0 에셋(Kenney Mini Characters, Kenney Furniture Kit) — assets/licenses 참고.
 */
(function () {
  "use strict";
  const T = window.THREE;
  const ASSETS = "assets/";
  const CHAR_H = 1.0;            // 캐릭터 키(월드 단위)
  const FURN_SCALE = 1.45;       // Kenney 가구 스케일
  const WALK_SPEED = 1.8;        // m/s (실제보다 약간 빠르게 — 관제실 템포)
  const CELL = 0.25;             // 경로 격자 셀(m)
  const SIT_LIFT = 0.17;         // 앉았을 때 root 높이 보정

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
  const cssVar = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;

  /* ---------- 에셋 로더 (모델당 1회 로드, 캐시) ---------- */
  class Assets {
    constructor() { this.loader = new T.GLTFLoader(); this.cache = new Map(); }
    async load(path) {
      if (!this.cache.has(path)) {
        this.cache.set(path, this.loader.loadAsync(new URL(ASSETS + path, document.baseURI).href).then((g) => {
          // 바닥 y=0, XZ 중심이 원점이 되도록 보정값 계산
          const box = new T.Box3().setFromObject(g.scene);
          const size = new T.Vector3(); box.getSize(size);
          const center = new T.Vector3(); box.getCenter(center);
          g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.map) o.material.map.colorSpace = T.SRGBColorSpace; } });
          return { gltf: g, size, offset: new T.Vector3(-center.x, -box.min.y, -center.z) };
        }));
      }
      return this.cache.get(path);
    }
  }

  /* ---------- 가구 인스턴싱: 모델의 메시마다 InstancedMesh 1개 ---------- */
  class Furniture {
    constructor(scene, assets) { this.scene = scene; this.assets = assets; this.placements = new Map(); this.groups = []; }
    place(model, x, z, yaw, scale, y) { if (!this.placements.has(model)) this.placements.set(model, []); this.placements.get(model).push({ x, y: y || 0, z, yaw, scale: scale || FURN_SCALE }); }
    placeholder(model) {
      const dims = { desk: [0.73, 0.38, 0.39], deskCorner: [0.97, 0.38, 0.97], chairDesk: [0.33, 0.61, 0.31], computerScreen: [0.39, 0.29, 0.1], wall: [1, 1.29, 0.05], wallWindow: [1, 1.29, 0.09], wallDoorway: [1, 1.29, 0.09], bookcaseClosedWide: [0.8, 0.79, 0.25], loungeSofa: [0.98, 0.46, 0.41] }[model] || [0.3, 0.3, 0.3];
      const mesh = new T.Mesh(new T.BoxGeometry(dims[0], dims[1], dims[2]), new T.MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.9 }));
      mesh.position.y = dims[1] / 2; const scene = new T.Group(); scene.add(mesh); scene.updateMatrixWorld(true);
      return { gltf: { scene }, size: new T.Vector3(dims[0], dims[1], dims[2]), offset: new T.Vector3(0, 0, 0) };
    }
    clear() { this.groups.forEach((g) => { this.scene.remove(g); g.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); }); this.groups = []; this.placements.clear(); }
    async commit() {
      const m4 = new T.Matrix4(), pos = new T.Matrix4(), rot = new T.Matrix4(), scl = new T.Matrix4(), off = new T.Matrix4();
      // 모든 모델을 병렬로 받은 뒤 인스턴싱 (순차 로드는 첫 빌드를 수 초 늦춘다)
      const entries = [...this.placements.entries()];
      const loaded = await Promise.all(entries.map(([model]) => this.assets.load("furniture/" + model + ".glb").catch((e) => { console.warn("furniture missing", model, e); return null; })));
      for (let k = 0; k < entries.length; k++) {
        const [model, list] = entries[k]; let a = loaded[k];
        if (!a) a = this.placeholder(model); // 모델을 못 받으면 비슷한 크기의 상자로 대체(화면이 비지 않게)
        const group = new T.Group(); group.name = "furn:" + model;
        a.gltf.scene.updateMatrixWorld(true);
        a.gltf.scene.traverse((mesh) => {
          if (!mesh.isMesh) return;
          const inst = new T.InstancedMesh(mesh.geometry, mesh.material, list.length);
          inst.castShadow = true; inst.receiveShadow = true;
          const local = mesh.matrixWorld.clone();
          list.forEach((p, i) => {
            pos.makeTranslation(p.x, p.y, p.z); rot.makeRotationY(p.yaw || 0); scl.makeScale(p.scale, p.scale, p.scale); off.makeTranslation(a.offset.x, a.offset.y, a.offset.z);
            m4.copy(pos).multiply(rot).multiply(scl).multiply(off).multiply(local);
            inst.setMatrixAt(i, m4);
          });
          inst.instanceMatrix.needsUpdate = true;
          group.add(inst);
        });
        this.scene.add(group); this.groups.push(group);
      }
    }
  }

  /* ---------- 경로 격자 + A* ---------- */
  class Grid {
    constructor(minX, minZ, maxX, maxZ) {
      this.minX = minX; this.minZ = minZ; this.w = Math.ceil((maxX - minX) / CELL); this.h = Math.ceil((maxZ - minZ) / CELL);
      this.block = new Uint8Array(this.w * this.h);
    }
    idx(cx, cz) { return cz * this.w + cx; }
    toCell(x, z) { return [clamp(Math.floor((x - this.minX) / CELL), 0, this.w - 1), clamp(Math.floor((z - this.minZ) / CELL), 0, this.h - 1)]; }
    toWorld(cx, cz) { return [this.minX + (cx + 0.5) * CELL, this.minZ + (cz + 0.5) * CELL]; }
    blockRect(x0, z0, x1, z1) {
      const [a, b] = this.toCell(Math.min(x0, x1), Math.min(z0, z1)), [c, d] = this.toCell(Math.max(x0, x1), Math.max(z0, z1));
      for (let z = b; z <= d; z++) for (let x = a; x <= c; x++) this.block[this.idx(x, z)] = 1;
    }
    free(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h && !this.block[this.idx(cx, cz)]; }
    nearestFree(cx, cz) {
      if (this.free(cx, cz)) return [cx, cz];
      for (let r = 1; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (this.free(cx + dx, cz + dz)) return [cx + dx, cz + dz];
      return [cx, cz];
    }
    path(x0, z0, x1, z1) {
      let [sx, sz] = this.nearestFree(...this.toCell(x0, z0)); let [gx, gz] = this.nearestFree(...this.toCell(x1, z1));
      const W = this.w, H = this.h, N = W * H;
      const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
      const open = []; const start = this.idx(sx, sz), goal = this.idx(gx, gz);
      g[start] = 0; open.push([this.heur(sx, sz, gx, gz), start]);
      const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
      let guard = 0;
      while (open.length && guard++ < 60000) {
        let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
        const [, cur] = open.splice(bi, 1)[0];
        if (cur === goal) break;
        if (closed[cur]) continue; closed[cur] = 1;
        const cx = cur % W, cz = (cur / W) | 0;
        for (const [dx, dz, cost] of dirs) {
          const nx = cx + dx, nz = cz + dz; if (!this.free(nx, nz)) continue;
          if (dx && dz && (!this.free(cx + dx, cz) || !this.free(cx, cz + dz))) continue; // 코너 컷 금지
          const ni = nz * W + nx, ng = g[cur] + cost;
          if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; open.push([ng + this.heur(nx, nz, gx, gz), ni]); }
        }
      }
      if (came[goal] < 0 && goal !== start) return [[x1, z1]];
      const cells = []; let c = goal; while (c >= 0) { cells.push(c); if (c === start) break; c = came[c]; }
      cells.reverse();
      // 스트링 풀링: 직선으로 갈 수 있으면 중간점 생략
      const pts = cells.map((i) => this.toWorld(i % W, (i / W) | 0));
      const out = [pts[0]]; let i = 0;
      while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !this.lineFree(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
      out[out.length - 1] = [x1, z1];
      return out;
    }
    heur(ax, az, bx, bz) { const dx = Math.abs(ax - bx), dz = Math.abs(az - bz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); }
    lineFree(a, b) {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CELL * 0.5));
      for (let i = 0; i <= n; i++) { const t = i / n; const [cx, cz] = this.toCell(lerp(a[0], b[0], t), lerp(a[1], b[1], t)); if (!this.free(cx, cz)) return false; }
      return true;
    }
  }

  /* ---------- 캐릭터(직원/총괄) ---------- */
  const CHAR_MODELS = ["character-male-a", "character-female-a", "character-male-c", "character-female-d"];
  class Agent {
    constructor(eng, id, opts) {
      this.eng = eng; this.id = id; this.opts = opts; this.group = new T.Group(); this.group.name = "agent:" + id;
      this.state = "idle"; this.queue = []; this.path = null; this.speed = WALK_SPEED; this.seat = opts.seat; this.color = opts.color;
      this.busy = false; this.t = Math.random() * 10; this.mixer = null; this.actions = {}; this.bones = {}; this.current = null; this.doc = null; this.holdUntil = 0;
      this.proc = null; // 절차적 폴백
      eng.scene.add(this.group);
      this.group.position.set(opts.x, 0, opts.z); this.group.rotation.y = opts.yaw || 0;
    }
    async loadModel(modelName) {
      try {
        const a = await this.eng.assets.load("characters/" + modelName + ".glb");
        const model = T.cloneSkinned(a.gltf.scene);
        const s = CHAR_H / a.size.y; model.scale.setScalar(s); model.position.set(0, 0, 0);
        model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.userData.pick = this.opts.pick; } if (o.isBone) this.bones[o.name] = o; });
        this.mixer = new T.AnimationMixer(model);
        for (const clip of a.gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
        this.model = model; this.group.add(model);
        if (this.opts.chief) this.group.scale.setScalar(1.06);
        this.badge = this.makeBadge(); this.group.add(this.badge);
        this.play("idle");
      } catch (e) {
        console.warn("character model failed, procedural fallback", e); this.makeProcedural();
      }
      return this;
    }
    makeBadge() { // 팀 색 뱃지(가슴) — 팀 소속을 한눈에
      const m = new T.Mesh(new T.BoxGeometry(0.08, 0.1, 0.02), new T.MeshStandardMaterial({ color: this.color, roughness: 0.5 }));
      m.position.set(0.09, CHAR_H * 0.62, 0.16); return m;
    }
    makeProcedural() {
      const g = new T.Group(); const body = new T.Mesh(new T.CapsuleGeometry(0.17, 0.42, 4, 10), new T.MeshStandardMaterial({ color: this.color, roughness: 0.7 }));
      body.position.y = 0.5; body.castShadow = true; body.userData.pick = this.opts.pick;
      const head = new T.Mesh(new T.SphereGeometry(0.16, 16, 12), new T.MeshStandardMaterial({ color: 0xf2cfae, roughness: 0.8 })); head.position.y = 0.9; head.castShadow = true; head.userData.pick = this.opts.pick;
      g.add(body, head); this.group.add(g); this.model = g; this.proc = { body, head };
    }
    play(name, opts) {
      const o = Object.assign({ fade: 0.18, loop: true, clamp: false }, opts);
      const a = this.actions[name]; if (!a) return null;
      if (this.current && this.current !== a) this.current.fadeOut(o.fade);
      a.reset(); a.setLoop(o.loop ? T.LoopRepeat : T.LoopOnce, Infinity); a.clampWhenFinished = o.clamp; a.fadeIn(o.fade).play();
      this.current = a; return a;
    }
    // ----- 명령 큐: 실제 이벤트가 큐에 들어오고, 3D는 순서대로 소화 -----
    enqueue(cmd) { this.queue.push(cmd); }
    walkTo(x, z, yaw, then) { this.enqueue({ kind: "walk", x, z, yaw, then }); }
    sitDown() { this.enqueue({ kind: "sit" }); }
    standUp() { this.enqueue({ kind: "stand" }); }
    gesture(name, dur) { this.enqueue({ kind: "gesture", name, dur: dur || 0.8 }); }
    wait(dur) { this.enqueue({ kind: "wait", dur }); }
    carry(on) { this.enqueue({ kind: "carry", on }); }
    seatPos() { return this.seat; }
    goHome() { if (!this.seat) return; this.walkTo(this.seat.x, this.seat.z, this.seat.yaw); this.sitDown(); }
    update(dt, now) {
      this.t += dt;
      // 큐 소화
      if (!this.path && this.holdUntil <= now) {
        const cmd = this.queue.shift();
        if (cmd) {
          if (cmd.kind === "walk") {
            const p = this.group.position; const pts = this.eng.grid.path(p.x, p.z, cmd.x, cmd.z);
            this.path = { pts, i: 0, yaw: cmd.yaw, then: cmd.then }; this.setState("walk");
          } else if (cmd.kind === "sit") { this.setState("sit"); this.holdUntil = now + 0.25; }
          else if (cmd.kind === "stand") { this.setState("idle"); this.holdUntil = now + 0.2; }
          else if (cmd.kind === "gesture") { this.setState("gesture", cmd.name); this.holdUntil = now + cmd.dur; }
          else if (cmd.kind === "wait") { this.holdUntil = now + cmd.dur; }
          else if (cmd.kind === "carry") { this.setCarry(cmd.on); }
        } else if (this.state === "gesture") { this.setState(this.seat && this.atSeat() ? "sit" : "idle"); }
      }
      // 이동
      if (this.path) {
        const p = this.group.position; const tgt = this.path.pts[this.path.i];
        if (!tgt) { this.path = null; }
        else {
          const dx = tgt[0] - p.x, dz = tgt[1] - p.z, dist = Math.hypot(dx, dz);
          const step = this.speed * dt;
          if (dist <= step) { p.x = tgt[0]; p.z = tgt[1]; this.path.i++; if (this.path.i >= this.path.pts.length) { const yaw = this.path.yaw, then = this.path.then; this.path = null; if (yaw != null) this.targetYaw = yaw; this.setState("idle"); if (then) then(); } }
          else { p.x += (dx / dist) * step; p.z += (dz / dist) * step; this.targetYaw = Math.atan2(dx, dz); }
        }
      }
      // 회전 보간
      if (this.targetYaw != null) { let d = this.targetYaw - this.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); this.group.rotation.y += d * Math.min(1, dt * 10); }
      // 앉기 높이
      const wantY = this.state === "sit" || this.state === "type" || this.state === "talk" ? SIT_LIFT : 0;
      this.group.position.y = damp(this.group.position.y, wantY, 12, dt);
      // 애니메이션
      if (this.mixer) {
        this.mixer.update(dt);
        const k = this.eng.reduceMotion ? 0 : 1;
        if (this.state === "type" && this.bones["arm-left"] && this.bones["arm-right"]) {
          this.bones["arm-left"].rotation.x += -1.1 + Math.sin(this.t * 16) * 0.12 * k; this.bones["arm-right"].rotation.x += -1.1 + Math.sin(this.t * 16 + 1.7) * 0.12 * k;
          if (this.bones.head) this.bones.head.rotation.x += 0.15;
        } else if (this.state === "talk" && this.bones.head) { this.bones.head.rotation.x += Math.sin(this.t * 3.2) * 0.08 * k; this.bones.head.rotation.y += Math.sin(this.t * 1.1) * 0.12 * k; }
        else if ((this.state === "idle" || this.state === "sit") && this.bones.head) { this.bones.head.rotation.y += Math.sin(this.t * 0.6) * 0.1 * k; }
      } else if (this.proc) {
        const walking = this.state === "walk"; const k = this.eng.reduceMotion ? 0 : 1;
        this.proc.body.position.y = 0.5 + (walking ? Math.abs(Math.sin(this.t * 9)) * 0.04 * k : 0) - (wantY ? 0.12 : 0);
        this.proc.head.position.y = 0.9 + (walking ? Math.abs(Math.sin(this.t * 9)) * 0.04 * k : 0) - (wantY ? 0.12 : 0);
        this.proc.head.rotation.y = Math.sin(this.t * 0.7) * 0.2 * k;
      }
      if (this.doc) { this.doc.rotation.y = this.t * 0.3; }
    }
    atSeat() { if (!this.seat) return false; const p = this.group.position; return Math.hypot(p.x - this.seat.x, p.z - this.seat.z) < 0.15; }
    setState(s, gestureName) {
      this.state = s;
      if (!this.mixer) return;
      if (s === "walk") this.play("walk");
      else if (s === "idle") this.play("idle");
      else if (s === "sit" || s === "type" || s === "talk") this.play("sit", { loop: true });
      else if (s === "gesture") { const a = this.play(gestureName, { loop: false, clamp: true }); if (!a) this.play("idle"); }
    }
    setCarry(on) {
      if (on && !this.doc) {
        const d = new T.Mesh(new T.BoxGeometry(0.22, 0.015, 0.3), new T.MeshStandardMaterial({ color: 0xf5f1e6, roughness: 0.9 }));
        const clip = new T.Mesh(new T.BoxGeometry(0.22, 0.012, 0.06), new T.MeshStandardMaterial({ color: this.color })); clip.position.z = -0.12; d.add(clip);
        d.position.set(0, CHAR_H * 0.55, 0.22); d.rotation.x = -0.3; this.group.add(d); this.doc = d; this.docGlow = clip;
      } else if (!on && this.doc) { this.group.remove(this.doc); this.doc = null; }
    }
    headPos(out) { return out.set(this.group.position.x, CHAR_H * (this.opts.chief ? 1.06 : 1) + this.group.position.y + 0.12, this.group.position.z); }
    dispose() { this.eng.scene.remove(this.group); this.group.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry && o.material && !o.material.map) { o.geometry.dispose(); } }); }
  }

  /* ---------- 엔진 ---------- */
  function create(cfg) {
    const { canvas, labelsEl, stage } = cfg;
    const eng = { ok: true, ready: null, assets: new Assets(), reduceMotion: !!cfg.reduceMotion, agents: new Map(), labels: [], anims: [], busy: new Map(), pickables: [] };
    let renderer, scene, camera, hemi, sun, floor, furniture, zonesGroup, fxGroup;
    const cam = { theta: 0.32, phi: 0.95, radius: 36, target: new T.Vector3() };
    let home = { radius: 36, target: new T.Vector3() };
    const director = { on: !cfg.reduceMotion, pauseUntil: 0, shot: null, queue: [] };
    let layout = null; let lastFrame = performance.now(); let busyIndex = 0;

    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    } catch (e) {
      eng.ok = false;
      stage.insertAdjacentHTML("beforeend", '<div class="nogl">이 기기에서는 3D 화면을 표시할 수 없어요. 오른쪽 패널로 모든 기능을 쓸 수 있어요.</div>');
      return Object.assign(eng, { build: async () => {}, setBusy() {}, clearBusy() {}, handoff() {}, hire() {}, resetView() {}, follow() {}, setDirector() {} });
    }
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(36, 1, 0.3, 400);
    hemi = new T.HemisphereLight(0xffffff, 0x8f9bab, 1.1); scene.add(hemi);
    sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(22, 36, 18); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 }); sun.shadow.bias = -0.0005;
    scene.add(sun); scene.add(sun.target);
    const floorMat = new T.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    floor = new T.Mesh(new T.PlaneGeometry(400, 400), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    zonesGroup = new T.Group(); fxGroup = new T.Group(); scene.add(zonesGroup, fxGroup);
    furniture = new Furniture(scene, eng.assets);
    eng.scene = scene;
    // 캐릭터 모델은 채용 순간에 바로 쓰이므로 미리 받아 둔다
    CHAR_MODELS.forEach((m) => eng.assets.load("characters/" + m + ".glb").catch(() => {}));

    function applyTheme() {
      scene.background = new T.Color(cssVar("--scene-bg", "#dfe5eb"));
      floorMat.color.set(cssVar("--floor", "#eef1f4"));
      const dark = (matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light") || document.documentElement.dataset.theme === "dark";
      hemi.intensity = dark ? 0.7 : 1.1; sun.intensity = dark ? 1.4 : 2.2;
      scene.fog = new T.Fog(scene.background, 60, 140);
    }
    applyTheme();

    /* ----- 라벨(DOM 투영) ----- */
    function addLabel(html, cls, getPos, dy) {
      const el = document.createElement("div"); el.className = "lbl"; el.innerHTML = `<div class="${cls}">${html}</div>`;
      labelsEl.appendChild(el); const l = { el, getPos, dy: dy || 0 }; eng.labels.push(l); return l;
    }
    function removeLabel(l) { if (!l) return; l.el.remove(); const i = eng.labels.indexOf(l); if (i >= 0) eng.labels.splice(i, 1); }

    /* ----- 레이아웃 생성: 총괄실(위) · 팀 존(격자) · 라운지(오른쪽) · 입구(아래) ----- */
    const ZW = 8.4, ZD = 6.6, GAP = 1.8;
    const DESK_H = 0.38 * FURN_SCALE, CHIEF_DESK_H = 0.38 * FURN_SCALE * 1.25;
    function computeLayout(teams, staffOf) {
      const n = Math.max(1, teams.length); const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3; const rows = Math.ceil(n / cols);
      const W = cols * ZW + (cols - 1) * GAP; const depth = rows * ZD + (rows - 1) * GAP;
      const chiefZ = -depth / 2 - GAP - 3.2; const zoneZ0 = -depth / 2 + ZD / 2;
      const L = { cols, rows, W, depth, zones: [], chief: { x: 0, z: chiefZ, w: 9, d: 6 }, lounge: { x: W / 2 + GAP + 2.6, z: zoneZ0 - ZD / 2 + 2.5, w: 5.2, d: 5 }, entrance: { x: 0, z: depth / 2 + 2.6 }, bounds: null };
      L.bounds = { minX: -W / 2 - GAP - 1, maxX: W / 2 + GAP + 6.2, minZ: chiefZ - 4, maxZ: depth / 2 + 4 };
      teams.forEach((t, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const zx = -W / 2 + ZW / 2 + col * (ZW + GAP), zz = zoneZ0 + row * (ZD + GAP);
        const seats = [];
        for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
          const x = zx - 2.7 + c * 1.8, dz = r === 0 ? -1.45 : 1.45; const facing = r === 0 ? 1 : -1; // 위 줄은 +z(아래)를 보고, 아래 줄은 -z(위)를 봄 → 서로 마주보는 섬 배치
          seats.push({ x, deskZ: zz + dz, z: zz + dz + facing * 0.62, yaw: facing > 0 ? Math.PI : 0, facing }); // 의자는 책상 반대편, 사람은 책상을 본다
        }
        L.zones.push({ team: t, x: zx, z: zz, seats, members: staffOf(t.id) });
      });
      return L;
    }

    function buildStatic(L, teams) {
      // 존 바닥(팀색 틴트)과 간판
      while (zonesGroup.children.length) { const c = zonesGroup.children.pop(); c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }
      eng.labels.filter((l) => l.static).forEach(removeLabel);
      eng.pickables.length = 0;
      furniture.clear();
      const floorC = new T.Color(cssVar("--floor", "#eef1f4"));
      const rug = (x, z, w, d, color, mix, pick) => {
        const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshStandardMaterial({ color: floorC.clone().lerp(new T.Color(color), mix), roughness: 0.97 }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); m.receiveShadow = true; if (pick) { m.userData.pick = pick; eng.pickables.push(m); } zonesGroup.add(m); return m;
      };
      // 총괄실
      const C = L.chief; rug(C.x, C.z, C.w, C.d, cssVar("--chief", "#b7791f"), 0.16);
      for (let i = 0; i < 9; i++) furniture.place(i === 4 ? "wallWindow" : "wall", C.x - C.w / 2 + 0.5 + i, C.z - C.d / 2, 0);
      furniture.place("deskCorner", C.x + 0.2, C.z - 0.6, 0, FURN_SCALE * 1.25);
      furniture.place("chairDesk", C.x, C.z - 1.6, Math.PI);
      furniture.place("computerScreen", C.x - 0.1, C.z - 0.9, Math.PI, undefined, CHIEF_DESK_H);
      furniture.place("computerKeyboard", C.x - 0.1, C.z - 0.65, Math.PI, undefined, CHIEF_DESK_H);
      furniture.place("bookcaseClosedWide", C.x - 3.2, C.z - C.d / 2 + 0.3, 0);
      furniture.place("bookcaseOpen", C.x + 3.4, C.z - C.d / 2 + 0.3, 0);
      furniture.place("pottedPlant", C.x - C.w / 2 + 0.6, C.z + C.d / 2 - 0.7, 0); furniture.place("pottedPlant", C.x + C.w / 2 - 0.6, C.z + C.d / 2 - 0.7, 0);
      furniture.place("loungeChair", C.x - 2.6, C.z + 1.6, 0.6); furniture.place("loungeChair", C.x + 2.6, C.z + 1.6, -0.6); furniture.place("tableCoffee", C.x, C.z + 1.9, 0);
      furniture.place("books", C.x + 0.9, C.z - 0.9, 0.3, undefined, CHIEF_DESK_H);
      L.chiefSeat = { x: C.x, z: C.z - 1.55, yaw: 0, deskZ: C.z - 0.6 };
      L.chiefHandoff = { x: C.x, z: C.z + 0.55, yaw: Math.PI };
      addLabel("총괄실", "sign", () => new T.Vector3(C.x, 2.6, C.z - C.d / 2), 0).static = true;
      eng.labels[eng.labels.length - 1].el.firstChild.style.background = cssVar("--chief", "#b7791f");
      // 팀 존
      L.zones.forEach((zn) => {
        rug(zn.x, zn.z, ZW, ZD, zn.team.color, 0.2, { kind: "team", id: zn.team.id });
        zn.seats.forEach((s) => {
          furniture.place("desk", s.x, s.deskZ, s.facing > 0 ? Math.PI : 0);
          furniture.place("chairDesk", s.x, s.z, s.facing > 0 ? 0 : Math.PI);
          furniture.place("computerScreen", s.x, s.deskZ - s.facing * 0.1, s.facing > 0 ? 0 : Math.PI, undefined, DESK_H);
          furniture.place("computerKeyboard", s.x, s.deskZ + s.facing * 0.14, s.facing > 0 ? 0 : Math.PI, undefined, DESK_H);
        });
        furniture.place("pottedPlant", zn.x + ZW / 2 - 0.5, zn.z + ZD / 2 - 0.5, 0);
        furniture.place("trashcan", zn.x - ZW / 2 + 0.4, zn.z + ZD / 2 - 0.4, 0);
        const lbl = addLabel(`${cfg.esc(zn.team.name)}<small>${zn.members.length}/${cfg.maxStaff}</small>`, "sign", () => new T.Vector3(zn.x, 1.9, zn.z - ZD / 2 + 0.2), 0);
        lbl.static = true; lbl.el.firstChild.style.background = zn.team.color;
      });
      // 라운지
      const G = L.lounge; rug(G.x, G.z, G.w, G.d, "#6b7a8c", 0.12);
      furniture.place("loungeSofa", G.x, G.z - 1.4, 0); furniture.place("tableCoffee", G.x, G.z - 0.3, 0);
      furniture.place("loungeChair", G.x - 1.6, G.z - 0.3, Math.PI / 2); furniture.place("loungeChair", G.x + 1.6, G.z - 0.3, -Math.PI / 2);
      furniture.place("kitchenCoffeeMachine", G.x - 1.6, G.z + 1.9, 0); furniture.place("kitchenFridge", G.x + 1.2, G.z + 1.9, 0); furniture.place("tableRound", G.x - 0.3, G.z + 1.8, 0);
      furniture.place("plantSmall1", G.x + 2.2, G.z + 2.0, 0); furniture.place("lampRoundFloor", G.x - 2.2, G.z - 2.0, 0);
      addLabel("라운지", "sign", () => new T.Vector3(G.x, 1.6, G.z - G.d / 2 + 0.2), 0).static = true;
      eng.labels[eng.labels.length - 1].el.firstChild.style.background = "#6b7a8c";
      // 입구
      const E = L.entrance; furniture.place("wallDoorway", E.x - 0.5, E.z + 0.6, 0); furniture.place("wall", E.x - 1.5, E.z + 0.6, 0); furniture.place("wall", E.x + 0.5, E.z + 0.6, 0);
      furniture.place("plantSmall2", E.x - 1.3, E.z + 0.2, 0); furniture.place("cardboardBoxClosed", E.x + 1.4, E.z + 0.2, 0.4);
      // 외벽: 뒤(-z)와 양옆. 앞은 카메라 쪽이라 입구 주변만 세운다
      const WSEG = 1.0 * FURN_SCALE; const B0 = L.bounds;
      for (let x = B0.minX + WSEG / 2; x < B0.maxX; x += WSEG) { const k = Math.round((x - B0.minX) / WSEG); furniture.place(k % 3 === 1 ? "wallWindow" : "wall", x, B0.minZ + 0.6, 0); }
      for (let z = B0.minZ + 0.6 + WSEG / 2; z < L.entrance.z + 0.6; z += WSEG) { const k = Math.round((z - B0.minZ) / WSEG); furniture.place(k % 3 === 2 ? "wallWindow" : "wall", B0.minX + 0.5, z, Math.PI / 2); furniture.place(k % 3 === 2 ? "wallWindow" : "wall", B0.maxX - 0.5, z, -Math.PI / 2); }
      // 경로 격자 장애물
      const B = L.bounds; eng.grid = new Grid(B.minX, B.minZ, B.maxX, B.maxZ);
      const blk = (x, z, w, d) => eng.grid.blockRect(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
      blk(C.x + 0.2, C.z - 0.6, 2.0, 1.6); blk(C.x - 3.2, C.z - C.d / 2 + 0.3, 1.3, 0.5); blk(C.x + 3.4, C.z - C.d / 2 + 0.3, 0.7, 0.5);
      blk(C.x - 2.6, C.z + 1.6, 0.8, 0.8); blk(C.x + 2.6, C.z + 1.6, 0.8, 0.8); blk(C.x, C.z + 1.9, 1.0, 0.6);
      eng.grid.blockRect(C.x - C.w / 2, C.z - C.d / 2 - 0.3, C.x + C.w / 2, C.z - C.d / 2 + 0.1);
      L.zones.forEach((zn) => zn.seats.forEach((s) => { blk(s.x, s.deskZ, 1.15, 0.65); }));
      blk(G.x, G.z - 1.4, 1.6, 0.7); blk(G.x, G.z - 0.3, 1.0, 0.6); blk(G.x - 1.6, G.z - 0.3, 0.7, 0.7); blk(G.x + 1.6, G.z - 0.3, 0.7, 0.7);
      blk(G.x - 1.6, G.z + 1.9, 0.4, 0.4); blk(G.x + 1.2, G.z + 1.9, 0.7, 0.5); blk(G.x - 0.3, G.z + 1.8, 1.0, 1.0);
      eng.grid.blockRect(E.x - 2, E.z + 0.45, E.x - 0.55, E.z + 0.75); eng.grid.blockRect(E.x + 0.45, E.z + 0.45, E.x + 2, E.z + 0.75);
      eng.grid.blockRect(B0.minX, B0.minZ, B0.maxX, B0.minZ + 0.9); eng.grid.blockRect(B0.minX, B0.minZ, B0.minX + 0.8, B0.maxZ); eng.grid.blockRect(B0.maxX - 0.8, B0.minZ, B0.maxX, B0.maxZ);
      return furniture.commit();
    }

    /* ----- 에이전트 동기화(증분): 새 직원은 입구에서 걸어 들어온다 ----- */
    async function syncAgents(L, first) {
      const want = new Map();
      want.set("chief", { seat: L.chiefSeat, color: cssVar("--chief", "#b7791f"), chief: true, model: "character-male-c", pick: { kind: "staff", id: "chief" }, name: cfg.chief.name, role: "총괄" });
      L.zones.forEach((zn) => zn.members.forEach((p, k) => { const s = zn.seats[k]; if (!s) return; want.set(p.id, { seat: s, color: zn.team.color, model: CHAR_MODELS[(p.name || "").length % CHAR_MODELS.length], pick: { kind: "staff", id: p.id }, name: p.name, role: p.role, hired: p.hiredAt }); }));
      // 제거
      for (const [id, ag] of eng.agents) if (!want.has(id)) { removeLabel(ag.tag); removeLabel(ag.bubble); ag.dispose(); eng.agents.delete(id); }
      // 추가/이동
      const loads = []; let hireDelay = 0;
      for (const [id, w] of want) {
        let ag = eng.agents.get(id);
        if (!ag) {
          const fresh = !first && !w.chief && w.hired && Date.now() - w.hired < 60000; // 방금 채용된 직원만 입구 연출
          const start = fresh ? { x: L.entrance.x + (Math.random() - 0.5), z: L.entrance.z - 0.2 } : { x: w.seat.x, z: w.seat.z };
          ag = new Agent(eng, id, { x: start.x, z: start.z, yaw: w.seat.yaw, seat: w.seat, color: w.color, chief: w.chief, pick: w.pick });
          eng.agents.set(id, ag);
          loads.push(ag.loadModel(w.model).then(() => {
            ag.tag = addLabel(`<b>${cfg.esc(w.name)}</b> ${cfg.esc(w.role.length > 10 ? w.role.slice(0, 10) + "…" : w.role)}`, w.chief ? "tag chief" : "tag", (o) => ag.headPos(o), 0);
            if (fresh) { ag.wait(hireDelay); hireDelay += 0.7; ag.walkTo(w.seat.x, w.seat.z, w.seat.yaw); ag.sitDown(); shot("hire", ag, 4); } else { ag.setState("sit"); ag.targetYaw = w.seat.yaw; ag.group.rotation.y = w.seat.yaw; }
          }));
        } else {
          ag.seat = w.seat; ag.color = w.color; if (ag.badge) ag.badge.material.color.set(w.color);
          if (!ag.atSeat() && !ag.path && !ag.queue.length) { ag.walkTo(w.seat.x, w.seat.z, w.seat.yaw); ag.sitDown(); }
        }
      }
      await Promise.all(loads);
      for (const [id, txt] of eng.busy) setBusy(id, txt);
    }

    let building = null;
    async function build() {
      const run = async () => {
        const teams = cfg.getTeams(); layout = computeLayout(teams, cfg.staffOf);
        const first = eng.agents.size === 0;
        await Promise.all([buildStatic(layout, teams), syncAgents(layout, first)]); // 가구와 캐릭터는 서로 독립 → 동시에
        const B = layout.bounds;
        home = { target: new T.Vector3(0, 0, (B.minZ + B.maxZ) / 2 + 1), radius: clamp(Math.max(layout.W + 12, layout.depth + 16) * 1.15, 24, 120) };
        if (first) resetView();
      };
      building = (building || Promise.resolve()).then(run).catch((e) => console.error("build failed", e));
      return building;
    }
    function resetView() { cam.theta = 0.32; cam.phi = 0.95; cam.radius = home.radius; cam.target.copy(home.target); director.shot = null; }

    /* ----- 상태·연출 API ----- */
    function setBusy(id, text) {
      if (text) eng.busy.set(id, text); else eng.busy.delete(id);
      const ag = eng.agents.get(id); if (!ag) return;
      removeLabel(ag.bubble); ag.bubble = null;
      if (text) {
        ag.bubble = addLabel(`${cfg.esc(text.length > 40 ? text.slice(0, 40) + "…" : text)}<span class="typing"><i></i><i></i><i></i></span>`, "bubble", (o) => ag.headPos(o), 26);
        ag.busy = true; if (ag.atSeat() && !ag.path && !ag.queue.length) ag.setState("type");
        ag.enqueueTyping = true;
      } else { ag.busy = false; if (ag.state === "type") ag.setState("sit"); }
      busyIndex = eng.busy.size;
    }
    function clearBusy() { [...eng.busy.keys()].forEach((id) => setBusy(id, null)); }
    // 서류 전달: from이 to의 자리로 걸어가 전달하고 돌아온다. (이벤트가 있을 때만)
    function handoff(from, to) {
      const a = eng.agents.get(from), b = eng.agents.get(to); if (!a || !b) return;
      const dest = b.seat ? { x: b.seat.x + (b.seat.facing ? 0.9 : 0.9), z: b.seat.z, yaw: Math.PI / 2 } : null;
      if (!dest) return;
      if (b.id === "chief" && layout && layout.chiefHandoff) { dest.x = layout.chiefHandoff.x; dest.z = layout.chiefHandoff.z; dest.yaw = Math.PI; }
      a.standUp(); a.carry(true); a.walkTo(dest.x, dest.z, dest.yaw);
      a.gesture("interact-right", 0.7); a.carry(false); a.wait(0.2); a.gesture("emote-yes", 0.6);
      a.goHome();
      if (b.atSeat() || b.id === "chief") { b.wait(0.1); }
      shot("handoff", a, 5, b);
      spawnDocFx(a, b);
    }
    function spawnDocFx(a, b) { // 전달 시점에 수신자 자리 바닥에 짧은 링 — 도착 시간에 맞춰 지연
      const dest = b.seat || b.group.position; const d = Math.hypot(a.group.position.x - dest.x, a.group.position.z - dest.z);
      const m = new T.Mesh(new T.RingGeometry(0.25, 0.32, 24), new T.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.9, side: T.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set(dest.x, 0.03, dest.z); m.visible = false; fxGroup.add(m);
      eng.anims.push({ m, t0: performance.now() + (d / WALK_SPEED) * 1000 + 900, dur: eng.reduceMotion ? 1 : 1400, kind: "ring" });
    }
    function hire(id) { const ag = eng.agents.get(id); if (ag) shot("hire", ag, 4); }
    function follow(id) { const ag = eng.agents.get(id); if (!ag) return; director.shot = { kind: "follow", ag, until: Infinity }; }
    function setDirector(on) { director.on = on; if (!on) director.shot = null; }
    function shot(kind, ag, dur, other) { if (!director.on) return; director.queue.push({ kind, ag, other, dur, prio: kind === "handoff" ? 2 : 1 }); }

    /* ----- 카메라 입력 ----- */
    const pointers = new Map(); let lastPinch = 0, moved = 0, panMode = false;
    const userTouched = () => { director.pauseUntil = performance.now() + 15000; director.shot = null; };
    canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; panMode = e.button === 2 || e.shiftKey; if (pointers.size === 2) { const [p1, p2] = [...pointers.values()]; lastPinch = Math.hypot(p1.x - p2.x, p1.y - p2.y); } });
    canvas.addEventListener("pointermove", (e) => {
      const p = pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 3) userTouched();
      if (pointers.size === 2) { const [p1, p2] = [...pointers.values()]; const d = Math.hypot(p1.x - p2.x, p1.y - p2.y); if (lastPinch) cam.radius = clamp(cam.radius * (lastPinch / d), 6, 160); lastPinch = d; return; }
      if (panMode) { const s = cam.radius * 0.0016; const right = new T.Vector3(Math.cos(cam.theta), 0, -Math.sin(cam.theta)), fwd = new T.Vector3(Math.sin(cam.theta), 0, Math.cos(cam.theta)); cam.target.addScaledVector(right, -dx * s).addScaledVector(fwd, -dy * s); }
      else { cam.theta -= dx * 0.006; cam.phi = clamp(cam.phi - dy * 0.005, 0.25, 1.45); }
    });
    const onUp = (e) => { const wasClick = pointers.size === 1 && moved < 6; pointers.delete(e.pointerId); if (pointers.size < 2) lastPinch = 0; if (wasClick && e.type === "pointerup") pick(e); };
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); userTouched(); cam.radius = clamp(cam.radius * (1 + Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0012), 6, 160); }, { passive: false });
    const ray = new T.Raycaster();
    function pick(e) {
      const r = canvas.getBoundingClientRect();
      ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const targets = [...eng.pickables]; eng.agents.forEach((ag) => { if (ag.model) targets.push(ag.model); });
      const hits = ray.intersectObjects(targets, true);
      for (const h of hits) { let o = h.object; while (o && !o.userData.pick) o = o.parent; if (o && o.userData.pick) { cfg.onPick(o.userData.pick.kind, o.userData.pick.id); return; } }
    }
    function resize() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(stage); resize();
    new MutationObserver(() => { applyTheme(); build(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyTheme(); build(); });

    /* ----- 카메라 디렉터 ----- */
    const camPos = new T.Vector3(), tmpV = new T.Vector3();
    function updateDirector(now, dt) {
      if (!director.on || now < director.pauseUntil) return;
      if (director.shot && now > director.shot.until) director.shot = null;
      if (!director.shot && director.queue.length) {
        director.queue.sort((a, b) => b.prio - a.prio); const s = director.queue.shift();
        director.shot = Object.assign({ until: now + s.dur * 1000 }, s);
      }
      const s = director.shot; if (!s) {
        // 유휴: 홈 뷰로 천천히 복귀
        cam.target.x = damp(cam.target.x, home.target.x, 1.2, dt); cam.target.z = damp(cam.target.z, home.target.z, 1.2, dt); cam.radius = damp(cam.radius, home.radius, 1.2, dt); cam.phi = damp(cam.phi, 0.95, 1.2, dt);
        return;
      }
      const p = s.ag.group.position; let tx = p.x, tz = p.z, rad = 9, phi = 0.85;
      if (s.kind === "handoff" && s.other) { tx = (p.x + s.other.group.position.x) / 2; tz = (p.z + s.other.group.position.z) / 2; rad = clamp(Math.hypot(p.x - s.other.group.position.x, p.z - s.other.group.position.z) * 1.2 + 7, 8, 24); }
      if (s.kind === "hire") { rad = 11; phi = 0.9; }
      if (s.kind === "follow") { rad = 8; }
      cam.target.x = damp(cam.target.x, tx, 2.5, dt); cam.target.z = damp(cam.target.z, tz, 2.5, dt); cam.radius = damp(cam.radius, rad, 2.0, dt); cam.phi = damp(cam.phi, phi, 2.0, dt);
    }

    /* ----- 메인 루프 ----- */
    let visible = true; document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) { lastFrame = performance.now(); requestAnimationFrame(loop); } });
    function loop(now) {
      if (!visible) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now; const t = now / 1000;
      if (layout) updateDirector(now, dt);
      const sp = Math.sin(cam.phi);
      camPos.set(cam.target.x + cam.radius * sp * Math.sin(cam.theta), cam.target.y + cam.radius * Math.cos(cam.phi), cam.target.z + cam.radius * sp * Math.cos(cam.theta));
      camera.position.lerp(camPos, 0.5); camera.lookAt(cam.target);
      eng.agents.forEach((ag) => {
        if (ag.busy && ag.atSeat() && !ag.path && !ag.queue.length && (ag.state === "sit" || ag.state === "idle")) ag.setState("type");
        ag.update(dt, t);
      });
      for (let i = eng.anims.length - 1; i >= 0; i--) {
        const a = eng.anims[i]; if (now < a.t0) continue; a.m.visible = true; const p = clamp((now - a.t0) / a.dur, 0, 1);
        a.m.scale.setScalar(1 + p * 2.2); a.m.material.opacity = 0.9 * (1 - p);
        if (p >= 1) { fxGroup.remove(a.m); a.m.geometry.dispose(); a.m.material.dispose(); eng.anims.splice(i, 1); }
      }
      renderer.render(scene, camera);
      // 라벨 투영
      const w = stage.clientWidth, h = stage.clientHeight;
      for (const l of eng.labels) {
        const pos = l.getPos(tmpV); tmpV.copy(pos).project(camera);
        if (tmpV.z > 1 || tmpV.z < -1 || Math.abs(tmpV.x) > 1.2 || Math.abs(tmpV.y) > 1.2) { l.el.style.display = "none"; continue; }
        l.el.style.display = "";
        l.el.style.transform = `translate(${((tmpV.x + 1) / 2) * w}px, ${((1 - tmpV.y) / 2) * h - l.dy}px) translate(-50%, -100%)`;
      }
    }
    requestAnimationFrame(loop);

    function debugCam(o) { // 테스트·스크린샷용 고정 시점
      if (o.theta != null) cam.theta = o.theta; if (o.phi != null) cam.phi = o.phi; if (o.radius != null) cam.radius = o.radius;
      if (o.target) cam.target.set(o.target[0], 0, o.target[1]); director.pauseUntil = Infinity; director.shot = null;
    }
    return Object.assign(eng, { build, setBusy, clearBusy, handoff, hire, resetView, follow, setDirector, applyTheme, debugCam, layout: () => layout });
  }

  window.Office3D = { create };
})();
