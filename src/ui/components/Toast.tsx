import { t } from '@/i18n';
import { useApp } from '@/state/store';

export function Toast() {
  const toast = useApp((s) => s.toast);
  if (!toast) return null;
  return (
    <div key={toast.id} className="toast" role="status">
      {t(toast.key)}
    </div>
  );
}
