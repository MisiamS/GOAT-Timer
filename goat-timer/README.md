# Capretta Timer 🐐

Timer condiviso ispirato al vecchio Cuckoo, con stanze via link e grafica pastello.

## Funzionalità

- stanza condivisa tramite URL;
- timer sincronizzato in tempo reale;
- sessioni lavoro e pausa configurabili;
- pausa, ripresa e reset;
- cambio modalità lavoro/pausa;
- notifica visiva e sonora quando entra qualcuno;
- notifica e suono quando il timer termina;
- elenco partecipanti con aggiornamento live;
- design responsive per telefono e desktop;
- nessuna dipendenza esterna: usa solo Node.js.

## Avvio locale

Richiede Node.js 18 o successivo.

```bash
npm start
```

Oppure:

```bash
node server.js
```

Poi apri:

```text
http://localhost:3000
```

Apri lo stesso link in due finestre o dispositivi per provare la sincronizzazione.

## Pubblicazione

Puoi pubblicarlo su Render, Railway, Fly.io o un altro servizio che supporti Node.js e connessioni HTTP persistenti/SSE.

Comando di avvio:

```text
npm start
```

Il server usa automaticamente la variabile d'ambiente `PORT` fornita dall'hosting.
