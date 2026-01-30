import express from "express";
import { getMessageData, insertMessage, insertNotification } from "./database.js";
import dotenv from "dotenv";
import cors from "cors";
import { rateLimit } from "express-rate-limit";

dotenv.config({ quiet: true });
const DEV_ENV = process.env.DEV_ENV;
const NTFY_FURSHARK_API = process.env.NTFY_FURSHARK_API;
const NTFY_MOBILE = process.env.NTFY_MOBILE;

const app = express();
const port = 3000;
app.use(express.json());
app.use(cors());
app.set("trust proxy", 1);

if (!NTFY_FURSHARK_API) {
  throw new Error("No NTFY_FURSHARK_API env variable!");
} else if (!NTFY_MOBILE) {
  throw new Error("No NTFY_MOBILE env variable!");
}

if (!DEV_ENV) {
  const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
    standardHeaders: "draft-8", // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
    // store: ... , // Redis, Memcached, etc. See below.
  });

  app.use(limiter);
}

async function notify(url: string, msg: string) {
  let resp = await fetch(url, {
    method: "POST", // PUT works too
    body: msg,
    headers: { "Content-Type": "text/plain", "User-Agent": "vercel-serverless" },
  });

  if (!resp.ok) {
    throw new Error(
      `Error trying to send ntfy.sh notification (${resp.status}). ${await resp.json()}`,
    );
  }
}

app.get("/", (req, res): void => {
  res.json("Hello, api! Now on a Raspberry Pi3!");
});

app.get("/guestbook", (req, res) => {
  getMessageData().then((response) => {
    res.json(response);
  });
});

app.post("/guestbook", async (req, res) => {
  if (!req.body) {
    res.status(400).json("ERROR: request has no body");
    return;
  }

  if (!req.body.name) {
    res.status(400).json("ERROR: missing `name`");
    return;
  }

  if (!req.body.content) {
    res.status(400).json("ERROR: missing `content`");
    return;
  }

  const { name, content } = req.body;
  let reply_to = null;
  if (req.body.reply_to) {
    reply_to = Number(req.body.reply_to);
  }
  let site = null;
  if (req.body.site) {
    try {
      site = new URL(req.body.site).toString();
    } catch {
      res.status(400).json("ERROR: invalid site url");
      return;
    }
  }

  await insertMessage(name, content, reply_to, site);
  await notify(
    NTFY_FURSHARK_API,
    `[${new Date().toLocaleDateString()}] New guestbook comment by "${name}"`,
  );
  res.sendStatus(200);
});

app.post("/ntfy", async (req, res) => {
  if (!req.body) {
    res.status(400).json("ERROR: request has no body");
    console.log(req.body);
    return;
  }

  if (!req.body) {
    res.status(400).json("ERROR: missing `text`");
    console.log(req.body);
    return;
  }

  await insertNotification(req.body.text);
  await notify(NTFY_MOBILE, req.body.text);
  res.sendStatus(200);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Listening on port http://localhost:${port}`);
});

export default app;
