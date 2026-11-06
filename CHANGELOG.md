# Changelog

Tutte le modifiche rilevanti di Lanterna. Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.1.0/), versioni secondo [SemVer](https://semver.org/lang/it/).

## [Non rilasciato]

## [0.2.1] - 2026-11-06

### Aggiunto
- `/healthz` riporta la memoria del processo (rss, heap) per la diagnostica
- Fuso orario configurabile con `TZ` (default `Europe/Rome`)
- `package-lock.json` generato automaticamente da GitHub Actions

### Modificato
- La dashboard smette di aggiornarsi quando la scheda è nascosta e riprende quando torna visibile
- Heap di Node limitato a 96 MB (`NODE_OPTIONS`) per contenere la crescita della RAM
- Compose: `init: true`, filesystem in sola lettura con `/tmp` in RAM, `mem_limit: 192m`
- Spegnimento pulito su `docker stop` (prima attendeva 10 secondi il kill forzato)

### Corretto
- Nel `docker-compose.yml` della repo la riga `image:` era finita dentro un commento

## [0.2.0] - 2026-11-05

### Aggiunto
- Barra unica con la RAM usata da ogni container, la quota del sistema e la memoria libera
- Limite alla dimensione dei log nel `docker-compose.yml` (3 file da 1 MB)

## [0.1.0]

Prima versione pubblica.

### Aggiunto
- Monitoraggio CPU (utilizzo e temperatura), RAM e uptime
- Spazio dischi con stato SMART e temperatura reali
- Gestione container Docker: avvio, arresto, riavvio
- Stato di Tailscale tramite LocalAPI
- Riavvio e spegnimento dell'host via systemd-logind
- Abbinamento dispositivi con codice e gestione dei dispositivi abbinati
- Avviso quando è disponibile una nuova versione
- Installabile come app (PWA) sulla schermata Home
- Configurazione tramite `.env`, immagine su GHCR per amd64 e arm64
