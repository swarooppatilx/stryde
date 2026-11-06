import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ENV } from '@/constants/config';
import { legalLinks } from '@/utils/legalLinks';
import { Toast } from '@/utils/toast';

export default function AboutScreen() {
  const router = useRouter();
  const links = legalLinks(ENV.WEB_URL);
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
      {links.length > 0 ? (
        <SettingsSection>
          {links.map((link) => (
            <SettingsRow
              key={link.title}
              icon={link.icon}
              title={link.title}
              subtitle={link.subtitle}
              onPress={() =>
                Linking.openURL(link.url).catch(() => Toast.fail(`Could not open ${link.title}`, 2))
              }
            />
          ))}
        </SettingsSection>
      ) : null}
    </SettingsScreen>
  );
}
