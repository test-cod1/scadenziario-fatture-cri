// ============================================================
//  Controllo statico del codice: `npm run lint`.
//
//  Cerca la classe di errori che le prove non vedono perché nessuna carica
//  quel file: una variabile usata ma mai dichiarata (il 18/10/2026 una riga
//  copiata da renderLogin in renderResetPassword usava `avviso`, che lì non
//  esiste: la schermata per impostare la password andava in errore appena
//  aperta), una dichiarata due volte, codice irraggiungibile.
//
//  Il progetto non ha dipendenze e non ne prende per questo: npm run lint
//  scarica ESLint al volo con npx, e questo file non importa niente — le
//  variabili globali del browser e di Node sono elencate qui sotto.
// ============================================================

const BROWSER = [
  'window', 'document', 'location', 'history', 'navigator', 'console', 'localStorage', 'sessionStorage',
  'fetch', 'Request', 'Response', 'Headers', 'URL', 'URLSearchParams', 'FormData', 'Blob', 'File', 'FileReader',
  'TextEncoder', 'TextDecoder', 'DOMParser', 'XMLSerializer', 'Node', 'Element', 'HTMLElement', 'Event', 'CustomEvent',
  'KeyboardEvent', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'AbortController', 'crypto',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'queueMicrotask', 'structuredClone', 'atob', 'btoa', 'alert', 'confirm', 'prompt', 'print', 'open', 'self',
  'caches', 'clients', 'registration', 'getComputedStyle', 'matchMedia', 'performance', 'Intl', 'CSS',
  'CompressionStream', 'DecompressionStream', 'ReadableStream', 'WritableStream', 'Image', 'Notification',
];
const NODE = ['process', 'Buffer', '__dirname', '__filename', 'require', 'module', 'global', 'globalThis',
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'URL', 'URLSearchParams', 'fetch',
  'Response', 'Request', 'Headers', 'TextEncoder', 'TextDecoder', 'crypto', 'structuredClone', 'atob', 'btoa',
  'AbortController', 'Intl', 'performance', 'queueMicrotask', 'Blob'];

const globali = (elenco) => Object.fromEntries(elenco.map(n => [n, 'readonly']));

const REGOLE = {
  'no-undef': 'error',
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'error',
  'no-const-assign': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-self-assign': 'error',
  'no-unsafe-finally': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
};

export default [
  { ignores: ['node_modules/**', 'dist/**', 'js/vendor/**', 'vendor/**', 'backup/**', '.wrangler/**'] },
  {
    files: ['js/**/*.js', 'sw.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globali(BROWSER) },
    rules: REGOLE,
  },
  {
    files: ['functions/**/*.js', 'functions/**/*.mjs', 'worker.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globali([...NODE, 'caches', 'DecompressionStream', 'CompressionStream']) },
    rules: REGOLE,
  },
  {
    files: ['tools/**/*.mjs', 'test/**/*.mjs', 'eslint.config.mjs'],
    // Alcune prove simulano il browser (location, history…) su globalThis.
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globali([...NODE, 'window', 'document', 'location', 'history']) },
    rules: REGOLE,
  },
  {
    files: ['server.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: globali(NODE) },
    rules: REGOLE,
  },
];
