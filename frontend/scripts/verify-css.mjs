import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist/assets');

console.log('🔍 [Contrôle Non-Régression CSS] Analyse du bundle CSS produit...');

if (!fs.existsSync(distDir)) {
  console.error('❌ Répertoire dist/assets introuvable ! Exécutez le build au préalable.');
  process.exit(1);
}

const cssFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.css'));
if (cssFiles.length === 0) {
  console.error('❌ Aucun fichier CSS trouvé dans dist/assets !');
  process.exit(1);
}

const mainCssFile = cssFiles[0];
const cssPath = path.join(distDir, mainCssFile);
const stats = fs.statSync(cssPath);
const content = fs.readFileSync(cssPath, 'utf8');

console.log(`📦 Fichier CSS détecté : ${mainCssFile} (${stats.size} octets / ${(stats.size / 1024).toFixed(2)} kB)`);

// 1. Contrôle de taille minimale :
// Un CSS sans classes Tailwind faisait seulement ~6.3 kB. Avec Tailwind compilé, il doit dépasser au moins 25 kB.
const MIN_BYTES = 25000;
if (stats.size < MIN_BYTES) {
  console.error(`❌ ÉCHEC : Le fichier CSS est anormalement petit (${stats.size} octets < seuil de ${MIN_BYTES} octets).`);
  console.error('   Les classes utilitaires Tailwind ne semblent pas avoir été générées.');
  process.exit(1);
}

// 2. Contrôle de présence des classes utilitaires et tokens clés
const requiredPatterns = [
  { name: 'min-h-[44px]', regex: /\.min-h-\\\[44px\\\]|min-height:\s*44px/ },
  { name: 'md:hidden', regex: /\.md\\:hidden|display:\s*none/ },
  { name: 'fixed', regex: /\.fixed\{position:\s*fixed/ },
  { name: 'rounded-xl', regex: /\.rounded-xl/ },
  { name: 'status-badge', regex: /\.status-badge/ },
  { name: 'design tokens (:root / --status-success)', regex: /--status-success/ },
];

let hasErrors = false;
for (const check of requiredPatterns) {
  if (!check.regex.test(content)) {
    console.error(`❌ ÉCHEC : Classe ou token requis manquant dans le CSS : "${check.name}"`);
    hasErrors = true;
  } else {
    console.log(`  ✓ Classe/Token vérifié : ${check.name}`);
  }
}

if (hasErrors) {
  console.error('❌ ÉCHEC du contrôle de non-régression CSS.');
  process.exit(1);
}

console.log('✅ CONTRÔLE DE NON-RÉGRESSION RÉUSSI : CSS généré complet et conforme.');
