import { Graphics, type Renderer, type Texture } from 'pixi.js';

export interface MapColors {
  ground: number;
  motes: number;
}

export interface GameTextures {
  flame: Texture;
  glow: Texture;
  shadow: Texture;
  eyes: Texture;
  bolt: Texture;
  gem: Texture;
  dot: Texture;
  ground: Texture;
  ring: Texture;
  spiky: Texture;
  blob: Texture;
  orb: Texture;
  aura: Texture;
  beam: Texture;
  shot: Texture;
}

/**
 * Todas las texturas del juego se dibujan una vez con Graphics y se hornean a
 * texturas GPU. Los sprites (pools) solo cambian posición/tinte/escala.
 */
export function buildTextures(renderer: Renderer, map: MapColors = { ground: 0x0b0a14, motes: 0x3a3357 }): GameTextures {
  const bake = (draw: (g: Graphics) => void, resolution = 2): Texture => {
    const g = new Graphics();
    draw(g);
    const tex = renderer.generateTexture({ target: g, resolution, antialias: true });
    g.destroy();
    return tex;
  };

  return {
    // Llama del jugador: gota cálida con núcleo claro.
    flame: bake((g) => {
      g.moveTo(0, -22)
        .bezierCurveTo(12, -10, 14, 2, 10, 10)
        .bezierCurveTo(6, 17, -6, 17, -10, 10)
        .bezierCurveTo(-14, 2, -12, -10, 0, -22)
        .fill(0xffa640);
      g.moveTo(0, -11)
        .bezierCurveTo(6, -4, 7, 3, 5, 8)
        .bezierCurveTo(3, 12, -3, 12, -5, 8)
        .bezierCurveTo(-7, 3, -6, -4, 0, -11)
        .fill(0xfff3c4);
    }),
    // Halo radial suave (se usa con blend 'add').
    glow: bake((g) => {
      for (let i = 10; i >= 1; i--) g.circle(0, 0, i * 6).fill({ color: 0xffa640, alpha: 0.035 });
    }, 1),
    // Silueta de sombra: círculo irregular oscuro con borde tenue.
    shadow: bake((g) => {
      const pts: number[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = 12 + (i % 2 === 0 ? 2 : -1.5);
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.poly(pts).fill(0x14111f).stroke({ color: 0x3a2f55, width: 1.5, alpha: 0.8 });
    }),
    // Ojos brillantes separados para poder tintarlos por tipo de enemigo.
    eyes: bake((g) => {
      g.circle(-4, -2, 2).fill(0xffffff).circle(4, -2, 2).fill(0xffffff);
    }),
    // Proyectil "Chispa".
    bolt: bake((g) => {
      g.ellipse(0, 0, 9, 4).fill(0xffe9a8).ellipse(-1, 0, 5, 2.2).fill(0xffffff);
    }),
    // Fragmento de luz (XP).
    gem: bake((g) => {
      g.poly([0, -7, 5, 0, 0, 7, -5, 0]).fill(0x8ff0ff).poly([0, -4, 2.5, 0, 0, 4, -2.5, 0]).fill(0xffffff);
    }),
    // Punto blanco genérico para partículas (tintado).
    dot: bake((g) => {
      g.circle(0, 0, 4).fill(0xffffff);
    }),
    // Suelo: tile con motas tenues para dar sensación de movimiento.
    ground: bake((g) => {
      g.rect(0, 0, 256, 256).fill(map.ground);
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 26; i++) {
        g.circle(rnd() * 256, rnd() * 256, 0.8 + rnd() * 1.4).fill({ color: map.motes, alpha: 0.25 + rnd() * 0.3 });
      }
    }, 1),
    // Anillo para el joystick / nova.
    ring: bake((g) => {
      g.circle(0, 0, 40).stroke({ color: 0xffffff, width: 3 });
    }),
    // Silueta puntiaguda (wisp, charger, drifter).
    spiky: bake((g) => {
      const pts: number[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = i % 2 === 0 ? 14 : 8;
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.poly(pts).fill(0x14111f).stroke({ color: 0x3a2f55, width: 1.5, alpha: 0.8 });
    }),
    // Silueta redondeada y pesada (brute, husk, spitter, jefe).
    blob: bake((g) => {
      g.ellipse(0, 1, 13, 11).fill(0x14111f).stroke({ color: 0x3a2f55, width: 1.5, alpha: 0.8 });
      g.ellipse(0, -6, 7, 4).fill({ color: 0x3a2f55, alpha: 0.5 });
    }),
    // Orbe en órbita.
    orb: bake((g) => {
      g.circle(0, 0, 9).fill({ color: 0xffffff, alpha: 0.35 }).circle(0, 0, 5).fill(0xffffff);
    }),
    // Disco suave para el aura (se escala).
    aura: bake((g) => {
      for (let i = 8; i >= 1; i--) g.circle(0, 0, i * 8).fill({ color: 0xffffff, alpha: 0.05 });
      g.circle(0, 0, 64).stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
    }, 1),
    // Haz: franja horizontal de 1x1 unidades lógicas (se escala en X = longitud, Y = grosor).
    beam: bake((g) => {
      g.rect(0, -4, 64, 8).fill({ color: 0xffffff, alpha: 0.45 }).rect(0, -1.5, 64, 3).fill(0xffffff);
    }),
    // Disparo enemigo.
    shot: bake((g) => {
      g.circle(0, 0, 5).fill(0x3a2f55).circle(0, 0, 2.5).fill(0xa3ff8f);
    }),
  };
}
