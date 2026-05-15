// Stockfish Web Worker
let stockfish = null;

async function init() {
  // stockfish-18-lite-single is a self-contained JS+wasm bundle
  importScripts('/stockfish.js');
  stockfish = await Stockfish();
  stockfish.addMessageListener(function (line) {
    self.postMessage({ type: 'uci', line });
  });
  stockfish.postMessage('uci');
}

init();

self.onmessage = function (e) {
  if (stockfish) {
    stockfish.postMessage(e.data);
  }
};
