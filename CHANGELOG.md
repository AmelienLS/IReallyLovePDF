# Journal des modifications

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
