import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';
import { POIProvider } from '@/src/context/POIContext';
import { FriendsProvider } from '@/src/context/FriendsContext';
import { AchievementsProvider } from '@/src/context/AchievementsContext';
import { ConvoyProvider } from '@/src/context/ConvoyContext';
import { CrewProvider } from '@/src/context/CrewContext';
import { ChallengeProvider } from '@/src/context/ChallengeContext';
import { TournamentProvider } from '@/src/context/TournamentContext';
import { RivalProvider } from '@/src/context/RivalContext';
import { MapThemeProvider } from '@/src/context/MapThemeContext';

import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { VehicleProvider } from '@/src/context/VehicleContext';
import { AudioProvider } from '@/src/context/AudioContext';
import { XPProvider } from '@/src/context/XPContext';
import { DailyChallengesProvider } from '@/src/context/DailyChallengesContext';
import { NetworkProvider } from '@/src/context/NetworkContext';
import { AuthScreen } from '@/src/screens/AuthScreen';
import { Colors } from '@/src/theme/colors';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Auth gate component - shows auth screen if not logged in
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
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
  const { theme, isDark } = useTheme();

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  // Create navigation theme based on app theme
  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.background,
          card: theme.surface,
          primary: theme.primary,
          text: theme.textPrimary,
          border: theme.border,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.background,
          card: theme.surface,
          primary: theme.primary,
          text: theme.textPrimary,
          border: theme.border,
        },
      };

  return (
    <NavThemeProvider value={navigationTheme}>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" options={{ headerShown: true }} />
        </Stack>
      </AuthGate>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

// Root layout with all providers
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <NetworkProvider>
            <MapThemeProvider>
              <POIProvider>
                <FriendsProvider>
                  <ConvoyProvider>
                    <CrewProvider>
                      <AudioProvider>
                        <XPProvider>
                          <DailyChallengesProvider>
                            <VehicleProvider>
                              <AchievementsProvider>
                                <ChallengeProvider>
                                  <TournamentProvider>
                                    <RivalProvider>
                                      <RootLayoutContent />
                                    </RivalProvider>
                                  </TournamentProvider>
                                </ChallengeProvider>
                              </AchievementsProvider>
                            </VehicleProvider>
                          </DailyChallengesProvider>
                        </XPProvider>
                      </AudioProvider>
                    </CrewProvider>
                  </ConvoyProvider>
                </FriendsProvider>
              </POIProvider>
            </MapThemeProvider>
          </NetworkProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
