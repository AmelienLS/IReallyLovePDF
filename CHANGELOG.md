# Journal des modifications

## [0.3.4] - 2026-04-21
> Commit : `fix(editor): reliable text click, visible delete buttons and keyboard Delete`

### Corrigé
- Clic sur texte existant : le handler utilise désormais la délégation d'événements (mouseover/click sur le conteneur) et l'ordre des layers a été inversé — `TextLayer` (z-index 12) est placé visuellement au-dessus de `AnnotationLayer`, qui perd son propre stacking context afin que les zones actives (new-text z:15, text-replacement actif z:20) passent correctement au-dessus
- Survol visuel : les spans de texte surlignent en bleu translucide en mode Sélection pour indiquer qu'ils sont cliquables
- Les spans ne sont plus reconstruits à chaque changement de `toolMode` (seulement le curseur et user-select sont mis à jour)

### Ajouté
- Bouton × visible pour supprimer une nouvelle zone de texte (au focus) ou annuler une modification de texte existant (au clic)
- Cliquer sur un indicateur de remplacement de texte l'active (permet de le supprimer via le bouton ×)
- Raccourci clavier `Delete` / `Backspace` : supprime l'édition active lorsque le focus n'est pas dans un textarea/input

---

## [0.3.3] - 2026-04-21
> Commit : `feat(window): add macOS overlay titlebar and DMG layout`

### Ajouté
- `titleBarStyle: "Overlay"` + `hiddenTitle: true` : boutons traffic light natifs macOS superposés à la toolbar
- Padding gauche 80px dans la toolbar pour ne pas masquer les boutons
- Config DMG (position app/dossier, taille fenêtre) identique à UNL3DPriceFinder

---

## [0.3.2] - 2026-04-21
> Commit : `fix(config): remove invalid plugins section from tauri.conf.json`

### Corrigé
- Crash au lancement : `plugins.dialog` avec valeur `{}` causait une erreur de désérialisation Tauri (`invalid type: map, expected unit`). Suppression de la section `plugins` entière — dans Tauri v2, dialog et fs se configurent uniquement via les capabilities.

---

## [0.3.1] - 2026-04-21
> Commit : `fix(ci): replace vite-plugin-static-copy with prebuild Node script for PDF.js worker`

### Corrigé
- Erreur CI `frontendDist includes node_modules` : `vite-plugin-static-copy` préservait la structure `node_modules/` dans `dist/`, bloquant le build Tauri
- Remplacement par un script `copy-pdfjs-worker` dans `package.json` (Node.js natif, cross-platform) qui copie `pdf.worker.min.mjs` dans `public/` avant chaque `build` et `dev`
- Suppression de la dépendance `vite-plugin-static-copy`

---

## [0.3.0] - 2026-04-21
> Commit : `chore(ci): add GitHub Actions build workflow for macOS and Windows`

### Ajouté
- `.github/workflows/build.yml` : workflow CI/CD qui build automatiquement un DMG (macOS) et un NSIS `.exe` (Windows) et les publie en GitHub Release dès qu'un commit sur `main` contient un tag de version (ex: `V1.0.0`) 

---

## [0.2.0] - 2026-04-21
> Commit : `feat(ui): apply Apple HIG design system`

### Ajouté
- `src/index.css` : design tokens CSS complets (couleurs, typographie, rayons, ombres, dark mode automatique)
- Support dark mode via `prefers-color-scheme`
- Scrollbars stylisées façon macOS

### Modifié
- Toolbar : fond card, séparateurs fins, tab-bar pour les modes outils, boutons HIG
- Sidebar : backdrop-blur, section header "Pages", miniatures avec ombres subtiles
- Viewer : fond `bg-grouped`, pages avec coins arrondis et ombre douce
- EditOverlay : bordure accent + halo focus HIG
- AnnotationLayer : highlights avec `mix-blend-mode: multiply`, indicateurs texte remplacé
- PageRenderer : skeleton loader stylisé, badge numéro de page

## [0.1.0] - 2026-04-21
> Commit : `feat(app): initial PDF editor implementation`

### Ajouté
- Viewer PDF multi-pages avec PDF.js (rendu canvas, zoom +/−)
- Sidebar avec miniatures des pages réordonnables par drag & drop (dnd-kit)
- Mode "Sélection" : clic sur du texte existant pour l'éditer en place (EditOverlay)
- Mode "Texte" : clic sur la page pour ajouter une nouvelle zone de texte
- Mode "Surligner" : sélection de texte pour ajouter un highlight jaune semi-transparent
- Sauvegarde PDF via pdf-lib (`Cmd+S` / `Cmd+Shift+S` pour Sauvegarder sous…)
- Backend Tauri (Rust) avec commandes `open_pdf` et `save_pdf` (écriture atomique)
- Store Zustand + Immer pour la gestion d'état centralisée
- Utilitaires de conversion de coordonnées PDF ↔ canvas
