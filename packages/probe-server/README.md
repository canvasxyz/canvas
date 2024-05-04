# @canvas-js/probe-server

Monitors uptime for an app topic using a Puppeteer headless browser, exposed via Prometheus.

## Usage

```
npm run start
```

Configure the server using environment variables:

- BOOTSTRAP_LIST: A list of multiaddrs to use as a bootstrap list. (unused)

## Troubleshooting

To connect to a running replication server, you can use the Fly console, e.g.:

```
fly ssh console --app=canvas-chat-probe
```
