# Premortem Transcript — FairwayPro

**Date:** 3 mai 2026
**Sujet:** FairwayPro, app iOS de coaching golf (React Native/Expo + Supabase)
**Methode:** Gary Klein prospective hindsight, 8 agents paralleles

---

## Contexte

### Quoi ?
FairwayPro est une app iOS React Native/Expo pour les coaches de golf. Elle permet de gerer des joueurs, suivre des sessions, capturer de la video, utiliser l'IA (Claude API) pour des resumes de coaching, gerer des reservations et le revenu. MVP redefini le 3 mai 2026 : 7 features sur 4 phases.

### Pour qui ?
Coaches de golf, principalement en Suisse (prix en CHF), potentiellement marche europeen. Audience secondaire : les joueurs/eleves des coaches.

### Succes = ?
Un MVP serré et livrable ou Session Mode est la proposition de valeur centrale justifiant un abonnement mensuel CHF 40-60/mois. Objectif : des coaches qui paient chaque mois parce que l'app ameliore concretement leur workflow de coaching.

---

## Frame du premortem

> On est en novembre 2026. FairwayPro a echoue. L'app est toujours a moins de 10 utilisateurs payants, le developpement stagne, et Noa envisage d'arreter le projet. Voici comment c'est arrive.

---

## Raisons d'echec brutes (8 identifiees)

1. **Cle API exposee** — Cle Anthropic hardcodee en clair dans le code client, extractible de l'IPA
2. **Aucune strategie de distribution** — Pas de go-to-market, pas de presence dans les canaux ou les coaches se trouvent
3. **Session Mode ne tient pas sa promesse** — Feature pilier pas construite, techniquement complexe, UX terrain potentiellement mauvaise
4. **Prix trop eleve** — CHF 40-60/mois pour un MVP dans un marche ou les alternatives sont gratuites
5. **IAP jamais integre** — Paywall UI sans librairie de paiement installee, revenue = 0
6. **Rejets App Store repetes** — SubscribeScreen comme premier ecran, cle API en clair, pas de disclosure AI
7. **Divergence des branches** — main et restore-working-version architecturalement incompatibles
8. **Goulot solo developer** — Une personne pour tout, aucune resilience face aux interruptions

---

## Deep-Dive Agent 1 : Cle API exposee

### Failure Story
FairwayPro ship sur l'App Store Q3 2026 avec `sk-ant-api03-n0yiidgBsqm-...` hardcode en plain text dans AICoachScreen.js (ligne 7) et CoachApp.js (ligne 58). Un IPA iOS est un zip — extraction en 2 minutes avec `strings`. Des scanners automatises ciblent specifiquement les binaires App Store pour les credentials API. L'abus commence discretement.

En octobre 2026, la facture Anthropic atteint plusieurs centaines de dollars par jour. Anthropic flag le compte (les cles ne doivent pas etre distribuees en client-side) et suspend la cle. Chaque appel Claude — AI Coach, resumes de session — retourne un 401. Les features IA tombent sans gestion d'erreur gracieuse. Les coaches qui paient CHF 40-60/mois ouvrent des tickets, puis des chargebacks.

L'ironie : le proxy Supabase Edge Function (`claude-proxy`) existe deja et est utilise correctement dans SessionsScreen.js et PlayerDetailScreen.js. Le fix etait a moitie fait.

### Hypothese sous-jacente
Parce que l'app est sur TestFlight (audience fermee), il n'y a pas d'urgence a rotater la cle hardcodee avant le lancement public.

### Signaux d'alerte
1. Spike de consommation API Anthropic post-lancement qui depasse le nombre d'utilisateurs
2. Toute exposition du repo (fork public, log CI) declenche trufflehog ou GitHub secret scanning

---

## Deep-Dive Agent 2 : Aucune strategie de distribution

### Failure Story
FairwayPro ship en aout 2026. Noa poste une fois sur LinkedIn, soumet a l'App Store, et attend. L'app est utile — Session Mode marche, le suivi joueurs est solide — mais personne ne vient. Les coaches suisses ne cherchent pas "golf coaching app" sur l'App Store. Ils demandent a un collegue au club, ou continuent avec WhatsApp + Excel. 40 impressions App Store le premier mois.

En octobre, 8 utilisateurs payants — amis d'amis. Noa interprete le silence comme un probleme produit et construit handicap tracking, drill libraries, video uploads. Le nombre d'utilisateurs reste a 8. Le vrai probleme — aucun coach hors du reseau personnel n'a entendu parler de FairwayPro — n'est jamais confronte directement.

