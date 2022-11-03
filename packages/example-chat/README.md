# Canvas - Chat Client

This is an example web app using Canvas for a backend and Webpack on
the front-end.

### Setting up

```
npm i
npm install -g @canvas-js/cli
```

### Developing

```
npm run dev
```

Open the app at http://localhost:8080/. The API will run at
http://localhost:8000/.

### Deploying to Fly.io

First, install [flyctl](https://fly.io/docs/speedrun/) and make sure
you are logged in.

Either run `fly launch` to create a new app (select yes when you are
asked to use fly.toml as a template), or in fly.toml, change `app` to
the name of a Fly application in your account.

```
npm run build
fly deploy
```
