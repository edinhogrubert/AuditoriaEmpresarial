import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.inventario.react',
  appName: 'AuditInventario',
  webDir: 'dist',
  backgroundColor: '#f8f9ff',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#f8f9ff",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    }
  }
};

export default config;
