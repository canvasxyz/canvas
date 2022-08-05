# Canvas - Chat Server

This is an example package for deploying a Canvas spec to Fly.io, or other hosted services.

### Developing

1. Install the Canvas CLI with `npm install -g @canvas-js/cli`.
2. Start a local Canvas node with `canvas run spec.canvas.js`.

### Deploying to Fly.io

1. Install [flyctl](https://fly.io/docs/speedrun/) and make sure you are logged in.
2. Inside `fly.toml`, change `app` to your app name.
3. Run `fly volumes create canvas_example_chat_data --size 3` to create a 3GB storage volume.
4. Run `flyctl deploy`.

### Deploying to Heroku

1. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) and make sure you're logged in.
2. Run `heroku create` and provide an app name.
3. Initialize this current directory as a git repo: `git init`
4. Add the git remote for deployment: `heroku git:remote --app [name]`
5. Add a Postgres database: `heroku addons:create heroku-postgresql:hobby-dev`
6. Commit the application: `git add . && git commit -m "initial commit"`
7. Run `git push heroku main` to deploy.


(c) 2022 Canvas Technology Corporation
