import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nebula.oracle',
  appName: 'NEBULA',
  webDir: 'dist',
  backgroundColor: '#050811', // <--- ДОБАВИТЬ ЭТО
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;