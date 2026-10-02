# Your Tiny Jungle 🪴

Page unique pour gérer ses plantes d'intérieur et son calendrier de semis.
Un seul fichier HTML, polices comprises, **aucune requête réseau** pour fonctionner :
elle marche hors ligne comme en ligne.

| Onglet | Contenu |
| --- | --- |
| 🪴 Plantes | Fiches, filtres par pièce, tri lumière/humidité, groupes par exposition |
| 🌱 Graines & semis | Calendrier 12 mois, fiches sourcées, « à faire ce mois-ci », coches et notes |

## Ce dépôt ne contient aucune donnée personnelle

Le jeu de données embarqué est un **exemple générique** : 10 plantes courantes,
10 graines, un logement fictif, pas de ville. Il sert de démonstration au premier lancement.

Tes vraies données vivent ailleurs, au choix :

- dans le navigateur (assistant ⚙️, import d'un `.json`) ;
- dans un **dépôt GitHub privé**, **chiffrées**, synchronisées entre tes appareils.

## Synchronisation chiffrée

- **AES-256-GCM**, clé dérivée de ta phrase secrète par **PBKDF2-SHA256, 250 000 itérations**,
  sel de 16 octets et IV de 12 octets tirés au hasard à chaque écriture. Web Crypto, aucune bibliothèque.
- Ce qui atteint GitHub est une enveloppe : `{v, kdf, iter, salt, iv, ct}`. **Jamais de clair.**
- La phrase secrète ne quitte pas l'appareil. GitHub ne peut pas la deviner, moi non plus.
- Jeton *fine-grained* limité au seul dépôt privé, permission **Contents : Read and write**.
- Envoi automatique 1,8 s après une modification, relecture du `sha` distant avant écriture,
  et **conflit explicite** si les deux côtés ont changé : c'est toi qui tranches, jamais l'appli.

Si tu perds ta phrase secrète, les données sont irrécupérables. C'est le prix du chiffrement réel.

## Partage vers un autre appareil

Un **QR code** encode un lien `…/#partage=<charge>`. Le fragment `#` n'est jamais
envoyé à un serveur. Il contient quand même le jeton et la phrase secrète : il est donc
**chiffré par un code de 8 caractères** (AES-256-GCM, PBKDF2-SHA256 200 000 itérations),
à transmettre de vive voix, jamais avec le QR.

Scanner le QR ouvre l'appli, demande le code, enregistre la configuration, efface le `#`
de la barre d'adresse, puis récupère les données. Fonctionne aussi quand l'appli est déjà ouverte.

QR généré par [qrcode-generator 2.0.4](https://github.com/kazuhikoarase/qrcode-generator) (MIT),
intégré au fichier — aucun CDN.

## PWA

`manifest.webmanifest` + `sw.js` en **réseau d'abord**, cache en repli hors ligne.
GitHub Pages sert une copie périmée une dizaine de minutes après un envoi : la page compare
donc sa constante `APP_BUILD` à celle en ligne et se recharge si besoin — jamais pendant une
saisie, au plus une fois par minute et par version.

## Le contenu est séparé du code

Tout vit dans un bloc unique en tête de page :

```html
<script type="application/json" id="jungle-data"> … </script>
```

Schéma :

```
{ "app": "your-tiny-jungle", "schema": 1,
  "site":   { title, city, subtitle, eyebrow, climate },
  "rooms":  [ { icon, name, orientation, details } ],
  "plants": [ { name, latin, wikiPage, wikiLang, rooms[], placement,
                light, humidity, size, notes } ],
  "plantGroups":    [ { title, plants[], suffix? } ],
  "humidityGroups": [ { title, plants[] } ],
  "seeds":  [ { id, name, latin, wikiPage, fresh, type,
                calendar: { indoor[], outdoor[], transplant[], harvest[] },
                facts{}, notes, sources[[libellé, url]] } ] }
```

- L'**emoji de la pièce** est la clé de jointure avec `plants[].rooms`.
- `light` et `humidity` valent `high`, `med` ou `low`.
- Les mois sont des entiers de 1 à 12, à caler sur les dates de gelées de ta ville.
- `sources` est obligatoire par graine : au moins une URL réelle et vérifiable.

L'assistant ⚙️ génère le prompt à donner à une IA pour produire ce fichier.

## Stockage local

| Clé | Contenu |
| --- | --- |
| `maxiskaJungle.v3` | coches « semée », notes, thème, onglet |
| `maxiskaJungle.dataset` | jeu de données importé ou configuré |
| `maxiskaJungle.configured` | la page a-t-elle déjà été configurée |
| `jg.cfg` | compte, dépôt, fichier, branche, jeton, phrase secrète |
| `jg.meta` | `sha` distant, indicateur de modification, empreinte du contenu |

## Construire

```bash
python3 src/build.py
```

Assemble les cinq morceaux de `src/`, intègre les polices en base64, écrit `index.html`.

## Crédits

Principes d'animation issus de [emilkowalski/skills](https://github.com/emilkowalski/skills).
Polices : Caprasimo et Figtree (Google Fonts), Jungledise pour le titre.
