const net = require("turbo-net");
const http = require("turbo-http");
const crypto = require("crypto");
const { parse } = require("url");
const HTTP_STATUS = require("turbo-http/http-status");

// Constant used for constructing Sec-WebSocket-Accept response header
const WS_ID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

class WSServer {
  constructor({ path = "" } = {}) {
    this.server = http.createServer((req, res) => {
      if (path !== "" && parse(req.url).pathname !== path) {
        return this.abort(res, 400);
      }

      return this.handleUpgrade(req, res);
    });
  }

  handleUpgrade(req, res) {
    const headers = req.getAllHeaders();
    const version = headers.get("Sec-WebSocket-Version");
    if (
      headers.get("Host") === undefined ||
      req.method !== "GET" ||
      headers.get("Upgrade") !== "websocket" ||
      headers.get("Connection") !== "Upgrade" ||
      headers.get("Sec-WebSocket-Key") === undefined ||
      version !== "13"
    ) {
      this.abort(res, 400);
    }
    this.completeUpgade(req, res, 101);
  }

  completeUpgade(req, res, code) {
    const message = Buffer.from(HTTP_STATUS[code]);
    res.statusCode = code;
    /**
     *
     * The value of this header field is constructed by concatenating /key/,
     * defined above in step 4 in Section 4.2.2, with the string "258EAFA5-
     * E914-47DA-95CA-C5AB0DC85B11", taking the SHA-1 hash of this
     * concatenated value to obtain a 20-byte value and base64-encoding
     */
    const headerKey = req.getAllHeaders().get("Sec-WebSocket-Key");
    const key = crypto
      .createHash("sha1")
      .update(headerKey + WS_ID)
      .digest("base64");

    res.setHeader("Upgrade", "websocket");
    res.setHeader("Connection", "Upgrade");
    res.setHeader("Sec-WebSocket-Accept", key);
    res.end(message);
  }

  abort(res, code) {
    const message = Buffer.from(HTTP_STATUS[code]);
    res.statusCode = code;
    res.setHeader("Connection", "close");
    res.setHeader("Content-type", "text/html");
    res.setHeader("Content-Length", message.length);
    res.end(message);
  }

  start(port) {
    this.server.listen(port, () => {
      console.log("started ws on port", port);
    });
  }
}

new WSServer().start(8080);
