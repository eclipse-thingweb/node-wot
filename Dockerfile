FROM node:12.16.1-alpine3.11

RUN apk add --no-cache \
	gcc \
    g++ \
	make \
    linux-headers \
    udev \
    python2

ARG BUILD_ENV=development

WORKDIR /home/node/app

COPY . .

RUN npm install \
    && npm run build \
    && if [ "${BUILD_ENV}" = "production" ]; then node_modules/.bin/lerna exec "npm prune --production"; fi \
    && npm run link

EXPOSE 8080

ENTRYPOINT [ "wot-servient" ]
CMD [ "-h" ]