let sf = null;
let ready = false;

function ensureEngine() {
  if (sf) return;

  // IMPORTANT: import the actual file you have
  importScripts("../stockfish/stockfish-17.1-asm-341ff22.js");

  // 17.x exposes Stockfish(), NOT STOCKFISH()
  sf = typeof Stockfish === "function" ? Stockfish() : self.Stockfish();

  sf.onmessage = (e) => {
    const line = typeof e.data === "string" ? e.data : e.data?.data;
    if (!line) return;

    if (line === "uciok") {
      // basic options
      sf.postMessage("setoption name Threads value 1");
      sf.postMessage("setoption name Hash value 16");
      sf.postMessage("setoption name Ponder value false");
      sf.postMessage("setoption name MultiPV value 1");
      sf.postMessage("setoption name Move Overhead value 50");
      sf.postMessage("setoption name Minimum Thinking Time value 100");
    }

    if (line === "readyok") {
      ready = true;
      self.postMessage({ type: "ready" });
    }

    if (line.startsWith("bestmove")) {
      const mv = line.split(/\s+/)[1] || "(none)";
      self.postMessage({ type: "bestmove", bestmove: mv });
    }
  };

  sf.postMessage("uci");
  sf.postMessage("isready");
}

function setDifficulty(level) {
  // tune ELO/Skill/Movetime to your buckets
  let skill = 2,
    elo = 600,
    movetime = 500;
  if (level === "medium") {
    skill = 6;
    elo = 900;
    movetime = 900;
  }
  if (level === "hard") {
    skill = 10;
    elo = 1200;
    movetime = 1300;
  }

  sf.postMessage("setoption name UCI_LimitStrength value true");
  sf.postMessage(`setoption name UCI_Elo value ${elo}`);
  sf.postMessage(`setoption name Skill Level value ${skill}`);

  return { movetime };
}

self.onmessage = (e) => {
  const { type, fen, level } = e.data || {};
  if (type !== "go" || !fen || !level) return;

  ensureEngine();

  const go = () => {
    const { movetime } = setDifficulty(level);
    sf.postMessage(`position fen ${fen}`);
    sf.postMessage(`go movetime ${movetime}`);
  };

  if (!ready) {
    const wait = () => (ready ? go() : setTimeout(wait, 10));
    wait();
  } else {
    go();
  }
};
