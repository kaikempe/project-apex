import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';
import { POIProvider } from '@/src/context/POIContext';

import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { VehicleProvider } from '@/src/context/VehicleContext';
import { AudioProvider } from '@/src/context/AudioContext';
import { AuthScreen } from '@/src/screens/AuthScreen';
import { Colors } from '@/src/theme/colors';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Custom dark theme for navigation
const ApexDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.secondary,
    primary: Colors.primary,
    text: Colors.textPrimary,
    border: Colors.secondary,
  },
};

// Auth gate component - shows auth screen if not logged in
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Show app content if authenticated
  return <>{children}</>;
}

// Root layout content (inside providers)
function RootLayoutContent() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={ApexDarkTheme}>
      <AuthGate>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AuthGate>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

// Root layout with all providers
export default function RootLayout() {
  return (
    
  <AuthProvider>
      <POIProvider>
        <AudioProvider>
          <VehicleProvider>
            <RootLayoutContent />
          </VehicleProvider>
        </AudioProvider>
    </POIProvider>
  </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
