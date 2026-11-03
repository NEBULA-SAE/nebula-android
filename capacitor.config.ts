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
    cleartext: true,
    allowNavigation: [
      'p2p.binance.com',
      'www.binance.com',
      'p2p.bybit.com',
      'www.bybit.com',
      'p2p.mexc.com',
      'www.mexc.com',
      'xgram.io',
      'pro.startmining.io'
    ]
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;