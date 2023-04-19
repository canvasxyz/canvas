# Canvas - Chat App, Advanced

This is an example web app using Canvas for more advanced functionality.

Currently, all this app does is import data from the previous chat apps.

### Setting up

```
npm i
```

### Run in offline development mode

```
npm run dev
```

Open the app at http://localhost:3000/. The API will run at
http://localhost:8000.

### Run in online production mode

```
npm run build
npm run start
```

This will enable peering.

### Deploying to Fly.io

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
fly volumes create data
```

Build and deploy the application:

```
npm run build
fly deploy
```

In case of issues, you may have to restart the app manually:

```
fly apps restart canvas-chat-3
```