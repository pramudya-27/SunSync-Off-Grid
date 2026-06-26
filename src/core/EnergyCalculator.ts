export interface SystemParameters {
  panelVoltage: number;
  panelCurrent: number;
  irradiation: number; // W/m2 (statis, tetap dipertahankan untuk legacy)
  panelArea: number;   // m2
  inverterInputVoltage: number;
  inverterInputCurrent: number;
  inverterOutputVoltage: number;
  inverterOutputCurrent: number;
  
  // New properties for Off-Grid
  batteryCapacityAh: number;
  batteryVoltage: number;
  initialSoC: number; // 0 to 100
  consumptionPower: number; // Watt

  // Thermal Derating Parameters
  envTemp: number; // Celsius
  noct: number;    // Nominal Operating Cell Temperature
  gamma: number;   // Temperature Coefficient (%/C, e.g. -0.4)
  
  // Custom states
  isLampOn?: boolean;

  // New properties matching the photo
  pvWp?: number;
  pvEff?: number;
  batteryCapacityKwh?: number;
  batteryDodLimit?: number;
  inverterEfficiency?: number;
  isBebanKonstan?: boolean;
  selectedMonth?: number;
}

export interface SimulationResults {
  powerInPanel: number;
  powerOutPanel: number;
  efficiencyPanel: number;
  powerInInverter: number;
  powerOutInverter: number;
  efficiencyInverter: number;
  
  // Off-Grid extensions
  batterySoC: number;
  surplusDeficitPower: number;
  
  // Thermal data
  cellTemp: number;
}

const MONTHLY_GHI = [
  0,
  4.37, // Jan
  4.31, // Feb
  4.64, // Mar
  4.80, // Apr
  4.42, // Mei
  4.17, // Jun
  4.56, // Jul
  4.99, // Agu
  5.27, // Sep
  5.19, // Okt
  4.54, // Nov
  4.46  // Des
];

export class EnergyCalculator {
  private params: SystemParameters;
  private currentSoC: number;

  constructor(initialParams: SystemParameters) {
    this.params = initialParams;
    this.currentSoC = initialParams.initialSoC;
  }

  public updateParameters(newParams: Partial<SystemParameters>) {
    this.params = { ...this.params, ...newParams };
    if (newParams.initialSoC !== undefined) {
      this.currentSoC = newParams.initialSoC;
    }
  }

  public calculateTick(deltaTimeHours: number, timeOfDay: number): SimulationResults {
    // 1. Dapatkan iradiasi dari profil harian Jakarta yang disederhanakan (Foto 3)
    let baselineIrrad = 0;
    if (timeOfDay >= 5.0 && timeOfDay < 6.0) {
      baselineIrrad = (timeOfDay - 5.0) * 120;
    } else if (timeOfDay >= 6.0 && timeOfDay < 9.0) {
      baselineIrrad = 120 + ((timeOfDay - 6.0) / 3.0) * (550 - 120);
    } else if (timeOfDay >= 9.0 && timeOfDay < 12.0) {
      baselineIrrad = 550 + ((timeOfDay - 9.0) / 3.0) * (930 - 550);
    } else if (timeOfDay >= 12.0 && timeOfDay < 15.0) {
      baselineIrrad = 930 + ((timeOfDay - 12.0) / 3.0) * (600 - 930);
    } else if (timeOfDay >= 15.0 && timeOfDay < 18.0) {
      baselineIrrad = 600 + ((timeOfDay - 15.0) / 3.0) * (100 - 600);
    } else if (timeOfDay >= 18.0 && timeOfDay < 19.0) {
      baselineIrrad = 100 - (timeOfDay - 18.0) * 100;
    } else {
      baselineIrrad = 0;
    }

    // Skala iradiasi berdasarkan bulan yang dipilih (Foto 1)
    // September (5.27) dianggap sebagai skala 1.0 (nilai standar di Foto 3)
    const selectedMonth = this.params.selectedMonth ?? 9;
    const ghiMonth = MONTHLY_GHI[selectedMonth] || 5.27;
    const scaleFactor = ghiMonth / 5.27;
    const currentIrradiation = baselineIrrad * scaleFactor;

    // 2. Kalkulasi PV Array (Foto 2 & 3)
    const pvWp = this.params.pvWp ?? 2000;
    const pvEff = this.params.pvEff ?? 18;
    
    // Luas area panel dihitung secara fisik berdasarkan Wp dan efisiensi pada STC (1000 W/m2)
    const area = pvWp / (1000 * (pvEff / 100));
    const powerInPanel = currentIrradiation * area;
    
    // Daya PV linear: P = P_max * (G / 1000)
    const powerSTC = pvWp * (currentIrradiation / 1000);
    
    // Thermal Derating (Suhu Lingkungan)
    let cellTemp = this.params.envTemp;
    if (currentIrradiation > 0) {
      cellTemp = this.params.envTemp + (this.params.noct - 20) * (currentIrradiation / 800);
    }
    
    // Jika gamma = 0, tidak ada penurunan daya akibat suhu (persis seperti angka di Foto 3)
    const thermalDeratingFactor = 1 + (this.params.gamma / 100) * (cellTemp - 25);
    let powerOutPanel = powerSTC * thermalDeratingFactor;
    if (powerOutPanel < 0) powerOutPanel = 0;
    
    const efficiencyPanel = powerInPanel > 0 ? (powerOutPanel / powerInPanel) * 100 : 0;
    
    // 3. Kalkulasi Inverter (Foto 2)
    const invEff = this.params.inverterEfficiency ?? 92;
    const powerAvailableAC = powerOutPanel * (invEff / 100);
    
    // 4. Kalkulasi Beban & Baterai Off-Grid (Foto 2 & 3)
    const consumption = this.params.consumptionPower;
    
    // Dalam off-grid, jika daya PV AC kurang dari beban, baterai mensuplai kekurangannya
    let surplusDeficitPower = powerAvailableAC - consumption;
    
    const batteryCapacityWh = (this.params.batteryCapacityKwh ?? 10) * 1000;
    const dodLimit = this.params.batteryDodLimit ?? 30;

    if (batteryCapacityWh > 0) {
      let effectiveSurplusDeficit = surplusDeficitPower;

      // Jika SoC berada di bawah batas DoD (misal 30%), baterai tidak boleh dikuras lagi
      if (this.currentSoC <= dodLimit && surplusDeficitPower < 0) {
        // Beban terputus karena baterai mencapai batas DoD
        // Inverter mati, beban riil menjadi 0
        effectiveSurplusDeficit = powerAvailableAC; // hanya menyalurkan daya PV langsung jika ada
      }

      // Delta Energi = Daya * Waktu (Jam)
      const energyDeltaWh = effectiveSurplusDeficit * deltaTimeHours;
      const socDelta = (energyDeltaWh / batteryCapacityWh) * 100;
      this.currentSoC += socDelta;
      
      // Batasi SoC antara 0% dan 100%
      this.currentSoC = Math.max(0, Math.min(100, this.currentSoC));
    }

    return {
      powerInPanel,
      powerOutPanel,
      efficiencyPanel,
      powerInInverter: powerOutPanel,
      powerOutInverter: powerAvailableAC,
      efficiencyInverter: invEff,
      batterySoC: this.currentSoC,
      surplusDeficitPower,
      cellTemp
    };
  }
}
