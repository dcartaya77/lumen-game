import { useRun } from '@/state/run';

/** Guías de la primera partida, sin texto: dedo arrastrando el joystick y flecha hacia la luz. */
export function Tutorial() {
  const tutorial = useRun((s) => s.tutorial);
  const moved = useRun((s) => s.moved);
  const guide = useRun((s) => s.guide);
  const phase = useRun((s) => s.phase);
  if (!tutorial || phase !== 'playing') return null;

  if (!moved) {
    return (
      <div className="tut-drag" aria-hidden>
        <span className="tut-ring" />
        <span className="tut-knob" />
        <span className="tut-finger">👆</span>
      </div>
    );
  }
  if (!guide || guide.dist < 70) return null;
  return (
    <div
      className="tut-arrow"
      aria-hidden
      style={{ transform: `translate(-50%, -50%) rotate(${guide.angle}rad) translateX(96px)` }}
    >
      <i />
    </div>
  );
}
