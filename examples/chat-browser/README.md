# canvas-chat-browser

### Deployment

Set up CLI for Cloudflare Pages:

```
npm install -g wrangler
wrangler login
```

Build:

```
npm run build
```

Deploy:

```
CLOUDFLARE_ACCOUNT_ID=[...] npx wrangler pages publish dist
```
