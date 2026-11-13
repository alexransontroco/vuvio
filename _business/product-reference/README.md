# Vuvio — Référence produit

Document source HTML/CSS et PDF final de la référence produit non technique Vuvio.

## Fichiers

- `index.html` — contenu complet des 10 pages.
- `styles.css` — mise en page 16:9, styles écran et impression.
- `Vuvio-Reference-Produit.pdf` — PDF final exporté.
- `assets/` — logo et photographies utilisées.
- `screens/` — captures locales de l’application Vuvio.
- `previews/` — aperçus PNG des 10 pages pour vérification visuelle.
- `export.sh` — export PDF + génération des aperçus.

## Modifier le contenu

Modifier directement `index.html`. Chaque page est une section `.slide`.

Modifier l’identité visuelle, les grilles, les tailles de texte ou les règles d’impression dans `styles.css`.

Les pages sont conçues en 1920 × 1080 px, format horizontal 16:9.

## Régénérer le PDF

Depuis ce dossier :

```bash
chmod +x export.sh
./export.sh
```

Le script utilise Google Chrome en mode headless et écrit :

- `Vuvio-Reference-Produit.pdf`
- `previews/page-1.png` à `previews/page-10.png`

## Notes de production

- Le document reprend la référence produit non technique originale.
- Les captures Watch, Explore et Profil proviennent du serveur local Vuvio.
- La route Globe locale n’a pas produit de capture stable; la page produit utilise donc le visuel globe réel du projet.
- Aucun fichier applicatif Vuvio n’est nécessaire pour modifier ou consulter ce document.
