import Chart from "chart.js/auto";
import { useEffect, useRef } from "react";

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
        <button type="button" className="zoom-reset mini-btn"
          style={{ position: "absolute", top: 4, right: 4, zIndex: 2 }}
          onClick={() => chartRef.current?.resetZoom?.()}>⟲ Reset zoom</button>
      )}
    </div>
  );
}
