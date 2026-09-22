# Agents IA — Vuvio

Agents spécialisés pour assister le développement de Vuvio. Les fichiers de configuration sont dans `.claude/agents/` (gitignored, local).

---

## Utilisation

Dans n'importe quelle conversation Claude Code :

```
use vuvio-qa
use vuvio-product
use vuvio-launch
```

Ou directement en langage naturel — ex. : "run a QA audit on the Watch flow", "evaluate this feature idea: …"

---

## vuvio-qa — Agent QA

**Rôle** : Auditer le code, trouver des bugs, produire des rapports priorisés.

**Ne fait jamais** : modifier le code, déployer, toucher la prod sans autorisation explicite.

### Quand l'utiliser

- Après une session de dev : `"run a QA audit on the changes I just made"`
- Avant un déploiement : `"check for regressions in Watch and Globe"`
- Sur un flow spécifique : `"audit the auth flow for mobile Safari issues"`

### Format de rapport

Pour chaque bug :
- **Sévérité** : BLOCKING / MAJOR / MINOR
- **Reproduced** : Yes (code evidence) | Potential (code analysis)
- **Location** : fichier:ligne
- **Root cause** + correction proposée

### Flows couverts

| Flow | Fichiers clés |
|------|--------------|
| Auth | `src/routes/LoginPage.jsx`, `SignupPage.jsx`, `ForgotPasswordPage.jsx`, `src/context/AuthContext.jsx` |
| Watch | `src/routes/WatchPage.jsx` |
| Globe | `src/components/globe/GlobeTest2.jsx` |
| Start Live | `src/routes/LivePage.jsx`, `src/services/webrtcService.js` |
| Streaming (viewer) | `src/routes/WatchPage.jsx` — HLS + P2P fallback |
| Profile / Settings | `src/routes/ProfilePage.jsx`, `SettingsPage.jsx` |
| Messages | `src/routes/MessagesPage.jsx`, `ConversationPage.jsx` |

---

## vuvio-product — Agent Product Manager

**Rôle** : Évaluer les nouvelles idées, garder le focus MVP, éviter la dispersion.

### Quand l'utiliser

- `"vuvio-product: est-ce que cette feature est dans le scope du lancement ?"`
- `"vuvio-product: on a déjà quelque chose pour ça ?"`
- `"vuvio-product: évalue l'idée d'ajouter [X]"`

### Ce qu'il évalue

1. Vision fit — cohérence avec "découvrir le monde via des lives POV"
2. Duplicate — existe déjà dans Vuvio ?
3. Launch necessity — requis pour la bêta publique ?
4. Deferrable — peut attendre v2 ?
5. Complexity — tweak / feature / architecture ?
6. Impact — flows existants affectés ?

### Docs de référence

- `docs/vuvio-complete-overview.md`
- `docs/vuvio-reference-produit-non-technique.md`
- `ADMIN.md` (tâches ouvertes)

---

## vuvio-launch — Agent Launch & Growth

**Rôle** : Préparer le lancement public — créateurs, outreach, séquence de lancement.

**Ne fait jamais** : envoyer des messages ou contacter des personnes automatiquement.

### Quand l'utiliser

- `"vuvio-launch: trouve 10 créateurs potentiels dans le sport extrême"`
- `"vuvio-launch: rédige un DM d'approche pour un chef cuisinier"`
- `"vuvio-launch: propose une séquence de lancement sur 4 semaines"`
- `"vuvio-launch: identifie des communautés pertinentes sur Reddit/Discord"`

### Ce qu'il peut produire

- Listes de créateurs cibles (nom, plateforme, followers, pourquoi Vuvio)
- Templates de DM / email d'approche (< 150 mots, toujours pour review avant envoi)
- Séquence de lancement J-4sem → J-0
- Cartographie des communautés pertinentes

---

## Historique des audits QA

| Date | Scope | Bugs trouvés | Bugs corrigés |
|------|-------|-------------|--------------|
| 2026-09-23 | Auth, Watch, Globe, Start Live, Streaming | 8 (4 majeurs, 4 mineurs) | 8 — commit `d75973b` |
