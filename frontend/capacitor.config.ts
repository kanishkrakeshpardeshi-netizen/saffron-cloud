import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saffron.hub',
  appName: 'Saffron Hub',
  webDir: 'out',
  server: {

    allowNavigation: ['*.trycloudflare.com'],
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#2c2c31',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