### Hypothese sous-jacente
Construire un bon produit et le publier sur l'App Store suffit pour que les coaches le decouvrent.

### Signaux d'alerte
1. Zero contact avec une association golf suisse/europeenne avant le lancement
2. Moins de 10 testeurs TestFlight hors du reseau personnel

---

## Deep-Dive Agent 3 : Session Mode ne tient pas sa promesse

### Failure Story
Le dev commence en juin. Premier obstacle : camera + micro simultanes dans Expo SDK 55 sur iOS necessite de naviguer les collisions entre expo-video, expo-image-picker et expo-av. Un enregistrement stable qui ne crash pas en background, ne perd pas le fichier sur un appel entrant, et upload correctement vers Supabase Storage prend jusqu'en aout. Videos de swing golf = 100-200MB par clip, pas de compression, pas de chunked upload.

Les coaches testent en conditions reelles et l'UX s'effondre. 3 taps pour lancer l'enregistrement en plein soleil avec un gant. L'ecran se verrouille apres 30 secondes. Un coach filme une lecon entiere, upload avec succes, mais le resume AI est generique (Claude traite les metadonnees, pas la video). Session Mode est plus lent que Camera.app + Notes.app. Les coaches driftent tranquillement vers ce qu'ils faisaient avant.

### Hypothese sous-jacente
Les coaches adopteront une interface multi-outils inconnue pendant une lecon active, quand une app native gratuite fait deja le job principal.

### Signaux d'alerte
1. En beta, les coaches lancent Camera.app au lieu de Session Mode pendant les lecons
2. Moins de 1 video uploadee par coach par semaine = traitement notes-only, value prop morte

---

## Deep-Dive Agent 4 : Prix trop eleve

### Failure Story
Lancement a CHF 40/mois (Solo) et CHF 60/mois (Pro). Taux de conversion trial 4%. Les exit surveys revelent : les coaches trouvent l'app prometteuse mais ne justifient pas le cout vs WhatsApp + Calendar + Notes (gratuit). Pour un instructeur part-time a 8-10 lecons/semaine, CHF 40/mois = une demi-heure de lecon juste pour payer l'app.

A CHF 60/mois, les coaches attendent Calendly + Notion + video pro. Ils recoivent un MVP fonctionnel avec des edges rough. Les reviews App Store mentionnent le gap prix/valeur. Drop a CHF 29/mois pour reactiver les churned = percue comme desperate, pas strategique.

### Hypothese sous-jacente
Les coaches paieront un prix SaaS premium pour remplacer des workflows gratuits, avant que le produit ait prouve qu'il economise du temps ou de l'argent.

### Signaux d'alerte
1. Conversion trial-to-paid sous 10% apres 2 mois
2. Les churned users reviennent aux outils gratuits (pas a des concurrents)

---

## Deep-Dive Agent 5 : IAP jamais integre

### Failure Story
Apres Build 64, Noa hesite entre RevenueCat et expo-iap. RevenueCat gere receipt validation et entitlements mais necessite config native, App Store Connect, sandbox testing. Decision reportee. SubscribeScreen affiche des prix mais n'a aucun bouton d'achat — juste "Se connecter". Aucune dependance IAP dans package.json.

Les testeurs demandent comment payer — pas de reponse. Noa grant manuellement l'acces via Supabase, masquant l'urgence. Apple rejette la soumission : prix affiches (CHF 40/60) sans flow d'achat fonctionnel (3.1.1). Integration RevenueCat rushee, break sur StoreKit 2 async. Revenue zero jusqu'en novembre.

### Hypothese sous-jacente
Le paywall peut etre construit UI-first et branche aux paiements "plus tard", sans realiser qu'Apple exige l'infra avant le langage de monetisation.

### Signaux d'alerte
1. SubscribeScreen sans TouchableOpacity "Subscribe" — juste un ghost button "Se connecter"
2. package.json sans dependance IAP vs MASTER_CONTEXT qui mentionne RevenueCat

---

## Deep-Dive Agent 6 : Rejets App Store repetes

### Failure Story
Premier rejet juin 2026 : Guideline 3.1.1. SubscribeScreen est la premiere route dans RootStack.Navigator (App.js, ligne 94). Pas de moyen de browser l'app sans payer. Fix = restructurer le paywall + wire le demo account. 2 semaines.

Deuxieme rejet : cle Anthropic en plain text dans AICoachScreen.js. Apple flag comme credential exposure. Pas de disclosure AI sur les reponses generees. Fix = router toutes les calls via le proxy Supabase, pas juste retirer la cle. 2 semaines.

