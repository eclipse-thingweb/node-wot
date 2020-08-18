FROM node:12.16.1-alpine3.11 as BUILD

RUN apk add --no-cache \
	gcc \
    g++ \
	make \
    linux-headers \
    udev \
    python3

ARG BUILD_ENV=development

WORKDIR /home/node/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build  \
    && if [ "${BUILD_ENV}" = "production" ]; then node_modules/.bin/lerna exec "npm prune --production"; fi 

FROM node:12.16.1-alpine3.11

COPY --from=BUILD  /home/node/app/packages/cli /usr/local/lib/node_modules/@node-wot/cli
COPY --from=BUILD  /home/node/app/packages/td-tools /usr/local/lib/node_modules/@node-wot/td-tools
COPY --from=BUILD  /home/node/app/packages/core /usr/local/lib/node_modules/@node-wot/core
COPY --from=BUILD  /home/node/app/packages/binding-http /usr/local/lib/node_modules/@node-wot/binding-http
COPY --from=BUILD  /home/node/app/packages/binding-file /usr/local/lib/node_modules/@node-wot/binding-file
COPY --from=BUILD  /home/node/app/packages/binding-mqtt /usr/local/lib/node_modules/@node-wot/binding-mqtt
COPY --from=BUILD  /home/node/app/packages/binding-coap /usr/local/lib/node_modules/@node-wot/binding-coap
COPY --from=BUILD  /home/node/app/packages/binding-websockets /usr/local/lib/node_modules/@node-wot/binding-websockets


WORKDIR /usr/local/lib/node_modules/@node-wot/cli

EXPOSE 8080

ENTRYPOINT [ "node", "dist/cli.js" ]
CMD [ "-h" ]