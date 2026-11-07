// ============================================================
//  TELEFONO — modulo pubblico delle patenti (patenti.html)
//  Si carica per primo, prima che la pagina venga disegnata, e decide se
//  usare la versione per telefono (classe «telefono» su <html>): testi
//  grandi, campi uno sotto l'altro.
//
//  Di solito basta la larghezza della finestra. Ma alcuni browser del
//  telefono (per esempio Opera o Chrome con «Sito desktop» attivo) disegnano
//  la pagina larga come su un computer e poi la rimpiccioliscono: tutto
//  diventa minuscolo. Si riconosce perché lo schermo è da telefono
//  (screen.width piccolo) mentre la pagina è molto più larga
//  (innerWidth). In quel caso si ingrandisce la pagina (zoom) quanto basta
//  perché torni larga come lo schermo, e si usa la versione per telefono.
//
//  È uno script classico (non un modulo) e senza dipendenze, perché deve
//  girare subito, dal <head>.
// ============================================================
(function () {
  var radice = document.documentElement;

  function decidi() {
    var schermo = window.screen && window.screen.width ? window.screen.width : window.innerWidth;
    var latoCorto = window.screen ? Math.min(window.screen.width, window.screen.height) : schermo;
    var finestra = window.innerWidth;
    // Telefono che mostra la pagina «da computer»: schermo piccolo, pagina
    // molto più larga dello schermo.
    var daComputerSuTelefono = latoCorto <= 600 && finestra > schermo * 1.3;
    radice.style.zoom = daComputerSuTelefono ? String(Math.round((finestra / schermo) * 100) / 100) : '';
    radice.classList.toggle('telefono', finestra <= 600 || daComputerSuTelefono);
  }

  decidi();
  window.addEventListener('resize', decidi);
  window.addEventListener('orientationchange', decidi);
  // Per le prove: ricalcola su richiesta.
  window.__patentiTelefono = decidi;
})();
