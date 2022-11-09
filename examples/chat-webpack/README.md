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

Create a new Fly application (select yes when you are asked to use
fly.toml as a template). This will update your fly.toml:

```
fly launch
```

Create a volume to persist the data in the application. When prompted,
select a region nearby your application server:

```
fly volumes create canvas_chat_data
```

Build and deploy the application:

```
npm run build
fly deploy
```
