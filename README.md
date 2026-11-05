# Lanterna

Hub leggero per home server Ubuntu: gestisci i container Docker e tieni d'occhio lo stato del sistema da un'unica pagina, anche da smartphone.

- CPU (utilizzo e temperatura), RAM, uptime
- Spazio dischi con stato SMART e temperatura reali
- Container Docker: stato, avvio, arresto, riavvio
- Stato di Tailscale
- Riavvio e spegnimento del server host
- Accesso tramite **abbinamento dispositivi**: niente password, il dispositivo viene ricordato

## Installazione

```bash
mkdir -p ~/lanterna && cd ~/lanterna
curl -O https://raw.githubusercontent.com/NicolasK98/lanterna/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/NicolasK98/lanterna/main/.env.example
docker compose up -d
docker logs lanterna   # qui trovi il codice di abbinamento
```

Apri `http://IP-DEL-SERVER:8081`, inserisci il codice e il dispositivo resterà abbinato.
Dal telefono puoi usare "Aggiungi a schermata Home" per averla come app.

## Aggiornamento

```bash
cd ~/lanterna
docker compose pull && docker compose up -d
```

## Configurazione

Tutte le opzioni sono in [`.env.example`](.env.example).

| Variabile | Default | Descrizione |
|---|---|---|
| `LANTERNA_PORT` | `8081` | Porta esposta sull'host |
| `AUTH_MODE` | `device` | `device` = abbinamento dispositivi, `none` = nessuna protezione |
| `PAIRING_CODE` | casuale | Codice fisso di abbinamento; se vuoto viene generato a ogni avvio e stampato nei log |
| `DEVICE_TTL_DAYS` | `400` | Dopo quanti giorni di inattività un dispositivo va riabbinato |
| `DISK_LABELS` | `/=SSD Sistema` | Nomi dei dischi, es. `/=SSD Sistema,/mnt/storage=HDD Dati` |
| `POWER_ACTIONS` | `true` | Mostra i pulsanti riavvia/spegni |
| `TRUST_PROXY` | vuoto | Da impostare se Lanterna è dietro un reverse proxy (es. `1` o una subnet) |
| `UPDATE_CHECK` | `true` | Mostra un avviso quando su GitHub esce una nuova versione |

Vengono mostrati la root dell'host e i dischi montati in `/mnt`, `/media` e `/srv`.

## Permessi richiesti

Lanterna controlla Docker e l'host, quindi ha privilegi elevati: **non esporla su Internet**, usala in LAN o tramite Tailscale.

| Mount | Perché |
|---|---|
| `/var/run/docker.sock` | Gestione dei container |
| `/run/tailscale/tailscaled.sock` | Stato di Tailscale |
| `/run/dbus/system_bus_socket` | Riavvio/spegnimento via systemd-logind |
| `/:/host:ro` | Spazio dei dischi (sola lettura) |
| `privileged: true` | Lettura SMART dei dischi |

## Log

```bash
docker logs lanterna
```

Il `docker-compose.yml` limita i log a 3 file da 1 MB: i più vecchi vengono eliminati automaticamente.
Se aggiungi Lanterna a un compose esistente, copia anche la sezione `logging:`.

Per applicare lo stesso limite a **tutti** i container, crea o modifica `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
```

poi `sudo systemctl restart docker`. Vale solo per i container creati dopo: ricreali con `docker compose up -d --force-recreate`.

## Sviluppo

```bash
git clone https://github.com/NicolasK98/lanterna.git && cd lanterna
# in docker-compose.yml sostituisci "image:" con "build: ."
docker compose up -d --build
```

## Rilascio di una nuova versione

1. Aggiorna `version` in `package.json`
2. `git tag v0.2.0 && git push --tags`
3. GitHub Actions pubblica `ghcr.io/nicolask98/lanterna:0.2.0` e `:latest` e crea la Release
4. Aggiorna `CHANGELOG.md`

## Licenza

[MIT](LICENSE) © [NicolasK98](https://github.com/NicolasK98)
