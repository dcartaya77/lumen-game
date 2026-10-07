import { useEffect, useRef } from 'react';
import type { SkinDef } from '@/data/skins';
import { WEAPON_BY_ID } from '@/data/weapons';
import { t } from '@/i18n';

const rgba = (c: number, a: number) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
const TAU = Math.PI * 2;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: number;
}

function flamePath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, core: boolean): void {
  ctx.beginPath();
  if (core) {
    ctx.moveTo(x, y - 11 * s);
    ctx.bezierCurveTo(x + 6 * s, y - 4 * s, x + 7 * s, y + 3 * s, x + 5 * s, y + 8 * s);
    ctx.bezierCurveTo(x + 3 * s, y + 12 * s, x - 3 * s, y + 12 * s, x - 5 * s, y + 8 * s);
    ctx.bezierCurveTo(x - 7 * s, y + 3 * s, x - 6 * s, y - 4 * s, x, y - 11 * s);
  } else {
    ctx.moveTo(x, y - 22 * s);
    ctx.bezierCurveTo(x + 12 * s, y - 10 * s, x + 14 * s, y + 2 * s, x + 10 * s, y + 10 * s);
    ctx.bezierCurveTo(x + 6 * s, y + 17 * s, x - 6 * s, y + 17 * s, x - 10 * s, y + 10 * s);
    ctx.bezierCurveTo(x - 14 * s, y + 2 * s, x - 12 * s, y - 10 * s, x, y - 22 * s);
  }
  ctx.closePath();
}

function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: number, glow: number, time: number): void {
  const bob = 1 + Math.sin(time * 7) * 0.05;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 62 * s);
  g.addColorStop(0, rgba(glow, 0.55));
  g.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - 70 * s, y - 70 * s, 140 * s, 140 * s);
  ctx.fillStyle = rgba(color, 1);
  flamePath(ctx, x, y, s * bob, false);
  ctx.fill();
  const mix = (c: number) => Math.round(c + (255 - c) * 0.7);
  ctx.fillStyle = `rgb(${mix((color >> 16) & 255)},${mix((color >> 8) & 255)},${mix(color & 255)})`;
  flamePath(ctx, x, y, s * bob, true);
  ctx.fill();
}

