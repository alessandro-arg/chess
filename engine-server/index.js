const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---- Spawn the native engine ----
const ENGINE_PATH = path.join(
  __dirname,
  "bin",
  process.platform === "win32" ? "stockfish.exe" : "stockfish"
);

const engine = spawn(ENGINE_PATH, [], {
  stdio: ["pipe", "pipe", "inherit"],
});

const rl = readline.createInterface({ input: engine.stdout });

let uciOk = false;
let readyOk = false;
let busy = false;

const queue = [];
let current = null;

function send(cmd) {
  // console.log('>>', cmd);
  engine.stdin.write(cmd + "\n");
}

function ensureInit() {
  if (!uciOk) send("uci");
  if (uciOk && !readyOk) send("isready");
}

function setLevel(level) {
  let skill = 6,
    elo = 1200,
    movetime = 1000;
  if (level === "easy") {
    skill = 2;
    elo = 800;
    movetime = 600;
  }
  if (level === "hard") {
    skill = 15;
    elo = 1800;
    movetime = 1500;
  }

  send("setoption name UCI_LimitStrength value true");
  send(`setoption name UCI_Elo value ${elo}`);
  send(`setoption name Skill Level value ${skill}`);

  return movetime;
}

function maybeRun() {
  if (!uciOk || !readyOk || busy || queue.length === 0) return;
  busy = true;
  current = queue.shift();

  const { fen, level } = current;
  const movetime = setLevel(level);

  send(`position fen ${fen}`);
  send(`go movetime ${movetime}`);
}

rl.on("line", (line) => {
  // console.log('<<', line);
  if (line === "uciok") {
    uciOk = true;
    ensureInit();
    return;
  }
  if (line === "readyok") {
    readyOk = true;
    maybeRun();
    return;
  }
  if (line.startsWith("bestmove")) {
    const best = line.split(/\s+/)[1] || "(none)";
    if (current) {
      current.res.json({ bestmove: best });
      current = null;
    }
    busy = false;
    maybeRun();
    return;
  }
});

engine.on("error", (err) => {
  console.error("Engine failed to start:", err);
  process.exit(1);
});

engine.on("exit", (code) => {
  console.error("Engine exited with code:", code);
  process.exit(code || 1);
});

// Kick off initialization
ensureInit();

// ---- HTTP API ----
app.get("/health", (_req, res) => res.send("ok"));

app.post("/api/engine/bestmove", (req, res) => {
  const { fen, level = "medium" } = req.body || {};
  if (!fen) return res.status(400).json({ error: 'Missing "fen"' });

  queue.push({ fen, level, res });
  ensureInit();
  maybeRun();
});

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`Engine server listening on http://localhost:${PORT}`);
});
