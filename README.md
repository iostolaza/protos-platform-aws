# Protos Platform (Admin + Portal)

Nx monorepo with two Angular apps and a shared `@ui` library, backed by Amplify Gen 2.

## Run tasks

Admin dev server (port 4200):

```sh
npm run dev:admin
```

Portal dev server (port 4201):

```sh
npm run dev:portal
```

Production builds:

```sh
npx nx build admin --configuration=production
npx nx build portal --configuration=production
```

Lint and test:

```sh
npx nx run-many -t lint test build
```

## Backend

Deploy the Amplify sandbox:

```sh
npx ampx sandbox --once --profile amplify-admin
```

Sync `amplify_outputs.json` into each app after deploy:

```sh
npm run sync-amplify:admin
npm run sync-amplify:portal
```
