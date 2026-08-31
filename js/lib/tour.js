// Tour guidato manuale: si avvia solo cliccando il pulsante flottante (mai in
// automatico) e mostra le funzioni principali navigando davvero fra le pagine
// dell'app, evidenziando ogni volta l'elemento di cui si sta parlando.
import { el } from './ui.js';

function isAdmin(ctx) { return ctx.user?.ruolo === 'admin'; }

function costruisciPassi(ctx) {
  const admin = isAdmin(ctx);
  const passi = [
    {
      hash: '#/passive/fatture',
      titolo: 'Tour guidato',
      testo: 'Un breve giro tra le funzioni principali dello Scadenziario Fatture. Usa «Avanti» per proseguire, oppure «Salta tour» in qualsiasi momento.',
    },
    {
      selettore: '.section-switch',
      titolo: 'Due sezioni indipendenti',
      testo: 'Il gestionale è diviso in due parti separate: le fatture da pagare ai fornitori ("Fatture Passive") e le fatture emesse ai clienti ("Fatture Attive"). Si passa dall\'una all\'altra con questi due pulsanti.',
    },
    {
      selettore: '.nav a[data-nav="fatture"]',
      titolo: 'Elenco fatture',
      testo: 'Questa è la vista principale della sezione: l\'elenco di tutte le fatture fornitori ancora aperte.',
    },
    {
      selettore: '#stats',
      titolo: 'Situazione a colpo d\'occhio',
      testo: 'Quanto resta da pagare in totale, cosa è già scaduto, cosa scade nei prossimi 7 giorni e quanto è stato pagato questo mese e quest\'anno. Le prime tre card sono cliccabili: filtrano subito la tabella su quelle fatture.',
    },
    {
      selettore: '.page-head .actions',
      titolo: 'Aggiungere ed esportare',
      testo: 'Da qui inserisci una fattura a mano, la carichi da un file PDF o XML (i dati vengono letti automaticamente), registri una nota di credito oppure esporti l\'elenco filtrato in Excel o PDF.',
    },
    {
      selettore: '.toolbar',
      titolo: 'Cerca e filtra',
      testo: 'Cerca per fornitore, numero fattura o note, oppure filtra per stato, intervallo di scadenza e importo.',
    },
    {
      selettore: '#tbl-zone',
      titolo: 'La tabella',
      testo: admin
        ? 'Clicca su una riga per aprire e modificare la fattura, oppure sul suo stato per registrare subito un pagamento.'
        : 'Clicca su una riga per aprire la fattura, oppure sul suo stato per proporre un pagamento: lo confermerà un amministratore.',
    },
    {
      selettore: '#archivio',
      titolo: 'Archivio',
      testo: 'Le fatture ormai chiuse (pagate o stornate) degli anni precedenti non restano nell\'elenco principale: si trovano qui, aprendo questo pannello.',
    },
    {
      hash: '#/passive/proposte',
      selettore: '.nav a[data-nav="proposte"]',
      titolo: 'Proposte di pagamento',
      testo: admin
        ? 'Le proposte di pagamento inviate dagli operatori arrivano qui: confermale quando esegui davvero il pagamento, o rifiutale.'
        : 'Qui trovi le proposte di pagamento che hai inviato e il loro stato: in attesa, confermata o rifiutata.',
    },
    {
      hash: '#/passive/report',
      selettore: '.nav a[data-nav="report"]',
      titolo: 'Report fornitori',
      testo: 'Un riepilogo della spesa per fornitore nel tempo, con un grafico mensile e il totale del periodo scelto.',
    },
    {
      hash: '#/attive/fatture',
      selettore: '.section-switch button[data-sezione="attive"]',
      titolo: 'Fatture Attive',
      testo: 'Sei passato alla sezione Fatture Attive: stessa logica di prima, ma per le fatture che emetti ai clienti invece di quelle dei fornitori.',
    },
    {
      selettore: '#stats',
      titolo: 'Da incassare',
      testo: 'Qui vedi quanto c\'è ancora da incassare in totale e quanto hai già incassato questo mese e quest\'anno. Le card "Da incassare" e "Incassato questo mese" sono cliccabili: filtrano subito la tabella su quelle fatture.',
    },
    {
      hash: '#/attive/report',
      selettore: '.nav a[data-nav="report"]',
      titolo: 'Report clienti',
      testo: 'Anche qui trovi un Report con l\'andamento degli incassi per cliente nel tempo.',
    },
  ];
  if (admin) {
    passi.push({
      hash: '#/passive/impostazioni',
      selettore: '.page-head h1',
      titolo: 'Impostazioni',
      testo: 'Visibile solo agli amministratori: da qui gestisci gli utenti abilitati, la scadenza di default per le fatture senza data e il registro di tutte le modifiche.',
    });
  }
  passi.push({
    hash: '#/passive/fatture',
    selettore: '.tour-fab',
    titolo: 'Tour completato',
    testo: 'Puoi rivedere questo tour quando vuoi cliccando su questo pulsante.',
  });
  return passi;
}

function elementoVisibile(elx) {
  return !!elx && !!(elx.offsetWidth || elx.offsetHeight || elx.getClientRects().length);
}

// L'app carica i dati da Supabase in modo asincrono dopo un cambio di hash
// (spinner intermedio): si interroga il DOM a intervalli finché l'elemento
// non compare invece di affidarsi a un singolo controllo subito dopo la
// navigazione, che lo troverebbe quasi sempre assente.
function attendiElemento(selettore, timeoutMs = 6000) {
  return new Promise(resolve => {
    const scadenza = Date.now() + timeoutMs;
    (function tenta() {
      const trovato = document.querySelector(selettore);
      if (elementoVisibile(trovato)) return resolve(trovato);
      if (Date.now() > scadenza) return resolve(null);
      setTimeout(tenta, 80);
    })();
  });
}

