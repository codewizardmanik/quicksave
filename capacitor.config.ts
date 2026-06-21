import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'xyz.vncl.quicksave',
  appName: 'quicksave',
  webDir: 'build',

  splashScreen: {
    launchShowDuration: 0,
    launchAutoHide: false
  }
};

export default config;