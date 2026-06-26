import { EnergyCalculator, SystemParameters } from './EnergyCalculator';
import { UIManager } from '../ui/UIManager';
import { SceneManager } from '../graphics/SceneManager';

export class SimulationController {
  private calculator: EnergyCalculator;
  private uiManager: UIManager;
  private sceneManager: SceneManager;

  private timeOfDay: number = 6; // Start at 06:00
  private timeMultiplier: number = 1.2; // 1 second real time = 1.2 hours simulated (20 seconds for 24 hours)
  private lastTickTime: number = 0;
  private isRunning: boolean = true;

  constructor() {
    const initialParams: SystemParameters = {
      panelVoltage: 14.86,
      panelCurrent: 2.03,
      irradiation: 1000,
      panelArea: 11.11, // Area untuk 2000 Wp pada efisiensi 18%
      inverterInputVoltage: 13.64,
      inverterInputCurrent: 2.33,
      inverterOutputVoltage: 233.5,
      inverterOutputCurrent: 0.11,
      batteryCapacityAh: 200,
      batteryVoltage: 48,
      initialSoC: 80,
      consumptionPower: 300, // Beban konstan default 300W
      envTemp: 30,
      noct: 45,
      gamma: 0, // Set ke 0 agar nilai awal persis seperti tabel di Foto 3 (tanpa thermal loss)

      // Parameter baru
      pvWp: 2000,
      pvEff: 18,
      batteryCapacityKwh: 10,
      batteryDodLimit: 30,
      inverterEfficiency: 92,
      isBebanKonstan: true,
      selectedMonth: 9 // September
    };

    this.calculator = new EnergyCalculator(initialParams);
    this.uiManager = new UIManager();
    this.sceneManager = new SceneManager();

    // Setup callbacks
    this.uiManager.onTogglePause = (isPaused) => {
      this.isRunning = !isPaused;
      // Resinkronisasi waktu agar tidak melompat ketika di-resume
      if (!isPaused) {
        this.lastTickTime = performance.now();
      }
    };

    this.uiManager.onTimeChange = (time) => {
      this.timeOfDay = time;
      // Langsung update scene dan UI agar responsif meskipun sedang di-pause
      this.forceUpdateState();
    };

    this.uiManager.onInputUpdate = () => {
      // Trigger update ketika temp atau beban diganti
      this.forceUpdateState();
    };

    requestAnimationFrame(this.loop.bind(this));
  }

  private forceUpdateState() {
    const userParams = this.uiManager.readInputParameters();
    this.calculator.updateParameters(userParams);
    const results = this.calculator.calculateTick(0, this.timeOfDay); // delta 0 karena hanya update statis
    this.uiManager.updateDashboardValues(results, this.timeOfDay);
    this.sceneManager.update(this.timeOfDay, results);
    // Tambahkan cek jika beban kurang dari 0 dan baterai kosong
    const isPowered = results.batterySoC > 0 || results.powerOutPanel > 0;
    this.sceneManager.updateHouseLights(userParams.isLampOn === true && isPowered);
  }

  private loop(timestamp: number) {
    if (!this.lastTickTime) this.lastTickTime = timestamp;
    const deltaTimeMs = timestamp - this.lastTickTime;
    this.lastTickTime = timestamp;

    if (this.isRunning) {
      // 1 real second = 1 simulated hour (for fast testing)
      const deltaTimeHours = (deltaTimeMs / 1000) * this.timeMultiplier;
      this.timeOfDay += deltaTimeHours;
      if (this.timeOfDay >= 24) {
        this.timeOfDay = this.timeOfDay % 24; // wrap around
      }

      // Update parameters from UI (if live tweaking is enabled)
      const userParams = this.uiManager.readInputParameters();
      this.calculator.updateParameters(userParams);

      // Run calculation step
      const results = this.calculator.calculateTick(deltaTimeHours, this.timeOfDay);

      // We only update charts periodically, not every frame.
      // E.g. when hour changes (floor of timeOfDay)
      // For simplicity, update UI every frame here but Chart update frequency could be throttled.
      // But let's just throttle chart to every 1 simulated hour.
      if (Math.floor(this.timeOfDay - deltaTimeHours) !== Math.floor(this.timeOfDay)) {
        const timeStr = `${Math.floor(this.timeOfDay).toString().padStart(2, '0')}:00`;
        // Hack to get current params for chart
        const currentParams = { ...this.calculator['params'] };
        this.uiManager.updateCharts(timeStr, results, currentParams);
      }

      this.uiManager.updateDashboardValues(results, this.timeOfDay);
      this.sceneManager.update(this.timeOfDay, results);
      
      const isPowered = results.batterySoC > 0 || results.powerOutPanel > 0;
      this.sceneManager.updateHouseLights(userParams.isLampOn === true && isPowered);
    }

    requestAnimationFrame(this.loop.bind(this));
  }
}
