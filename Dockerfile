# Dockerfile to run jinrou in a docker container.
FROM node:8
MAINTAINER uhyo
# define work directory
WORKDIR /jinrou
ENV SS_ENV=production
ENV NODE_ENV=production
ARG APP_CONFIG=config/app-image.coffee
# First, install dependencies.
# COPY ./package.json ./package-lock.json ./
# COPY ./node_modules ./node_modules/
COPY ./package.json ./package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com/ \
 && npm config set strict-ssl false \
 && npm install --production --no-audit --no-fund
# copy source files.
COPY ./prizedata ./prizedata/
COPY ./public ./public/
COPY ./config ./config/
COPY ./${APP_CONFIG} ./config/app.coffee
COPY ./app.js ./
COPY ./manual ./manual/
COPY ./client ./client/
COPY ./server ./server/
COPY ./language ./language/
RUN mkdir -p /jinrou/client/static/assets \
 && chown -R node:node /jinrou/client/static/assets
# expose to webserver.
VOLUME ["/jinrou/client/static/", "/jinrou/public/"]
# specify user to run the app.
USER node
# expose default port.
EXPOSE 8800
# define command.
CMD ["node", "app.js"]
