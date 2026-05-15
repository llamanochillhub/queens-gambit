'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface EngineEval {
  score: number | null; // centipawns, null if mate
  mate: number | null;  // moves to mate
  depth: number;
  bestMove: string;
  pv: string[];         // principal variation in UCI
}

export function useStockfish(enabled: boolean) {
  const workerRef = useRef<Worker | null>(null);
  const [evaluation, setEvaluation] = useState<EngineEval | null>(null);
  const [isReady, setIsReady] = useState(false);
  const pendingFen = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const worker = new Worker('/stockfish.worker.js');
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const line: string = typeof e.data === 'string' ? e.data : e.data?.line;
      if (!line) return;

      if (line === 'uciok') {
        worker.postMessage('isready');
      } else if (line === 'readyok') {
        setIsReady(true);
        if (pendingFen.current) {
          analyzePosition(pendingFen.current, worker);
          pendingFen.current = null;
        }
      } else if (line.startsWith('info') && line.includes('score') && line.includes('pv')) {
        const depthMatch = line.match(/depth (\d+)/);
        const scoreMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const pvMatch = line.match(/ pv (.+)/);
        const depth = depthMatch ? parseInt(depthMatch[1]) : 0;
        if (depth < 6) return; // skip shallow results
        const pv = pvMatch ? pvMatch[1].trim().split(' ') : [];
        setEvaluation({
          score: scoreMatch ? parseInt(scoreMatch[1]) : null,
          mate: mateMatch ? parseInt(mateMatch[1]) : null,
          depth,
          bestMove: pv[0] ?? '',
          pv,
        });
      } else if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        const move = parts[1];
        if (move && move !== '(none)') {
          setEvaluation(prev =>
            prev ? { ...prev, bestMove: move } : { score: null, mate: null, depth: 0, bestMove: move, pv: [move] }
          );
        }
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      setIsReady(false);
    };
  }, [enabled]);

  const analyzePosition = useCallback((fen: string, worker?: Worker) => {
    const w = worker ?? workerRef.current;
    if (!w) return;
    w.postMessage('stop');
    w.postMessage(`position fen ${fen}`);
    w.postMessage('go depth 20');
  }, []);

  const analyze = useCallback((fen: string) => {
    if (!isReady) {
      pendingFen.current = fen;
      return;
    }
    setEvaluation(null);
    analyzePosition(fen);
  }, [isReady, analyzePosition]);

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop');
  }, []);

  return { evaluation, isReady, analyze, stop };
}
