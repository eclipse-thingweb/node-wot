# Counter Thing

A Web of Things (WoT) Counter Thing implementation for the test-things infrastructure.

## Structure

```
counter-thing/
├── .dockerignore
├── Dockerfile
├── README.md
├── package.json
├── tsconfig.json
├── .env (not committed)
├── counter-thing.td.json
├── src/
│   └── main.ts
└── test/
```

## Features

- Counter with increment, decrement, and reset actions
- Observable properties
- Multi-language support (en, de, it)
- Image properties (SVG and PNG)
- Event emission
- Logging with Winston and Loki
- Docker support

## Prerequisites

- Node.js 18 or later
- npm 8 or later
- Docker (for containerized deployment)

## Environment Variables

The following environment variables can be configured (see `.env`):

- `PORT`: The port number to run the server on (default: 3000)
- `HOSTNAME`: The hostname to bind to (default: localhost)
- `LOKI_HOSTNAME`: The Loki hostname for logging (default: localhost)
- `LOKI_PORT`: The Loki port for logging (default: 3100)

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Building

1. Build the TypeScript code:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Docker Deployment

1. Build the Docker image:
   ```bash
   docker build -t counter-thing .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 \
     -e PORT=3000 \
     -e HOSTNAME=0.0.0.0 \
     -e LOKI_HOSTNAME=loki \
     -e LOKI_PORT=3100 \
     counter-thing
   ```

## Thing Description

The Thing Description for this counter is in `counter-thing.td.json`.

## Testing

The Thing can be tested using any WoT client. Here's an example using curl:

1. Get the Thing Description:
   ```bash
   curl http://localhost:3000/counter
   ```

2. Read the count property:
   ```bash
   curl http://localhost:3000/counter/properties/count
   ```

3. Increment the counter:
   ```bash
   curl -X POST http://localhost:3000/counter/actions/increment
   ```

4. Increment with a custom step:
   ```bash
   curl -X POST "http://localhost:3000/counter/actions/increment?step=5"
   ```

## License

This project is licensed under the Eclipse Public License v. 2.0 and the W3C Software Notice and Document License (2015-05-13).
