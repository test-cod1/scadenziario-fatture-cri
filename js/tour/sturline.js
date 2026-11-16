// ============================================================
//  Passi del tour guidato della sezione PROGETTO STURLINE.
//  Il motore sta in js/lib/tour.js: qui c'è solo il copione.
// ============================================================

export function passi() {
  return [
    {
      hash: '#/sturline/panoramica',
      titolo: 'Tour guidato',
      testo: 'Il Progetto Sturline raccoglie le idee per il recupero delle due ville di Via Sturla: chi contattare e dove cercare i fondi, ordinati per argomento.',
    },
    {
      selettore: '.stl-cerca',
      titolo: 'Cercare in tutto il progetto',
      testo: 'Scrivi un nome o una parola (Gaslini, Art Bonus, Rotary…): la panoramica mostra tutte le voci che la contengono, in qualunque capitolo stiano.',
    },
    {
      selettore: '.stl-capitolo',
      titolo: 'Da dove partire',
      testo: 'I primi contatti: il Comitato Nazionale CRI e la Città Metropolitana, proprietaria delle ville. Senza di loro il progetto non si muove.',
    },
    {
      selettore: '.stl-mappa',
      titolo: 'Gli argomenti',
      testo: 'Fonti di sostegno, fondazioni, aziende, istituzioni, stampa e idee: ogni riquadro apre la sua pagina, che trovi anche nel menu della sezione.',
    },
    {
      hash: '#/sturline/sostegno',
      selettore: '.stl-indice',
      titolo: 'Dentro una pagina',
      testo: 'Quando una pagina mette insieme più capitoli, l\'indice in alto porta dritto a ciascuno. Anche qui c\'è la ricerca, limitata alla pagina.',
    },
    {
      selettore: '.tour-fab',
      titolo: 'Tour completato',
      testo: 'Puoi rivedere questo tour quando vuoi da questo pulsante.',
    },
  ];
}
