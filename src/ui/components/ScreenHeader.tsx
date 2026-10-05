import { t } from '@/i18n';

export function ScreenHeader({ title, sparks }: { title: string; sparks?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 16px' }}>
      <h2 style={{ margin: 0 }}>{title}</h2>
      {sparks !== undefined && (
        <span className="pill">
          <span className="spark-icon" />
          {sparks.toLocaleString()}
        </span>
      )}
    </div>
  );
}

export { t };
