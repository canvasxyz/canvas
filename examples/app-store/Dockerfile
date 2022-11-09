FROM node:16
RUN npm install -g @canvas-js/cli foreman serve ipfs-only-hash
ADD spec.canvas.js $HOME
ADD Procfile $HOME
RUN mkdir dist -p $HOME
COPY dist $HOME/dist
ENTRYPOINT ["nf", "start"]
