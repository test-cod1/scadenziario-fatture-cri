// ============================================================
//  Da uno user agent a qualcosa che una persona riconosce:
//  «Chrome su Windows», «Safari su iPhone». Per il Registro accessi.
//  L'ordine dei controlli conta: Edge e Opera si dichiarano anche Chrome,
//  Chrome si dichiara anche Safari, l'iPad recente si dichiara Mac.
// ============================================================

const BROWSER = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SISTEMA = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/CrOS/, 'ChromeOS'],
  [/Mac OS X|Macintosh/, 'Mac'],
  [/Linux/, 'Linux'],
];

export function descriviDispositivo(ua) {
  if (!ua || typeof ua !== 'string') return 'Dispositivo sconosciuto';
  const browser = BROWSER.find(([re]) => re.test(ua))?.[1];
  const sistema = SISTEMA.find(([re]) => re.test(ua))?.[1];
  if (browser && sistema) return `${browser} su ${sistema}`;
  if (browser || sistema) return browser || sistema;
  return 'Altro programma';
}

// Durata leggibile tra due istanti: «45 min», «2 h 10 min», «3 giorni».
export function durata(da, a) {
  const min = Math.max(0, Math.round((new Date(a) - new Date(da)) / 60000));
  if (min < 1) return 'meno di un minuto';
  if (min < 60) return `${min} min`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return min % 60 ? `${ore} h ${min % 60} min` : `${ore} h`;
  const giorni = Math.floor(ore / 24);
  return giorni === 1 ? '1 giorno' : `${giorni} giorni`;
}
