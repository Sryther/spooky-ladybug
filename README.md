# 🎃 Spooky Ladybug — le photomaton d'Halloween

Une mini-application web pour la soirée d'Halloween de l'association
**[Cox Animation](https://www.cox-anim.fr)**. Les parents prennent leur petit
monstre en photo, choisissent un cadre qui fait (un peu) peur — citrouilles,
fantômes ou araignées — puis enregistrent la photo sur leur téléphone.

- 🇫🇷 Entièrement en français, pensée pour le téléphone
- 🔒 **Aucun stockage** : la photo est prise, encadrée et enregistrée
  directement dans le navigateur. Elle n'est jamais envoyée au serveur,
  aucun cookie, aucun `localStorage`, aucune statistique.
- 🖼️ Photo en 4:5 (portrait) ou 5:4 (paysage) : le cadre suit l'orientation du téléphone
- 📣 Partage proposé discrètement vers Facebook, Instagram, TikTok ou Snapchat :
  la légende (avec hashtags) est copiée et la photo passe par le menu de partage
  natif du téléphone. Sur ordinateur, la photo est enregistrée et le réseau
  ouvert dans un nouvel onglet.
- 🎄 Annonce du prochain événement : le
  [marché de Noël](https://www.cox-anim.fr/evenement/marche-de-noel-4/)
- ⚡ Site statique : HTML/CSS/JS, sans backend ni base de données

## Garanties de confidentialité

« Rien n'est stocké » n'est pas qu'une promesse affichée : c'est imposé
techniquement.

| Garantie | Comment |
| --- | --- |
| Rien n'est envoyé | `Content-Security-Policy: connect-src 'none'; form-action 'none'` : le navigateur refuse toute requête sortante depuis la page |
| Pas d'endpoint d'upload | Site statique ; `client_max_body_size 1k` refuse tout corps de requête |
| Aucun tiers | Polices auto-hébergées, aucun script externe, aucun traceur |
| Rien ne persiste | Photo gardée uniquement en mémoire (canvas + URL `blob:`), libérée au changement de photo et à la fermeture de la page ; caméra coupée dès que la page passe en arrière-plan |
| Caméra limitée | `Permissions-Policy: camera=(self), microphone=(), geolocation=()` |

## Structure

```
src/                 Le site statique (index.html, styles.css, app.js)
src/assets/frames/   Les cadres SVG (fenêtre transparente) : 1080×1350, et 1350×1080 (*-paysage.svg)
src/assets/fonts/    Polices auto-hébergées (Creepster, Fredoka, Nunito — OFL)
nginx.conf           Config NGINX durcie (port 8080, en-têtes de sécurité)
Containerfile        Image conteneur durcie (NGINX non-root)
chart/               Chart Helm pour un déploiement Kubernetes
```

## Lancer en local

L'accès à la caméra exige un contexte sécurisé : `localhost` ou HTTPS.

```bash
cd src && python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

Pour tester sur un téléphone, il faut servir le site en HTTPS (par exemple
derrière l'Ingress avec cert-manager).

## Construire et lancer le conteneur

```bash
# Construction (Podman ou Docker)
podman build -t spooky-ladybug:1.0.0 -f Containerfile .

# Exécution (image non-root, port interne 8080, FS en lecture seule)
podman run --rm -p 8080:8080 --read-only --tmpfs /tmp --tmpfs /var/cache/nginx spooky-ladybug:1.0.0
# puis ouvrir http://localhost:8080
```

## Intégration continue (Docker Hub)

Le workflow [`.github/workflows/build-and-push-images.yml`](.github/workflows/build-and-push-images.yml)
construit l'image multi-arch (`amd64`/`arm64`) et la pousse sur **Docker Hub**
à chaque **tag Git** de version (`1.0.0` ou `v1.0.0`) :

```bash
git tag 1.0.0 && git push origin 1.0.0
```

Étapes : **meta** (version + détection du `latest`), **build-and-push** (SBOM +
provenance, `sryther/spooky-ladybug:<version>` et `:latest`), **sbom** (SPDX) et
**security-scan** (Trivy, remonté dans l'onglet *Security*).

Secrets à configurer dans **Settings → Secrets and variables → Actions** :
`DOCKERHUB_USERNAME` et `DOCKERHUB_TOKEN`.

## Déployer sur Kubernetes

```bash
helm upgrade --install spooky-ladybug ./chart \
  --set image.tag=1.0.0 \
  --set ingress.hosts[0].host=halloween.cox-anim.fr
```

⚠️ **HTTPS obligatoire** : sans lui, les navigateurs mobiles refusent l'accès
à la caméra. Renseigner `ingress.annotations` (ex.
`cert-manager.io/cluster-issuer`) et `ingress.tls` dans un fichier de valeurs.

| Clé                 | Défaut                               | Description                 |
| ------------------- | ------------------------------------ | --------------------------- |
| `replicaCount`      | `1`                                  | Nombre de pods              |
| `image.repository`  | `docker.io/sryther/spooky-ladybug`   | Dépôt de l'image            |
| `image.tag`         | `1.0.0`                              | Tag de l'image              |
| `ingress.className` | `nginx`                              | Classe d'Ingress            |
| `ingress.hosts`     | `halloween.cox-anim.fr`              | Nom(s) d'hôte               |
| `ingress.tls`       | `[]`                                 | Secrets TLS                 |

## Personnaliser

- **Cadres** : la liste `FRAMES` dans [`src/app.js`](src/app.js) (titre affiché
  en haut, couleur) et les SVG dans `src/assets/frames/`. Un cadre est un SVG
  1080×1350 (et sa variante `-paysage` en 1350×1080) dont le centre est transparent ; le titre et la signature
  « Cox Animation » sont ajoutés par le code.
- **Réseaux sociaux** : l'objet `NETWORKS` dans `src/app.js` (hashtags, lien).
- **Prochain événement** : le bloc `<aside class="xmas">` dans
  [`src/index.html`](src/index.html).
- **Couleurs** : variables CSS en haut de [`src/styles.css`](src/styles.css).

## Crédits

Illustrations des cadres créées pour le projet. Polices
[Creepster](https://fonts.google.com/specimen/Creepster),
[Fredoka](https://fonts.google.com/specimen/Fredoka) et
[Nunito](https://fonts.google.com/specimen/Nunito), sous licence
[SIL Open Font License](https://openfontlicense.org).

---

Fait avec 🧡 pour **[Cox Animation](https://www.cox-anim.fr)**.
