import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nebula.oracle',
  appName: 'NEBULA',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https', // ОБЯЗАТЕЛЬНО для работы Web Crypto
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;