// ============================================================
//  DOMANDE E RISPOSTE SULLE PATENTI CRI
//  Le leggono i volontari nel modulo pubblico (patenti.html) e la
//  segreteria nella sezione Patenti del portale: un testo solo.
//
//  Fonti (ogni risposta dice la sua):
//   - Testo Unico CRI «Norme per la circolazione dei veicoli della Croce
//     Rossa Italiana», revisione 2 del 22/10/2026 (TU), parte II e
//     allegati B, B-1 e C;
//   - nota CRI prot. 2025/63182/CN/U dell'11/06/2025 (patenti digitali);
//   - nota CRI prot. 2025/63883/CN/U del 18/06/2025, che trasmette la
//     circolare del Ministero dell'Interno prot. 300/STRAD/1/0000017806.U/2025
//     del 10/06/2025.
//
//  Le risposte sono HTML scritto qui (non arriva mai da fuori): si possono
//  usare <b>, <ul>, <li>, <table>.
// ============================================================

export const FONTE_TU = 'Testo Unico CRI norme per la circolazione dei veicoli, rev. 2 del 22/10/2026';

export const FAQ = [
  {
    gruppo: 'Il modulo e la procedura',
    domande: [
      {
        d: 'A cosa serve questo modulo?',
        r: `Avvisa la segreteria del Comitato che vuoi ottenere o rinnovare una patente di servizio CRI, e ti guida nei passaggi.
          La pratica poi la istruisce il Comitato; la patente la rilascia il <b>Comitato Regionale</b> (o l'Ufficio Territoriale
          Motorizzazione, dove c'è). Il modulo non sostituisce la patente e non ti autorizza a guidare.`,
        fonte: 'TU art. 54 c. 7',
      },
      {
        d: 'Perché devo caricare i documenti su Gaia?',
        r: `Fototessera, patente civile e carta d'identità servono a chi istruisce la pratica per verificare i tuoi requisiti
          ed emettere la patente. Caricali su Gaia prima di inviare il modulo: la segreteria li trova lì, senza che tu debba
          mandarli altrove. Usa scansioni leggibili, fronte e retro.`,
        fonte: 'Procedura del Comitato',
      },
      {
        d: 'Che differenza c\'è tra conversione diretta, con prova pratica e con esame?',
        r: `<ul>
          <li><b>Conversione diretta</b> (patenti 1, 2 e 3): la patente CRI si ottiene dalla tua patente civile o militare, senza prove.</li>
          <li><b>Conversione con prova pratica</b> (patenti 4, 6, 7, 7b e 8): serve la patente civile corrispondente e
            un'esercitazione di guida con un Trainer CRI, che attesta la tua idoneità.</li>
          <li><b>Con esame</b> (patente 5): si ottiene solo con un corso di scuola guida CRI e un esame davanti a una commissione.</li>
        </ul>`,
        fonte: 'TU artt. 54 e 56',
      },
      {
        d: 'Chi non ha la patente civile può prendere la 6, la 7 o la 8?',
        r: `Sì, ma non per conversione: solo frequentando un corso di scuola guida presso un Centro di Formazione Motorizzazione
          CRI e superando l'esame. A questi corsi accedono per primi i volontari segnalati dai Centri di Emergenza o di
          Mobilitazione, i dipendenti e chi appartiene a Comitati che hanno quei veicoli.`,
        fonte: 'TU artt. 54 c. 4 e 55 c. 4',
      },
    ],
  },
  {
    gruppo: 'Quale patente chiedere',
    domande: [
      {
        d: 'Quali veicoli posso guidare con ogni patente?',
        r: `<table class="faq-tab"><tbody>
          <tr><td><b>1</b></td><td>Ciclomotori</td></tr>
          <tr><td><b>2</b></td><td>Motoveicoli da trasporto</td></tr>
          <tr><td><b>2b</b></td><td>Motoveicoli di soccorso in emergenza (moto medica)</td></tr>
          <tr><td><b>3</b></td><td>Autovetture e autocarri leggeri fino a 4,5 t e fino a 9 posti (rimorchio fino a 2 t, complesso fino a 6,5 t)</td></tr>
          <tr><td><b>4</b></td><td>Ambulanze da trasporto fino a 4,5 t, e ambulanze da soccorso non impiegate in emergenza-urgenza</td></tr>
          <tr><td><b>5</b></td><td>Veicoli di soccorso in emergenza-urgenza fino a 4,5 t: ambulanze di soccorso, automediche</td></tr>
          <tr><td><b>6</b></td><td>Autocarri medi e pesanti oltre 4,5 t</td></tr>
          <tr><td><b>7</b></td><td>Autobus: oltre 4,5 t e più di 20 posti</td></tr>
          <tr><td><b>7b</b></td><td>Minibus da 10 a 20 posti, fino a 4,5 t</td></tr>
          <tr><td><b>8</b></td><td>Complessi con rimorchio oltre 2 t, quando il complesso supera 6,5 t</td></tr>
        </tbody></table>`,
        fonte: 'TU art. 50 c. 3',
      },
      {
        d: 'Se prendo una patente, ottengo anche le altre?',
        r: `In parte sì. La 1 è compresa in tutte le altre; la <b>4</b> comprende la 3; la <b>5</b> e la <b>7b</b> comprendono la 3 e la 4.`,
        fonte: 'TU art. 53 e allegato C-1',
      },
      {
        d: 'Il modulo arriva alla patente 8: e la 2b e la 7b?',
        r: `La <b>2b</b> (moto medica) si chiede se hai già la 2, insieme alla 5 con un esame integrato, oppure dopo,
          con esercitazione ed esame pratico. La <b>7b</b> (minibus) si ottiene per conversione con prova pratica, come la 7.
          Se ti serve una di queste, scrivilo alla segreteria.`,
        fonte: 'TU art. 54 cc. 3 e 6',
      },
      {
        d: 'Per guidare l\'ambulanza in servizio basta la patente 4 o 5?',
        r: `No. Con la 2b, la 4 e la 5, per guidare in servizio operativo serve anche l'abilitazione al <b>trasporto sanitario (TS)</b>
          o equipollente, e la formazione pratica sul veicolo e sulle sue dotazioni curata dalla CRI, secondo la normativa
          sanitaria regionale.`,
        fonte: 'TU art. 50 c. 4',
      },
    ],
  },
  {
    gruppo: 'Requisiti',
    domande: [
      {
        d: 'Quale patente civile mi serve?',
        r: `<ul>
          <li><b>Patente 1</b>: AM (o militare equipollente).</li>
          <li><b>Patente 2</b>: A2 o A, senza sospensioni negli ultimi 3 anni.</li>
          <li><b>Patente 3</b>: B in corso di validità, senza sospensioni negli ultimi 5 anni.</li>
          <li><b>Patenti 6, 7, 7b e 8</b>: la categoria civile corrispondente — C1 o C per la 6, D per la 7, D1 per la 7b,
            C1E, CE o DE per la 8.</li>
        </ul>
        Valgono anche le patenti di altri Stati dell'Unione Europea, quelle di Stati con accordi di conversione e quelle
        rilasciate da Forze Armate e Corpi dello Stato.`,
        fonte: 'TU art. 51 e allegati C-1, C-2',
      },
      {
        d: 'Cosa mi serve per la 5, la 6 e la 7?',
        r: `<ul>
          <li><b>Patente 5</b>: avere già la <b>4</b> CRI (o un titolo equipollente) e nessuna sospensione o revoca negli ultimi 5 anni.</li>
          <li><b>Patente 6</b>: avere la 4 (o il titolo equipollente) da almeno <b>1 anno</b>.</li>
          <li><b>Patente 7</b>: avere la 4 (o il titolo equipollente) da almeno <b>2 anni</b>.</li>
        </ul>
        Nell'autocertificazione dei requisiti, per le patenti 6, 7 e 8 si dichiara di non aver <b>mai</b> avuto sospensioni o revoche.`,
        fonte: 'TU art. 51 cc. 4, 6, 7 e allegato C-3',
      },
      {
        d: 'Che età serve?',
        r: `<b>14 anni</b> per la 1, con il consenso scritto di un genitore; <b>18 anni</b> per la 2, la 3 e la 4; <b>21 anni</b> per
          la 2b, la 5, la 6, la 7, la 7b e la 8. Ogni patente ha anche un'età massima oltre la quale non si rinnova
          (per esempio 70 anni per la 7, 85 per la 1 e la 3).`,
        fonte: 'TU art. 51 c. 11 e allegato B-1',
      },
      {
        d: 'Ho una patente speciale: posso avere la patente CRI?',
        r: `Sì, ma solo le patenti <b>1, 2 e 3</b>, e potrai guidare solo veicoli già adattati alle tue limitazioni.
          Le patenti 2b, 4, 5, 6, 7, 7b e 8 non possono essere rilasciate a chi ha una patente speciale.`,
        fonte: 'TU art. 51 c. 12',
      },
      {
        d: 'Chi può avere la patente CRI?',
        r: `I volontari CRI e i lavoratori dei Comitati (nazionale, regionali e territoriali), delle strutture di diretta emanazione
          CRI e delle agenzie interinali. I volontari del Servizio Civile e a progetto possono avere le patenti 1, 3 e 4, solo per la
          durata e le attività del progetto.`,
        fonte: 'TU art. 51 cc. 8 e 9',
      },
    ],
  },
  {
    gruppo: 'Visita medica',
    domande: [
      {
        d: 'Devo fare una visita medica?',
        r: `Sì, sia per il rilascio sia per ogni rinnovo. La fa un <b>medico CRI</b> iscritto all'albo regionale, oppure la
          <b>Commissione Medica Locale</b> CRI (o ASL) quando ci sono patologie, dubbi sull'idoneità o si superano certe età.
          L'attività dei medici CRI è gratuita.`,
        fonte: 'TU art. 61 e allegato B',
      },
      {
        d: 'Cosa devo portare alla visita?',
        r: `<ul>
          <li>un documento di riconoscimento valido e il codice fiscale;</li>
          <li>una fototessera recente (non più vecchia di 6 mesi);</li>
          <li>se porti lenti: il certificato dell'ottico o dell'oculista con il grado delle lenti;</li>
          <li>se porti protesi acustiche: il certificato di efficienza del costruttore, non più vecchio di 3 mesi;</li>
          <li>il certificato anamnestico del tuo medico di base, oppure l'autocertificazione da firmare davanti al medico CRI;</li>
          <li>eventuali documenti sanitari su patologie che contano per la guida.</li>
        </ul>`,
        fonte: 'TU allegato B, punti 4 e 6',
      },
    ],
  },
  {
    gruppo: 'Prova pratica ed esame',
    domande: [
      {
        d: 'Come funziona l\'esercitazione di guida?',
        r: `Si guida con un <b>Trainer Istruttore di Guida</b> CRI (per la 2b, la 4 e la 5 con un Trainer specializzato in
          emergenza-urgenza); se non ce ne sono, con un conducente CRI che ha la stessa patente da almeno 5 anni, mai sospesa.
          Si guida su strada ordinaria e a scorrimento veloce e si fanno manovre, anche il parcheggio in salita.
          Valgono anche le guide fatte nei rientri o negli spostamenti di servizio (rifornimento, trasferimenti, officina).
          Alla fine il Trainer attesta che sei idoneo.`,
        fonte: 'TU art. 56',
      },
      {
        d: 'Dove si fa e quante guide servono?',
        r: `Per la <b>4</b> la organizza l'Ufficio Territoriale Motorizzazione, il Comitato Regionale o un Centro di Formazione
          Motorizzazione, anche presso il tuo Comitato. Per la <b>6, la 7 e la 8</b> si fa solo presso un Centro di Formazione
          Motorizzazione. Va comunicata al Comitato Regionale almeno 10 giorni prima. Il numero di guide dipende da come guidi:
          se dopo <b>20 esercitazioni</b> il Trainer non ti giudica idoneo, la pratica si chiude con esito negativo.`,
        fonte: 'TU art. 56 cc. 8–12',
      },
      {
        d: 'Cos\'è il foglio rosa?',
        r: `È l'autorizzazione a esercitarti alla guida dei veicoli CRI. La rilascia il Responsabile del Procedimento, vale
          <b>1 anno</b> e si rinnova una volta se non hai ancora fatto l'esame. Durante le guide devi averla con te, insieme a un
          documento che attesti la tua appartenenza alla CRI. Il veicolo deve avere i cartelli «SCUOLA GUIDA».`,
        fonte: 'TU artt. 56 c. 15 e 57',
      },
      {
        d: 'Come si ottiene la patente 5?',
        r: `Solo con un <b>corso di scuola guida</b> e un <b>esame</b>, attivati dal Comitato Regionale (o dall'Ufficio Territoriale
          Motorizzazione). Serve avere già la 4. Il corso lo tengono Trainer specializzati in emergenza-urgenza; l'esame si
          sostiene davanti a una commissione.`,
        fonte: 'TU artt. 51 c. 4, 54 cc. 5 e 9, 55',
      },
    ],
  },
  {
    gruppo: 'Validità e rinnovo',
    domande: [
      {
        d: 'Quanto dura la patente CRI?',
        r: `Dipende dal tipo e dalla tua età:
          <ul>
            <li><b>1, 2, 3 e 4</b>: 10 anni fino a 64 anni, 5 anni dai 65 ai 74, poi 1 anno.</li>
            <li><b>2b, 5, 6 e 8</b>: 5 anni fino a 64 anni, 2 anni dai 65 ai 68, poi 1 anno.</li>
            <li><b>7</b>: 5 anni fino a 59 anni, 2 anni dai 60 ai 63, poi 1 anno.</li>
            <li><b>7b</b>: 5 anni fino a 59 anni, 2 anni dai 60 ai 69, poi 1 anno.</li>
          </ul>
          Dal primo rinnovo la scadenza viene allineata al tuo compleanno. La scadenza esatta è scritta sulla patente.`,
        fonte: 'TU art. 53 e allegato B-1',
      },
      {
        d: 'Quando e come rinnovo la patente?',
        r: `Puoi rinnovarla da <b>60 giorni prima</b> della scadenza. Fai la visita medica e consegna il certificato al tuo
          Comitato entro la scadenza (o lo trasmette il medico sulla piattaforma CRI). Il rinnovo è la conferma di validità:
          la patente resta la stessa.`,
        fonte: 'TU artt. 60 e 61',
      },
      {
        d: 'Cosa succede se la lascio scadere?',
        r: `<ul>
          <li>Se non fai la visita entro <b>30 giorni</b> dalla scadenza, la patente è sospesa finché la visita non dà esito positivo.</li>
          <li>Se è scaduta da <b>più di 3 anni</b> (e meno di 5), prima del rinnovo devi superare un'esercitazione di guida.</li>
          <li>Se è scaduta da <b>più di 5 anni</b>, devi sottoporti a revisione.</li>
        </ul>
        Con la patente scaduta non puoi guidare veicoli CRI.`,
        fonte: 'TU artt. 53 cc. 8–9 e 75',
      },
      {
        d: 'La patente CRI dipende da quella civile?',
        r: `Una volta rilasciata è <b>autonoma</b>: ha scadenza e rinnovo propri, anche se l'hai ottenuta per conversione.
          Però, se la patente civile viene sospesa, la CRI può sospendere in via precauzionale anche quella di servizio,
          per lo stesso periodo.`,
        fonte: 'TU artt. 60 c. 4 e 76 c. 2',
      },
      {
        d: 'Ho una patente CRI del vecchio modello: vale ancora?',
        r: `Sì. Le vecchie categorie corrispondono a quelle nuove secondo le tabelle di equipollenza, e la riclassificazione
          avviene al primo rinnovo, avanzamento o revisione. Chi ha la 4 conseguita prima del 31/07/2021 senza la limitazione
          «escluso minibus» ottiene anche la 7b.`,
        fonte: 'TU art. 114 e allegato C-1',
      },
    ],
  },
  {
    gruppo: 'Patente digitale',
    domande: [
      {
        d: 'Riceverò la patente su carta o in digitale?',
        r: `In <b>digitale</b>, con un QR code e un sigillo elettronico che ne garantiscono autenticità e integrità. Le nuove
          patenti, i rinnovi e i duplicati si rilasciano così, e il formato cartaceo non viene più prodotto. Fa eccezione chi
          deve guidare all'estero o in contesti transfrontalieri, che riceve anche la versione cartacea.`,
        fonte: 'Nota CRI prot. 2025/63182 dell\'11/06/2025; TU art. 50 c. 1',
      },
      {
        d: 'La mia patente CRI di carta è ancora valida?',
        r: `Sì, fino alla scadenza scritta sul documento. Viene sostituita da quella digitale solo quando chiedi un duplicato
          (smarrimento, furto, deterioramento) o un aggiornamento dei dati.`,
        fonte: 'Nota CRI prot. 2025/63883 del 18/06/2025',
      },
      {
        d: 'Come la mostro a un controllo su strada?',
        r: `Basta mostrarla sul telefono, oppure stamparla su carta semplice: il documento deve essere completo e il
          <b>QR code ben leggibile</b>, perché è leggendolo che le Forze di Polizia ne verificano la validità. Il Ministero
          dell'Interno ne ha informato Prefetture e Forze di Polizia con la circolare prot. 300/STRAD/1/0000017806.U/2025 del
          10/06/2025: conviene averne una copia a bordo, su carta o sul telefono.`,
        fonte: 'Nota CRI prot. 2025/63883 del 18/06/2025',
      },
      {
        d: 'Posso guidare mentre aspetto la patente?',
        r: `Solo se il Responsabile del Procedimento ti rilascia un'<b>autorizzazione provvisoria</b>: vale al massimo 90 giorni,
          per i tipi di veicolo indicati, finché la patente non viene emessa. Senza, non si guida.`,
        fonte: 'TU art. 50 c. 2 e allegato C-4',
      },
    ],
  },
  {
    gruppo: 'Problemi e casi particolari',
    domande: [
      {
        d: 'Ho perso la patente o me l\'hanno rubata: cosa faccio?',
        r: `Fai denuncia alle autorità di polizia <b>entro 48 ore</b> da quando te ne accorgi e chiedi il duplicato al Comitato,
          allegando la copia della denuncia. Il duplicato ha un nuovo numero ma la stessa scadenza, ed è in formato digitale.`,
        fonte: 'TU art. 63',
      },
      {
        d: 'Per cosa può essere sospesa la patente CRI?',
        r: `Per esempio, per <b>20 giorni</b> (40 se ricapita entro due anni) se usi il cellulare alla guida fuori dai casi
          ammessi, non usi le cinture o accendi sirena e lampeggianti fuori dai servizi urgenti. Può essere sospesa anche per le
          violazioni del Codice della Strada che sospendono la patente civile, per incidenti con lesioni causati da negligenza
          e se non ti presenti alla visita di rinnovo.`,
        fonte: 'TU artt. 73–76',
      },
      {
        d: 'Cosa succede alla patente se lascio la CRI?',
        r: `Viene revocata. Se rientri in servizio puoi riaverla: se dalla revoca sono passati meno di 5 anni valgono le
          regole della patente scaduta, quindi oltre i 3 anni ti serve un'esercitazione di guida.`,
        fonte: 'TU art. 77 c. 7',
      },
      {
        d: 'Posso convertire la patente CRI in patente civile?',
        r: `Sì, se hai fatto almeno <b>3 anni consecutivi</b> di servizio attivo, hai la patente CRI da almeno 1 anno, hai guidato i
          veicoli di quella categoria per almeno <b>100 ore o 5.000 km</b> e la patente non è mai stata sospesa o revocata. Il
          certificato lo rilascia l'U.O. Motorizzazione del Comitato Nazionale; puoi chiederlo durante il servizio o entro un anno
          dalla fine. Le spese della conversione sono a tuo carico.`,
        fonte: 'TU art. 82',
      },
    ],
  },
];

