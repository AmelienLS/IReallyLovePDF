# Journal des modifications

## [0.4.2] - 2026-04-21
> Commit : `feat(ocr): prominent dashed outline per detected zone with tooltip`

### Ajouté
- **Rectangle pointillé visible** (`1.5px dashed`) autour de chaque zone détectée en mode Sélection, avec un léger `outline-offset` pour bien détacher la bordure du contenu — chaque zone est identifiable individuellement
- Couleur distinctive : **orange** pour les zones OCR, **bleu accent** pour le texte natif PDF.js
- Fond translucide (12% orange / 8% bleu) remplit la zone pour visualiser son étendue exacte
- **Effet de survol** : bordure pleine 2px, fond intensifié, halo et élévation (`box-shadow`) — la zone survolée ressort clairement de ses voisines
- **Tooltip** au survol affichant le texte détecté : `« 25.4 » (OCR) — clic pour éditer` — permet de vérifier la lecture OCR avant modification
- Transitions CSS fluides (120 ms) pour le hover et `border-radius: 2px` sur les zones

---

## [0.4.1] - 2026-04-21
> Commit : `fix(ocr): bundle tesseract assets locally and add ASCII symbol-level recognition`

### Corrigé
- **OCR fonctionnel dans Tauri** : les assets tesseract (`worker.min.js`, 18 fichiers `tesseract-core*`, `eng.traineddata`, `fra.traineddata`) sont désormais copiés/téléchargés dans `public/tesseract/` par `scripts/setup-tesseract.mjs` exécuté en `predev` / `prebuild`. Plus aucun appel au CDN au runtime — l'OCR marche hors ligne et sans problème de CORS/CSP dans la webview Tauri
- Appel `worker.recognize()` adapté à tesseract.js v7 : passage explicite de `output: { blocks: true, text: true }` pour obtenir l'arbre `blocks → paragraphs → lines → words → symbols`

### Ajouté
- **Granularité « par symbole »** (nouveau défaut) : chaque caractère ASCII reconnu devient une zone éditable indépendante — idéal pour modifier chiffre par chiffre une valeur de cote dans un dessin technique
- Granularités disponibles : `par symbole` / `par mot` / `par ligne` via un sélecteur sous chaque page
- Whitelist de caractères par défaut : chiffres, lettres ASCII, ponctuation courante et symboles métriques (`° ± × µ ∅ Ø`) — améliore drastiquement la précision en évitant les caractères exotiques parasites
- `PSM.AUTO` + `preserve_interword_spaces: "1"`
- Affichage du **statut** Tesseract en direct (rendu / chargement / reconnaissance) en plus du pourcentage
- Message d'erreur détaillé si l'OCR échoue, avec conseil de relancer le script de setup

### Modifié
- `scripts/setup-tesseract.mjs` : script Node natif (zéro dépendance) qui copie les fichiers tesseract depuis `node_modules` et télécharge les `.traineddata` (tessdata_fast) depuis GitHub si absents
- `package.json` : `predev` et `prebuild` enchaînent désormais `copy-pdfjs-worker` puis `setup-tesseract`
- `.gitignore` : `public/tesseract/` et `public/pdf.worker.min.mjs` sont ignorés (régénérés automatiquement)

---

## [0.4.0] - 2026-04-21
> Commit : `feat(ocr): add Tesseract.js OCR for vectorized / scanned PDFs`

### Ajouté
- **OCR sur demande via [`tesseract.js`](https://github.com/naptha/tesseract.js)** (langues `fra+eng`) : bouton « Lancer l'OCR sur cette page » sous chaque page en mode Sélection
- `src/lib/ocr.ts` : rend la page à 3× pour précision OCR, filtre les mots avec confiance < 30%, retourne les bounding boxes en coordonnées PDF
- Store : `ocrWords: Record<pageIndex, OcrWord[]>` + `ocrRunning`, réinitialisés à l'ouverture d'un nouveau PDF
- `TextLayer` : fusionne les items PDF.js et les mots OCR, chaque mot OCR est cliquable (couleur orange distinctive vs bleu pour le texte natif)
- Édition OCR : clic → `EditOverlay` → sauvegarde via `pdfSaver` qui dessine un rectangle blanc sur l'emplacement original et écrit le nouveau texte par-dessus (identique au flow de remplacement natif)
- Indicateur de progression en temps réel pendant la reconnaissance
- Bouton « Effacer l'OCR » pour repartir de zéro
- Cas d'usage principal : **PDF de CAO / dessins techniques** où le texte a été converti en tracés vectoriels et n'est plus extractible par PDF.js

### Modifié
- `package.json` : ajout de la dépendance `tesseract.js`
- Les données de langue Tesseract sont téléchargées depuis le CDN au premier OCR (CSP désactivée dans `tauri.conf.json`)

---

## [0.3.5] - 2026-04-21
> Commit : `feat(editor): visible editable text regions and extraction status`

### Ajouté
- En mode Sélection, chaque zone de texte extraite par PDF.js (`getTextContent`) est maintenant affichée avec un fond bleuté et un pointillé discret — l'utilisateur voit immédiatement ce qui est cliquable/éditable (utile pour les cotes d'un dessin technique)
- Hover : le fond s'intensifie et une bordure pleine accent apparaît pour confirmer la cible
- Curseur `pointer` en mode Sélection
- Badge sous chaque page indiquant le nombre de zones de texte éditables, ou un avertissement rouge `aucun texte extractible (PDF vectorisé / scanné)` lorsque PDF.js ne retourne aucun item — cas fréquent sur les PDF de CAO où le texte est converti en tracés vectoriels (OCR nécessaire, non supporté nativement)

---

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
