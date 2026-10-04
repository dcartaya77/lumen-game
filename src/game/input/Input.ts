import { Container, Sprite, type Texture } from 'pixi.js';

const JOY_RADIUS = 56;
const DEAD_ZONE = 0.12;

/**
 * Entrada unificada: joystick virtual flotante (aparece donde se toca) y
 * teclado (WASD / flechas) para desarrollo en PC. Ambos producen un vector
 * de movimiento normalizado en `x`, `y` (longitud ≤ 1).
 */
export class Input {
  x = 0;
  y = 0;
  /** true mientras hay un dedo sobre el joystick. */
  touching = false;

  readonly view = new Container();
  private readonly base: Sprite;
  private readonly knob: Sprite;

  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private joyX = 0;
  private joyY = 0;
  private readonly keys = new Set<string>();

  constructor(
    private readonly host: HTMLElement,
    ringTexture: Texture,
    dotTexture: Texture,
  ) {
    this.base = new Sprite({ texture: ringTexture, anchor: 0.5, alpha: 0.35 });
    this.base.scale.set(JOY_RADIUS / 40);
    this.knob = new Sprite({ texture: dotTexture, anchor: 0.5, alpha: 0.8 });
    this.knob.scale.set(5);
    this.view.addChild(this.base, this.knob);
    this.view.visible = false;

    host.style.touchAction = 'none';
    host.addEventListener('pointerdown', this.onDown);
    host.addEventListener('pointermove', this.onMove);
    host.addEventListener('pointerup', this.onUp);
    host.addEventListener('pointercancel', this.onUp);
    host.addEventListener('contextmenu', prevent);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
  }

  /** Combina joystick y teclado. El joystick manda si está activo. */
  update(): void {
    if (this.touching) {
      this.x = this.joyX;
      this.y = this.joyY;
      return;
    }
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;
    if (kx !== 0 && ky !== 0) {
      kx *= Math.SQRT1_2;
      ky *= Math.SQRT1_2;
    }
    this.x = kx;
    this.y = ky;
  }

  get active(): boolean {
    return this.x !== 0 || this.y !== 0;
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null || e.button !== 0) return;
    // Permitir que los botones React superpuestos reciban sus propios toques.
    if ((e.target as HTMLElement).closest('button')) return;
    this.pointerId = e.pointerId;
    this.host.setPointerCapture?.(e.pointerId);
    const r = this.host.getBoundingClientRect();
    this.originX = e.clientX - r.left;
    this.originY = e.clientY - r.top;
    this.touching = true;
    this.joyX = this.joyY = 0;
    this.base.position.set(this.originX, this.originY);
    this.knob.position.set(this.originX, this.originY);
    this.view.visible = true;
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const r = this.host.getBoundingClientRect();
    let dx = e.clientX - r.left - this.originX;
    let dy = e.clientY - r.top - this.originY;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx *= JOY_RADIUS / len;
      dy *= JOY_RADIUS / len;
    }
    this.knob.position.set(this.originX + dx, this.originY + dy);
    const mag = Math.min(1, len / JOY_RADIUS);
    if (mag < DEAD_ZONE) {
      this.joyX = this.joyY = 0;
    } else {
      // Respuesta lineal tras la zona muerta: control fino cerca del centro.
      const scaled = (mag - DEAD_ZONE) / (1 - DEAD_ZONE);
      this.joyX = (dx / (len || 1)) * scaled;
      this.joyY = (dy / (len || 1)) * scaled;
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.touching = false;
    this.joyX = this.joyY = 0;
    this.view.visible = false;
  };

  private onKey = (e: KeyboardEvent): void => {
    if (!KEYS.has(e.code)) return;
    if (e.type === 'keydown') this.keys.add(e.code);
    else this.keys.delete(e.code);
    e.preventDefault();
  };

  private onBlur = (): void => {
    this.keys.clear();
  };

  destroy(): void {
    this.host.removeEventListener('pointerdown', this.onDown);
    this.host.removeEventListener('pointermove', this.onMove);
    this.host.removeEventListener('pointerup', this.onUp);
    this.host.removeEventListener('pointercancel', this.onUp);
    this.host.removeEventListener('contextmenu', prevent);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    this.view.destroy({ children: true });
  }
}

const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const prevent = (e: Event) => e.preventDefault();
