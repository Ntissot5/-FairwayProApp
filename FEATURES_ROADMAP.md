# ⚠️ NOTE IMPORTANTE POUR CLAUDE CODE

Ce roadmap a été conçu à l'origine pour le projet Capacitor (`~/fairwaypro`).
Pour CE projet (`~/FairwayProApp`), qui est en **React Native (Expo) pur** :

1. **Adapter chaque feature au contexte natif RN** — pas de WebView par défaut
2. **Vérifier la compatibilité Expo SDK** avant d'installer une nouvelle lib
3. **Demander confirmation à l'utilisateur** avant d'utiliser un package non standard
4. **Une feature à la fois, testée et stable, commitée séparément**

Features qui posent problème en React Native pur (à discuter avec Noa avant d'attaquer) :
- F-011 Stripe Connect : pas de SDK natif officiel, peut nécessiter WebView
- F-019 QR-Bill Switzerland : libs web → wrapper RN nécessaire
- F-021 Trackman CSV : expo-document-picker requis
- F-014 Apple Pay : RevenueCat + StoreKit natif

---

## MVP Sprint Status (updated 2026-05-07)

| Feature | Status | Notes |
|---------|--------|-------|
| F-005a Push Notifications | ✅ DONE | Permission modal + token persistence |
| F-005b Daily Briefing Edge Function | ✅ DONE | Claude AI + cron scheduled |
| F-005c Daily Briefing Home UI | ✅ DONE | 3 cards + dismiss/reshow pill |
| F-005d Briefing Settings | ✅ DONE | Toggle/time/pause in Settings |
| F-007 Session Mode (Note + Drill) | ✅ DONE | Timeline + DB persistence validated |
| F-008 AI Summary | ✅ DONE | Whisper + Claude edge function + editable summary + send to player |
| F-V01 Video Annotation | ✅ DONE | Camera in-app, line/circle annotations multi-frame (accumulate from timestamp to end), 4 colors, upload Storage, player replay with synced annotations. Pattern C display. |
| F-006 Onboarding Coach | ✅ DONE | Welcome + Profile + First Player + Tutorial swipable + Hero CTA first session |

