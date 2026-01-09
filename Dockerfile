FROM docker.io/library/node:18-alpine as BUILD
RUN apk add --no-cache \
	gcc \
    g++ \
	make \
    linux-headers \
    udev \
    python3

## change it to maintain all the dev dependencies
ARG BUILD_ENV=production
WORKDIR /app
COPY ./package.json ./
COPY ./package-lock.json ./
COPY ./tsconfig.json ./
COPY ./packages packages/

RUN npm install && npm run build

# now remove dev dependencies by reinstalling for production
# this wil reduce the size of the image built in next steps significantly
RUN if [ "${BUILD_ENV}" = "production" ]; then npm prune --production; fi

FROM docker.io/library/node:18-alpine

COPY --from=BUILD  /app /app

WORKDIR /app/packages/cli

EXPOSE 8080/tcp
EXPOSE 5683/udp

STOPSIGNAL SIGINT

ENTRYPOINT [ "node", "dist/cli.js" ]
CMD [ "-h" ]

##  docker build -t node-wot ./docker/Dockerfile
