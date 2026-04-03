# KJ Fitness App

Mobile and desktop fitness coaching app for KJ Fitness, built with React Native + Expo + Firebase.

## Stack

- **Framework**: React Native + Expo (managed workflow)
- **Navigation**: React Navigation v6 (bottom tabs + stack)
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Platforms**: iOS, Android, Web (PWA)

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run in browser
npm run web
```

## Project Structure

```
src/
├── screens/
│   ├── client/       # Client-facing screens
│   └── coach/        # Coach-facing screens
├── components/       # Shared UI components
├── navigation/       # React Navigation setup
└── theme/            # Colors, typography, spacing
```

## Current Status

### Done
- [x] Project setup (Expo managed workflow)
- [x] Theme system (colors, typography)
- [x] Client Home Screen
- [x] Bottom tab navigation (5 tabs)
- [x] Weekly Plan Card component
- [x] Session Card with Bit Pay button
- [x] Quick Actions grid

### Coming Next
- [ ] Firebase Auth integration (login/register)
- [ ] Coach Dashboard
- [ ] Booking flow (calendar + slot picker)
- [ ] Real-time messaging
- [ ] Weekly content editor (coach)

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| Primary | `#00BCD4` | Buttons, accents, active states |
| Background | `#0A0A1A` | App background |
| Card | `#141428` | Card backgrounds |
| Text | `#FFFFFF` | Primary text |
| Text Secondary | `#9999BB` | Subtitles, labels |

## Developer

Built by pappostudios
