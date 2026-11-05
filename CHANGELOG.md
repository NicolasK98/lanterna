# Changelog

Tutte le modifiche rilevanti di Lanterna. Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.1.0/), versioni secondo [SemVer](https://semver.org/lang/it/).

## [Non rilasciato]

### Aggiunto
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
