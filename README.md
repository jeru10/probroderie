# Atelier de Broderie Pro — v4.3

Application de gestion et facturation pour atelier de broderie :
calculateur de prix (points × tarif, viseline, frais de calage), registre
des commandes avec numérotation des factures, suivi des paiements, export
CSV/JSON et factures imprimables.

Stack : React 18 + Vite + Tailwind CSS v4. 100% front-end — les données
sont stockées dans le `localStorage` du navigateur (par appareil).

## Développement en local

```bash
npm install
npm run dev      # http://localhost:5173
```

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` construit et publie
automatiquement l'app à chaque push sur `main`.

1. Créer le dépôt sur GitHub (aucune option supplémentaire nécessaire).
2. `Settings → Pages → Source : GitHub Actions`.
3. Pousser sur `main` — l'app sera en ligne sur
   `https://<utilisateur>.github.io/<nom-du-dépôt>/`.

La base des liens est calculée automatiquement à partir du nom du dépôt
(variable d'environnement `VITE_BASE`).

## Sauvegardes

Aucune base de données serveur : penser à utiliser régulièrement
**Backup JSON** (Tableau de Bord) pour exporter les commandes.
