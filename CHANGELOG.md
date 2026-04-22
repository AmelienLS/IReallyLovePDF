# Journal des modifications

## [0.7.6] - 2026-04-22
> Commit : `fix(save): align PDF baseline with CSS cap-height; fix(ocr): tighter artifact filters`

### Corrigé
- **Décalage vertical entre la preview et le PDF sauvegardé** : la racine du problème était dans `drawTextReplacement` — la première ligne était positionnée avec `1.0 × fontSize` sous le haut de la bbox, alors que CSS `lineHeight:1.2` place la baseline à `0.82 × fontSize` (cap-height Helvetica 0.718 + demi-leading 0.1). Corrigé dans `pdfSaver.ts` : premier baseline à `0.82 × rowFontSize`, idem pour le chemin de secours sans `ocrRows`
- **Artefacts watermark "J", "L" toujours présents** : seuil de binarisation abaissé de 100 à 80/255 — les pixels anti-aliasés en bordure du filigrane gris (80-100/255) sont maintenant éliminés avant Tesseract
- **Fragments courts minuscules ("ed", "is", "of")** : `looksLikeText` rejette désormais les tokens de 1-2 caractères entièrement en minuscules
- **Caractère unique trop grand ("J", "L" isolés)** : limite de hauteur ajoutée pour les tokens d'un seul caractère (`rect.height > pageH × 0.06`)
- **Filtre de taille de police** : seuil outlier resserré à `2.0 × médiane` (au lieu de 2.5×) ; minimum absolu ajouté à `5pt` pour exclure le texte du cartouche trop petit pour être ré-dessiné fidèlement

---

## [0.7.5] - 2026-04-22
> Commit : `fix(ocr): fixed threshold binarization, numeric confidence bypass, outlier filter`

### Corrigé
- **Filigrane gris rendu plus visible par la binarisation d'Otsu** : remplacé par un seuil fixe à 100/255 — seuls les pixels réellement foncés (encre) sont conservés, les gris moyens du filigrane diagonal deviennent blancs avant d'être envoyés à Tesseract
- **Chiffres de listes (`1.`, `2.`, `3.`) toujours ignorés** : les tokens purement numériques contournent désormais le filtre de confiance et sont acceptés sans condition, quel que soit le score de Tesseract
- **Artefacts de taille anormale (`433`, `J` isolés depuis un logo)** : filtre de valeurs aberrantes ajouté après extraction — tout mot dont la `fontSize` dépasse 2,5× la médiane de la page est écarté avant le clustering
- **Symbole `∅` (diamètre) lu `@`** : post-processing étendu — `@(\d)` → `∅$1` corrige la notation diamètre sur les plans techniques
- **`Y%` spurieux** : pattern `\bY(%)` → `$1` supprime le `Y` parasite avant les symboles `%`
- **Clustering d'annotations empilées** : seuil vertical étendu de 1,5 → 2,5× la hauteur moyenne, ce qui permet de regrouper les cotes stacked type `(B) 0.433` + `[20.00]`

---

## [0.7.4] - 2026-04-22
> Commit : `fix(ocr): Otsu binarization to eliminate watermarks before recognition`

### Corrigé
- **Filigrane détecté comme texte / chiffres de listes qui disparaissent** : cause racine identifiée — le texte diagonal gris ("MW Industries") perturbait la segmentation de blocs de `PSM.AUTO`, mélangeant le contenu des notes avec celui du filigrane. Fix : binarisation d'Otsu ajoutée dans `preprocessCanvas` — l'algorithme calcule automatiquement le seuil optimal pour séparer le texte foncé du fond clair. Le filigrane gris devient pur blanc avant d'être envoyé à Tesseract, qui ne le voit plus du tout
- Seuil de confiance abaissé 35 % → 25 % : les chiffres isolés (`1`, `2`, `3` en début de liste) et les tokens courts ont souvent une confiance basse mais sont légitimes

---

## [0.7.3] - 2026-04-22
> Commit : `fix(ocr): filter watermarks by page-relative bbox size and post-process ± symbol`

### Corrigé
- **Watermark "MW Industries" détecté comme texte** : filtre `looksLikeText` étendu avec les dimensions de page — tout mot dont le bbox dépasse 20 % de la largeur ou 15 % de la hauteur de la page est considéré comme un filigrane/logo et écarté. Le texte diagonal de fond (type tampon MW Industries) ne génère plus de zones parasites
- **Symbole `±` tronqué** : post-processing `postProcess()` appliqué à chaque mot avant insertion — `+/-`, `+-`, `+\-` sont convertis en `±`. Corrige les cotes de tolérance (`±0.039`, `±1.00`) qui apparaissaient sans le signe

---

## [0.7.2] - 2026-04-22
> Commit : `fix(ocr): restore PSM.AUTO for lists and derive font size from line bbox`

