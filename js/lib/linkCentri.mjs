// ============================================================
//  IL CODICE DEL LINK DI SOLA LETTURA DI UN CENTRO DI COSTO
//  («…/conto#automedica-Xk3pQ9aZb2»). Lo usano il portale, che lo crea,
//  la pagina pubblica e /api/centro-condiviso, che lo controllano: tre
//  posti, una regola sola.
//
//  Due pezzi:
//  - il nome dell'attività ridotto a lettere e trattini, perché chi riceve
//    il link capisca di che cosa parla prima di aprirlo. Non è un segreto
//    e non conta niente nel controllo;
//  - dieci caratteri casuali fra 62 (circa 60 bit): sono loro a rendere il
//    link impossibile da indovinare. Bastano per una pagina che si legge
//    soltanto e che si può disattivare con un clic, e tengono il link
//    abbastanza corto da stare in un messaggio.
//
//  Il tutto sta dopo il #: non arriva al server con la pagina, quindi non
//  finisce nei log di chi la serve né nel Referer.
// ============================================================

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const LUNGHEZZA_CASUALE = 10;
const MAX_NOME = 30;

// I link nati prima di questa forma (43 caratteri base64url) restano validi.
const FORMA_VECCHIA = /^[A-Za-z0-9_-]{43}$/;
const FORMA_NUOVA = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?[A-Za-z0-9]{10}$/;

export function formaValida(codice) {
  return typeof codice === 'string' && codice.length <= 60 && (FORMA_NUOVA.test(codice) || FORMA_VECCHIA.test(codice));
}

// «Corso BLSD – primavera 2026» → «corso-blsd-primavera-2026». Gli accenti
// diventano la lettera semplice, tutto il resto un trattino.
export function nomeNelLink(nome) {
  const s = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length <= MAX_NOME) return s;
  // Troppo lungo: si taglia a una parola intera, non a metà.
  const corto = s.slice(0, MAX_NOME + 1);
  const ultimo = corto.lastIndexOf('-');
  return (ultimo > 0 ? corto.slice(0, ultimo) : s.slice(0, MAX_NOME)).replace(/-+$/, '');
}

// Caratteri casuali senza sbilanciamenti: 256 non è multiplo di 62, quindi
// i byte da 248 in su si scartano invece di ripiegarli sulle prime lettere.
export function casuale(n = LUNGHEZZA_CASUALE) {
  let out = '';
  while (out.length < n) {
    for (const b of crypto.getRandomValues(new Uint8Array(n * 2))) {
      if (b < 248 && out.length < n) out += ALFABETO[b % 62];
    }
  }
  return out;
}

export function nuovoCodiceLink(nome) {
  const n = nomeNelLink(nome);
  return n ? `${n}-${casuale()}` : casuale();
}
