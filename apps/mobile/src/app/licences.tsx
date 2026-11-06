import manifest from '@/../package.json';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { useT } from '@/i18n';
import { directDependencies } from '@/utils/licences';

const DEPENDENCIES = directDependencies(manifest);

export default function LicencesScreen() {
  const t = useT();
  return (
    <SettingsScreen title={t('licences.title')}>
      <SettingsSection footer={t('licences.footer')}>
        {DEPENDENCIES.map((dep) => (
          <SettingsRow
            key={dep.name}
            icon="cube-outline"
            title={dep.name}
            subtitle={dep.version || undefined}
          />
        ))}
      </SettingsSection>
    </SettingsScreen>
  );
}
