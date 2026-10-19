// ============================================================
//  BOT TELEGRAM — cosa chiede un messaggio, e i testi delle risposte.
//  Il bot serve a una cosa sola: mandare un'idea alla sezione Direttore
//  scrivendola dal telefono. Qui solo funzioni pure (le prove in
//  test/telegram.prove.mjs le usano senza rete); il webhook che le usa sta
//  in functions/api/telegram.js.
// ============================================================

export const LUNGHEZZA_MASSIMA = 4000;

// Cosa vuole il messaggio. Ritorna null per quello che il bot ignora
// (gruppi, canali, foto, messaggi modificati…): un'idea arriva solo come
// testo, in una chat privata con il bot.
export function interpreta(update) {
  const m = update?.message;
  if (!m || m.chat?.type !== 'private' || typeof m.text !== 'string') return null;
  const chatId = m.chat.id;
  const nome = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ')
    || (m.from?.username ? '@' + m.from.username : '');
  const testo = m.text.trim();
  if (!testo) return null;
  // I comandi possono arrivare come /comando@NomeDelBot (dai menu di Telegram).
  const cmd = testo.match(/^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i);
  if (cmd) {
    const nomeCmd = cmd[1].toLowerCase();
    const arg = (cmd[2] || '').trim();
    // /start CODICE è quello che manda il link t.me/<bot>?start=CODICE.
    if ((nomeCmd === 'collega' || nomeCmd === 'start') && arg) return { tipo: 'collega', chatId, nome, codice: arg.toUpperCase().replace(/[^A-Z0-9]/g, '') };
    if (nomeCmd === 'scollega') return { tipo: 'scollega', chatId, nome };
    if (nomeCmd === 'idee') return { tipo: 'idee', chatId, nome };
    return { tipo: 'aiuto', chatId, nome };
  }
  return { tipo: 'idea', chatId, nome, testo: testo.slice(0, LUNGHEZZA_MASSIMA) };
}

export const TESTI = {
  aiuto: 'Ciao! Qui puoi mandare le idee alla sezione Direttore del portale Amministrazione CRI Genova: ogni messaggio che scrivi diventa un\'idea da valutare.\n\n'
    + 'Per cominciare, collega il tuo account: nel portale apri Direttore → Idee → «Collega Telegram» e segui il link, oppure scrivi qui /collega seguito dal codice.\n\n'
    + '/idee — le ultime idee\n/scollega — scollega questo Telegram',
  nonCollegato: 'Questo Telegram non è collegato al portale. Nel portale apri Direttore → Idee → «Collega Telegram», poi segui il link o scrivi qui /collega CODICE.',
  codiceNonValido: 'Codice non valido o scaduto (vale 15 minuti). Generane uno nuovo dal portale: Direttore → Idee → «Collega Telegram».',
  senzaAccesso: 'Il tuo account del portale non ha (più) accesso alla sezione Direttore: chiedi a un amministratore.',
  scollegato: 'Fatto: questo Telegram non è più collegato al portale.',
  ideaSalvata: '💡 Idea salvata. La trovi nel portale, in Direttore → Idee.',
  errore: 'Qualcosa non ha funzionato, riprova fra poco. Se continua, avvisa un amministratore del portale.',
};

export function testoCollegato(nomePortale) {
  return `✅ Collegato${nomePortale ? ' come ' + nomePortale : ''}. Da ora ogni messaggio che scrivi qui diventa un'idea nella sezione Direttore. /idee mostra le ultime.`;
}

const STATI = { nuova: 'nuova', in_valutazione: 'in valutazione', approvata: 'approvata', scartata: 'scartata', realizzata: 'realizzata' };
export function testoUltimeIdee(idee) {
  if (!idee.length) return 'Ancora nessuna idea. Scrivine una qui!';
  return 'Le ultime idee:\n\n' + idee.map(i => {
    const breve = i.testo.length > 140 ? i.testo.slice(0, 139) + '…' : i.testo;
    const data = String(i.created_at || '').slice(0, 10).split('-').reverse().join('/');
    return `• ${breve}\n  (${STATI[i.stato] || i.stato}, ${data}${i.autore_nome ? ', ' + i.autore_nome : ''})`;
  }).join('\n\n');
}

// Confronto a tempo costante del segreto del webhook.
export function stessoSegreto(a, b) {
  const x = new TextEncoder().encode(String(a || ''));
  const y = new TextEncoder().encode(String(b || ''));
  let diverso = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diverso |= (x[i] || 0) ^ (y[i] || 0);
  return diverso === 0 && x.length > 0;
}
