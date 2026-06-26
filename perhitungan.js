// Variabel global untuk komunikasi dengan sketch.js
let panelEfficiencyGlobal = 0;
let inverterEfficiencyGlobal = 0;
let finalPowerACGlobal = 0;


function hitungSimulasi() {
    // --- 1. Mengambil Nilai Input dari Form ---
    const tegangan_panel_v = parseFloat(document.getElementById('tegangan_panel_v').value);
    const arus_panel_a = parseFloat(document.getElementById('arus_panel_a').value);
    const iradiasi_j = parseFloat(document.getElementById('iradiasi_j').value);
    const luas_panel_a = parseFloat(document.getElementById('luas_panel_a').value);
    const tegangan_inverter_in_v = parseFloat(document.getElementById('tegangan_inverter_in_v').value);
    const arus_inverter_in_a = parseFloat(document.getElementById('arus_inverter_in_a').value);
    const tegangan_inverter_out_v = parseFloat(document.getElementById('tegangan_inverter_out_v').value);
    const arus_inverter_out_a = parseFloat(document.getElementById('arus_inverter_out_a').value);

    // --- Validasi Input ---
    if (isNaN(tegangan_panel_v) || isNaN(arus_panel_a) || isNaN(iradiasi_j) || isNaN(luas_panel_a) ||
        isNaN(tegangan_inverter_in_v) || isNaN(arus_inverter_in_a) || isNaN(tegangan_inverter_out_v) || isNaN(arus_inverter_out_a)) {
        document.getElementById('output').innerHTML = `<div class="error-message">⚠️ Mohon lengkapi semua field input.</div>`;
        return;
    }

    // --- 2. Perhitungan Sesuai Rumus Jurnal ---
    const p_in_panel = iradiasi_j * luas_panel_a;
    const p_out_panel = tegangan_panel_v * arus_panel_a;
    const efisiensi_panel = (p_out_panel / p_in_panel) * 100;
    const p_in_inverter = tegangan_inverter_in_v * arus_inverter_in_a;
    const p_out_inverter_ac = tegangan_inverter_out_v * arus_inverter_out_a;
    const efisiensi_inverter = (p_out_inverter_ac / p_in_inverter) * 100;

    // --- 3. Memperbarui Variabel Global untuk Visualisasi ---
    panelEfficiencyGlobal = Math.min(efisiensi_panel / 100, 1);
    inverterEfficiencyGlobal = Math.min(efisiensi_inverter / 100, 1);
    finalPowerACGlobal = p_out_inverter_ac;

    // --- 4. Menampilkan Hasil Perhitungan ---
    document.getElementById('output').innerHTML = `
    <div class="result-card">
        <div class="result-item"><span class="result-icon">☀️</span><div class="result-content"><strong>Daya Input Panel (Pin):</strong><span class="result-value">${p_in_panel.toFixed(2)} Watt</span></div></div>
        <div class="result-item"><span class="result-icon">⚡</span><div class="result-content"><strong>Daya Output Panel (Pout):</strong><span class="result-value">${p_out_panel.toFixed(2)} Watt</span></div></div>
        <div class="result-item"><span class="result-icon">📈</span><div class="result-content"><strong>Efisiensi Panel Surya (η):</strong><span class="result-value">${efisiensi_panel.toFixed(2)} %</span></div></div>
        <div class="result-item" style="border-top: 1px dashed #bcdffb; padding-top: 10px;"><span class="result-icon">🔄</span><div class="result-content"><strong>Daya Input Inverter (Pin):</strong><span class="result-value">${p_in_inverter.toFixed(2)} Watt</span></div></div>
        <div class="result-item"><span class="result-icon">🏠</span><div class="result-content"><strong>Daya Output Inverter (Pout AC):</strong><span class="result-value">${p_out_inverter_ac.toFixed(2)} Watt</span></div></div>
        <div class="result-item"><span class="result-icon">📉</span><div class="result-content"><strong>Efisiensi Inverter (η):</strong><span class="result-value">${efisiensi_inverter.toFixed(2)} %</span></div></div>
    </div>`;
    
    // --- 5. Menampilkan Insight & Interpretasi ---
    const insightOutput = document.getElementById('insight-output');
    if (efisiensi_inverter > 0 && isFinite(efisiensi_inverter)) {
        const power_loss = p_in_inverter - p_out_inverter_ac;
        insightOutput.innerHTML = `
            <p>
                Nilai <strong>efisiensi inverter sebesar ${efisiensi_inverter.toFixed(2)}%</strong> adalah faktor kunci yang menentukan berapa banyak daya listrik yang bisa Anda gunakan.
            </p>
            <p>
                Artinya, dari total daya DC sebesar <strong>${p_in_inverter.toFixed(2)} W</strong> yang diterima inverter, hanya <strong>${p_out_inverter_ac.toFixed(2)} W</strong> yang berhasil diubah menjadi daya AC untuk perangkat elektronik.
            </p>
            <p>
                Sisa daya sekitar <strong>${power_loss.toFixed(2)} W</strong> (${(100 - efisiensi_inverter).toFixed(2)}%) hilang dalam proses konversi, yang umumnya dilepaskan sebagai panas oleh inverter. Semakin tinggi efisiensi, semakin sedikit daya yang terbuang sia-sia.
            </p>
        `;
    } else {
        insightOutput.innerHTML = `
            <div class="placeholder-text">
                Lakukan perhitungan untuk melihat interpretasi hasil.
            </div>
        `;
    }
}