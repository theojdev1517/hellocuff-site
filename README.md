# HelloCuff UAT frontend source

This branch checkpoints the reviewed sales site and customer portal frontend. The repository's `main` branch retains the original coming-soon site and remains the GitHub Pages source. This branch adds no publishing workflow and does not deploy production.

The relative `portal/`, `website/` and `legal/` layout is intentional. The functions directory here contains only shared validation/catalog data; the privileged API, business records and deployment tooling remain outside this public export. The current backend and Firebase configuration are required to use account features on the authorized UAT host.

From `portal/`, with Node22 or newer:

```powershell
npm ci
$env:HELLOCUFF_PHOTO_STORAGE_BUCKET="hellocuff-e8dec.firebasestorage.app"
npm run build
```

The build reads public Firebase initialization metadata, forces the isolated UAT entry and noindex, and writes `uat-build/`. It does not publish. No payments or real orders are enabled; no credentials are included.

Legal sources retain owner-supplied placeholders pending launch details. Production release, payment integration and GitHub Pages changes require their own review.
