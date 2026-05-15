importScripts('/stockfish.js');

var sf = null;

Stockfish().then(function (engine) {
  sf = engine;
  engine.addMessageListener(function (line) {
    postMessage(line); // plain string, not an object
  });
  engine.postMessage('uci');
});

onmessage = function (e) {
  if (sf) {
    sf.postMessage(e.data);
  }
};
