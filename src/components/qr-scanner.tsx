"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export function QrScanner({ onScan }: { onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function stop() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      tick();
    } catch {
      setError(
        "Não foi possível acessar a câmera. Verifique se você deu permissão ao navegador.",
      );
    }
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result?.data) {
          const now = Date.now();
          const last = lastScanRef.current;
          if (!last || last.code !== result.data || now - last.at > 2500) {
            lastScanRef.current = { code: result.data, at: now };
            onScanRef.current(result.data);
          }
        }
      }
    }
    frameRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => stop, []);

  return (
    <div className="space-y-2">
      {active ? (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="aspect-square w-full object-cover"
            />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <button type="button" className="btn-ghost w-full" onClick={stop}>
            Fechar câmera
          </button>
        </div>
      ) : (
        <button type="button" className="btn-ghost w-full" onClick={start}>
          📷 Escanear com a câmera
        </button>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
