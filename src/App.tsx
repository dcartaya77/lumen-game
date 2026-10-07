import { useApp } from '@/state/store';
import { BootScreen } from '@/ui/screens/BootScreen';
import { CampaignScreen } from '@/ui/screens/CampaignScreen';
import { CharactersScreen } from '@/ui/screens/CharactersScreen';
import { CollectionScreen } from '@/ui/screens/CollectionScreen';
import { DailyScreen } from '@/ui/screens/DailyScreen';
import { MapsScreen } from '@/ui/screens/MapsScreen';
import { MenuScreen } from '@/ui/screens/MenuScreen';
import { RunScreen } from '@/ui/screens/RunScreen';
import { SettingsScreen } from '@/ui/screens/SettingsScreen';
import { ShopScreen } from '@/ui/screens/ShopScreen';
import { SkinsScreen } from '@/ui/screens/SkinsScreen';
import { Toast } from '@/ui/components/Toast';

function Current() {
  const screen = useApp((s) => s.screen);
  switch (screen) {
    case 'boot':
      return <BootScreen />;
    case 'menu':
      return <MenuScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'run':
      return <RunScreen />;
    case 'shop':
      return <ShopScreen />;
    case 'characters':
      return <CharactersScreen />;
    case 'maps':
      return <MapsScreen />;
    case 'collection':
      return <CollectionScreen />;
    case 'daily':
      return <DailyScreen />;
    case 'skins':
      return <SkinsScreen />;
    case 'campaign':
      return <CampaignScreen />;
  }
}

export function App() {
  // Suscripción al idioma para re-renderizar toda la UI al cambiarlo.
  useApp((s) => s.lang);
  return (
    <>
      <Current />
      <Toast />
    </>
  );
}
