let sizeCanvasX = 900;
let sizeCanvasY = 600;

let bgSkyBlue;
let landscape;
let houseHasElectricity;
let houseNoElectricity;
let inverter;
let panel;
let pole;
let ac;
let dc;
let cloud;
let wires = [];
let clouds = [];


// --- Kelas Partikel (Tidak diubah) ---
class ElectricParticle {
  constructor(totalWireLength, particleImage) {
    this.totalWireLength = totalWireLength;
    this.t = random(0, totalWireLength);
    this.speed = random(2, 4);
    this.image = particleImage;
    this.size = 60;
    this.active = true;
  }

  update() {
    this.t = (this.t + this.speed) % this.totalWireLength;
  }

  display(x, y) {
    if (this.active) {
      image(this.image, x, y, this.size, this.size);
    }
  }
}

// --- Kelas Kabel (Diubah untuk menggunakan efisiensi) ---
class Wire {
  constructor(ax, ay, bx, by, cx, cy, particleImg, type) {
    this.A = createVector(ax, ay);
    this.B = createVector(bx, by);
    this.C = createVector(cx, cy);

    this.d1 = p5.Vector.dist(this.A, this.B);
    this.d2 = p5.Vector.dist(this.B, this.C);
    this.totalLength = this.d1 + this.d2;
    this.type = type; // "dc" atau "ac"

    this.particles = [];
    let numParticles = (this.type === 'dc') ? 7 : 5;
    for (let i = 0; i < numParticles; i++) {
      this.particles.push(new ElectricParticle(this.totalLength, particleImg));
    }
  }

  drawWireShape() {
    stroke(50);
    strokeWeight(3);
    noFill();
    beginShape();
    vertex(this.A.x, this.A.y);
    vertex(this.B.x, this.B.y);
    vertex(this.C.x, this.C.y);
    endShape();
  }

  updateAndDisplayParticles() {
    // Menentukan efisiensi berdasarkan tipe kabel (DC dari panel, AC dari inverter)
    let efficiency = (this.type === 'dc') ? panelEfficiencyGlobal : inverterEfficiencyGlobal;
    
    // Jumlah partikel aktif dan ukurannya bergantung pada efisiensi
    let activeCount = floor(map(efficiency, 0, 1, 0, this.particles.length));
    
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = i < activeCount;
      this.particles[i].size = map(efficiency, 0, 1, 15, 60); // Ukuran partikel dinamis
      this.particles[i].speed = map(efficiency, 0, 1, 0.5, 4); // Kecepatan partikel dinamis

      if (this.particles[i].active) {
        this.particles[i].update();
        let pos;
        if (this.particles[i].t < this.d1) {
          let amt = this.particles[i].t / this.d1;
          pos = p5.Vector.lerp(this.A, this.B, amt);
        } else {
          let amt = (this.particles[i].t - this.d1) / this.d2;
          pos = p5.Vector.lerp(this.B, this.C, amt);
        }
        this.particles[i].display(pos.x, pos.y);
      }
    }
  }
}

// --- Kelas Awan (Tidak diubah) ---
class Cloud {
  constructor() {
    this.reset();
    this.speed = random(0.5, 1.5);
  }
  reset() {
    this.x = random(-width, -100);
    this.y = random(50, height / 3);
    this.width = random(100, 300);
    this.height = random(50, 150);
    this.alpha = random(100, 200);
  }
  update() {
    this.x += this.speed;
    if (this.x > width + this.width) {
      this.reset();
    }
  }
  display() {
    tint(255, this.alpha);
    image(cloud, this.x, this.y, this.width, this.height);
    noTint();
  }
}

function preload() {
  bgSkyBlue = loadImage('./assets/sky-blue.png');
  landscape = loadImage('./assets/landscape.png');
  houseHasElectricity = loadImage('./assets/house-has-electricity.png');
  houseNoElectricity = loadImage('./assets/house-no-electricity.png');
  cloud = loadImage('./assets/cloud.png');
  inverter = loadImage('./assets/inverter.png');
  panel = loadImage('./assets/panel.png');
  pole = loadImage('./assets/pole.png');
  ac = loadImage('./assets/ac.png');
  dc = loadImage('./assets/dc.png');
}

function setup() {
  let myCanvas = createCanvas(sizeCanvasX, sizeCanvasY);
  noStroke();
  frameRate(60);
  myCanvas.parent('simulation-canvas');

  // Mendefinisikan kabel DC (panel -> inverter) dan AC (inverter -> rumah)
  wires.push(new Wire(395, 370, 630, 370, 630, 480, dc, "dc"));
  wires.push(new Wire(195, 505, 195, 360, 390, 360, ac, "ac"));
  
  for (let i = 0; i < 10; i++) {
    clouds.push(new Cloud());
  }
}

function draw() {
  image(bgSkyBlue, 0, 0);
  image(landscape, 0, 70, width, height, 0, 0, landscape.width, landscape.height);
  
  for (let cloud of clouds) {
    cloud.update();
    cloud.display();
  }
  
  drawSun();
  drawPole();
  drawWiresAndParticles();
  drawInverter();
  drawPanel();
  drawHouse();
}

function drawWiresAndParticles() {
  push();
  imageMode(CENTER);
  for (let wire of wires) {
    wire.drawWireShape();
    wire.updateAndDisplayParticles();
  }
  pop();
}

function drawPole() {
  image(pole, 0, 200, 800, 800 * (pole.height / pole.width));
}

function drawInverter() {
  image(inverter, 285, 320, 200, 200 * (inverter.height / inverter.width));
}

function drawPanel() {
  // Membuat panel sedikit "menyala" berdasarkan efisiensinya
  let tintValue = map(panelEfficiencyGlobal, 0, 1, 150, 255);
  tint(tintValue);
  image(panel, 75, 425, 200, 200 * (panel.height / panel.width));
  noTint();
}

function drawHouse() {
  let targetWidth = 500;
  let aspectRatio = houseHasElectricity.height / houseHasElectricity.width;
  let targetHeight = targetWidth * aspectRatio;

  // Rumah menyala jika ada daya AC yang dihasilkan
  if (finalPowerACGlobal > 0) {
    image(houseHasElectricity, 450, 300, targetWidth, targetHeight);
  } else {
    image(houseNoElectricity, 450, 300, targetWidth, targetHeight);
  }
}

function drawSun() {
  let centerX = 0;
  let centerY = 0;
  let maxRadius = 100;
  let lightIntensity = map(panelEfficiencyGlobal, 0, 1, 0.2, 1); // Intensitas matahari visual

  for (let r = maxRadius * 2; r > maxRadius; r -= 2) {
    let t = map(r, maxRadius * 2, maxRadius, 0, 1);
    let alpha = 20 * t * lightIntensity;
    fill(255, 204, 0, alpha);
    ellipse(centerX, centerY, r * 2, r * 2);
  }

  fill(lerpColor(color(255, 100, 0), color(255, 204, 0), lightIntensity));
  ellipse(centerX, centerY, maxRadius * 2, maxRadius * 2);
}