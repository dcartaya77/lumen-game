import { tg } from '@/platform/telegram';
import { useApp, type Screen } from '@/state/store';

export function NavButton({ screen, label, icon }: { screen: Screen; label: string; icon: string }) {
  const go = useApp((s) => s.go);
  return (
    <button
      className="nav-btn"
      onClick={() => {
        tg.haptic.select();
        go(screen);
      }}
    >
      <span className="nav-icon">{icon}</span>
      {label}
    </button>
  );
}
