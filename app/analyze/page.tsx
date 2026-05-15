'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import ImportPGNDialog from '@/components/ImportPGNDialog';
import { useStockfish } from '@/hooks/useStockfish';
import {
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,
  FlipVertical, Download, Clipboard, Upload, RotateCcw, Cpu,
} from 'lucide-react';
import { toast } from 'sonner';

const ChessBoard = dynamic(() => import('@/components/ChessBoard'), { ssr: false });

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface MoveNode {
  fen: string;
  san: string;
  uci: string;
}

function buildMoveList(history: ReturnType<Chess['history']> & { verbose: true }[]): MoveNode[] {
  const nodes: MoveNode[] = [];
  const temp = new Chess();
  (history as any[]).forEach((m: any) => {
    temp.move(m);
    nodes.push({ fen: temp.fen(), san: m.san, uci: `${m.from}${m.to}${m.promotion ?? ''}` });
  });
  return nodes;
}

function scoreDisplay(score: number | null, mate: number | null, isBlackToMove: boolean): string {
  if (mate !== null) {
    const adjusted = isBlackToMove ? -mate : mate;
    return adjusted > 0 ? `M${adjusted}` : `-M${Math.abs(adjusted)}`;
  }
  if (score === null) return '—';
  const adjusted = isBlackToMove ? -score : score;
  const pawns = (adjusted / 100).toFixed(2);
  return adjusted > 0 ? `+${pawns}` : `${pawns}`;
}

function uciLineToPv(pv: string[], fen: string): string {
  try {
    const c = new Chess(fen);
    return pv.slice(0, 6).map(uci => {
      const m = c.move({ from: uci.slice(0, 2) as any, to: uci.slice(2, 4) as any, promotion: uci[4] as any });
      return m ? m.san : uci;
    }).join(' ');
  } catch {
    return pv.slice(0, 6).join(' ');
  }
}