function elementiFocalizzabili(node) {
  return [...node.querySelectorAll('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')]
    .filter(e => e.offsetParent !== null);
}

let tourAttivo = false;

// Un solo tour alla volta: se il pulsante viene ricliccato mentre è già
// aperto (es. doppio clic accidentale) si ignora, invece di sovrapporre due
// istanze con i propri listener e finire per non poterle chiudere entrambe.
export function startTour(ctx) {
  if (tourAttivo) return;
  tourAttivo = true;

  const passi = costruisciPassi(ctx);
  const elementoAttivoPrima = document.activeElement;
  let idx = -1;
  let target = null;

  const scrim = el('<div class="tour-scrim"></div>');
  const ring = el('<div class="tour-ring"></div>');
  const tip = el(`<div class="tour-tip" role="dialog" aria-label="Tour guidato" tabindex="-1">
    <div class="tt-h"><div><b class="tt-title"></b><div class="tt-step"></div></div><button class="tt-x" type="button" aria-label="Chiudi tour">✕</button></div>
    <div class="tt-b"></div>
    <div class="tt-f">
      <button class="btn ghost sm tt-salta" type="button">Salta tour</button>
      <div style="display:flex;gap:8px">
        <button class="btn sm tt-indietro" type="button">‹ Indietro</button>
        <button class="btn primary sm tt-avanti" type="button">Avanti ›</button>
      </div>
    </div>
  </div>`);
  document.body.append(scrim, ring, tip);

  function chiudi() {
    if (!tourAttivo) return;
    tourAttivo = false;
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('resize', riposiziona);
    window.removeEventListener('scroll', riposiziona, true);
    scrim.remove(); ring.remove(); tip.remove();
    if (elementoAttivoPrima && document.contains(elementoAttivoPrima)) elementoAttivoPrima.focus();
  }

  function posizionaRing(rect) {
    if (!rect) { ring.style.display = 'none'; return; }
    const pad = 8;
    ring.style.display = 'block';
    ring.style.top = (rect.top - pad) + 'px';
    ring.style.left = (rect.left - pad) + 'px';
    ring.style.width = (rect.width + pad * 2) + 'px';
    ring.style.height = (rect.height + pad * 2) + 'px';
  }

  function posizionaTip(rect) {
    const margin = 14;
    tip.style.visibility = 'hidden';
    tip.style.top = '0px'; tip.style.left = '0px';
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let top, left;
    if (!rect) {
      top = (window.innerHeight - th) / 2;
      left = (window.innerWidth - tw) / 2;
    } else {
      const spazioSotto = window.innerHeight - rect.bottom;
      const spazioSopra = rect.top;
      top = (spazioSotto >= th + margin || spazioSotto >= spazioSopra)
        ? rect.bottom + margin
        : rect.top - th - margin;
      left = rect.left + rect.width / 2 - tw / 2;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - th - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
    tip.style.visibility = 'visible';
  }

  function riposiziona() {
    const rect = (target && target.isConnected) ? target.getBoundingClientRect() : null;
    posizionaRing(rect);
    posizionaTip(rect);
  }

  async function goToStep(i) {
    if (i < 0) return;
    if (i >= passi.length) return chiudi();
    idx = i;
    const passo = passi[i];
    if (passo.hash && location.hash !== passo.hash) {
      location.hash = passo.hash;
      await new Promise(r => setTimeout(r, 30));
    }
    target = null;
    if (passo.selettore) {
      target = await attendiElemento(passo.selettore);
      if (!tourAttivo) return; // chiuso mentre si attendeva l'elemento
      if (!target) return goToStep(i + 1); // pagina/ruolo senza quell'elemento: salta al passo dopo
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
      await new Promise(r => setTimeout(r, 200)); // lascia assestare lo scroll prima di misurare
      if (!tourAttivo) return;
    }
    disegna(passo);
  }

  function disegna(passo) {
    tip.querySelector('.tt-title').textContent = passo.titolo;
    tip.querySelector('.tt-step').textContent = `Passo ${idx + 1} di ${passi.length}`;
    tip.querySelector('.tt-b').textContent = passo.testo;
    tip.querySelector('.tt-indietro').style.visibility = idx === 0 ? 'hidden' : 'visible';
    tip.querySelector('.tt-avanti').textContent = idx === passi.length - 1 ? 'Fine ✓' : 'Avanti ›';
    riposiziona();
    tip.querySelector('.tt-avanti').focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); chiudi(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); goToStep(idx + 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goToStep(idx - 1); return; }
    if (e.key !== 'Tab') return;
    const focalizzabili = elementiFocalizzabili(tip);
    if (!focalizzabili.length) return;
    const primo = focalizzabili[0], ultimo = focalizzabili[focalizzabili.length - 1];
    if (!tip.contains(document.activeElement)) { e.preventDefault(); primo.focus(); return; }
    if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
  }

  tip.querySelector('.tt-x').addEventListener('click', chiudi);
  tip.querySelector('.tt-salta').addEventListener('click', chiudi);
  tip.querySelector('.tt-indietro').addEventListener('click', () => goToStep(idx - 1));
  tip.querySelector('.tt-avanti').addEventListener('click', () => { if (idx === passi.length - 1) chiudi(); else goToStep(idx + 1); });
  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('resize', riposiziona);
  window.addEventListener('scroll', riposiziona, true);

  goToStep(0);
}
