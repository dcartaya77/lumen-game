import { useApp } from '@/state/store';
import { BootScreen } from '@/ui/screens/BootScreen';
import { MenuScreen } from '@/ui/screens/MenuScreen';
import { RunScreen } from '@/ui/screens/RunScreen';
import { SettingsScreen } from '@/ui/screens/SettingsScreen';

export function App() {
  const screen = useApp((s) => s.screen);
  // Suscripción al idioma para re-renderizar toda la UI al cambiarlo.
  useApp((s) => s.lang);

  switch (screen) {
    case 'boot':
      return <BootScreen />;
    case 'menu':
      return <MenuScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'run':
      return <RunScreen />;
  }
}
