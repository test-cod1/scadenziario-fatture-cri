// Registro accessi: il dispositivo letto dallo user agent e la durata di una
// sessione. Sono le due cose che l'amministratore legge per capire se un
// accesso è suo o di qualcun altro.
import { gruppo, prova, uguale, RADICE } from './aiuto.mjs';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const { descriviDispositivo, durata } = await import(pathToFileURL(RADICE + '/js/lib/dispositivo.mjs').href);

gruppo('Registro accessi');

prova('i browser più comuni si riconoscono, anche quando si dichiarano altro', () => {
  uguale(descriviDispositivo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'), 'Chrome su Windows');
  uguale(descriviDispositivo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'), 'Edge su Windows');
  uguale(descriviDispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'), 'Safari su iPhone');
  uguale(descriviDispositivo('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'), 'Safari su Mac');
  uguale(descriviDispositivo('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36'), 'Samsung Internet su Android');
  uguale(descriviDispositivo('Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'), 'Firefox su Linux');
});

prova('uno user agent vuoto o ignoto non rompe la pagina', () => {
  uguale(descriviDispositivo(null), 'Dispositivo sconosciuto');
  uguale(descriviDispositivo(''), 'Dispositivo sconosciuto');
  uguale(descriviDispositivo('node'), 'Altro programma');
});

prova('la durata si legge in minuti, ore o giorni', () => {
  const t = (min) => new Date(Date.UTC(2026, 10, 27, 8, 0) + min * 60000).toISOString();
  uguale(durata(t(0), t(0)), 'meno di un minuto');
  uguale(durata(t(0), t(45)), '45 min');
  uguale(durata(t(0), t(120)), '2 h');
  uguale(durata(t(0), t(130)), '2 h 10 min');
  uguale(durata(t(0), t(60 * 30)), '1 giorno');
  uguale(durata(t(0), t(60 * 24 * 3 + 5)), '3 giorni');
});

prova('i trigger sulle sessioni non possono bloccare un login', () => {
  // Un errore in un trigger su auth.sessions farebbe fallire l'accesso di
  // tutti: la funzione deve inghiottire i propri errori.
  const sql = fs.readFileSync(RADICE + '/supabase/patch-2026-11-27-registro-accessi.sql', 'utf8');
  const corpo = sql.slice(sql.indexOf('function public.trg_accessi_sessioni'));
  uguale(/exception when others/.test(corpo.slice(0, corpo.indexOf('end; $$'))), true);
});