export default function AnalyzePage() {
  // Full game tree stored as an array of UCI moves
  const [uciMoves, setUciMoves] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 = start
  const [moves, setMoves] = useState<MoveNode[]>([]);
  const [pgnHeaders, setPgnHeaders] = useState<Record<string, string>>({});
  const [flipped, setFlipped] = useState(false);
  const [engineOn, setEngineOn] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const moveListRef = useRef<HTMLDivElement>(null);

  // Rebuild moves whenever uciMoves changes
  useEffect(() => {
    const chess = new Chess();
    const verbose: any[] = [];
    for (const uci of uciMoves) {
      const m = chess.move({ from: uci.slice(0, 2) as any, to: uci.slice(2, 4) as any, promotion: uci[4] as any });
      if (m) verbose.push(m);
    }
    setMoves(buildMoveList(verbose));
  }, [uciMoves]);

  const currentFen = currentIndex === -1 ? START_FEN : (moves[currentIndex]?.fen ?? START_FEN);
  const isBlackToMove = currentFen.split(' ')[1] === 'b';

  const { evaluation, analyze, stop } = useStockfish(engineOn);

  useEffect(() => {
    if (engineOn) analyze(currentFen);
  }, [currentFen, engineOn, analyze]);

  useEffect(() => {
    if (!engineOn) stop();
  }, [engineOn, stop]);

  // Scroll active move into view
  useEffect(() => {
    const el = moveListRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(-1, Math.min(moves.length - 1, index)));
  }, [moves.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft') setCurrentIndex(i => Math.max(-1, i - 1));
      if (e.key === 'ArrowRight') setCurrentIndex(i => Math.min(moves.length - 1, i + 1));
      if (e.key === 'ArrowUp') setCurrentIndex(-1);
      if (e.key === 'ArrowDown') setCurrentIndex(moves.length - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [moves.length]);

  const handleMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
    // Truncate any moves after current index, then append
    setUciMoves(prev => [...prev.slice(0, currentIndex + 1), uci]);
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex]);

  const handleImport = (pgn: string) => {
    try {
      const c = new Chess();
      c.loadPgn(pgn);
      const history = c.history({ verbose: true });
      const newUci = history.map((m: any) => `${m.from}${m.to}${m.promotion ?? ''}`);
      setUciMoves(newUci);
      const rawHeaders = c.header() as Record<string, string | null>;
      const cleanHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawHeaders)) {
        if (v != null) cleanHeaders[k] = v;
      }
      setPgnHeaders(cleanHeaders);
      setCurrentIndex(newUci.length - 1);
    } catch {
      toast.error('Failed to load PGN');
    }
  };

  const handleReset = () => {
    setUciMoves([]);
    setMoves([]);
    setCurrentIndex(-1);
    setPgnHeaders({});
  };

  const getPGN = () => {
    const c = new Chess();
    Object.entries(pgnHeaders).forEach(([k, v]) => c.header(k, v));
    for (const uci of uciMoves) {
      c.move({ from: uci.slice(0, 2) as any, to: uci.slice(2, 4) as any, promotion: uci[4] as any });
    }
    return c.pgn({ maxWidth: 80, newline: '\n' });
  };

  const exportPGN = () => {
    const pgn = getPGN();
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game.pgn';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('PGN downloaded');
  };

  const copyPGN = () => {
    navigator.clipboard.writeText(getPGN()).then(() => toast.success('PGN copied to clipboard'));
  };

  const evalBarPct = (() => {
    if (!engineOn || !evaluation) return 50;
    if (evaluation.mate !== null) return evaluation.mate > 0 ? 98 : 2;
    const clamped = Math.max(-1000, Math.min(1000, evaluation.score ?? 0));
    return 50 + (clamped / 1000) * 48;
  })();

  const engineArrows =
    engineOn && evaluation && evaluation.bestMove && evaluation.bestMove.length >= 4
      ? [{ from: evaluation.bestMove.slice(0, 2), to: evaluation.bestMove.slice(2, 4) }]
      : [];

  return (
    <div className="flex flex-col h-full">
      <ImportPGNDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />

      {/* Game header strip */}
      {(pgnHeaders.White || pgnHeaders.Black) && (
        <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground">{pgnHeaders.White ?? '?'}</span>
          <span>vs</span>
          <span className="font-medium text-foreground">{pgnHeaders.Black ?? '?'}</span>
          {pgnHeaders.Result && <Badge variant="outline">{pgnHeaders.Result}</Badge>}
          {pgnHeaders.Event && <span>— {pgnHeaders.Event}</span>}
          {pgnHeaders.Date && <span>{pgnHeaders.Date}</span>}
        </div>
      )}

      <div className="flex flex-1 flex-col lg:flex-row gap-4 p-4 min-h-0">
        {/* Board column */}
        <div className="flex flex-col items-center gap-3 w-full lg:w-auto lg:max-w-[min(60vh,580px)]">
          {/* Eval bar */}
          {engineOn && (
            <div className="w-full h-3 rounded-full bg-gray-800 relative overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-white transition-all duration-300"
                style={{ width: `${evalBarPct}%` }}
              />
              {evaluation && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-400 select-none leading-none">
                  {scoreDisplay(evaluation.score, evaluation.mate, isBlackToMove)} d{evaluation.depth}
                </span>
              )}
            </div>
          )}

          <div className="w-full aspect-square">
            <ChessBoard
              fen={currentFen}
              onMove={handleMove}
              boardOrientation={flipped ? 'black' : 'white'}
              arrows={engineArrows}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <Button size="icon" variant="ghost" onClick={() => goTo(-1)} title="First"><ChevronFirst className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => goTo(currentIndex - 1)} title="Prev"><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => goTo(currentIndex + 1)} title="Next"><ChevronRight className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => goTo(moves.length - 1)} title="Last"><ChevronLast className="h-4 w-4" /></Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button size="icon" variant="ghost" onClick={() => setFlipped(f => !f)} title="Flip board"><FlipVertical className="h-4 w-4" /></Button>
            <Button size="icon" variant={engineOn ? 'default' : 'ghost'} onClick={() => setEngineOn(e => !e)} title="Engine"><Cpu className="h-4 w-4" /></Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="gap-1"><Upload className="h-3.5 w-3.5" />Import</Button>
            <Button size="sm" variant="outline" onClick={handleReset} className="gap-1"><RotateCcw className="h-3.5 w-3.5" />New</Button>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          <Tabs defaultValue="moves" className="flex-1 flex flex-col">
            <TabsList className="w-full">
              <TabsTrigger value="moves" className="flex-1">Moves</TabsTrigger>
              <TabsTrigger value="engine" className="flex-1">Engine</TabsTrigger>
              <TabsTrigger value="export" className="flex-1">Export</TabsTrigger>
            </TabsList>

            <TabsContent value="moves" className="flex-1 overflow-hidden flex flex-col mt-0">
              <div ref={moveListRef} className="flex-1 overflow-y-auto rounded-md border border-border p-2 mt-2 min-h-[200px]">
                {moves.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Make a move or import a PGN to get started.
                  </p>
                ) : (
                  <div className="font-mono text-sm">
                    {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => {
                      const wi = i * 2;
                      const bi = i * 2 + 1;
                      return (
                        <div key={i} className="flex items-center gap-1 rounded px-1 py-0.5">
                          <span className="text-muted-foreground w-7 shrink-0 select-none text-xs">{i + 1}.</span>
                          <button
                            data-active={currentIndex === wi ? 'true' : 'false'}
                            onClick={() => goTo(wi)}
                            className="px-2 py-0.5 rounded hover:bg-accent transition-colors data-[active=true]:bg-primary data-[active=true]:text-primary-foreground min-w-[3.5rem] text-left"
                          >
                            {moves[wi].san}
                          </button>
                          {moves[bi] && (
                            <button
                              data-active={currentIndex === bi ? 'true' : 'false'}
                              onClick={() => goTo(bi)}
                              className="px-2 py-0.5 rounded hover:bg-accent transition-colors data-[active=true]:bg-primary data-[active=true]:text-primary-foreground min-w-[3.5rem] text-left"
                            >
                              {moves[bi].san}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="engine" className="flex-1 mt-0">
              <div className="rounded-md border border-border p-4 mt-2 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Stockfish</span>
                  <Button size="sm" variant={engineOn ? 'default' : 'outline'} onClick={() => setEngineOn(e => !e)}>
                    {engineOn ? 'On' : 'Off'}
                  </Button>
                </div>
                {!engineOn && <p className="text-sm text-muted-foreground">Enable to see evaluation and best moves.</p>}
                {engineOn && !evaluation && <p className="text-sm text-muted-foreground animate-pulse">Calculating…</p>}
                {engineOn && evaluation && (
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold font-mono">
                        {scoreDisplay(evaluation.score, evaluation.mate, isBlackToMove)}
                      </span>
                      <span className="text-xs text-muted-foreground">depth {evaluation.depth}</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Best line</p>
                      <p className="font-mono text-sm bg-muted rounded px-2 py-1.5 break-words">
                        {uciLineToPv(evaluation.pv, currentFen)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="export" className="flex-1 mt-0">
              <div className="rounded-md border border-border p-4 mt-2 space-y-3">
                <p className="text-sm text-muted-foreground">Export the current game as PGN.</p>
                <pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto max-h-52 whitespace-pre-wrap leading-relaxed">
                  {moves.length ? getPGN() : '(no moves yet)'}
                </pre>
                <div className="flex gap-2">
                  <Button onClick={exportPGN} className="flex-1 gap-1.5"><Download className="h-4 w-4" />Download .pgn</Button>
                  <Button onClick={copyPGN} variant="outline" className="flex-1 gap-1.5"><Clipboard className="h-4 w-4" />Copy</Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