### Corrigé
- **Chiffres de listes zappés** (`1.`, `2.`, `3.`) : `PSM.SPARSE_TEXT` ignorait les tokens courts dans les listes structurées. Retour à `PSM.AUTO` (plus robuste pour les documents mixtes) — le filtre `looksLikeText` continue de rejeter les logos et zones décoratives
- **Taille de police incohérente sur une même ligne** : la `fontSize` est désormais dérivée du bbox de la **ligne Tesseract** (`lineRect.height × 0.88`) et appliquée uniformément à tous les mots de cette ligne. Ainsi majuscules et minuscules sur la même ligne ont la même taille affichée, conformément à la police originale du PDF

---

## [0.7.1] - 2026-04-22
> Commit : `fix(ocr): expand display boxes and improve short-string detection`

### Corrigé
- **Boîtes trop petites** : le div d'affichage et l'input d'édition sont désormais élargis d'un padding `max(fontSize × 0.15, 2px)` sur chaque côté — le texte rendu (légèrement plus grand que le bbox Tesseract) n'est plus coupé. `originalRect` reste inchangé pour la sauvegarde PDF
- **Chiffres et crochets manquants** : seuil de confiance abaissé de 50 % → 35 % ; filtre `looksLikeText` assoupli pour les chaînes courtes (≤ 3 caractères) où la contrainte alphanumérique et le ratio densité étaient trop stricts pour les symboles `[`, `]`, `(`, `)` et les chiffres isolés

---

## [0.7.0] - 2026-04-22
> Commit : `feat(ocr): auto-scan on load, per-word font sizes, multi-line clusters`

### Ajouté
- **OCR automatique au chargement** : se déclenche dès que PDF.js détecte qu'une page ne contient pas de texte extractible (`textCount === 0`). Les pages avec texte natif ne sont pas re-scannées
- **Taille de police par mot** : chaque token d'un cluster OCR conserve sa `fontSize` individuelle (`OcrRow[] = Array<Array<{ text, fontSize }>>`) stockée dans `TextEdit.ocrRows`. Le rendu dans `AnnotationLayer` affiche chaque mot dans son `<span>` avec sa propre taille — titres et corps de texte coexistent dans la même zone sans uniformisation
- **Multi-ligne dans EditOverlay** : le `<input>` remplacé par un `<textarea>` ; `Shift+Enter` = saut de ligne, `Enter` = validation
- `OcrWord.rows` : structure transmise par `clusterWords` vers le store via `importOcrAsEdits`

