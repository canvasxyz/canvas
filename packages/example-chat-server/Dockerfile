FROM node:16
RUN npm install -g @canvas-js/cli
ADD spec.canvas.js $HOME
CMD ["canvas", "run", "./spec.canvas.js", "--datadir", "/data"]