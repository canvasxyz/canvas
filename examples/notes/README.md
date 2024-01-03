# Canvas - Notes, Webpack Version

Installation:

```
pnpm i
```

Running:

```
pnpm run dev
```

Running in production with peering:

```
pnpm run build
pnpm run start
```

Deploying to Fly.io:

First, install [flyctl](https://fly.io/docs/speedrun/) and make sure
you are logged in.

Create a new Fly application (select yes when you are asked to use
fly.toml as a template). Don't deploy the application immediately
if you are asked to. This will update your fly.toml:

```
fly launch
```

Create a volume to persist the data in the application. When prompted,
select a region near your application server:

```
fly volumes create canvas_notes_data
```

Build and deploy the application:

```
pnpm run build
fly deploy
```
