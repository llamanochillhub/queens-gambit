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
  const pendingFen = useRef<string | null>(null);
  const linesRef = useRef<Record<number, LineEval>>({});

  useEffect(() => {
    if (!enabled) return;

    // Load stockfish.js directly as the worker — it self-initialises when the
    // hash contains ",worker". Commands sent before wasm loads are queued internally.
    const worker = new Worker('/stockfish.js#/stockfish.wasm,worker');
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data;
      if (!line || typeof line !== 'string') return;

      if (line === 'uciok') {
        worker.postMessage('setoption name MultiPV value 5');
        worker.postMessage('isready');
      } else if (line === 'readyok') {
        setIsReady(true);
        if (pendingFen.current) {
          doAnalyze(pendingFen.current, worker);
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
        const move = line.split(' ')[1];
        if (move && move !== '(none)') {
          setEvaluation(prev =>
            prev ? { ...prev, bestMove: move } : { lines: [], depth: 0, bestMove: move }
          );
        }
      }
    };

    // Send uci immediately — queued internally until wasm is ready
    worker.postMessage('uci');

    return () => {
      worker.postMessage('quit');
      worker.terminate();
      workerRef.current = null;
      setIsReady(false);
      setEvaluation(null);
    };
  }, [enabled]);

  const doAnalyze = (fen: string, worker: Worker) => {
    linesRef.current = {};
    worker.postMessage('stop');
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage('go infinite');
  };

  const analyze = useCallback((fen: string) => {
    const worker = workerRef.current;
    if (!worker) return;
    if (!isReady) {
      pendingFen.current = fen;
      return;
    }
    setEvaluation(null);
    doAnalyze(fen, worker);
  }, [isReady]);

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop');
  }, []);

  return { evaluation, isReady, analyze, stop };
}
