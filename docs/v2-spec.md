# QuickServerMute v2 — Spécification

> Statut : brouillon (Phase 0). À valider avant toute implémentation.

## 1. Vision

v1 ajoute un bouton pour muter serveurs et dossiers en un clic. v2 vise à
**réduire le besoin de cliquer** en s'appuyant sur l'activité réelle de
l'utilisateur : détecter les serveurs et salons peu utilisés et proposer — ou,
en mode opt-in, appliquer — le mute automatiquement.

L'objectif n'est pas de remplacer les réglages Discord, mais de fournir une
couche d'aide locale, transparente et réversible.

## 2. Contraintes non négociables

- **100 % local** : aucune requête réseau, aucune télémétrie, aucun endpoint
  externe. Le plugin n'utilise que les modules internes de Discord et `BdApi`.
- **Aucune donnée personnelle exploitable** : on ne stocke jamais le contenu des
  messages, ni les pseudos, ni les URLs. Uniquement des **IDs Discord** et des
  **compteurs/timestamps**.
- **Réversible et transparent** : l'utilisateur peut voir, désactiver, exporter
  et effacer toutes les données collectées.
- **Open source** : le code reste lisible et auditable.
- **Safe par défaut** : aucune modification silencieuse des réglages. L'auto-mute
  est désactivé par défaut.

## 3. Non-objectifs

- Pas de synchronisation entre machines / comptes.
- Pas d'analyse sémantique des messages (sujets, sentiments, etc.).
- Pas de tracking hors de Discord (le plugin ne tourne que quand Discord tourne).
- Pas de "temps d'utilisation global" : uniquement l'activité dans les
  serveurs/salons de l'utilisateur.

## 4. Signaux collectés

Tous les signaux sont disponibles via les internes Discord, déjà calculés :

| Signal | Source | Usage |
| --- | --- | --- |
| Salon sélectionné | event Flux `CHANNEL_SELECT` (porte `guildId`) | visite + temps actif |
| Message créé | event Flux `MESSAGE_CREATE` | activité du salon/serveur |
| Message lu (ACK) | event Flux `MESSAGE_ACK` / `BULK_MESSAGE_ACK` | engagement réel |
| Non-lus / mentions | `ReadStateStore` | veto mentions, poids engagement |
| Mute actuel | `UserGuildSettingsStore` | ne pas écraser un choix manuel |
| Métadonnées | `GuildStore`, `ChannelStore` | noms, type de salon |

> Les noms d'events/actions exacts (`MESSAGE_ACK`, `GUILD_SELECT`, etc.) sont à
> confirmer sur la version courante de Discord. À isoler dans un module dédié
> (`signals.js`) pour limiter la casse lors des mises à jour.

## 5. Modèle de données local

