import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';

export default function AboutScreen() {
  const router = useRouter();
  return (
    <SettingsScreen title="Help and About">
      <SettingsSection>
        <SettingsRow
          icon="information-circle-outline"
          title="Version"
          subtitle={Constants.expoConfig?.version ?? '—'}
        />
        <SettingsRow
          icon="document-text-outline"
          title="Licences"
          subtitle="Open-source software Stryde is built with"
          onPress={() => router.push('/licences')}
        />
      </SettingsSection>
    </SettingsScreen>
  );
}
