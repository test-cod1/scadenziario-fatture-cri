import { impostazioni } from '../data/store.js';
import { DEFAULT_IMPOSTAZIONI } from '../calc.js';
import { FUEL_PRICES, FUEL_DATA_DATE } from '../data/fuel-prices.js';
import { getAccessToken } from '../../lib/supabase.js';
import { el, clear, esc, toast, fmtNum, fmtDate } from '../lib/ui.js';
import { sorvegliaUscita, armaGuardiaIndietro } from '../../lib/uscita.js';

// Paesi UE coperti da /api/prezzo-eu (Weekly Oil Bulletin): gli altri restano
// modificabili solo a mano, non esiste una fonte gratuita equivalente.
const UE_ISO2 = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
  'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
]);

export async function renderImpostazioni(view, ctx) {
  // Niente clear(view): la pagina la svuota gia' il router del portale, che ci
  // lascia in cima la riga di ritorno alla home delle sezioni.
  const imp = structuredClone(ctx.imp);
  const prezzi = structuredClone(imp.prezziCustom || FUEL_PRICES);

  // Tutta la pagina dentro un contenitore suo, come nelle impostazioni delle
  // assistenze: serve alla sorveglianza dell'uscita qui sotto, che riconosce
  // l'editor ancora in pagina dal fatto che il SUO nodo è ancora attaccato al
  // documento (il contenitore del router non lo sarebbe mai).
  const pagina = el('<div></div>');
  view.appendChild(pagina);

  // Anche qui si lavora su una copia in memoria (structuredClone) fino al clic
  // su "Salva": senza sorveglianza, cambiare il parco mezzi, le tariffe o i
  // prezzi carburante e passare a un preventivo buttava via tutto in silenzio.
  // Un solo ascoltatore delegato copre campi, tendine e tabella dei prezzi.
  let sporco = false;
  const modificato = (e) => {
    // Il filtro "Paese" della tabella prezzi non è un dato da salvare: senza
    // questa eccezione, scriverci dentro faceva chiedere conferma all'uscita
    // di una pagina in cui non si era cambiato nulla.
    if (e?.target?.id === 'qfuel') return;
    sporco = true;
    armaGuardiaIndietro();
  };
  pagina.addEventListener('input', modificato);
  pagina.addEventListener('change', modificato);

  pagina.appendChild(el(`<div class="page-head">
    <div><h1>Impostazioni</h1><p>Parametri di calcolo, parco mezzi e prezzi carburante di riferimento</p></div>
    <button class="btn primary" id="save">💾 Salva impostazioni</button>
  </div>`));

  // ---------- Parco mezzi ----------
  const cMezzi = card('Parco mezzi e consumi', '<div id="mezzi"></div><button class="btn sm" id="add-mezzo" type="button">➕ Aggiungi mezzo</button>');
  pagina.appendChild(cMezzi);
  const mezziBox = cMezzi.querySelector('#mezzi');
  // Campi etichettati su .form-row.three invece di una griglia a colonne fisse
  // in pixel: su schermi stretti (telefono) si impila automaticamente con la
  // stessa regola responsive già usata nel resto del sito (styles.css).
  function drawMezzi() {
    clear(mezziBox);
    imp.mezzi.forEach((m, i) => {
      const r = el(`<div class="mezzo-row">
        <div class="form-row three">
          <div class="field"><label>Nome</label><input type="text" value="${esc(m.nome)}"></div>
          <div class="field"><label>Alimentazione</label><select>
            <option value="diesel" ${m.alimentazione==='diesel'?'selected':''}>Gasolio</option>
            <option value="benzina" ${m.alimentazione==='benzina'?'selected':''}>Benzina</option>
          </select></div>
          <div class="field"><label>Consumo (km/l)</label><input type="number" step="0.1" value="${m.consumo}"></div>
        </div>
        <button class="rm btn ghost sm" type="button">✕ Rimuovi mezzo</button>
      </div>`);
      const [nome, cons] = r.querySelectorAll('input');
      const alim = r.querySelector('select');
      nome.addEventListener('input', () => m.nome = nome.value);
      alim.addEventListener('change', () => m.alimentazione = alim.value);
      cons.addEventListener('input', () => m.consumo = Number(cons.value) || 0);
      r.querySelector('.rm').addEventListener('click', () => {
        if (imp.mezzi.length <= 1) { toast('Serve almeno un mezzo', 'err'); return; }
        imp.mezzi.splice(i, 1); drawMezzi();
      });
      mezziBox.appendChild(r);
    });
  }
  drawMezzi();
  cMezzi.querySelector('#add-mezzo').addEventListener('click', () => {
    imp.mezzi.push({ id: 'm' + Date.now(), nome: 'Nuovo mezzo', alimentazione: 'diesel', consumo: 10 }); drawMezzi();
  });

  // ---------- Parametri economici ----------
  const cPar = card('Parametri economici', `
    <div class="form-row three">
      <div class="field"><label>Costo a pasto (€)</label><input type="number" step="0.5" id="pastoCosto" value="${imp.pastoCosto}"></div>
      <div class="field"><label>Tariffa € / km (default)</label><input type="number" step="0.05" id="tariffaKm" value="${imp.tariffaKm}"></div>
      <div class="field"><label>&nbsp;</label><div class="hint">La tariffa resta modificabile in ogni singolo preventivo.</div></div>
    </div>
    <div class="form-row three">
      <div class="field"><label>Pedaggi estero (€/km)</label><input type="number" step="0.01" id="pedaggiEsteroKm" value="${imp.pedaggiEsteroKm}">
        <div class="hint">In Italia la CRI è esente: i pedaggi si applicano solo ai viaggi all'estero (attivo automaticamente in base alla destinazione).</div></div>
      <div class="field"><label>Medico: tariffa oraria (€/h)</label><input type="number" step="0.5" id="medicoTariffaOraria" value="${imp.medicoTariffaOraria}">
        <div class="hint">Default usato nel preventivo: totale = ore stimate × tariffa, sempre modificabile.</div></div>
      <div class="field"><label>Infermiere: tariffa oraria (€/h)</label><input type="number" step="0.5" id="infermiereTariffaOraria" value="${imp.infermiereTariffaOraria}">
        <div class="hint">Stesso principio del medico: totale = ore stimate × tariffa, sempre modificabile.</div></div>
    </div>`);
  pagina.appendChild(cPar);
  cPar.querySelector('#pastoCosto').addEventListener('input', e => imp.pastoCosto = Number(e.target.value) || 0);
  cPar.querySelector('#tariffaKm').addEventListener('input', e => imp.tariffaKm = Number(e.target.value) || 0);
  cPar.querySelector('#pedaggiEsteroKm').addEventListener('input', e => imp.pedaggiEsteroKm = Number(e.target.value) || 0);
  cPar.querySelector('#medicoTariffaOraria').addEventListener('input', e => imp.medicoTariffaOraria = Number(e.target.value) || 0);
  cPar.querySelector('#infermiereTariffaOraria').addEventListener('input', e => imp.infermiereTariffaOraria = Number(e.target.value) || 0);

  // ---------- Prezzi carburante ----------
  const cFuel = card(`Prezzi carburante di riferimento`, `
    <div class="banner info" style="margin:0 0 14px;flex-wrap:wrap"><div class="bi">⛽</div><div style="flex:1;min-width:200px">
      <b id="fuel-data-date">Medie nazionali · aggiornate al ${esc(fmtDate(imp.fuelDataDate || FUEL_DATA_DATE))}</b>
      <div class="small">Valori usati per precompilare il prezzo in base al Paese di destinazione UE. Modificali quando vuoi, o scarica il bollettino settimanale della Commissione Europea per aggiornarli tutti in blocco.</div>
    </div><button class="btn sm" id="update-eu" type="button" style="flex:none;align-self:center">🇪🇺 Aggiorna prezzi UE</button></div>
    <div class="toolbar"><div class="search"><span class="search-icon" aria-hidden="true">🔍</span><input type="text" id="qfuel" placeholder="Filtra Paese…"></div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Paese</th><th>Gasolio €/l</th><th>Benzina €/l</th></tr></thead><tbody id="fuel-body"></tbody></table></div>`);
  pagina.appendChild(cFuel);
  const fuelBody = cFuel.querySelector('#fuel-body');
  function drawFuel() {
    const q = cFuel.querySelector('#qfuel').value.toLowerCase().trim();
    clear(fuelBody);
    Object.entries(prezzi).sort((a,b) => a[1].nome.localeCompare(b[1].nome)).forEach(([iso, row]) => {
      if (q && !row.nome.toLowerCase().includes(q)) return;
      const tr = el(`<tr>
        <td class="fuel-country">${flag(iso)} ${esc(row.nome)} <span class="mini">${iso}</span></td>
        <td><input class="fuel-price" type="number" step="0.001" value="${row.diesel}"></td>
        <td><input class="fuel-price" type="number" step="0.001" value="${row.benzina}"></td>
      </tr>`);
      const [d, b] = tr.querySelectorAll('input');
      d.addEventListener('input', () => row.diesel = Number(d.value) || 0);
      b.addEventListener('input', () => row.benzina = Number(b.value) || 0);
      fuelBody.appendChild(tr);
    });
  }
  drawFuel();
  cFuel.querySelector('#qfuel').addEventListener('input', drawFuel);
  cFuel.querySelector('#update-eu').addEventListener('click', async () => {
    const btn = cFuel.querySelector('#update-eu'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Aggiorno…';
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/prezzo-eu', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
      let n = 0;
      for (const [iso, p] of Object.entries(data.prezzi || {})) {
        if (!prezzi[iso] || !UE_ISO2.has(iso)) continue;
        prezzi[iso].diesel = p.diesel;
        prezzi[iso].benzina = p.benzina;
        n++;
      }
      drawFuel();
      if (data.aggiornatoAl) {
        imp.fuelDataDate = data.aggiornatoAl;
        cFuel.querySelector('#fuel-data-date').textContent = `Medie nazionali · aggiornate al ${fmtDate(data.aggiornatoAl)}`;
      }
      // Salva subito i prezzi scaricati (senza toccare altre modifiche non
      // ancora confermate nel resto del form): altrimenti un refresh della
      // pagina prima del click su "Salva impostazioni" li fa perdere.
      const salvati = await impostazioni.get();
      salvati.prezziCustom = prezzi;
      salvati.fuelDataDate = imp.fuelDataDate;
      await impostazioni.save(salvati);
      await ctx.reloadImp();
      toast(`Prezzi UE aggiornati e salvati (${n} Paesi, dati del ${fmtDate(data.aggiornatoAl)})`, 'ok');
    } catch (e) {
      toast('Aggiornamento prezzi UE non riuscito: ' + (e.message || e), 'err');
    } finally { btn.disabled = false; btn.innerHTML = old; }
  });

  // ---------- salvataggio ----------
  pagina.querySelector('#save').addEventListener('click', async () => {
    const btn = pagina.querySelector('#save'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Salvo…';
    try {
      imp.prezziCustom = prezzi;
      await impostazioni.save(imp);
      await ctx.reloadImp();
      sporco = false;
      toast('Impostazioni salvate', 'ok');
    } catch (e) {
      toast('Errore: ' + (e.message || e), 'err'); console.error(e);
    } finally { btn.disabled = false; btn.innerHTML = old; }
  });

  sorvegliaUscita(pagina, () => sporco);

  function card(title, bodyHtml) {
    return el(`<div class="card" style="margin-bottom:18px"><div class="card-h">${esc(title)}</div><div class="card-b">${bodyHtml}</div></div>`);
  }
}

function flag(iso2) {
  if (!iso2 || iso2.length !== 2) return '🏳️';
  return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}