Persisté via `BdApi.Data.save("QuickServerMute", key, value)`, écrit de façon
débouncée (toutes les ~30 s et à l'arrêt). IDs uniquement.

```json
{
  "schema": 1,
  "since": 1710000000000,
  "guilds": {
    "<guildId>": {
      "lastActivityTs": 1710000000000,
      "activeMs": 123456,
      "visitCount": 12,
      "messagesSent": 3,
      "messagesRead": 120,
      "lastMentionTs": null,
      "lastUserMuteChangeTs": null
    }
  },
  "channels": {
    "<channelId>": {
      "guildId": "<guildId>",
      "lastActivityTs": 1710000000000,
      "activeMs": 0,
      "visitCount": 4,
      "messagesSent": 0,
      "messagesRead": 42,
      "lastMentionTs": null
    }
  }
}
```

Règles de stockage :

- Pruning : supprimer les salons inactifs > 180 j et les serveurs quittés.
- Plafond de taille (ex. 5 000 salons) pour borner le fichier.
- `messagesRead` peut être approximé par les transitions de compteurs de
  `ReadStateStore` plutôt que par un comptage par message (moins coûteux).

## 6. Scoring

Score d'inactivité par cible, calculé à la demande (pas de calcul permanent) :

```
inactivityDays = (now - lastActivityTs) / 86_400_000
engagement     = messagesRead + messagesSent + visitCount   (pondérés)
score          = f(recency, frequency, engagement)          // 0 → 1
```

Principes :

- **Décroissance** : les compteurs anciens pèsent moins (fenêtre glissante 30 j).
- **Hystérésis** : une cible doit rester sous le seuil pendant `K` jours
  consécutifs avant d'être proposée au mute (évite le flapping).
- **Veto** : `lastMentionTs` récent ⇒ jamais proposé/muté, quel que soit le score.
- **Réveil** : toute activité (visite, message, ACK) réinitialise
  `lastActivityTs` et force le unmute en mode auto.

Tous ces calculs doivent être des **fonctions pures** (aucune dépendance à
Discord) pour être testables en Node.

## 7. UX

### Phase 1 — Vue debug
Panneau simple (ou logs console) affichant les cibles et leur score brut, pour
valider les signaux avant de construire l'UI finale.

### Phase 2 — Mode assisté (défaut)
`getSettingsPanel()` retourne un panneau avec :

- **Statut** : collecte activée/désactivée, date de début, nombre de cibles.
- **Suggestions** : liste serveurs + salons triés par inactivité (nom, dernier
  usage, score, mentions récentes), cases à cocher.
- **Action** : « Muter la sélection » / « Ne pas proposer ces cibles ».
- Aucun changement automatique.

### Phase 3 — Mode auto (opt-in)
- Activation explicite, avec rappel des règles.
- Application via l'action existante `updateGuildNotificationSettings`
  (et override par channel à partir de la Phase 4).
- **Journal** des N dernières actions avec undo 1 clic.
- **Kill switch** global et retour immédiat en mode assisté.

### Phase 4 — Réglages avancés
- Mute par channel.
- Export / import JSON local (backup du profil d'activité).
- Réglage des seuils (`inactivityDays`, `K`, grâce mentions).
- Bouton « Oublier mes données » (suppression immédiate du store local).

## 8. Architecture cible

Pour permettre les tests et limiter la fragilité :

```
src/
  signals.js     // abonnements Flux + lecture stores → events normalisés
  store.js       // persistance locale (BdApi.Data) + pruning
  scoring.js     // fonctions pures : score, hystérésis, veto
  rules.js       // décisions mute/unmute (pur)
  ui.js          // panneau de réglages
  plugin.js      // glue BetterDiscord (start/stop, injection boutons v1)
build/
  bundle.js      // concatène src/ → QuickServerMute.plugin.js (fichier unique)
```

- Le livrable BetterDiscord reste **un seul fichier** `QuickServerMute.plugin.js`.
- `scoring.js` et `rules.js` sont purs ⇒ testables avec `node --test` sans
  Discord ni dépendance externe.
- Décision à confirmer : introduire ce découpage + build, ou garder le
  monofichier et tester via extraction.

## 9. Vie privée & sécurité

- Aucun appel réseau. À vérifier en CI (grep des `fetch`/`XMLHttpRequest`/URLs).
- Données stockées dans le dossier de données BetterDiscord, jamais partagées.
- L'utilisateur peut tout effacer (`BdApi.Data.delete`).
- Encart README obligatoire : « 100 % local, aucune donnée transmise ».

## 10. Risques & mitigations

| Risque | Mitigation |
| --- | --- |
| Faux positif : mute un serveur important | veto mentions + grâce + assisté par défaut |
| Perte de confiance (changement silencieux) | opt-in, journal, undo, kill switch |
| Flapping (on/off répété) | hystérésis + décroissance |
| APIs internes cassées par Discord | isoler dans `signals.js`, dégradation gracieuse |
| Surcoût CPU (observer + events) | throttle, calcul à la demande, écritures débouncées |
| Perception "surveillance" | transparence, local-only, effaçable, open source |

## 11. Tests (à activer quand le projet grossit)

- Tests unitaires `node:test` sur `scoring.js` et `rules.js` :
  - veto mention,
  - seuil + hystérésis (K jours),
  - réveil sur activité,
  - pruning du store.
- Test de non-régression "aucun réseau" (analyse statique du bundle).
- Tests manuels documentés pour l'injection DOM (v1) et le panneau.

## 12. Phases récapitulatives

| Phase | Contenu | Livrable |
| --- | --- | --- |
| 0 | Spec + roadmap | `docs/v2-spec.md`, `roadmap.local.md` |
| 1 | Collecteur + store + vue debug | signaux validés |
| 2 | Scoring + panneau assisté | mute assisté utilisable |
| 3 | Mode auto opt-in + garde-fous | auto-mute sûr |
| 4 | Par-channel + export/import + seuils | fonctionnalités avancées |
