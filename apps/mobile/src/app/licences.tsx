import manifest from '@/../package.json';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { directDependencies } from '@/utils/licences';

const DEPENDENCIES = directDependencies(manifest);

export default function LicencesScreen() {
  return (
    <SettingsScreen title="Licences">
      <SettingsSection footer="Each package is open source and comes with its own licence, available from its project page.">
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
