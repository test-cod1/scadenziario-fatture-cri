// ============================================================
//  PROGETTO STURLINE — i contenuti.
//  Le idee raccolte per il recupero delle due ville di Via Sturla
//  (proprietà della Città Metropolitana di Genova), trascritte dal
//  documento «Elenco» e ordinate per argomento.
//
//  Ogni voce è [nome, descrizione] oppure [nome, descrizione, [sottovoci]],
//  dove le sottovoci hanno la stessa forma. Le pagine della sezione
//  raggruppano i capitoli: per cambiare un contenuto basta questo file.
// ============================================================

export const CAPITOLI = [
  {
    id: 'contatti',
    titolo: 'Primi contatti',
    nota: 'Da cui partire: senza di loro il progetto non si muove.',
    gruppi: [
      { titolo: null, voci: [
        ['Croce Rossa Italiana – Comitato Nazionale', 'sede a Roma; primo interlocutore interno per sostegno e finanziamento del progetto'],
        ['Città Metropolitana di Genova', 'proprietaria delle due ville in Via Sturla; da coinvolgere per autorizzazioni, eventuale cofinanziamento e accordi sull\'uso dei beni'],
      ] },
    ],
  },
  {
    id: 'fonti',
    titolo: 'Altre possibili fonti di sostegno',
    gruppi: [
      { titolo: 'Strumenti fiscali', voci: [
        ['Art Bonus', 'credito d\'imposta del 65% per chi dona per manutenzione, protezione e restauro di beni culturali pubblici; applicabile anche se il bene è affidato a un concessionario (es. CRI) con contratto stipulato con l\'ente proprietario'],
        ['8×1000 a gestione statale', 'categoria «conservazione di beni culturali» per immobili di proprietà degli enti locali territoriali; la domanda andrebbe presentata dalla Città Metropolitana'],
        ['Requisito comune', 'le ville sono vincolate, quindi il requisito di bene culturale dovrebbe essere soddisfatto; chiedere alla Città Metropolitana copia del provvedimento di vincolo e del contratto di affidamento alla CRI, e confermare con il consulente fiscale'],
        ['Conto Termico 3.0 (GSE)', 'incentivo per efficienza energetica e rinnovabili (isolamento, impianti, pompe di calore, solare termico); accessibile alla Città Metropolitana e alla CRI se iscritta al RUNTS come ente del Terzo Settore; da verificare quali interventi sono compatibili con il vincolo'],
      ] },
      { titolo: 'Enti pubblici', voci: [
        ['Regione Liguria', 'bandi su fondi europei (FESR) o regionali per recupero ed efficientamento energetico degli edifici'],
        ['Comune di Genova e Municipio IX Levante', 'patrocinio, visibilità ed eventuali contributi'],
        ['Autorità di Sistema Portuale', 'ente fortemente radicato sul territorio genovese'],
      ] },
      { titolo: 'Aziende e categorie', voci: [
        ['Confindustria Genova e Camera di Commercio', 'un solo contatto per raggiungere molte aziende'],
        ['Grande distribuzione', 'ad esempio Coop Liguria, con raccolte nei punti vendita'],
      ] },
      { titolo: 'Comunità', voci: [
        ['Club service', 'Rotary, Lions e Kiwanis di Genova, che finanziano spesso progetti locali concreti; tramite i club si possono chiedere anche i Global Grants della Rotary Foundation e i contributi della Lions Clubs International Foundation (LCIF)'],
        ['Crowdfunding', 'su piattaforme come Rete del Dono, con un obiettivo simbolico (una stanza, un intervento)'],
        ['Eventi di raccolta', 'con società sportive, teatri o l\'Acquario'],
        ['5×1000', 'al comitato CRI, comunicando lo scopo preciso della ristrutturazione'],
      ] },
      { titolo: 'Concorsi', voci: [
        ['FAI – I Luoghi del Cuore (con Intesa Sanpaolo)', 'censimento aperto fino al 15 dicembre 2026 su www.iluoghidelcuore.it; 600.000 euro in palio, premi da 70.000, 60.000 e 50.000 euro ai primi tre e bando per i luoghi con almeno 3.000 voti; mobilitare volontari CRI, famiglie e personale del Gaslini'],
      ] },
      { titolo: 'Rete Gaslini e infanzia', voci: [
        ['Associazioni dei genitori e di volontariato del Gaslini', 'possibili partner e cofinanziatori'],
        ['Fondazione per l\'Infanzia Ronald McDonald', 'gestisce case di accoglienza per famiglie vicino agli ospedali pediatrici; possibili partner o modello'],
      ] },
      { titolo: 'Formule di raccolta', voci: [
        ['Adotta una stanza', 'ogni stanza o intervento ha un costo preciso e una targa con il nome di chi lo finanzia'],
        ['Teli pubblicitari sui ponteggi', 'spazi per sponsor durante il cantiere, con autorizzazione della Soprintendenza'],
        ['Payroll giving e matching gift', 'i dipendenti delle grandi aziende donano una parte dello stipendio e l\'azienda raddoppia'],
        ['Genoa e Sampdoria', 'partite di beneficenza o aste di maglie autografate'],
      ] },
    ],
  },
  {
    id: 'non-denaro',
    titolo: 'Sostegni non in denaro',
    gruppi: [
      { titolo: 'Progettazione e competenze tecniche', voci: [
        ['Università di Genova – Dipartimento Architettura e Design (dAD)', 'rilievi, progetto di restauro e riuso, tesi di laurea e workshop con gli studenti sulle ville'],
        ['Università di Genova – Dipartimento di Ingegneria civile (DICCA)', 'verifiche strutturali, analisi sismica ed efficienza energetica'],
        ['Ordini degli Architetti e degli Ingegneri', 'progettazione e direzione lavori gratuite o a costo ridotto'],
        ['Collegio dei Geometri di Genova', 'rilievi, pratiche catastali e urbanistiche'],
        ['Accademia Ligure di Belle Arti', 'decorazioni, murales e progetti artistici per gli spazi'],
      ] },
      { titolo: 'Lavori, materiali e forniture', voci: [
        ['ANCE Genova', 'associazione dei costruttori edili; un solo contatto per presentare il progetto alle imprese associate e chiedere lavori donati o a prezzo di costo'],
        ['Gambino Emilio Costruzioni', 'Genova, attiva dal 1953; abilitata al restauro di beni tutelati, ha già lavorato per il Comune di Genova su edifici storici'],
        ['Impresa Cresta Geom. Stefano', 'Genova; restauro di facciate ed edifici monumentali, tra i clienti anche Fondazione Carige e Comune di Genova'],
        ['Impresa Di Martino', 'Genova; restauri monumentali in molti palazzi storici della città'],
        ['Ferreri Costruzioni', 'Genova; restauri conservativi a Palazzo della Meridiana e Palazzo Spinola in via Garibaldi'],
        ['Assorestauro', 'associazione delle imprese di restauro; contatti con aziende specializzate per lavori a costo ridotto'],
        ['ARI – Associazione Restauratori d\'Italia', 'restauratori professionisti; possibili cantieri didattici o interventi pro bono su decorazioni e superfici'],
        ['Mapei', 'Milano; prodotti per consolidamento, intonaci e impermeabilizzazione'],
        ['Kerakoll', 'Sassuolo (MO); malte e intonaci naturali adatti agli edifici storici'],
        ['Fassa Bortolo', 'Spresiano (TV); intonaci, malte e sistemi di isolamento'],
        ['Saint-Gobain Italia', 'Milano; isolanti, cartongesso e vetri'],
        ['Istituti tecnici CAT', 'ad esempio IIS Firpo-Buonarroti e Gastaldi-Abba, scuole della Città Metropolitana; percorsi PCTO e piccoli interventi supervisionati'],
        ['Scuola edile di Genova', 'ente di formazione del settore edile; possibile cantiere scuola'],
        ['Catene di arredamento e bricolage presenti a Genova', 'ad esempio IKEA; donazione di mobili, elettrodomestici e materiali per l\'allestimento'],
      ] },
    ],
  },
  {
    id: 'immobiliare',
    titolo: 'Immobiliare e architettura',
    gruppi: [
      { titolo: 'Architettura e patrimonio storico', voci: [
        ['Fondazione Renzo Piano', 'sede a Genova; possibile interesse per un progetto cittadino dedicato ai bambini, anche come consulenza o patrocinio'],
        ['ADSI – Associazione Dimore Storiche Italiane (sezione Liguria)', 'rete di proprietari di ville storiche, con esperienza pratica sul restauro di immobili vincolati'],
        ['Italia Nostra – sezione di Genova', 'tutela del patrimonio, visibilità e dialogo con gli enti'],
        ['In/Arch Liguria (Istituto Nazionale di Architettura)', 'rete di architetti e costruttori, utile per eventi e progetti'],
        ['Fondazione dell\'Ordine degli Architetti di Genova', 'concorsi di idee, formazione ed eventi sul caso delle ville'],
      ] },
      { titolo: 'Settore immobiliare', voci: [
        ['Confedilizia Genova, FIAIP e FIMAA', 'associazioni di proprietari e agenti immobiliari; possibili raccolte tra gli iscritti'],
        ['Fondazione Tecnocasa', 'fondazione di un gruppo immobiliare, attiva nel sociale'],
        ['Confindustria Assoimmobiliare', 'per raggiungere fondi immobiliari e grandi operatori del settore'],
      ] },
      { titolo: 'Internazionali', voci: [
        ['ULI – Urban Land Institute (ULI Italy)', 'rete internazionale di operatori immobiliari e urbanisti; non finanzia direttamente, ma può aprire contatti con investitori e sviluppatori'],
      ] },
    ],
  },
  {
    id: 'fondazioni-liguria',
    titolo: 'Fondazioni attive a Genova e in Liguria',
    gruppi: [
      { titolo: 'Fondazioni di origine bancaria', voci: [
        ['Fondazione Carige', 'Genova; sostiene progetti sociali, culturali e di ricerca in tutta la Liguria'],
        ['Fondazione Compagnia di San Paolo', 'sede a Torino, ma con un forte impegno su Genova e la Liguria'],
        ['Fondazione Agostino De Mari', 'Savona (ex Cassa di Risparmio di Savona)'],
        ['Fondazione Carispezia', 'La Spezia (ex Cassa di Risparmio della Spezia)'],
      ] },
      { titolo: 'Cultura', voci: [
        ['Fondazione Palazzo Ducale per la Cultura', 'Genova; mostre, incontri ed eventi culturali'],
        ['Fondazione Teatro Carlo Felice', 'Genova; teatro lirico e stagione sinfonica'],
        ['Fondazione Luzzati – Teatro della Tosse', 'Genova; teatro e arti visive'],
        ['Fondazione Ansaldo', 'Genova; archivi d\'impresa e patrimonio industriale'],
        ['Fondazione Genova Liguria Film Commission', 'Genova; supporto alle produzioni audiovisive'],
      ] },
      { titolo: 'Ricerca, salute e ambiente', voci: [
        ['Fondazione Istituto Italiano di Tecnologia (IIT)', 'Genova; ricerca scientifica e tecnologica'],
        ['Fondazione Gerolamo Gaslini', 'Genova; sostiene l\'Istituto pediatrico Giannina Gaslini'],
        ['Fondazione CIMA', 'Savona; ricerca su rischi naturali e protezione civile'],
        ['Fondazione Edoardo Garrone', 'Genova; formazione, giovani e sviluppo delle aree interne'],
      ] },
      { titolo: 'Sociale', voci: [
        ['Fondazione Auxilium', 'Genova; servizi della Caritas diocesana per persone in difficoltà'],
        ['Fondazione San Marcellino', 'Genova; accoglienza delle persone senza dimora'],
        ['Fondazione Antiusura Santa Maria del Soccorso', 'Genova; prevenzione dell\'usura e del sovraindebitamento'],
        ['Costa Crociere Foundation', 'Genova; fondazione di Costa Crociere, sostiene progetti sociali e per l\'infanzia nelle città di porto'],
      ] },
    ],
  },
  {
    id: 'fondazioni-italia',
    titolo: 'Fondazioni italiane e internazionali',
    gruppi: [
      { titolo: 'Infanzia e ospedali pediatrici', voci: [
        ['Fondazione Mission Bambini', 'Milano; finanzia progetti per bambini in difficoltà, anche in ambito sanitario'],
        ['Enel Cuore', 'onlus del gruppo Enel; ha sostenuto in passato strutture sociali e di accoglienza'],
        ['Fondazione Allianz UMANA MENTE', 'Milano; sostiene progetti per minori e persone fragili'],
        ['The Human Safety Net (Generali)', 'programmi per famiglie con bambini piccoli in condizioni di fragilità'],
        ['Fondazione Alta Mane Italia', 'Roma; progetti artistici per bambini e ragazzi in condizioni di fragilità, anche in ospedale'],
        ['Fondazione Mediolanum', 'Basiglio (MI); sostiene progetti per l\'infanzia in difficoltà'],
      ] },
      { titolo: 'Fondazioni d\'impresa e bancarie nazionali', voci: [
        ['Fondazione CDP', 'fondazione del gruppo Cassa Depositi e Prestiti; bandi a carattere sociale'],
        ['Fondazione Snam', 'progetti sociali sui territori in cui opera il gruppo'],
        ['Fondazione Vodafone Italia', 'bandi per progetti sociali e di inclusione'],
        ['Fondazione TIM', 'progetti sociali e di valorizzazione del patrimonio culturale'],
        ['Fondazione UniCredit', 'sostegno a progetti sociali in Italia'],
        ['Fondazione Italiana Accenture', 'bandi e piattaforme per progetti a impatto sociale'],
        ['Prosolidar', 'fondo di solidarietà del settore bancario (ABI e sindacati); finanzia progetti sociali in Italia e all\'estero'],
      ] },
      { titolo: 'Infanzia, sport e territorio (internazionali)', voci: [
        ['Fondation Princesse Grace', 'Monaco; sostiene progetti per bambini ricoverati e le loro famiglie'],
        ['UEFA Foundation for Children', 'Nyon; contributi a progetti per l\'infanzia in Europa'],
        ['MSC Foundation', 'Ginevra; fondazione del gruppo MSC, che a Genova controlla GNV'],
      ] },
    ],
  },
  {
    id: 'aziende-genova',
    titolo: 'Grandi aziende con sede a Genova',
    gruppi: [
      { titolo: 'Energia e industria', voci: [
        ['Ansaldo Energia', 'turbine e impianti per la produzione di energia'],
        ['Ansaldo Nucleare', 'ingegneria nucleare (gruppo Ansaldo Energia)'],
        ['ERG', 'energie rinnovabili (eolico e solare), quotata in Borsa; possibile contributo in natura per impianti ed efficientamento, da coordinare con il Conto Termico 3.0'],
        ['Hitachi Rail STS (ex Ansaldo STS)', 'segnalamento e sistemi ferroviari'],
        ['Paul Wurth Italia', 'impiantistica siderurgica (gruppo SMS)'],
      ] },
      { titolo: 'Trasporti, crociere e logistica', voci: [
        ['Costa Crociere', 'compagnia crocieristica (gruppo Carnival)'],
        ['GNV – Grandi Navi Veloci', 'traghetti (gruppo MSC)'],
        ['Ignazio Messina & C.', 'trasporto marittimo container'],
        ['Gruppo Spinelli', 'logistica portuale e terminal'],
        ['Rimorchiatori Riuniti', 'rimorchio portuale e servizi marittimi'],
      ] },
      { titolo: 'Servizi e tecnologia', voci: [
        ['RINA', 'certificazione, classificazione navale e ingegneria'],
        ['Esaote', 'apparecchiature biomedicali e diagnostica per immagini'],
        ['Leonardo', 'sede centrale a Roma, ma con grandi stabilimenti a Genova (elettronica, cyber security)'],
      ] },
      { titolo: 'Finanza e altro', voci: [
        ['Banca Passadore', 'banca privata genovese'],
        ['Costa Edutainment', 'gestore dell\'Acquario di Genova'],
      ] },
    ],
  },
  {
    id: 'aziende-presenza',
    titolo: 'Grandi aziende con forte presenza a Genova',
    gruppi: [
      { titolo: 'Industria e costruzioni', voci: [
        ['Fincantieri', 'sede a Trieste; cantiere navale di Sestri Ponente; la controllata Fincantieri Infrastructure ha lavorato al nuovo ponte'],
        ['Webuild', 'sede a Milano; ha costruito il ponte San Giorgio e lavora alla nuova diga foranea del porto'],
        ['Ericsson', 'grande centro di ricerca e sviluppo a Erzelli'],
      ] },
      { titolo: 'Porto e logistica', voci: [
        ['PSA International', 'sede a Singapore; gestisce il terminal container di Genova Pra\''],
        ['Gruppo MSC', 'sede a Ginevra; uffici, terminal e controllo di GNV; da contattare insieme alla MSC Foundation'],
      ] },
      { titolo: 'Infrastrutture e servizi', voci: [
        ['Iren', 'sedi a Reggio Emilia e Torino; servizi di acqua, gas, energia e rifiuti a Genova; possibile contributo in natura per caldaie, pompe di calore ed efficientamento'],
        ['Gruppo FS / RFI', 'sede a Roma; grandi cantieri del Terzo Valico e del nodo ferroviario di Genova'],
        ['Autostrade per l\'Italia', 'sede a Roma; legame forte ma delicato con la città dopo il crollo del Ponte Morandi; da valutare con cautela'],
      ] },
      { titolo: 'Banche', voci: [
        ['BPER Banca', 'sede a Modena; ha incorporato Carige ed è oggi la banca con più sportelli in città'],
        ['Intesa Sanpaolo', 'già partner del FAI per I Luoghi del Cuore; contatto naturale'],
        ['UniCredit', 'da contattare insieme alla Fondazione UniCredit'],
      ] },
    ],
  },
  {
    id: 'stampa',
    titolo: 'Stampa',
    gruppi: [
      { titolo: 'Nazionali', voci: [
        ['Corriere della Sera – Buone Notizie', 'inserto settimanale dedicato al Terzo settore e al volontariato'],
        ['la Repubblica', 'quotidiano nazionale; per Genova anche l\'edizione locale (vedi sotto)'],
        ['Avvenire', 'quotidiano con ampio spazio a sociale, volontariato e infanzia'],
        ['Il Sole 24 Ore', 'utile per il taglio Art Bonus, mecenatismo d\'impresa e responsabilità sociale'],
        ['Vita', 'magazine e sito di riferimento per il non profit e la filantropia'],
        ['Redattore Sociale', 'agenzia di stampa specializzata sui temi sociali'],
        ['ANSA', 'agenzia di stampa nazionale, con redazione regionale in Liguria'],
        ['Il Giornale dell\'Arte', 'mensile su patrimonio e restauro, per il tema delle ville vincolate'],
        ['Rai (TG1, TG2, TG3), Mediaset (TG5), La7 e Sky TG24', 'telegiornali nazionali, per i momenti chiave della campagna (lancio, inaugurazione)'],
      ] },
      { titolo: 'Locali', voci: [
        ['Il Secolo XIX', 'quotidiano di Genova e della Liguria; il gruppo comprende anche Radio 19 e The MediTelegraph (porto e shipping)'],
        ['la Repubblica – edizione di Genova', 'pagine locali del quotidiano nazionale'],
        ['Il Cittadino', 'settimanale cattolico della diocesi di Genova'],
        ['Primocanale', 'televisione e sito d\'informazione regionale'],
        ['TGR Liguria (Rai)', 'telegiornale regionale del servizio pubblico'],
        ['Telenord', 'televisione regionale ligure'],
        ['GenovaToday', 'quotidiano online di Genova'],
        ['Genova24', 'quotidiano online di Genova e provincia'],
        ['Radio Babboleo', 'emittente radiofonica genovese'],
      ] },
    ],
  },
  {
    id: 'istituzioni',
    titolo: 'Politici e istituzioni',
    gruppi: [
      { titolo: 'Comune e Città Metropolitana di Genova', voci: [
        ['Silvia Salis', 'sindaca di Genova e, per legge, sindaca della Città Metropolitana, proprietaria delle ville di Via Sturla; tiene per sé le deleghe a sport e grandi eventi'],
        ['Alessandro Terrile', 'vicesindaco; deleghe a bilancio, società partecipate e rapporti tra porto e città, utile per il dialogo con le aziende portuali'],
        ['Cristina Lodi', 'assessora a welfare, servizi sociali e famiglie'],
        ['Giacomo Montanari', 'assessore alla cultura e alla valorizzazione del patrimonio; ideatore dei Rolli Days, possibile alleato per aperture e visibilità delle ville'],
        ['Davide Patrone', 'assessore a patrimonio, casa e partecipazione'],
        ['Federico Bogliolo', 'presidente del Municipio IX Levante, dove si trovano le ville di Via Sturla (zona vicina al confine con il Municipio VIII Medio Levante, da confermare); centrodestra, rieletto nel 2025'],
      ] },
      { titolo: 'Regione Liguria', voci: [
        ['Marco Bucci', 'presidente della Regione, già sindaco di Genova'],
        ['Simona Ferro', 'vicepresidente; deleghe a cultura, scuola e tutela e valorizzazione dell\'infanzia'],
        ['Massimo Nicolò', 'assessore a sanità, politiche sociosanitarie e sociali e Terzo settore; interlocutore naturale per il legame con il Gaslini'],
        ['Alessio Piana', 'assessore a sviluppo economico, porti e programmazione FESR, per i bandi su fondi europei'],
      ] },
      { titolo: 'Livello nazionale', voci: [
        ['Alessandro Giuli', 'ministro della Cultura; competente su Soprintendenza, Art Bonus e beni vincolati'],
        ['Ministri per la famiglia e della salute', 'possibile patrocinio per il tema dell\'accoglienza dei bambini ricoverati'],
        ['Parlamentari eletti in Liguria, di tutti gli schieramenti', 'eletti nel 2022 (elenco aggiornato al subentro di Pandolfo; verificare eventuali altre sostituzioni), per segnalare il progetto e sostenerlo nei passaggi con i ministeri', [
          ['Camera – Edoardo Rixi', 'Lega, segretario regionale; viceministro alle Infrastrutture'],
          ['Camera – Francesco Bruzzone', 'Lega'],
          ['Camera – Matteo Rosso', 'Fratelli d\'Italia, coordinatore regionale'],
          ['Camera – Maria Grazia Frijia', 'Fratelli d\'Italia'],
          ['Camera – Roberto Bagnasco', 'Forza Italia; eletto nel collegio del Levante'],
          ['Camera – Ilaria Cavo', 'Noi Moderati'],
          ['Camera – Luca Pastorino', 'centrosinistra; già sindaco di Bogliasco, vicino alla zona delle ville'],
          ['Camera – Alberto Pandolfo', 'Pd; subentrato ad Andrea Orlando nel 2025'],
          ['Camera – Valentina Ghio', 'Pd'],
          ['Camera – Roberto Traversi', 'Movimento 5 Stelle'],
          ['Senato – Gianni Berrino', 'Fratelli d\'Italia'],
          ['Senato – Roberto Menia', 'Fratelli d\'Italia'],
          ['Senato – Stefania Pucciarelli', 'Lega'],
          ['Senato – Lorenzo Basso', 'Pd'],
          ['Senato – Luca Pirondini', 'Movimento 5 Stelle; già consigliere comunale a Genova'],
          ['Liguri eletti fuori regione', 'Raffaella Paita (Senato, Italia Viva) e Annamaria Furlan (Senato, eletta con il Pd)'],
        ]],
        ['Parlamentari europei della circoscrizione Nord-Ovest', 'per informazioni sui fondi europei'],
      ] },
    ],
  },
  {
    id: 'idee',
    titolo: 'Idee fuori dagli schemi',
    gruppi: [
      { titolo: 'Sport', voci: [
        ['Derby del cuore Genoa–Sampdoria', 'amichevole benefica o partita delle vecchie glorie rossoblù e blucerchiate, con incasso destinato alle ville; per una volta le due tifoserie dalla stessa parte'],
        ['Maglia unica Genoa + Samp', 'una maglia metà rossoblù e metà blucerchiata in edizione limitata, firmata dalle due rose e venduta o messa all\'asta'],
        ['Calciatori in cantiere', 'giornata in cui i giocatori delle due squadre dipingono una stanza insieme ai volontari CRI, con riprese per i social'],
        ['Sturla Run', 'corsa non competitiva da Sturla a Nervi lungo il mare, con iscrizione solidale'],
        ['Regata solidale', 'con lo Yacht Club Italiano e i circoli velici genovesi, magari durante il Salone Nautico'],
      ] },
      { titolo: 'Gala ed eventi esclusivi', voci: [
        ['Cena di gala con il Principe Alberto II di Monaco', 'da proporre tramite la Fondation Princesse Grace, che sostiene i bambini ricoverati; location d\'effetto come Palazzo Ducale, Palazzo Reale o una nave da crociera ormeggiata in porto'],
        ['Cena tra i ponteggi', 'cena esclusiva dentro una delle ville a cantiere aperto, per far vedere ai grandi donatori cosa stanno finanziando'],
        ['Cena a quattro mani', 'chef stellati liguri ai fornelli per una sera, con menù di pesto e focaccia rivisitati'],
        ['Asta di beneficenza', 'con Cambi Casa d\'Aste (sede a Genova): opere donate da artisti, cimeli sportivi, esperienze uniche come una giornata in plancia su una nave Costa o MSC'],
        ['Concerto benefico', 'al Teatro Carlo Felice o al Porto Antico, con artisti genovesi come testimonial', [
          ['Ivano Fossati', 'cantautore genovese, ritirato dalle scene: più adatto a un messaggio o a un patrocinio che a un concerto'],
          ['Gino Paoli', 'cantautore della scuola genovese'],
          ['Cristiano De André e Fondazione Fabrizio De André', 'il legame con Faber renderebbe l\'evento molto sentito in città'],
          ['Ricchi e Poveri', 'gruppo nato a Genova, molto popolare anche tra le famiglie'],
          ['Francesco Baccini', 'cantautore genovese'],
          ['Olly, Bresh, Tedua e Izi', 'artisti genovesi e liguri della nuova generazione, utili per coinvolgere ragazzi e social'],
          ['Buio Pesto', 'band genovese con canzoni in dialetto, adatta a un evento per bambini e famiglie'],
          ['Maurizio Crozza', 'comico genovese, possibile presentatore o testimonial'],
          ['Luca Bizzarri e Paolo Kessisoglu', 'duo comico genovese, possibili conduttori della serata'],
          ['Tullio Solenghi e Enrique Balbontin', 'attori e comici genovesi'],
          ['Orchestra del Teatro Carlo Felice', 'per un concerto classico o una serata con ospiti pop'],
        ]],
      ] },
      { titolo: 'Gesti simbolici per la città', voci: [
        ['Lanterna rossa', 'illuminare la Lanterna di rosso, il colore della Croce Rossa, la sera del lancio della campagna'],
        ['Sirene del porto', 'un minuto in cui tutte le navi in porto suonano insieme per il lancio, d\'accordo con l\'Autorità di Sistema Portuale'],
        ['Tegola d\'ardesia firmata', 'ogni donatore «compra» una tegola o un mattone in ardesia ligure con il suo nome, da usare nel restauro o esporre in un muro dei donatori'],
        ['Mostra dei disegni', 'i bambini disegnano la stanza dei loro sogni; i disegni diventano una mostra a Palazzo Ducale e poi il progetto vero'],
        ['Euroflora e Parchi di Nervi', 'un\'aiuola o uno spazio dedicato al progetto alla prossima edizione, a pochi minuti da Via Sturla'],
        ['Rolli Days speciali', 'aprire le ville durante i Rolli Days, con visite guidate a offerta (se compatibili con la presenza dei bambini)'],
      ] },
    ],
  },
];

