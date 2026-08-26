import { createServer } from "node:http";
import next from "next";

// Keep Next's router hostname aligned with its loopback normalization while
// preserving the production security boundary at the actual listening socket.
const routerHostname = "localhost";
const listenHost = "127.0.0.1";
const portFlagIndex = process.argv.findIndex((value) => value === "-p" || value === "--port");
const portValue = portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : process.env.PORT;
const port = Number.parseInt(portValue || "3000", 10);

const app = next({ dev: false, hostname: routerHostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => handle(request, response));
server.listen(port, listenHost, () => {
  console.log(`RentTools ready on http://${listenHost}:${port}`);
});
