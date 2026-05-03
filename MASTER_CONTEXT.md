# FairwayProApp — React Native (Expo) — App Mobile iOS

## ⚠️ RÈGLES CRITIQUES POUR CLAUDE CODE

1. **CE PROJET EST 100% REACT NATIVE / EXPO.** Pas de Capacitor. Pas de site web. Pas de wrapper.
2. **NE JAMAIS toucher au site web** (`~/fairwaypro` ou `~/fairwaypro-v2`). Ces dossiers sont SÉPARÉS.
3. **BUNDLE ID** : `com.ntissot.FairwayProApp` (App Store Connect : "FairwayPro – Coach de Golf")
4. **TOUJOURS utiliser** : Expo SDK, React Navigation, react-native composants natifs
5. **JAMAIS utiliser** : @capacitor/*, web APIs (window, document, localStorage), iframes, WebView (sauf demande explicite)

## Stack technique

- **Framework** : Expo (React Native)
- **Backend** : Supabase (project ref: aqdifzgqfemfdcigxsgw)
- **AI** : Claude API via Supabase proxy
- **Paiements** : RevenueCat (production key) + Stripe Connect côté coach
- **Build** : Xcode local archive (EAS Build instable avec iOS beta SDK)
- **Repo** : github.com/Ntissot5/-FairwayProApp

## Structure du projet

- `App.js` — entry point, routing principal
- `src/` — tous les screens et composants
  - `CoachApp.js` — navigation principale coach (tabs Home/Players/Sessions/Revenue/Chat/Booking)
  - `LoginScreen.js`, `WelcomeScreen.js`, `SubscribeScreen.js`
  - `PlayersScreen.js`, `PlayerDetailScreen.js`
  - `SessionsScreen.js`, `RevenueScreen.js`, `BookingScreen.js`
  - `ChatScreen.js`, `AICoachScreen.js`, `SettingsScreen.js`
  - `PlayerHomeScreen.js`, `PlayerBookScreen.js`, `PlayerOnboarding.js` — côté joueur
  - `components/` — composants réutilisables
  - `theme.js`, `ThemeContext.js` — design system
  - `i18n.js`, `locales/` — FR/EN

## État actuel

- **Branche `main`** : version récente avec features Phase 1/2/3 expérimentales (DailyBriefing, Feed, Space, VideoAnnotate, theme, i18n) — **non testée, peut crasher**
- **Branche `restore-working-version`** : commit `6fb91e0`, version stable du 2 mai = build TestFlight 64 actuellement en ligne
- **Build TestFlight actuel** : Build 64, 1.0.0, uploadé le 3 mai 2026

## Workflow obligatoire pour Claude Code

1. **Toujours lire ce fichier en premier** avant de modifier quoi que ce soit
2. **Une feature à la fois** — pas 7 features en 40 minutes comme aujourd'hui
3. **Commiter après chaque feature stable** avec message clair
4. **Tester localement avec `npx expo start`** avant tout build TestFlight
5. **Ne JAMAIS faire `npm install` d'un nouveau package** sans confirmation

## Commandes habituelles

```bash
# Lancer en local pour dev
npx expo start

# Build pour TestFlight (depuis branche stable)
npx expo prebuild --platform ios --clean
open ios/FairwayProApp.xcworkspace
# Puis dans Xcode : Product → Archive → Distribute → Upload
```

## Demo account Apple Review

- Email : `apple@fairwaypro.io`
- Password : `Demo1234!`
- 5 joueurs pré-populés, plan Pro actif