Troisieme soumission passe en septembre. 3 mois de momentum perdus.

### Hypothese sous-jacente
Passer TestFlight review (pas de scrutin IAP/paywall) = pret pour App Store review.

### Signaux d'alerte
1. Commit recent "fix: remove external URL button for App Store 3.1.1 compliance" = symptome traite, pas cause racine
2. AICoachScreen.js:7 contient une cle API live dans le source

---

## Deep-Dive Agent 7 : Divergence des branches

### Failure Story
La strategie deux-branches avait du sens en avril — stable pour TestFlight, main pour experimenter. Mais main a ajoute une couche de dependances complete : i18next, react-i18next, ThemeContext, expo-haptics, expo-linear-gradient. Chaque ecran sur main importe useTheme() et useTranslation() — hooks qui n'existent pas sur la branche stable. Merger n'importe quel fichier casse instantanement.

DailyBriefing (feature MVP) est sur main, wired dans l'architecture theme/i18n. Pour la ramener : soit porter toute la couche theme/i18n (30+ fichiers, risque regressions), soit rewrite from scratch. Le commit "WIP: backup before debugging crash" sur main indique que main est broken.

### Hypothese sous-jacente
Le travail sur main peut etre cherry-pick dans la branche stable, alors que la divergence est architecturale.

### Signaux d'alerte
1. Toute feature MVP qui touche un fichier existant aussi sur main avec useTheme()/useTranslation()
2. main reste au commit WIP 30+ jours sans etre fixe ni delete

---

## Deep-Dive Agent 8 : Goulot solo developer

### Failure Story
Apres Build 64, Noa commence Session Mode. La feature est la plus exigeante techniquement. Le progres ralentit de weekly a bi-weekly a monthly commits. Un projet client absorbe 2 semaines en aout. Le groupe TestFlight (pic a 12 coaches) se tait — pas de builds = pas de feedback.

En septembre, Noa porte une dette mentale grandissante : Session Mode a moitie construit, 3 bug reports ouverts, page pricing qui ne match pas la config IAP. Chaque fois qu'il ouvre la codebase, le scope semble plus lourd. En octobre, Session Mode partiel sans video. Les coaches le trouvent decevant. Le projet entre en mode "j'y reviendrai".

### Hypothese sous-jacente
Noa aura une capacite de dev consistante et ininterrompue pendant 6 mois.

### Signaux d'alerte
1. Frequence de commit sous 1/semaine pendant 2 semaines consecutives
2. Taux de reponse testeurs TestFlight sous 30%

---

## Synthese

### L'echec le plus probable
**Pas de distribution.** C'est le scenario avec la probabilite la plus haute parce qu'il ne depend d'aucun evenement externe — c'est l'etat par defaut. Sans action deliberee de go-to-market, l'invisibilite est garantie.

### L'echec le plus dangereux
**Cle API exposee.** C'est le seul scenario qui cause des pertes financieres directes ET detruit la reputation simultanement. Tous les autres echecs sont graduels et reversibles. Celui-ci est un incident.

### L'hypothese cachee
**"Un bon produit se vend tout seul."** 100% du temps va au dev, 0% a la distribution. La croyance non questionnee est que Session Mode suffira a attirer les coaches. L'histoire des startups dit le contraire.

### Le plan revise
1. **Securite (cette semaine)** : Migrer vers claude-proxy, revoquer la cle, alerte budget
2. **Enterrer main (cette semaine)** : Decision formelle, archiver le reference, un seul flux
3. **5 coaches beta non-amis avant Session Mode** : ASG, clubs, WhatsApp coaching
4. **Prix early adopter CHF 19/mois** : Valider willingness-to-pay, monter apres product-market fit
5. **Session Mode V1 minimal** : Timer + notes texte. Pas de video in-app. Valider usage reel d'abord.

### Checklist pre-lancement
1. Zero secret dans le code client. Calls AI via claude-proxy. Alerte Anthropic $50/mois.
2. SubscribeScreen n'est pas le premier ecran. App browsable sans payer. Disclosure AI.
3. RevenueCat installe et sandbox teste avant soumission App Store.
4. 5 coaches non-amis sur TestFlight en 3 semaines ou pivoter distribution.
5. Branche main archivee. Un seul flux de travail.

---

*Premortem genere le 3 mai 2026 — Methode Gary Klein (prospective hindsight) — 8 agents d'investigation en parallele*