### Modifié
- Granularité "intelligente" devient l'unique mode, le sélecteur est supprimé
- Le bouton "Lancer l'OCR" devient "Relancer l'OCR" (l'auto-scan ayant déjà été effectué)
- `OcrGranularity` conservé dans les types pour rétrocompatibilité mais n'est plus exposé dans l'UI

---

## [0.6.1] - 2026-04-22
> Commit : `feat(ocr): smart clustering, logo filtering and contrast preprocessing`

### Ajouté
- **Granularité "intelligente"** (nouveau défaut) : après extraction mot par mot, un algorithme Union-Find regroupe les mots spatialement proches (gap horizontal < 3× largeur moy. d'un caractère, gap vertical < 1.5× hauteur de ligne) en zones sémantiques unifiées. Idéal pour les dessins techniques : une cote avec sa tolérance (`+0.05 / 25.4 / −0.05`) devient une seule zone éditable
- **Pré-traitement image** avant OCR : conversion en niveaux de gris + étirement de contraste (histogram stretching). Améliore significativement la détection des chiffres fins (tracés de faible contraste, scans sous-exposés)
- **Filtre logo/non-texte** (`looksLikeText`) : exclut les régions dont la densité caractères/surface est trop faible (logo étalé sur grande zone), le ratio largeur/hauteur extrême (bandeau décoratif), ou qui ne contiennent aucun caractère alphanumérique

### Modifié
- PSM `AUTO` → `SPARSE_TEXT` (11) : Tesseract cherche du texte épars sur la page et ignore les régions non-texte — bien plus adapté aux plans techniques que le mode automatique (qui tente de détecter des colonnes/paragraphes)
- Seuils de confiance relevés et différenciés par granularité : `symbol` ≥ 40 %, `word`/`smart` ≥ 50 %, `line` ≥ 45 % (réduit les faux positifs sur les zones ambiguës)

---

## [0.6.0] - 2026-04-22
> Commit : `feat(ocr): convert scanned zones to pre-filled text edits for iLovePDF-like UX`

### Ajouté
- `TextEdit.source?: "ocr" | "native"` : distingue les zones créées par OCR des éditions manuelles — les zones OCR sont toujours conservées à la sauvegarde même si leur texte n'a pas changé (garantit une typographie uniforme Helvetica sur tout le texte scanné)
- `importOcrAsEdits(pageIndex, words)` dans le store : convertit directement chaque zone OCR en `TextEdit` pré-rempli avec le texte reconnu. Les anciennes zones OCR de la page sont purgées avant chaque re-scan

### Modifié
- **UX OCR** : après un scan, toutes les zones apparaissent immédiatement comme des boîtes blanches éditables avec le texte OCR dedans — l'utilisateur clique et tape directement, sans étape intermédiaire d'activation. Identique au comportement d'iLovePDF
- Granularité par défaut : `"symbol"` → `"line"` (une zone par ligne de texte, plus naturel pour l'édition en place)
- `commitTextEdit` : les zones OCR ne sont plus supprimées si le texte n'a pas changé (comportement préservé uniquement pour le texte natif PDF.js)
- `PageRenderer` : `OcrOverlay` retiré — les zones OCR sont désormais rendues par `AnnotationLayer` via les `TextEdit` générés. Bouton "Effacer l'OCR" retiré (remplacé par "Relancer l'OCR" qui purge et recrée)

---

## [0.5.1] - 2026-04-21
> Commit : `fix(ocr): correct font size by compensating for glyph-tight bbox`

### Corrigé
- La taille de la police affichée dans l'aperçu WYSIWYG et dans l'`EditOverlay` était trop petite pour les zones OCR : le bbox Tesseract colle au glyphe et n'inclut ni les ascendants ni les descendants. Correction par un facteur de compensation (`× 1.35` pour la granularité `symbol`, `× 1.15` pour `word` / `line`) — le texte tapé apparaît désormais à la même taille visuelle que l'original

---

## [0.5.0] - 2026-04-21
> Commit : `feat(editor): live WYSIWYG preview of text replacements with matching typography`

### Ajouté
- **Aperçu WYSIWYG en direct** : dès qu'un caractère est modifié dans `EditOverlay`, le PDF affiche instantanément le résultat final — fond blanc couvrant le texte/OCR original, nouveau texte rendu à la **même taille** (`fontSize` hérité du transform PDF.js ou de la hauteur OCR) et **même couleur** que l'original
- Typographie de substitution `"Helvetica Neue", Helvetica, Arial, sans-serif` avec `letterSpacing: 0.01em` et `lineHeight: 1` — reproduit visuellement le rendu Helvetica utilisé par `pdf-lib` à la sauvegarde, donc l'aperçu écran correspond exactement au PDF final

### Modifié
- `EditOverlay` : passage d'un `<textarea>` non-contrôlé (`defaultValue` + `onBlur`) à un `<input>` contrôlé (`value` + `onChange` → `updateEdit`). Chaque frappe patche le store → re-render live de l'aperçu. `Enter` valide, `Escape` annule, `blur` finalise
- `AnnotationLayer` : le bloc `text-replacement` ne montre plus un simple indicateur coloré mais rend le `newText` avec la typographie cible dans un rectangle blanc (taille = `originalRect`) — à l'inactif, l'utilisateur voit le résultat comme imprimé ; à l'édition, l'input se superpose au même emplacement

---

## [0.4.4] - 2026-04-21
> Commit : `refactor(ocr): extract OCR zones into dedicated declarative OcrOverlay component`

### Modifié
- **Architecture OCR refondue** : les zones OCR ne sont plus gérées par `TextLayer` (manipulation DOM impérative dans un `.then()` asynchrone, sujette aux race conditions) mais par un nouveau composant dédié `OcrOverlay.tsx` qui rend chaque zone en **JSX déclaratif**. Les rectangles pointillés apparaissent donc de façon garantie dès que `ocrWords` est présent dans le store — aucune dépendance à l'ordre d'exécution des effets
- `TextLayer` simplifié : ne gère plus que le texte extrait par PDF.js (natif). Suppression du sélecteur `ocrWords` et de la branche OCR dans la boucle d'ajout de spans

### Ajouté
- `src/components/viewer/OcrOverlay.tsx` : overlay React (zIndex 14) qui affiche chaque zone détectée comme un `<div>` absolument positionné avec bordure pointillée orange, fond translucide, hover glow, et handler `onClick` → `beginTextEdit`
- **Déduplication** : les zones OCR déjà transformées en `text-replacement` sont automatiquement masquées (comparaison sur `originalRect`) — évite les doublons quand on re-clique après édition

---

## [0.4.3] - 2026-04-21
> Commit : `fix(ocr): apply dashed outline at span creation to avoid race with async build`

### Corrigé
- Les rectangles pointillés autour des zones OCR n'apparaissaient pas alors que le badge indiquait « N zones détectées » : les styles étaient posés par un `useEffect` qui s'exécutait **avant** que `page.getTextContent().then()` ait eu le temps d'ajouter les spans au DOM. Le `recordsRef` était encore vide au moment du styling
- Correction : les styles « idle » (pointillé orange/bleu, fond translucide) sont maintenant appliqués **directement au moment de l'ajout du span** via `applyIdleStyle()`, en utilisant `toolModeRef` pour lire le mode courant. Un `useEffect` secondaire réapplique les styles uniquement lors d'un changement de `toolMode`
- Taille minimale garantie pour les zones OCR (`6×10 px`) : les petits glyphes restent cliquables même à faible zoom
- `box-sizing: border-box` ajouté aux spans pour que l'outline ne gonfle pas la boîte

### Ajouté
- `isOcr` mémorisé dans `ItemRecord` (évite de relire la classe CSS à chaque event)
- Fond idle un peu plus marqué (15% orange / 10% bleu au lieu de 12% / 8%)

---

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