// Tutte le domande in fila, con il loro gruppo: comodo per cercare.
export function tutteLeDomande() {
  return FAQ.flatMap(g => g.domande.map(q => ({ ...q, gruppo: g.gruppo })));
}

const senzaTag = (html) => html.replace(/<[^>]+>/g, ' ');

// Testo su cui cercare, minuscolo e senza accenti: «eta» trova «età».
export function testoCercabile(q) {
  return `${q.d} ${senzaTag(q.r)} ${q.gruppo || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// L'HTML delle domande, raggruppate e richiudibili. `esc` è quello della
// pagina che le mostra.
export function htmlFaq(esc) {
  return FAQ.map(g => `<section class="faq-gruppo" data-gruppo>
    <h3>${esc(g.gruppo)}</h3>
    ${g.domande.map(q => `<details class="faq-voce" data-testo="${esc(testoCercabile({ ...q, gruppo: g.gruppo }))}">
      <summary>${esc(q.d)}</summary>
      <div class="faq-risposta">${q.r}<div class="faq-fonte">Fonte: ${esc(q.fonte)}</div></div>
    </details>`).join('')}
  </section>`).join('');
}

// Filtro della ricerca: nasconde le domande che non c'entrano e i gruppi
// rimasti vuoti; con una ricerca attiva apre quelle trovate.
export function filtraFaq(contenitore, testo) {
  const q = String(testo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  let trovate = 0;
  contenitore.querySelectorAll('.faq-gruppo').forEach(g => {
    let nelGruppo = 0;
    g.querySelectorAll('.faq-voce').forEach(v => {
      const ok = !q || v.dataset.testo.includes(q);
      v.hidden = !ok;
      if (q) v.open = ok;
      if (ok) nelGruppo++;
    });
    g.hidden = !nelGruppo;
    trovate += nelGruppo;
  });
  return trovate;
}
