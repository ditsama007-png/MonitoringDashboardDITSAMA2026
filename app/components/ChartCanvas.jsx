import Chart from "chart.js/auto";
import { useEffect, useRef } from "react";

// gaya dasar semua grafik mengikuti dashboard
Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = "#5d6879";
Chart.defaults.borderColor = "#E3E8F0";
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;
Chart.defaults.plugins.legend.labels.useBorderRadius = true;
Chart.defaults.plugins.legend.labels.borderRadius = 3;
Chart.defaults.plugins.tooltip.backgroundColor = "#1A2233";
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;

// plugin zoom (butuh hammerjs -> `window`), jadi didaftarkan hanya di browser
let zoomReady = null;
function ensureZoomPlugin() {
  if (!zoomReady) {
    zoomReady = import("chartjs-plugin-zoom")
      .then((m) => { Chart.register(m.default); })
      .catch((e) => console.warn("chartjs-plugin-zoom gagal dimuat:", e));
  }
  return zoomReady;
}

/**
 * Bungkus <canvas> Chart.js. `config` harus di-memo oleh pemanggil (useMemo),
 * grafik dibuat ulang setiap kali `config` berubah.
 * `zoom`: aktifkan zoom/geser sumbu X + tombol reset.
 */
export function ChartCanvas({ config, height = 240, zoom = false, style }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const build = () => {
      if (cancelled || !canvasRef.current) return;
      chartRef.current = new Chart(canvasRef.current, config);
    };
    if (zoom) ensureZoomPlugin().then(build); else build();
    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [config, zoom]);

  return (
    <div style={{ height, position: "relative", ...style }}>
      <canvas ref={canvasRef} />
      {zoom && (
        <button type="button" className="btn btn-sm zoom-reset"
          onClick={() => chartRef.current?.resetZoom?.()}>Reset zoom</button>
      )}
    </div>
  );
}
