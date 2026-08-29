import React, { useEffect, useRef } from 'react';
import { BitNoiseConfig } from '../../themes/themes';

// ── Perlin Noise ─────────────────────────────────────────────────────────────
const PERM = (() => {
  const p = Array.from({ length: 256 }, (_: unknown, i: number) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return [...p, ...p];
})();

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number) { return a + t * (b - a); }
function grad(hash: number, x: number, y: number): number {
  switch (hash & 3) {
    case 0: return  x + y;
    case 1: return -x + y;
    case 2: return  x - y;
    default: return -x - y;
  }
}
function noise2(x: number, y: number): number {
  const X  = Math.floor(x) & 255;
  const Y  = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u  = fade(xf);
  const v  = fade(yf);
  const aa = PERM[PERM[X]     + Y];
  const ab = PERM[PERM[X]     + Y + 1];
  const ba = PERM[PERM[X + 1] + Y];
  const bb = PERM[PERM[X + 1] + Y + 1];
  return lerp(
    lerp(grad(aa, xf,     yf    ), grad(ba, xf - 1, yf    ), u),
    lerp(grad(ab, xf,     yf - 1), grad(bb, xf - 1, yf - 1), u),
    v
  ) * 0.5 + 0.5;
}

// ── Static canvas config ──────────────────────────────────────────────────────
const CELL      = 16;    // px per grid cell
const FONT_PX   = 9;     // rendered font size
const SCALE     = 0.09;  // noise spatial frequency
const SPEED_X   = 0.045;
const SPEED_Y   = 0.07;
const FLIP_MIN  = 1.8;   // minimum seconds between bit flips
const FLIP_RANGE= 9.0;   // random window added on top

interface Cell {
  val:    0 | 1;
  color:  string;  // current draw color
  isAccent: boolean;
  flipAt: number;
}

interface BitNoiseProps {
  config: BitNoiseConfig;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const BitNoise: React.FC<BitNoiseProps> = ({ config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use a ref to expose the *latest* config to the long-running animation loop
  // without restarting the effect on every theme change
  const cfgRef = useRef<BitNoiseConfig>(config);

  // When config changes:
  //  1. Update the ref so the animation loop sees new colors / opacity immediately
  //  2. Re-roll cell colors to adopt the new palette — bit values and flip timers stay
  const gridRef = useRef<Cell[][]>([]);
  useEffect(() => {
    cfgRef.current = config;
    // Re-roll colors for all existing cells
    const { baseColor, accentColors, accentProb } = config;
    for (const row of gridRef.current) {
      for (const cell of row) {
        const isAccent = Math.random() < accentProb;
        cell.isAccent = isAccent;
        cell.color    = isAccent
          ? accentColors[Math.floor(Math.random() * accentColors.length)]
          : baseColor;
      }
    }
  }, [config]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    let raf  = 0;
    let t    = 0;
    let last = performance.now();
    let C = 0, R = 0;

    function initGrid() {
      cvs!.width  = window.innerWidth;
      cvs!.height = window.innerHeight;
      C = Math.ceil(cvs!.width  / CELL) + 1;
      R = Math.ceil(cvs!.height / CELL) + 1;
      const { baseColor, accentColors, accentProb } = cfgRef.current;
      gridRef.current = Array.from({ length: R }, () =>
        Array.from({ length: C }, (): Cell => {
          const isAccent = Math.random() < accentProb;
          return {
            val:      Math.random() < 0.5 ? 0 : 1,
            isAccent,
            color:    isAccent
              ? accentColors[Math.floor(Math.random() * accentColors.length)]
              : baseColor,
            flipAt:   t + FLIP_MIN + Math.random() * FLIP_RANGE,
          };
        })
      );
    }

    function draw(ts: number) {
      const dt = Math.min((ts - last) / 1000, 0.1);
      last = ts;
      t   += dt;

      const { baseColor, accentColors, accentProb, maxOpacity } = cfgRef.current;

      ctx!.clearRect(0, 0, cvs!.width, cvs!.height);
      ctx!.font         = `${FONT_PX}px "IBM Plex Mono", monospace`;
      ctx!.textBaseline = 'top';

      const grid = gridRef.current;

      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          const cell = grid[r]?.[c];
          if (!cell) continue;

          // ── Maybe flip bit ──────────────────────────────────────────────────
          if (t >= cell.flipAt) {
            cell.val = cell.val === 0 ? 1 : 0;

            // Re-roll accent status on each flip
            const becomeAccent = Math.random() < accentProb * 1.4;
            const revertToBase  = cell.isAccent && Math.random() < 0.08;

            if (becomeAccent && !revertToBase) {
              cell.isAccent = true;
              cell.color    = accentColors[Math.floor(Math.random() * accentColors.length)];
            } else if (revertToBase || !becomeAccent) {
              cell.isAccent = false;
              cell.color    = baseColor;
            }

            cell.flipAt = t + FLIP_MIN + Math.random() * FLIP_RANGE;
          }

          // ── Noise-driven opacity ────────────────────────────────────────────
          // Two octaves of Perlin noise for organic cloud-like blobs
          const nx = c * SCALE + t * SPEED_X;
          const ny = r * SCALE + t * SPEED_Y;
          const n1 = noise2(nx, ny);
          const n2 = noise2(nx * 2.1 + 40, ny * 2.1 + 80) * 0.35;
          const n  = Math.min(1, (n1 * 0.72 + n2) / (0.72 + 0.35));

          // Cubic power curve: dark regions → fully transparent,
          // bright peaks → maxOpacity. No floor — true zero in the darkest spots.
          const opacity = n * n * n * maxOpacity;

          if (opacity < 0.003) continue; // skip invisible cells

          ctx!.globalAlpha = opacity;
          ctx!.fillStyle   = cell.color;
          ctx!.fillText(String(cell.val), c * CELL, r * CELL);
        }
      }

      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }

    initGrid();
    raf = requestAnimationFrame(draw);

    const onResize = () => initGrid();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []); // runs once — config changes are handled via cfgRef

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        width:         '100vw',
        height:        '100vh',
        pointerEvents: 'none',
        zIndex:        0,
      }}
    />
  );
};
