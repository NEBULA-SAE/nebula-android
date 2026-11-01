import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nebula.oracle',
  appName: 'NEBULA',
  webDir: 'dist',
  backgroundColor: '#050811',
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
    cleartext: true, // <--- РАЗРЕШАЕМ HTTP ЗАПРОСЫ НА ANDROID
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;