/** Vista previa animada en vivo de una skin (flama, arma, muerte, nivel) o maqueta del marco. */
export function SkinPreview({ skin, size = 170 }: { skin: SkinDef; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || skin.target === 'frame') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const v = skin.visual;
    const c = size / 2;
    const parts: Particle[] = [];
    const burst = (x: number, y: number, color: number, n: number, speed: number, life: number, sz: number) => {
      for (let i = 0; i < n && parts.length < 220; i++) {
        const a = Math.random() * TAU;
        const s = speed * (0.3 + Math.random() * 0.7);
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life, max: life, size: sz * (0.5 + Math.random()), color });
      }
    };
    const weapon = skin.weaponId ? WEAPON_BY_ID[skin.weaponId] : undefined;
    const behavior = weapon?.behavior;
    const shots: { x: number; y: number; vx: number; vy: number; a: number }[] = [];
    let timer = 0;
    let beam: { a: number; t: number } | null = null;
    let chain: { pts: number[]; t: number } | null = null;
    let ring = 0;
    let raf = 0;
    let last = performance.now();
    let time = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      timer -= dt;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';

      if (skin.target === 'flame') {
        const moving = !!v.trail;
        const fx = moving ? c + Math.cos(time * 1.6) * size * 0.2 : c;
        const fy = moving ? c + Math.sin(time * 3.2) * size * 0.1 : c;
        if (moving && timer <= 0) {
          timer = 0.04;
          burst(fx, fy + 10, v.glow, 3, 24, 0.6, 3);
        }
        drawFlame(ctx, fx, fy, 1.5, v.color, v.glow, time);
      } else if (skin.target === 'weapon' && behavior) {
        drawFlame(ctx, c, c, 1, 0xffa640, 0xffa640, time);
        const col = v.color;
        if (behavior === 'projectile') {
          if (timer <= 0) {
            timer = 0.5;
            const a = Math.random() * TAU;
            shots.push({ x: c, y: c, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, a });
          }
        } else if (behavior === 'aura') {
          const r = size * 0.36 * (1 + Math.sin(time * 5) * 0.05);
          const g = ctx.createRadialGradient(c, c, 0, c, c, r);
          g.addColorStop(0, rgba(col, 0.05));
          g.addColorStop(1, rgba(col, 0.5));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(c, c, r, 0, TAU);
          ctx.fill();
        } else if (behavior === 'orbit') {
          for (let i = 0; i < 3; i++) {
            const a = time * 2.8 + (i / 3) * TAU;
            const ox = c + Math.cos(a) * size * 0.3;
            const oy = c + Math.sin(a) * size * 0.3;
            ctx.fillStyle = rgba(col, 0.9);
            ctx.beginPath();
            ctx.arc(ox, oy, 7, 0, TAU);
            ctx.fill();
            if (v.trail && timer <= 0) burst(ox, oy, v.glow, 1, 20, 0.5, 3);
          }
          if (timer <= 0) timer = 0.05;
        } else if (behavior === 'homing') {
          for (let i = 0; i < 6; i++) {
            const a = time * 1.5 + i * 1.05;
            const x = c + Math.cos(a * 1.3 + i) * size * 0.32;
            const y = c + Math.sin(a) * size * 0.3;
            ctx.fillStyle = rgba(col, 0.55 + Math.sin(time * 14 + i) * 0.4);
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, TAU);
            ctx.fill();
          }
        } else if (behavior === 'beam') {
          if (timer <= 0) {
            timer = 1.2;
            beam = { a: Math.random() * TAU, t: 0.35 };
          }
        } else if (behavior === 'chain') {
          if (timer <= 0) {
            timer = 0.9;
            const pts = [c, c];
            for (let i = 0; i < 3; i++) pts.push(c + (Math.random() - 0.5) * size * 0.8, c + (Math.random() - 0.5) * size * 0.8);
            chain = { pts, t: 0.25 };
          }
        } else if (behavior === 'nova') {
          if (timer <= 0) {
            timer = 1.5;
            ring = 0.0001;
            if (v.trail) burst(c, c, v.glow, 40, 90, 0.6, 3);
          }
        }

        for (let i = shots.length - 1; i >= 0; i--) {
          const s = shots[i]!;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          if (s.x < 0 || s.y < 0 || s.x > size || s.y > size) {
            shots.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.a);
          ctx.fillStyle = rgba(col, 0.95);
          ctx.beginPath();
          ctx.ellipse(0, 0, 10, 4, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        if (beam) {
          beam.t -= dt;
          if (beam.t <= 0) beam = null;
          else {
            ctx.strokeStyle = rgba(col, beam.t / 0.35);
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(c, c);
            ctx.lineTo(c + Math.cos(beam.a) * size, c + Math.sin(beam.a) * size);
            ctx.stroke();
          }
        }
        if (chain) {
          chain.t -= dt;
          if (chain.t <= 0) chain = null;
          else {
            ctx.strokeStyle = rgba(col, chain.t / 0.25);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(chain.pts[0]!, chain.pts[1]!);
            for (let i = 2; i < chain.pts.length; i += 2) ctx.lineTo(chain.pts[i]!, chain.pts[i + 1]!);
            ctx.stroke();
          }
        }
        if (ring > 0) {
          ring += dt * 1.1;
          if (ring >= 1) ring = 0;
          else {
            ctx.strokeStyle = rgba(col, 1 - ring);
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(c, c, 8 + ring * size * 0.42, 0, TAU);
            ctx.stroke();
          }
        }
      } else if (skin.target === 'death') {
        const phase = time % 1.8;
        if (phase < 0.9) {
          // Silueta de sombra con ojos que se encoge antes de estallar.
          const k = 1 - phase / 0.9 * 0.25;
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#1b1630';
          ctx.strokeStyle = '#3a2f55';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(c, c, 22 * k, 0, TAU);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#ff2e5b';
          ctx.fillRect(c - 9 * k, c - 5 * k, 5, 5);
          ctx.fillRect(c + 4 * k, c - 5 * k, 5, 5);
          ctx.globalCompositeOperation = 'lighter';
        } else if (timer <= 0 && phase < 1) {
          timer = 1;
          const k = v.particles ?? 1;
          const main = v.color || 0xff2e5b;
          burst(c, c, main, Math.round(16 * k), 150, 0.7, 4);
          if (v.color) burst(c, c, v.glow, Math.round(6 * k), 90, 0.8, 3);
        }
      } else if (skin.target === 'levelup') {
        drawFlame(ctx, c, c, 1.3, 0xffa640, 0xffa640, time);
        const phase = time % 1.8;
        if (phase < 0.1 && timer <= 0) {
          timer = 1;
          const k = v.particles ?? 1;
          burst(c, c, v.color, Math.round(24 * k), 200, 0.8, 4);
          burst(c, c, v.glow, Math.round(16 * k), 260, 1, 3);
          ring = 0.0001;
        }
        if (ring > 0) {
          ring += dt * 1.1;
          if (ring >= 1) ring = 0;
          else {
            ctx.strokeStyle = rgba(v.color, 1 - ring);
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(c, c, 10 + ring * size * 0.45, 0, TAU);
            ctx.stroke();
          }
        }
      }

      ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.life -= dt;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        p.vx *= 1 - 2.5 * dt;
        p.vy *= 1 - 2.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = p.life / p.max;
        ctx.fillStyle = rgba(p.color, k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k, 0, TAU);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [skin, size]);

  if (skin.target === 'frame') {
    return (
      <div className={`preview-frame ${skin.visual.css ?? ''}`} style={{ width: size, height: size * 0.8 }}>
        <span>{t('time_survived')}</span>
        <strong>4:32</strong>
      </div>
    );
  }
  return <canvas ref={ref} className="skin-canvas" style={{ width: size, height: size }} />;
}
