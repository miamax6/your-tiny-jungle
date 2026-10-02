# Mettre en ligne

Ce dossier est un dépôt git complet, le commit est déjà fait.
Il ne manque que le push.

## 1. Pousser

```bash
cd pub2
git push https://<TON_PAT>@github.com/miamax6/your-tiny-jungle.git main
```

Sans ligne de commande : https://github.com/miamax6/your-tiny-jungle → *uploading an existing file*,
puis glisser `index.html`, `manifest.webmanifest`, `sw.js`, les dossiers `icons` et `src`, et `README.md`.

## 2. Activer GitHub Pages

Settings → Pages → Source : **Deploy from a branch** → Branch : `main` / `(root)` → Save.

L'appli sera sur **https://miamax6.github.io/your-tiny-jungle/** (compter quelques minutes).

## 3. Créer le jeton de synchronisation

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained** :

- *Repository access* : **Only select repositories** → `miamax6/miamax6` **uniquement**
- *Permissions* → Repository permissions → **Contents : Read and write**
- Durée : 1 an — note la date de renouvellement

## 4. Configurer l'appli

Ouvrir l'appli en ligne → ⚙️ → **4 · Synchro** :

| Champ | Valeur |
| --- | --- |
| Compte GitHub | `miamax6` |
| Dépôt privé | `miamax6` |
| Fichier | `jungle/datas.json` |
| Branche | `main` |
| Jeton | celui de l'étape 3 |
| Phrase secrète | la tienne, longue |

Puis **Synchroniser maintenant**. Le dossier `jungle/` se crée tout seul au premier envoi.

⚠️ Si tu perds la phrase secrète, les données sont irrécupérables. C'est le prix du vrai chiffrement.

## 5. Ton téléphone

Sur le PC : ⚙️ → Synchro → **Partager vers un autre appareil**.
Scanner le QR avec le téléphone, saisir le code affiché (à lire de vive voix, jamais avec le QR).
Puis menu du navigateur → « Ajouter à l'écran d'accueil » pour l'installer en PWA.

## 6. Révoquer

Le PAT temporaire donné dans la conversation : **à révoquer maintenant**.
