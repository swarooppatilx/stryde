import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the config; this only layers on local signing for free Apple IDs (see the plugin).
const { applyLocalSigning } = require('./plugins/withLocalIosSigning.cjs') as {
  applyLocalSigning: (config: ExpoConfig) => ExpoConfig;
};

export default ({ config }: ConfigContext): ExpoConfig => applyLocalSigning(config as ExpoConfig);
