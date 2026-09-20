# Modération — À faire / Explorer

---

## 1. Modération vidéo des lives

Détecter contenu adulte et violence pendant un live en cours.

**Solution : Google Cloud Vision API SafeSearch**
- 1 000 images/mois gratuites, puis $1.50 / 1 000
- ~360 frames/heure de live → coût très faible
- Catégories : `adult`, `violence`, `racy` — bloquer si `LIKELY` ou `VERY_LIKELY`

**Architecture :** frames capturées depuis le navigateur du broadcaster (canvas), envoyées à une Firebase Function qui appelle Vision API.

Flow :
1. Frame flaggée → `moderationWarning: true` dans Firestore
2. WatchPage affiche une alerte au streamer : *"Contenu potentiellement inapproprié — ajustez votre caméra"*
3. 2e flag dans les 30s → `moderationFlagged: true` → arrêt automatique

Ne jamais couper sans prévenir (faux positifs possibles).

**À faire**
- [ ] Activer Vision API dans Google Cloud Console
- [ ] Ajouter `@google-cloud/vision` dans `functions/package.json`
- [ ] Firebase Function `moderateFrame` (capture + appel API + écriture Firestore)
- [ ] Intervalle de capture dans WatchPage (mode broadcaster, toutes les 10s)
- [ ] Réaction dans WatchPage : alerte → arrêt si 2e flag
- [ ] Collection `moderationLogs` pour audit
- [ ] Tester avec image de test avant prod

---

## 2. Trust Score — Score de confiance interne

Score interne (jamais affiché à l'utilisateur) pour prendre des décisions automatiques :
- Mettre en avant ou non dans l'Explore
- Prioriser la modération humaine sur les comptes suspects
- Limiter certaines features pour les comptes à risque

**Signaux positifs :** ancienneté du compte, nb de lives, durée moyenne, followers, engagement, email vérifié, profil complété

**Signaux négatifs :** signalements reçus, lives terminés très tôt (< 2 min), compte récent (< 7 jours)

**Stockage dans `users/{uid}` :**
```
trustScore: 0–100
trustTier: "new" | "standard" | "trusted" | "at-risk" | "suspended"
```

Recalculé à chaque live terminé, à chaque signalement, et via scheduled function 1x/jour.

**Utilisation :**
- `at-risk` / `suspended` → exclus du feed Explore
- `new` → affichés mais pas mis en avant
- `trusted` → priorité dans le ranking

**Rôle de l'IA (optionnel)** : un LLM (Gemini Flash ou GPT-4o-mini, quasi gratuit) pour analyser les cas limites et produire un label + une raison lisible.

**Implémenté**
- [x] Formule de score dans `functions/src/users/updateTrustScore.ts`
- [x] Appelé depuis `endStream.ts` à chaque fin de live (fire-and-forget)
- [x] Scheduled function quotidienne `updateTrustScoresScheduled` dans `index.ts`
- [x] `trustScore` + `trustTier` + `trustUpdatedAt` écrits dans `users/{uid}`
- [x] Filtre `at-risk` / `suspended` dans `listLiveStreams.ts` (globe + explore)

**À faire**
- [ ] Interface admin pour voir / override le score manuellement
- [ ] Décider si on notifie l'utilisateur en cas de suspension
- [ ] Ajouter `reportCount` sur `users/{uid}` quand le système de signalement existera
