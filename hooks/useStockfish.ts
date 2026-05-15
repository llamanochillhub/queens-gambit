'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface LineEval {
  multipv: number;
  score: number | null;
  mate: number | null;
  depth: number;
  pv: string[];
}

export interface EngineEval {
  lines: LineEval[];
  depth: number;
  bestMove: string;
}

export function useStockfish(enabled: boolean) {
  const workerRef = useRef<Worker | null>(null);
  const [evaluation, setEvaluation] = useState<EngineEval | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const pendingFen = useRef<string | null>(null);
  const isRunning = useRef(false);
  const linesRef = useRef<Record<number, LineEval>>({});

  useEffect(() => {
    if (!enabled) return;

    const worker = new Worker('/stockfish.js');
    workerRef.current = worker;

    const log = (msg: string) => setDebugLog(prev => [...prev.slice(-20), msg]);

    const startAnalysis = (fen: string) => {
      linesRef.current = {};
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage('go infinite');
      isRunning.current = true;
    };

    worker.onerror = (err) => {
      log('ERROR: ' + err.message);
      isRunning.current = false;
    };

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data;
      if (!line || typeof line !== 'string') return;

      if (!line.startsWith('info')) log(line.slice(0, 80));

      if (line === 'uciok') {
        worker.postMessage('setoption name MultiPV value 5');
        worker.postMessage('isready');
      } else if (line === 'readyok') {
        setIsReady(true);
        if (pendingFen.current) {
          startAnalysis(pendingFen.current);
          pendingFen.current = null;
        }
      } else if (line.startsWith('info') && line.includes(' score ') && line.includes(' pv ')) {
        const depthMatch = line.match(/\bdepth (\d+)/);
        const multipvMatch = line.match(/\bmultipv (\d+)/);
        const scoreMatch = line.match(/\bscore cp (-?\d+)/);
        const mateMatch = line.match(/\bscore mate (-?\d+)/);
        const pvMatch = line.match(/ pv (.+)/);

        const depth = depthMatch ? parseInt(depthMatch[1]) : 0;
        if (depth < 5) return;

        const multipv = multipvMatch ? parseInt(multipvMatch[1]) : 1;
        const pv = pvMatch ? pvMatch[1].trim().split(' ') : [];

        const lineEval: LineEval = {
          multipv,
          score: scoreMatch ? parseInt(scoreMatch[1]) : null,
          mate: mateMatch ? parseInt(mateMatch[1]) : null,
          depth,
          pv,
        };

        linesRef.current = { ...linesRef.current, [multipv]: lineEval };

        if (multipv === 1) {
          const lines = Object.values(linesRef.current).sort((a, b) => a.multipv - b.multipv);
          setEvaluation({ lines, depth, bestMove: pv[0] ?? '' });
        }
      } else if (line.startsWith('bestmove')) {
        isRunning.current = false;
        const move = line.split(' ')[1];
        if (move && move !== '(none)') {
          setEvaluation(prev =>
            prev ? { ...prev, bestMove: move } : { lines: [], depth: 0, bestMove: move }
          );
        }
        // If analyze() was called while engine was running, start it now
        if (pendingFen.current) {
          startAnalysis(pendingFen.current);
          pendingFen.current = null;
        }
      }
    };

    worker.postMessage('uci');

    return () => {
      worker.postMessage('quit');
      worker.terminate();
      workerRef.current = null;
      setIsReady(false);
      setEvaluation(null);
      isRunning.current = false;
    };
  }, [enabled]);

  const analyze = useCallback((fen: string) => {
    const worker = workerRef.current;
    if (!worker) return;
    if (!isReady) {
      pendingFen.current = fen;
      return;
    }
    setEvaluation(null);
    if (isRunning.current) {
      // Queue the new FEN and stop the engine; startAnalysis fires in the bestmove handler
      pendingFen.current = fen;
      worker.postMessage('stop');
    } else {
      linesRef.current = {};
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage('go infinite');
      isRunning.current = true;
    }
  }, [isReady]);

  const stop = useCallback(() => {
    if (isRunning.current) {
      workerRef.current?.postMessage('stop');
      isRunning.current = false;
    }
  }, []);

  return { evaluation, isReady, analyze, stop, debugLog };
}
