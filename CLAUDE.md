# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

- **React Native 0.81** with **Expo 54** (managed workflow) and **React 19**
- **Expo Router 6** for file-based routing
- **TypeScript 5.9** (strict mode)
- **Supabase** (PostgreSQL backend, auth, realtime)
- **Mapbox** (@rnmapbox/maps) + react-native-maps for mapping
- **expo-location** + expo-task-manager for foreground/background GPS tracking
- **expo-speech** with custom priority-based AudioQueue for TTS announcements
- **React Context API** for state management (no Redux/Zustand)

## Common Commands

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in browser via Metro
```

No test framework is configured yet.

## Architecture

### Routing (app/)

Expo Router file-based routing with a tab layout:

- `app/_layout.tsx` — Root layout, stacks all context providers, handles auth gating
- `app/(tabs)/_layout.tsx` — Tab bar with 5 visible tabs (Drive, History, Insights, Social, Profile) + 2 hidden (Garage, Explore)
- `app/(tabs)/index.tsx` — Main Drive screen with map, speedometer, HUD, session controls
- `app/drive-detail.tsx` — Drive playback/visualization (stack modal)

### Context Providers (src/context/)

Stacked in root layout in this order: `AuthProvider → POIProvider → AudioProvider → VehicleProvider`

- **AuthContext** — Supabase auth (email/password, Apple Sign In), profile management, session persistence via expo-secure-store
- **VehicleContext** — Vehicle CRUD, active vehicle, drive session state, includes AsyncStorage→Supabase migration
- **AudioContext** — Wraps AudioQueue singleton for TTS announcements
- **POIContext** — Speed traps, segments, car meets (currently uses mock data)

### Services (src/services/)

- **supabase.ts** — Supabase client + all database helper functions (profiles, vehicles, sprints)
- **AudioQueue.ts** — Priority queue (SYSTEM > SEGMENT_RESULT > SEGMENT_APPROACH > FRIEND_NEARBY > LOW), interrupts lower priority, ducks audio
- **SegmentDetection.ts** — Geofence-based segment triggering with ghost data interpolation
- **BackgroundLocationService.ts** — Background location via Expo TaskManager

### Hooks (src/hooks/)

- **useLocation** — Real-time GPS at 1Hz with BestForNavigation accuracy, Haversine distance, noise filtering (ignores jumps >500m and <2m)
- **useSprintTimer** — High-precision timing via `requestAnimationFrame` + `performance.now()`, supports 0-100/100-200 modes with ghost comparison
- **useLiveTracking** — Friend location tracking
- **useBackgroundLocation** — Background location control

### Data Flow

```
Supabase → Services → Context Providers → Hooks → Components/Screens
```

Vehicle data (drive history, sprint history, best times) is stored in `vehicles.specs_json` as JSON. Sprint timing uses `requestAnimationFrame` for sub-frame accuracy.

## Theming

Dark-only theme optimized for OLED. Colors and typography defined in `src/theme/colors.ts`. Background is pure black (#000000), primary is electric blue (#007AFF).

## Key Patterns

- Auth gating happens at the root layout level — unauthenticated users see AuthScreen
- Drive sessions collect route waypoints + speed data at 1Hz, saved to Supabase
- POI data is currently mocked in POIContext, designed for real API swap
- Deep linking via `apex://` scheme
- Platform-specific secure storage (Secure Enclave on iOS, Keystore on Android)
