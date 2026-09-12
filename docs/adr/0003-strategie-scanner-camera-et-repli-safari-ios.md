# 3. Stratégie du Scanner Caméra Optique et Gestion du Repli Safari / iOS

Date : 2026-09-12  
Statut : **Accepté**  
Contexte : Phase 16 - Pivot Mobile Web Responsive & PWA (Priorité 2)

---

## Contexte et Problématique

Dans le cadre du pivot mobile vers une application Web Responsive / PWA unique, les livreurs et agents de quai doivent pouvoir scanner les étiquettes de colis (Code 128) et les QR codes directement via la caméra de leur smartphone ou terminal portable (sans douchette filaire dédiée).

Deux technologies d'analyse d'image vidéo sont envisageables dans le navigateur :

1. **L'API Web Standard `BarcodeDetector`** (`window.BarcodeDetector`) : moteur natif C++ accéléré matériellement disponible dans les moteurs Chromium (Google Chrome, Microsoft Edge, Samsung Internet, Opera sur Android et PC).
2. **Une librairie de décodage logicielle JavaScript pure** (ex. `@zxing/library` ou WASM) : moteur interprété en JS/WASM analysant les frames vidéo extraites sur un `<canvas>`.

Or, **Apple Safari (iOS / iPadOS / macOS WebKit) n'implémente pas l'API `BarcodeDetector`**.  
Pour les utilisateurs opérant sous Safari/iOS, l'invocation de `window.BarcodeDetector` échouerait, risquant soit un crash non capturé, soit un flux vidéo allumé sans aucun décodage effectif (échec silencieux et décharge batterie inutile).

---

## Décision Retenue

### 1. Utilisation Native de `window.BarcodeDetector` pour le Lancement (MVP)

- Pour les terminaux Android (flotte métier principale des livreurs HES : PDA Zebra/Honeywell/Urovo et smartphones Android sous Chrome), nous exploitons le moteur natif `BarcodeDetector`.
- **Avantages majeurs** :
  - **Empreinte bundle zéro** : 0 KB ajouté au bundle de production (contre ~450 KB pour `@zxing/library`).
  - **Efficience énergétique & CPU** : décodage accéléré GPU/DSP par l'OS sans surchauffe du smartphone ni saturation du thread UI.
  - **Fréquence throttlée** : analyse limitée à 250 ms par passe pour préserver la batterie en tournée.

### 2. Détection Préventive et Repli Explicite sur Safari / iOS (Fail-Safe)

Plutôt que d'initier un flux caméra passif qui ne décoderait rien sous iOS, le composant unifié `CameraBarcodeScanner` :

1. Vérifie la présence de `window.BarcodeDetector && typeof window.BarcodeDetector === "function"` **avant** d'allumer le flux vidéo.
2. Si le navigateur est Safari/iOS (ou tout navigateur dépourvu de `BarcodeDetector`) :
   - Le flux vidéo n'est **pas ouvert** (économie de batterie et absence de prompt d'autorisation caméra inutile).
   - Un statut explicite et transparent est affiché à l'utilisateur :  
     _"Détection optique automatique non supportée sur ce navigateur (Safari/iOS). Saisie manuelle activée."_
   - Le callback `onFallback` est invoqué automatiquement, basculant l'interface parente (`TrackingScannerModal` ou `RecoverReturnPage`) directement sur le champ de saisie clavier pré-existant avec focus automatique.

### 3. Libération Immédiate des Ressources et Isolation Contexte

- **Sécurité HTTPS / `isSecureContext`** : `getUserMedia` exigeant impérativement HTTPS (ou `localhost`), toute tentative dans un contexte non sécurisé est interceptée en amont avec bascule manuelle explicite.
- **Cycle de vie du MediaStream** : à chaque fermeture de modal ou démontage du composant, `stream.getTracks().forEach(t => t.stop())` est systématiquement exécuté pour éteindre le voyant caméra du matériel.
- **Feedback sensoriel immédiat** : confirmation visuelle (halo vert émeraude `#10b981`) et impulsion haptique (`navigator.vibrate(100)`).

---

## Comparatif Technique : Repli Manuel vs Polyfill JS (@zxing)

| Critère                     | Option A : Natif + Repli Saisie Manuelle (Retenu)                   | Option B : Polyfill JS (@zxing/library)                  |
| :-------------------------- | :------------------------------------------------------------------ | :------------------------------------------------------- |
| **Poids Bundle Frontend**   | **0 KB supplémentaire** (bundle actuel : 691 kB)                    | +400 à 500 KB (+65% d'augmentation du bundle total)      |
| **CPU / Batterie Mobile**   | Accélération matérielle native (froid)                              | Décodage matriciel CPU pur en JS (chauffe & décharge)    |
| **Cible Métier HES**        | 95%+ des terminaux livreurs sur le terrain sont sous Android/Chrome | Couvre les utilisateurs occasionnels iPhone              |
| **Résilience Réseau CI/CD** | Zéro dépendance externe supplémentaire                              | Vulnérable aux restrictions registry npm en réseau fermé |
| **Expérience Utilisateur**  | Claire, honnête, repli fluide sans blocage                          | Scan actif sur iOS mais latence de décodage accrue       |

---

## Conséquences

### Positives

- Bundle ultra-léger et démarrage instantané de l'application sur smartphone.
- Aucune régression ni écran figé pour les utilisateurs Safari/iOS : l'expérience utilisateur est guidée et transparente.
- Réutilisation stricte à 100% du composant unique [CameraBarcodeScanner.tsx](file:///c:/Users/abdou/OneDrive/Desktop/HES/frontend/src/components/common/CameraBarcodeScanner.tsx) entre les différents écrans métiers.
- Zéro fuite de flux caméra en arrière-plan.

### Négatives / Limitations

- Les rares utilisateurs sur iPhone ne peuvent pas scanner automatiquement avec le capteur photo et doivent saisir le numéro de BL ou tracking au clavier ou par douchette Bluetooth HID.

### Évolution Roadmap Post-Lancement

Si la part d'utilisateurs Safari/iOS sur le terrain le justifie ultérieurement, l'architecture prévoit l'ajout d'un import dynamique lazy-loadé (`await import('@zxing/library')`) activé **uniquement** sur détection de `!('BarcodeDetector' in window)`, préservant ainsi le bundle principal pour les terminaux Android.
