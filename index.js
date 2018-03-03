const http = require("turbo-http");
const crypto = require("crypto");
const { parse } = require("url");
const HTTP_STATUS = require("turbo-http/http-status");

// Magic string used for constructing Sec-WebSocket-Accept response header
const WS_MAGIC_STRING = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

class WSServer {
  constructor({ path = "" } = {}) {
    this.server = http.createServer((req, res) => {
      if (path !== "" && parse(req.url).pathname !== path) {
        return this.abort(res, 400);
      }
      return this.handleUpgrade(req, res);
    });
    this.supportedVersion = "13";
  }

  handleUpgrade(req, res) {
    const headers = req.getAllHeaders();
    const version = headers.get("Sec-WebSocket-Version");

    // https://tools.ietf.org/html/rfc6455#section-4.4
    if (version !== this.supportedVersion) {
      return this.abort(res, 400, {
        "Sec-WebSocket-Version": this.supportedVersion
      });
    }

    if (
      headers.get("Host") === undefined ||
      req.method !== "GET" ||
      headers.get("Upgrade") !== "websocket" ||
      headers.get("Connection") !== "Upgrade" ||
      headers.get("Sec-WebSocket-Key") === undefined
    ) {
      return this.abort(res, 400);
    }
    this.completeUpgade(req, res, 101);
    // Now the connection is in open state
    this.exchange(res);
  }

  completeUpgade(req, res, code) {
    const message = Buffer.from(HTTP_STATUS[code]);
    res.statusCode = code;
    // https://tools.ietf.org/html/rfc6455#section-4.2.2
    const headerKey = req.getAllHeaders().get("Sec-WebSocket-Key");
    const key = crypto
      .createHash("sha1")
      .update(headerKey + WS_MAGIC_STRING)
      .digest("base64");

    res.setHeader("Upgrade", "websocket");
    res.setHeader("Connection", "Upgrade");
    res.setHeader("Sec-WebSocket-Accept", key);
    // Finish the handshake and do not close the connection
    res.end(Buffer.from(""), 0);
  }

  exchange(res) {
    const socket = res.socket;
    const readBuffer = Buffer.alloc(32 * 1024);
    // Start Exchanging Data Formats
    // https://tools.ietf.org/html/rfc6455#section-5.2
    socket.read(readBuffer, function onread(err, buf, read) {
      if (err) {
        throw err;
        socket.close();
      }
      socket.write(buf, read);
    });
  }

  abort(res, code, headers = {}) {
    const message = Buffer.from(HTTP_STATUS[code]);
    res.statusCode = code;
    res.setHeader("Connection", "close");
    res.setHeader("Content-type", "text/plain");
    res.setHeader("Content-Length", message.length);
    Object.keys(headers).forEach(key => {
      res.setHeader(key, headers[key]);
    });
    res.end(message);
  }

  start(port) {
    this.server.listen(port, () => {
      console.log("started ws on port", port);
    });
  }
}

new WSServer().start(8080);
