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