// Le pagine della sezione: ognuna mette insieme uno o più capitoli affini.
export const PAGINE = [
  { id: 'panoramica', icon: '🧭', label: 'Panoramica', capitoli: ['contatti'],
    intro: 'Il recupero delle due ville di Via Sturla: da dove partire, dove cercare i fondi, chi coinvolgere.' },
  { id: 'sostegno', icon: '💶', label: 'Fonti di sostegno', capitoli: ['fonti', 'non-denaro'],
    intro: 'Strumenti fiscali, enti, raccolte e concorsi; poi i sostegni in competenze, lavori e materiali.' },
  { id: 'fondazioni', icon: '🏛️', label: 'Fondazioni', capitoli: ['fondazioni-liguria', 'fondazioni-italia'],
    intro: 'Le fondazioni di Genova e della Liguria, poi quelle italiane e internazionali.' },
  { id: 'aziende', icon: '🏢', label: 'Aziende e immobiliare', capitoli: ['aziende-genova', 'aziende-presenza', 'immobiliare'],
    intro: 'Le grandi aziende di Genova, quelle con una forte presenza in città e il mondo di architettura e immobiliare.' },
  { id: 'istituzioni', icon: '🗳️', label: 'Istituzioni', capitoli: ['istituzioni'],
    intro: 'Comune e Città Metropolitana, Regione, Governo e parlamentari liguri.' },
  { id: 'stampa', icon: '📰', label: 'Stampa', capitoli: ['stampa'],
    intro: 'Testate nazionali e locali per raccontare il progetto.' },
  { id: 'idee', icon: '💡', label: 'Idee', capitoli: ['idee'],
    intro: 'Sport, gala, concerti e gesti simbolici per la città.' },
];

// Quante voci ha un capitolo (le sottovoci contano a parte).
export function contaVoci(capitolo) {
  let n = 0;
  for (const g of capitolo.gruppi) for (const v of g.voci) n += 1 + (v[2]?.length || 0);
  return n;
}
