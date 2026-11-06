import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ENV } from '@/constants/config';
import { useT } from '@/i18n';
import { legalLinks } from '@/utils/legalLinks';
import { Toast } from '@/utils/toast';

export default function AboutScreen() {
  const router = useRouter();
  const t = useT();
  const links = legalLinks(ENV.WEB_URL, t);
  return (
    <SettingsScreen title={t('settings.help')}>
      <SettingsSection>
        <SettingsRow
          icon="information-circle-outline"
          title={t('about.version')}
          subtitle={Constants.expoConfig?.version ?? '—'}
        />
        <SettingsRow
          icon="document-text-outline"
          title={t('about.licences')}
          subtitle={t('about.licencesHint')}
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
                Linking.openURL(link.url).catch(() =>
                  Toast.fail(t('about.openFailed', { name: link.title }), 2)
                )
              }
            />
          ))}
        </SettingsSection>
      ) : null}
    </SettingsScreen>
  );
}
