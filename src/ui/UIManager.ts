import Chart from 'chart.js/auto';
import { SimulationResults, SystemParameters } from '../core/EnergyCalculator';

export class UIManager {
  private energyChart: Chart | null = null;
  private socChart: Chart | null = null;

  private historyLabels: string[] = [];
  private historyPowerProd: number[] = [];
  private historyPowerCons: number[] = [];
  private historySoC: number[] = [];

  public onTogglePause: ((isPaused: boolean) => void) | null = null;
  public onTimeChange: ((time: number) => void) | null = null;
  public onInputUpdate: (() => void) | null = null;

  private isPaused: boolean = false;

  constructor() {
    this.initCharts();
    this.setupExportListeners();
    this.setupControlListeners();
  }

  private setupExportListeners() {
    const btnCsv = document.getElementById('btn-export-csv');
    const btnPng = document.getElementById('btn-export-png');

    if (btnCsv) {
      btnCsv.addEventListener('click', () => this.exportCSV());
    }
    if (btnPng) {
      btnPng.addEventListener('click', () => this.exportPNG());
    }
  }

  private setupControlListeners() {
    const btnPause = document.getElementById('btn-toggle-pause');
    const inputTime = document.getElementById('input-time') as HTMLInputElement;

    if (btnPause) {
      btnPause.addEventListener('click', () => {
        this.isPaused = !this.isPaused;
        btnPause.innerText = this.isPaused ? 'Mulai Simulasi' : 'Pause Simulasi';
        if (this.onTogglePause) this.onTogglePause(this.isPaused);
      });
    }

    if (inputTime) {
      inputTime.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (this.onTimeChange) this.onTimeChange(val);
      });
    }

    // Trigger onInputUpdate untuk temperature
    const inputTemp = document.getElementById('input-env-temp') as HTMLInputElement;
    if (inputTemp) {
      inputTemp.addEventListener('input', () => {
        if (this.onInputUpdate) this.onInputUpdate();
      });
    }

    // Trigger onInputUpdate untuk toggles beban
    const toggles = ['toggle-kulkas', 'toggle-tv', 'toggle-lampu', 'toggle-kipas', 'toggle-pompa', 'toggle-ricecooker'];
    toggles.forEach(id => {
      const el = document.getElementById(id) as HTMLInputElement;
      if (el) {
        el.addEventListener('change', () => {
          if (this.onInputUpdate) this.onInputUpdate();
        });
      }
    });

    // Trigger onInputUpdate untuk parameter spesifikasi baru
    const newSpecInputs = [
      'input-month',
      'input-pv-wp',
      'input-pv-eff',
      'input-battery-kwh',
      'input-battery-voltage',
      'input-battery-dod',
      'input-inverter-eff',
      'toggle-beban-konstan'
    ];
    newSpecInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          if (this.onInputUpdate) this.onInputUpdate();
        });
        el.addEventListener('input', () => {
          if (this.onInputUpdate) this.onInputUpdate();
        });
      }
    });

    // --- Dropdown Logic ---
    const menuButtons = [
      { btnId: 'btn-menu-waktu', dropId: 'dropdown-waktu' },
      { btnId: 'btn-menu-panel', dropId: 'dropdown-panel' },
      { btnId: 'btn-menu-beban', dropId: 'dropdown-beban' }
    ];

    menuButtons.forEach(menu => {
      const btn = document.getElementById(menu.btnId);
      const dropdown = document.getElementById(menu.dropId);
      
      if (btn && dropdown) {
        // Toggle on click
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isShowing = dropdown.classList.contains('show');
          
          // Close all other dropdowns first
          menuButtons.forEach(m => {
            document.getElementById(m.dropId)?.classList.remove('show');
            document.getElementById(m.btnId)?.classList.remove('active');
          });

          // Toggle this one
          if (!isShowing) {
            dropdown.classList.add('show');
            btn.classList.add('active');
          }
        });

        // Prevent clicking inside dropdown from closing it
        dropdown.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      menuButtons.forEach(m => {
        document.getElementById(m.dropId)?.classList.remove('show');
        document.getElementById(m.btnId)?.classList.remove('active');
      });
    });
  }

  private exportCSV() {
    let csvContent = "data:text/csv;charset=utf-8,Waktu,Produksi Energi (W),Konsumsi (W),SoC (%)\n";
    for (let i = 0; i < this.historyLabels.length; i++) {
      const row = [
        this.historyLabels[i],
        this.historyPowerProd[i].toFixed(2),
        this.historyPowerCons[i].toFixed(2),
        this.historySoC[i].toFixed(2)
      ].join(",");
      csvContent += row + "\n";
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "simulasi_plts.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private exportPNG() {
    // Export Energy Chart
    if (this.energyChart) {
      const link = document.createElement("a");
      link.download = "grafik_energi.png";
      link.href = this.energyChart.toBase64Image();
      link.click();
    }
  }

  private initCharts() {
    const ctxEnergy = document.getElementById('energyChart') as HTMLCanvasElement;
    const ctxSoC = document.getElementById('socChart') as HTMLCanvasElement;

    if (ctxEnergy) {
      this.energyChart = new Chart(ctxEnergy, {
        type: 'line',
        data: {
          labels: this.historyLabels,
          datasets: [
            {
              label: 'Produksi Energi (W)',
              data: this.historyPowerProd,
              borderColor: '#4ade80',
              tension: 0.4,
              fill: true,
              backgroundColor: 'rgba(74, 222, 128, 0.2)'
            },
            {
              label: 'Konsumsi (W)',
              data: this.historyPowerCons,
              borderColor: '#f87171',
              tension: 0.4,
              fill: true,
              backgroundColor: 'rgba(248, 113, 113, 0.2)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: '#fff',
                font: { size: 10 },
                boxWidth: 10,
                padding: 6
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: '#aaa',
                font: { size: 9 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 5
              },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            y: {
              ticks: {
                color: '#aaa',
                font: { size: 9 }
              },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            }
          }
        }
      });
    }

    if (ctxSoC) {
      this.socChart = new Chart(ctxSoC, {
        type: 'line',
        data: {
          labels: this.historyLabels,
          datasets: [
            {
              label: 'State of Charge (%)',
              data: this.historySoC,
              borderColor: '#3b82f6',
              tension: 0.4,
              fill: true,
              backgroundColor: 'rgba(59, 130, 246, 0.2)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: '#fff',
                font: { size: 10 },
                boxWidth: 10,
                padding: 6
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: '#aaa',
                font: { size: 9 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 5
              },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            y: {
              min: 0,
              max: 100,
              ticks: {
                color: '#aaa',
                font: { size: 9 }
              },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            }
          }
        }
      });
    }
  }

  public updateCharts(timeStr: string, results: SimulationResults, params: SystemParameters) {
    if (this.historyLabels.length > 24) {
      this.historyLabels.shift();
      this.historyPowerProd.shift();
      this.historyPowerCons.shift();
      this.historySoC.shift();
    }

    this.historyLabels.push(timeStr);
    this.historyPowerProd.push(results.powerOutInverter);
    this.historyPowerCons.push(params.consumptionPower);
    this.historySoC.push(results.batterySoC);

    if (this.energyChart) this.energyChart.update();
    if (this.socChart) this.socChart.update();
  }

  public updateDashboardValues(results: SimulationResults, timeOfDay: number) {
    const elProd = document.getElementById('val-produksi');
    const elSoc = document.getElementById('val-soc');
    const elSurplus = document.getElementById('val-surplus');
    const elTime = document.getElementById('val-time');

    if (elProd) elProd.innerText = `${results.powerOutInverter.toFixed(2)} W`;
    if (elSoc) elSoc.innerText = `${results.batterySoC.toFixed(1)} %`;
    if (elSurplus) elSurplus.innerText = `${results.surplusDeficitPower.toFixed(2)} W`;
    
    const hours = Math.floor(timeOfDay);
    const minutes = Math.floor((timeOfDay - hours) * 60);
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    if (elTime) {
      elTime.innerText = timeString;
    }
    
    const labelTime = document.getElementById('label-time-val');
    if (labelTime) labelTime.innerText = timeString;

    const inputTime = document.getElementById('input-time') as HTMLInputElement;
    if (inputTime && !this.isPaused) {
      inputTime.value = timeOfDay.toString();
    }

      // ─── HUD Real-Time Overlay ───
      const hudTime = document.getElementById('hud-time');
      const hudPv = document.getElementById('hud-pv-power');
      const hudTemp = document.getElementById('hud-cell-temp');
      const hudLoad = document.getElementById('hud-load');
      const hudSoc = document.getElementById('hud-soc');
      const hudStatus = document.getElementById('hud-status');
      
      if (hudTime) hudTime.innerText = timeString;
      if (hudPv) hudPv.innerText = `${results.powerOutInverter.toFixed(1)} W`;
      if (hudTemp) hudTemp.innerText = `${(results.cellTemp || 30).toFixed(1)} °C`;
      if (hudSoc) hudSoc.innerText = `${results.batterySoC.toFixed(1)} %`;
      
      // Hitung beban saat ini untuk ditampilkan di HUD (dari DOM)
      const currentLoad = (document.getElementById('val-beban-total') as HTMLElement)?.innerText || "0 W";
      if (hudLoad) hudLoad.innerText = currentLoad;
      
      if (hudStatus) {
        // Reset classes
        hudStatus.className = 'hud-status-badge';
        
        if (results.surplusDeficitPower > 0 && results.batterySoC < 100) {
          hudStatus.innerText = "CHARGING";
          hudStatus.classList.add("charging");
          hudStatus.style.color = ""; // Clear inline color
        } else if (results.surplusDeficitPower < 0) {
          hudStatus.innerText = "DISCHARGING";
          hudStatus.classList.add("discharging");
          hudStatus.style.color = ""; // Clear inline color
        } else {
          hudStatus.innerText = "STANDBY";
          hudStatus.classList.add("standby");
          hudStatus.style.color = ""; // Clear inline color
        }
      }
    }

  public readInputParameters(): Partial<SystemParameters> {
    const getValue = (id: string, defaultVal: number) => {
      const el = document.getElementById(id) as HTMLInputElement;
      return el ? parseFloat(el.value) : defaultVal;
    };

    const toggleKonstan = document.getElementById('toggle-beban-konstan') as HTMLInputElement;
    const isBebanKonstan = toggleKonstan ? toggleKonstan.checked : false;

    let totalLoad = 0;
    const kulkas = document.getElementById('toggle-kulkas') as HTMLInputElement;
    const tv = document.getElementById('toggle-tv') as HTMLInputElement;
    const lampu = document.getElementById('toggle-lampu') as HTMLInputElement;
    const kipas = document.getElementById('toggle-kipas') as HTMLInputElement;
    const pompa = document.getElementById('toggle-pompa') as HTMLInputElement;
    const ricecooker = document.getElementById('toggle-ricecooker') as HTMLInputElement;

    const togglesList = [kulkas, tv, lampu, kipas, pompa, ricecooker];

    if (isBebanKonstan) {
      totalLoad = 300;
      // Disable load toggles visually
      togglesList.forEach(el => {
        if (el) el.disabled = true;
      });
    } else {
      // Enable load toggles
      togglesList.forEach(el => {
        if (el) el.disabled = false;
      });
      if (kulkas) { totalLoad += kulkas.checked ? 120 : 0; }
      if (tv) { totalLoad += tv.checked ? 80 : 0; }
      if (lampu) { totalLoad += lampu.checked ? 20 : 0; }
      if (kipas) { totalLoad += kipas.checked ? 50 : 0; }
      if (pompa) { totalLoad += pompa.checked ? 250 : 0; }
      if (ricecooker) { totalLoad += ricecooker.checked ? 350 : 0; }
    }
    
    // Update label beban total
    const elBeban = document.getElementById('val-beban-total');
    if (elBeban) elBeban.innerText = `${totalLoad} W`;

    // Update label suhu
    const tempVal = getValue('input-env-temp', 30);
    const elTempLabel = document.getElementById('label-temp-val');
    if (elTempLabel) elTempLabel.innerText = tempVal.toString();

    // Read new spec parameters
    const pvWp = getValue('input-pv-wp', 2000);
    const pvEff = getValue('input-pv-eff', 18);
    const batteryCapacityKwh = getValue('input-battery-kwh', 10);
    const batteryVoltage = getValue('input-battery-voltage', 48);
    const batteryDodLimit = getValue('input-battery-dod', 30);
    const inverterEfficiency = getValue('input-inverter-eff', 92);

    const selectedMonthEl = document.getElementById('input-month') as HTMLSelectElement;
    const selectedMonth = selectedMonthEl ? parseInt(selectedMonthEl.value) : 9;

    // Calculate legacy parameters for backward compatibility
    const panelArea = pvWp / (1000 * (pvEff / 100));
    const batteryCapacityAh = (batteryCapacityKwh * 1000) / batteryVoltage;

    return {
      consumptionPower: totalLoad,
      panelArea,
      batteryCapacityAh,
      batteryVoltage,
      envTemp: tempVal,
      isLampOn: lampu ? lampu.checked : false,
      
      // New parameters
      pvWp,
      pvEff,
      batteryCapacityKwh,
      batteryDodLimit,
      inverterEfficiency,
      isBebanKonstan,
      selectedMonth
    };
  }
}
