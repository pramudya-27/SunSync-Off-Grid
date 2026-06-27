import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader.js";
import {SimulationResults} from "../core/EnergyCalculator";

interface ElectricParticle {
  mesh: THREE.Mesh;
  curve: THREE.QuadraticBezierCurve3;
  t: number;
  speed: number;
}

interface CloudSprite {
  sprite: THREE.Sprite;
  speedX: number;
  startX: number;
  rangeX: number;
  baseY: number;
}

export class SceneManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;

  private isLoaded: boolean = false;
  private skyMesh: THREE.Object3D | null = null;

  // House Lights
  private house1Light: THREE.PointLight | null = null;
  private house2Light: THREE.PointLight | null = null;

  // Cables
  private cableCurves: THREE.QuadraticBezierCurve3[] = [];

  // Electricity animation
  private electricParticles: ElectricParticle[] = [];
  private isPowered: boolean = true;

  // Clouds
  private cloudSprites: CloudSprite[] = [];
  private cloudTimeOfDay: number = 12;

  constructor() {
    this.container = document.getElementById("simulation-canvas")!;
    this.container.innerHTML = "";

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      10000,
    );
    this.camera.position.set(0, 25, 80);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight,
    );
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 5, 0);

    // Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffee, 1.5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.scene.add(this.sunLight);

    // Sun mesh
    const sunGeo = new THREE.SphereGeometry(10, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({color: 0xffdd00});
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    // Moon mesh
    const moonGeo = new THREE.SphereGeometry(8, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({color: 0xdddddd});
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moonMesh);

    window.addEventListener("resize", this.onWindowResize.bind(this));

    this.loadModels();
    this.animate();
  }

  private async loadModels() {
    const loader = new GLTFLoader();

    // Konfigurasi DRACOLoader untuk mendukung model terkompresi
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.6/",
    );
    loader.setDRACOLoader(dracoLoader);

    try {
      // Sky
      loader.load("/assets/Cloud/skybox_skydays_3.glb", (gltf) => {
        this.skyMesh = gltf.scene;
        this.skyMesh.scale.set(5000, 5000, 5000);
        this.scene.add(this.skyMesh);
      });

      // Land (Menggunakan optimized.glb berukuran 11.2 MB, bukan 120 MB)
      const landGltf = await loader.loadAsync(
        "/assets/Land/compressed_test.glb",
      );
      const land = landGltf.scene;
      land.position.set(0, 0, 0);
      land.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.scene.add(land);
      land.updateMatrixWorld(true);

      // Raycaster for ground height
      const getGroundHeight = (x: number, z: number): number => {
        const raycaster = new THREE.Raycaster();
        raycaster.set(
          new THREE.Vector3(x, 200, z),
          new THREE.Vector3(0, -1, 0),
        );
        const hits = raycaster.intersectObject(land, true);
        return hits.length > 0 ? hits[0].point.y : 0;
      };

      // ─── Solar Panel ────────────────────────────────────────────────
      const panelGltf = await loader.loadAsync(
        "/assets/SolarPanel/large_solar_panel_array.glb",
      );
      const panel = panelGltf.scene;
      panel.scale.set(2, 2, 2);
      const panelX = -40,
        panelZ = 25;
      const panelGroundY = getGroundHeight(panelX, panelZ);
      panel.position.set(panelX, panelGroundY, panelZ);
      panel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.scene.add(panel);

      // Panel cable attach point (top center of panel)
      const panelBox = new THREE.Box3().setFromObject(panel);
      const panelAttach = new THREE.Vector3(panelX, panelBox.max.y - 2, panelZ);

      // ─── Custom Telephone Pole (Three.js geometry) ───────────────────
      // Kamera arah: panel ada di kanan, rumah di kiri. Tiang di tengah.
      const poleX = -5,
        poleZ = 5;
      const poleGroundY = getGroundHeight(poleX, poleZ);
      const poleTopY = poleGroundY + 22; // setinggi 22 unit

      this.buildTelephonePole(poleX, poleGroundY, poleZ, 22);

      // ─── Load House Model dulu agar bisa hitung tinggi atap untuk kabel ──
      const houseGltf = await loader.loadAsync(
        "/assets/house/small_japanese_house.glb",
      );
      const house = houseGltf.scene;
      const houseScale = 3;
      house.scale.set(houseScale, houseScale, houseScale);

      const houseX = 52,
        houseZ = 2;
      house.position.set(houseX, 0, houseZ);
      // Hitung bounding box untuk offset tanah & tinggi atap
      const houseBox = new THREE.Box3().setFromObject(house);
      const houseGroundY = getGroundHeight(houseX, houseZ);
      const houseBottomOffset = houseBox.min.y; // bisa negatif
      house.position.set(houseX, houseGroundY - houseBottomOffset, houseZ);

      // Tinggi atap aktual
      const houseRoofY =
        houseGroundY -
        houseBottomOffset +
        (houseBox.max.y - houseBox.min.y) * 0.85;

      house.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.scene.add(house);

      // Light for Japanese House
      // Posisikan di luar rumah sedikit agar cahayanya menyinari dinding luar
      this.house1Light = new THREE.PointLight(0xffcc55, 0, 150);
      this.house1Light.position.set(houseX - 12, houseGroundY + 8, houseZ + 12);
      this.house1Light.castShadow = true;
      this.scene.add(this.house1Light);

      // Tiang & rumah attach points untuk kabel
      const poleTip = new THREE.Vector3(poleX, poleTopY, poleZ);
      // Kabel ke rumah: dari puncak tiang ke atap rumah
      const houseAttach = new THREE.Vector3(houseX - 5, houseRoofY, houseZ);

      // Kabel 1: Panel ke Tiang
      const curve1 = this.drawCable(panelAttach, poleTip);
      // Kabel 2: Tiang ke Rumah Biru (Japanese House)
      const curve2 = this.drawCable(poleTip, houseAttach);

      // Rumah Abu-abu (bawaan dari map land)
      // Geser titik attach ke ujung atap yang menghadap rumah biru agar tidak menembus cerobong/kubah
      const house2X = 11,
        house2Z = -23;
      const house2GroundY = getGroundHeight(house2X, house2Z);
      const house2Attach = new THREE.Vector3(
        house2X,
        house2GroundY + -0.1,
        house2Z,
      );

      // Light for Gray House
      // Posisikan di luar rumah sedikit agar cahayanya menyinari dinding luar
      this.house2Light = new THREE.PointLight(0xffcc55, 0, 150);
      this.house2Light.position.set(
        house2X + 12,
        house2GroundY + 8,
        house2Z + 12,
      );
      this.house2Light.castShadow = true;
      this.scene.add(this.house2Light);

      // Kabel 3: Rumah Biru ke Rumah Abu-abu
      const curve3 = this.drawCable(houseAttach, house2Attach, 6);

      this.cableCurves = [curve1, curve2, curve3];

      // ─── Electricity Particles ────────────────────────────────────────
      this.spawnElectricParticles();

      // ─── Animated Clouds ──────────────────────────────────────────────
      this.initClouds();

      this.isLoaded = true;
    } catch (e) {
      console.error("Error loading models:", e);
    }
  }

  private buildTelephonePole(
    x: number,
    groundY: number,
    z: number,
    height: number,
  ) {
    const wood = new THREE.MeshLambertMaterial({color: 0x6b4226});
    const metal = new THREE.MeshLambertMaterial({color: 0x888888});

    // Main post
    const postGeo = new THREE.CylinderGeometry(0.25, 0.35, height, 8);
    const post = new THREE.Mesh(postGeo, wood);
    post.position.set(x, groundY + height / 2, z);
    post.castShadow = true;
    this.scene.add(post);

    // Cross arm horizontal
    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 7, 8);
    const arm = new THREE.Mesh(armGeo, wood);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(x, groundY + height - 2, z);
    arm.castShadow = true;
    this.scene.add(arm);

    // Cross arm braces (diagonal supports)
    const braceGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.5, 6);
    [-1, 1].forEach((side) => {
      const brace = new THREE.Mesh(braceGeo, wood);
      brace.position.set(x + side * 1.5, groundY + height - 3.5, z);
      brace.rotation.z = side * 0.5;
      this.scene.add(brace);
    });

    // Insulators (small spheres on top of arm ends)
    [-3, 3].forEach((offset) => {
      const insGeo = new THREE.SphereGeometry(0.2, 8, 8);
      const ins = new THREE.Mesh(insGeo, metal);
      ins.position.set(x + offset, groundY + height - 1.8, z);
      this.scene.add(ins);
    });
  }

  private drawCable(
    start: THREE.Vector3,
    end: THREE.Vector3,
    droop: number = 4,
  ): THREE.QuadraticBezierCurve3 {
    // Control point: midpoint pulled DOWN to simulate gravity droop
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      Math.min(start.y, end.y) - droop, // droop ke bawah
      (start.z + end.z) / 2,
    );

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

    // Tube geometry agar kabel terlihat jelas
    const tubePoints = curve.getPoints(30);
    const path = new THREE.CatmullRomCurve3(tubePoints);
    const tubeGeo = new THREE.TubeGeometry(path, 30, 0.08, 6, false);
    const tubeMat = new THREE.MeshLambertMaterial({color: 0x1a1a1a});
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.castShadow = true;
    this.scene.add(tube);

    return curve;
  }

  private spawnElectricParticles() {
    if (this.cableCurves.length === 0) return;

    this.electricParticles.forEach((p) => this.scene.remove(p.mesh));
    this.electricParticles = [];

    this.cableCurves.forEach((curve, i) => {
      // 2 partikel per segmen kabel, dengan jarak offset
      [0, 0.5].forEach((offset) => {
        const geo = new THREE.SphereGeometry(0.25, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.95,
        });
        const mesh = new THREE.Mesh(geo, mat);

        // Glow ring around particle
        const glowGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.25,
          side: THREE.BackSide,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        mesh.add(glow);

        this.scene.add(mesh);
        this.electricParticles.push({
          mesh,
          curve,
          t: offset,
          speed: 0.003 + i * 0.001,
        });
      });
    });
  }

  private updateElectricParticles() {
    if (!this.isPowered) {
      this.electricParticles.forEach((p) => {
        p.mesh.visible = false;
      });
      return;
    }

    this.electricParticles.forEach((p) => {
      p.t = (p.t + p.speed) % 1;
      const pos = p.curve.getPoint(p.t);
      p.mesh.position.copy(pos);
      p.mesh.visible = true;

      // Pulse scale untuk efek kedip listrik
      const pulse = 1 + 0.4 * Math.sin(Date.now() * 0.015 + p.t * 10);
      p.mesh.scale.setScalar(pulse);

      // Warna: cyan di siang (panel aktif), orange di malam (baterai)
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(this.isPowered ? 0x00ffff : 0xff8800);
    });
  }

  private initClouds() {
    const loader = new THREE.TextureLoader();
    loader.load("/assets/cloud.png", (tex) => {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      });
      const count = 8;
      for (let i = 0; i < count; i++) {
        const sprite = new THREE.Sprite(mat.clone());
        const scale = 15 + Math.random() * 25;
        sprite.scale.set(scale * 2.5, scale, 1);
        // Sebar di langit: Y tinggi, X acak, Z di belakang scene
        const startX = -120 + Math.random() * 240;
        const baseY = 55 + Math.random() * 30;
        const z = -80 + Math.random() * 60;
        sprite.position.set(startX, baseY, z);
        this.scene.add(sprite);
        this.cloudSprites.push({
          sprite,
          speedX: 0.02 + Math.random() * 0.04,
          startX: startX,
          rangeX: 240,
          baseY,
        });
      }
    });
  }

  private updateClouds() {
    const isDay = this.cloudTimeOfDay >= 6 && this.cloudTimeOfDay <= 18;
    this.cloudSprites.forEach((c) => {
      c.sprite.position.x += c.speedX;
      // Reset ke kiri jika sudah keluar kanan
      if (c.sprite.position.x > 130) {
        c.sprite.position.x = -130;
      }
      // Transparansi: hanya terlihat saat siang
      const mat = c.sprite.material as THREE.SpriteMaterial;
      mat.opacity = isDay ? 0.75 : 0.15;
    });
  }

  public update(timeOfDay: number, results: SimulationResults) {
    if (!this.isLoaded) return;
    this.cloudTimeOfDay = timeOfDay;

    // Apakah ada daya
    this.isPowered = results.powerOutPanel > 0 || results.batterySoC > 0;

    // Posisi matahari
    const angle = ((timeOfDay - 6) / 12) * Math.PI;
    const radius = 300;
    const sunX = -Math.cos(angle) * radius;
    const sunY = Math.sin(angle) * radius;
    const sunZ = -80;

    this.sunMesh.position.set(sunX, sunY, sunZ);
    this.sunLight.position.set(sunX, sunY, sunZ);

    // Bulan
    this.moonMesh.position.set(-sunX, -sunY, sunZ);

    // Pencahayaan siang/malam
    if (timeOfDay >= 6 && timeOfDay <= 18) {
      const intensity = Math.sin(angle);
      this.sunLight.intensity = Math.max(0.1, intensity * 2.0);
      this.ambientLight.intensity = 0.6;
      this.scene.background = new THREE.Color().setHSL(
        0.58,
        0.8,
        0.55 + intensity * 0.1,
      );
    } else {
      this.sunLight.intensity = 0;
      this.ambientLight.intensity = 0.08;
      this.scene.background = new THREE.Color(0x05060f);
    }

    // Skybox tint
    if (this.skyMesh) {
      const isDay = timeOfDay >= 6 && timeOfDay <= 18;
      this.skyMesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh)
            .material as THREE.MeshStandardMaterial;
          if (mat.color) mat.color.setHex(isDay ? 0xffffff : 0x111122);
        }
      });
    }
  }

  public updateHouseLights(isOn: boolean) {
    // Gunakan intensity yang jauh lebih besar agar terlihat jelas meski terhalang
    const intensity = isOn ? 150 : 0;
    if (this.house1Light) this.house1Light.intensity = intensity;
    if (this.house2Light) this.house2Light.intensity = intensity;
  }

  private onWindowResize() {
    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight,
    );
  }

  private animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.updateElectricParticles();
    this.updateClouds();
    this.renderer.render(this.scene, this.camera);
  }
}
