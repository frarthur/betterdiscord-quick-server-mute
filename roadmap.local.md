# Roadmap

## Backlog

### v2 — Mute assisté par l'activité (100 % local, zéro réseau)

- [ ] Phase 1 — Collecteur local (events Flux + `ReadStateStore`) + stockage `BdApi.Data`
- [ ] Phase 1 — Vue debug (panneau/log) pour valider la pertinence des signaux
- [ ] Phase 2 — Scoring (récence, fréquence, engagement) + décroissance + hystérésis
- [ ] Phase 2 — Panneau de réglages : suggestions serveurs/chans + bouton « Muter la sélection »
- [ ] Phase 3 — Mode auto opt-in : garde-fous (veto mentions, unmute sur interaction), undo, kill switch
- [ ] Phase 4 — Overrides par channel, export/import JSON local, réglage des seuils
- [ ] Phase 4 — i18n FR/EN + tests unitaires des fonctions pures
- [ ] Docs — encart README « 100 % local, aucune donnée transmise » + désactivation de la collecte

## In Progress

- [ ] Phase 0 — Spécification v2 (`docs/v2-spec.md`)

## Done

- [x] v1 — Plugin QuickServerMute (mute serveur + dossier au clic)
- [x] Scaffolding dépôt (editorconfig, gitignore, templates, vscode)

## Notes

- Vision : analyse **locale et persistante** autorisée, jamais transmise.
- Aucun réseau, aucune télémétrie, open source, safe pour tout le monde.
- Si le projet grossit : configurer speckit + tests (extraire la logique pure hors du code Discord).
