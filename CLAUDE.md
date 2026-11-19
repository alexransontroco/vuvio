# Vuvio — Instructions pour Claude

## Ajouter une vidéo live mockup

Quand l'utilisateur dit "ajouter une vidéo mockup" ou "ajouter un live mockup", suivre ce checklist dans l'ordre :

1. **Upload vidéo** sur Firebase Storage
   ```
   gsutil cp "chemin/local/video.mp4" "gs://vuvio-bf328.firebasestorage.app/mock-videos/live-mockups/nom.mp4"
   gsutil acl ch -u AllUsers:R "gs://vuvio-bf328.firebasestorage.app/mock-videos/live-mockups/nom.mp4"
   ```

2. **Générer un thumbnail** avec ffmpeg (à ~2s dans la vidéo)
   ```
   ffmpeg -ss 2 -i "chemin/local/video.mp4" -vframes 1 -q:v 2 /tmp/nom-thumb.jpg
   ```

3. **Upload thumbnail** sur Firebase Storage
   ```
   gsutil cp /tmp/nom-thumb.jpg "gs://vuvio-bf328.firebasestorage.app/mock-videos/live-mockups/nom-thumb.jpg"
   gsutil acl ch -u AllUsers:R "gs://vuvio-bf328.firebasestorage.app/mock-videos/live-mockups/nom-thumb.jpg"
   ```

4. **Ajouter les URLs** dans `src/data/mockVideoUrls.js`
   - URL vidéo dans `MOCK_VIDEO_URLS`
   - URL thumbnail dans `MOCK_THUMBNAILS`

5. **Créer le stream** dans `src/data/mockStreams.js` avec `video: MOCK_VIDEO_URLS.xxx` et `image: MOCK_THUMBNAILS.xxx`

6. **Ajouter l'ID** dans `demoVideoLiveIds` dans `src/routes/WatchPage.jsx`

7. **Ajouter coordonnées** dans `src/data/mapStreams.js` pour que le zoom globe fonctionne

## Déployer

```
vite build && firebase deploy --only hosting:vuvio-bf328
```

Ne déployer QUE depuis `main`. Jamais depuis `dev` ni `experimental`.

## Workflow Git — 3 branches

- **`main`** → production, stable, toujours déployable
- **`dev`** → travail quotidien, intégration des features
- **`experimental`** → labos, PoCs, features instables

Détail complet dans [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md).

Raccourcis :
- Nouvelle feature → `git checkout dev && git checkout -b feat/<slug>`
- Promotion `dev` → `main` : `git checkout main && git merge --ff-only dev`
- Ne jamais `git push --force` sur `main`

## Fin de session

Après chaque session de travail significative (feature, bug fix, refacto) :

1. Mettre à jour `CHANGELOG.md` avec ce qui a été fait — **sans attendre que l'utilisateur le demande**
2. Mettre à jour les fichiers mémoire dans `.claude/projects/.../memory/`

> Règle : Claude met à jour CHANGELOG.md de manière autonome à la fin de chaque session. Ne pas attendre d'instruction explicite.
