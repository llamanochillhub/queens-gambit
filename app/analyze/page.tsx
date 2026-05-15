'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ImportPGNDialog from '@/components/ImportPGNDialog';
import MoveList from '@/components/MoveList';
import { useStockfish } from '@/hooks/useStockfish';
import {
  GameTree, emptyTree, addMove, applyUci, fenAt, parentOf,
  mainChild, mainLineEnd, toPgn,
} from '@/lib/gameTree';
import { parsePgn } from '@/lib/parsePgn';
import {
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,
  FlipVertical, Download, Clipboard, Upload, RotateCcw, Cpu,
} from 'lucide-react';
import { toast } from 'sonner';

const ChessBoard = dynamic(() => import('@/components/ChessBoard'), { ssr: false });

function scoreDisplay(score: number | null, mate: number | null, isBlackToMove: boolean): string {
  if (mate !== null) {
    const adj = isBlackToMove ? -mate : mate;
    return adj > 0 ? `M${adj}` : `-M${Math.abs(adj)}`;
  }
  if (score === null) return '—';
  const adj = isBlackToMove ? -score : score;
  const pawns = (adj / 100).toFixed(2);
  return adj > 0 ? `+${pawns}` : `${pawns}`;
}

function uciLineToPv(pv: string[], fen: string, maxMoves = 6): string {
  try {
    const { Chess } = require('chess.js');
    const c = new Chess(fen);
    return pv.slice(0, maxMoves).map((uci: string) => {
      const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
      return m ? m.san : uci;
    }).join(' ');
  } catch {
    return pv.slice(0, maxMoves).join(' ');
  }
}

export default function AnalyzePage() {
  const [tree, setTree] = useState<GameTree>(emptyTree);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [engineOn, setEngineOn] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const moveListRef = useRef<HTMLDivElement>(null);

  const currentFen = fenAt(tree, currentId);
  const isBlackToMove = currentFen.split(' ')[1] === 'b';

  const { evaluation, analyze, stop, debugLog } = useStockfish(engineOn);

  useEffect(() => {
    if (engineOn) analyze(currentFen);
  }, [currentFen, engineOn, analyze]);

  useEffect(() => {
    if (!engineOn) stop();
  }, [engineOn, stop]);

  // Scroll active move into view
  useEffect(() => {
    moveListRef.current?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentId]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft')  setCurrentId(id => parentOf(tree, id));
      if (e.key === 'ArrowRight') setCurrentId(id => mainChild(tree, id) ?? id);
      if (e.key === 'ArrowUp')    setCurrentId(null);
      if (e.key === 'ArrowDown')  setCurrentId(mainLineEnd(tree, null));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tree]);

  const handleMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
    const applied = applyUci(currentFen, uci);
    if (!applied) return;
    const ply = currentId === null ? 1 : (tree.nodes[currentId]?.ply ?? 0) + 1;
    const result = addMove(tree, currentId, uci, applied.san, applied.fen, ply);
    setTree(result.tree);
    setCurrentId(result.nodeId);
  }, [tree, currentId, currentFen]);

  const handleImport = (pgn: string) => {
    try {
      const newTree = parsePgn(pgn);
      if (newTree.rootChildIds.length === 0) throw new Error('No moves found');
      setTree(newTree);
      // Navigate to end of main line
      setCurrentId(mainLineEnd(newTree, null));
    } catch {
      toast.error('Failed to load PGN');
    }
  };

  const handleReset = () => {
    setTree(emptyTree());
    setCurrentId(null);
  };

  const exportPGN = () => {
    const pgn = toPgn(tree);
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'game.pgn'; a.click();
    URL.revokeObjectURL(url);
    toast.success('PGN downloaded');
  };

  const copyPGN = () => {
    navigator.clipboard.writeText(toPgn(tree)).then(() => toast.success('PGN copied'));
  };

  const bestLine = evaluation?.lines[0] ?? null;
  const evalBarPct = (() => {
    if (!engineOn || !bestLine) return 50;
    if (bestLine.mate !== null) return (isBlackToMove ? bestLine.mate < 0 : bestLine.mate > 0) ? 98 : 2;
    const clamped = Math.max(-1000, Math.min(1000, bestLine.score ?? 0));
    const fromWhite = isBlackToMove ? -clamped : clamped;
    return 50 + (fromWhite / 1000) * 48;
  })();

  const engineArrows =
    engineOn && evaluation?.bestMove && evaluation.bestMove.length >= 4
      ? [{ from: evaluation.bestMove.slice(0, 2), to: evaluation.bestMove.slice(2, 4) }]
      : [];

  const pgnHeaders = tree.headers;

  return (
    <div className="flex overflow-hidden h-[calc(100vh-3.5rem)]">
      <ImportPGNDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />

      {/* Vertical eval bar */}
      {engineOn && (
        <div className="w-3 flex-shrink-0 relative bg-gray-800">
          <div
            className="absolute bottom-0 left-0 w-full bg-white transition-all duration-500"
            style={{ height: `${evalBarPct}%` }}
          />
        </div>
      )}

      {/* Left panel: moves + controls */}
      <div className="w-52 flex-shrink-0 flex flex-col border-r border-border overflow-hidden">
        {(pgnHeaders.White || pgnHeaders.Black) && (
          <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground leading-snug flex-shrink-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-medium text-foreground">{pgnHeaders.White ?? '?'}</span>
              <span>vs</span>
              <span className="font-medium text-foreground">{pgnHeaders.Black ?? '?'}</span>
              {pgnHeaders.Result && <Badge variant="outline" className="text-[10px] px-1 py-0">{pgnHeaders.Result}</Badge>}
            </div>
            {pgnHeaders.Event && <div className="truncate">{pgnHeaders.Event}</div>}
            {pgnHeaders.Date && <div>{pgnHeaders.Date}</div>}
          </div>
        )}

        <div ref={moveListRef} className="flex-1 overflow-y-auto p-2 min-h-0">
          <MoveList tree={tree} currentId={currentId} onSelect={setCurrentId} />
        </div>

        <div className="flex-shrink-0 border-t border-border p-2 space-y-2">
          <div className="flex items-center justify-center gap-0.5">
            <Button size="icon" variant="ghost" onClick={() => setCurrentId(null)} title="First move"><ChevronFirst className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setCurrentId(id => parentOf(tree, id))} title="Previous"><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setCurrentId(id => mainChild(tree, id) ?? id)} title="Next"><ChevronRight className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setCurrentId(mainLineEnd(tree, null))} title="Last move"><ChevronLast className="h-4 w-4" /></Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button size="icon" variant="ghost" onClick={() => setFlipped(f => !f)} title="Flip board"><FlipVertical className="h-4 w-4" /></Button>
            <Button size="icon" variant={engineOn ? 'default' : 'ghost'} onClick={() => setEngineOn(e => !e)} title="Toggle engine"><Cpu className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-1.5 justify-center">
            <Button size="icon" variant="outline" onClick={() => setImportOpen(true)} title="Import PGN" className="h-8 w-8 rounded-full"><Upload className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="outline" onClick={exportPGN} title="Export PGN" className="h-8 w-8 rounded-full"><Download className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="outline" onClick={copyPGN} title="Copy PGN" className="h-8 w-8 rounded-full"><Clipboard className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="outline" onClick={handleReset} title="New game" className="h-8 w-8 rounded-full"><RotateCcw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center p-2">
        <div className="h-full aspect-square max-w-full">
          <ChessBoard
            fen={currentFen}
            onMove={handleMove}
            boardOrientation={flipped ? 'black' : 'white'}
            arrows={engineArrows}
          />
        </div>
      </div>

      {/* Right panel: engine */}
      <div className="w-64 flex-shrink-0 border-l border-border overflow-y-auto">
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Stockfish</span>
            <Button size="sm" variant={engineOn ? 'default' : 'outline'} onClick={() => setEngineOn(e => !e)}>
              {engineOn ? 'Engine On' : 'Engine Off'}
            </Button>
          </div>
          {!engineOn && <p className="text-sm text-muted-foreground">Enable the engine to see evaluation and top lines.</p>}
          {engineOn && !evaluation && (
            <>
              <p className="text-sm text-muted-foreground animate-pulse">Calculating…</p>
              {debugLog.length > 0 && (
                <div className="font-mono text-xs text-muted-foreground bg-muted rounded p-2 space-y-0.5 max-h-40 overflow-y-auto">
                  {debugLog.map((line, i) => <div key={i}>{line}</div>)}
                </div>
              )}
            </>
          )}
          {engineOn && evaluation && (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2 pb-1 border-b border-border">
                <span className="text-2xl font-bold font-mono">
                  {scoreDisplay(bestLine?.score ?? null, bestLine?.mate ?? null, isBlackToMove)}
                </span>
                <span className="text-xs text-muted-foreground">depth {evaluation.depth}</span>
              </div>
              <div className="space-y-1.5">
                {evaluation.lines.map((line, i) => (
                  <div key={line.multipv} className="flex gap-2 text-sm items-start">
                    <span className={`font-mono font-semibold shrink-0 w-12 ${i === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {scoreDisplay(line.score, line.mate, isBlackToMove)}
                    </span>
                    <span className={`font-mono break-words leading-snug ${i === 0 ? 'text-foreground' : 'text-muted-foreground text-xs'}`}>
                      {uciLineToPv(line.pv, currentFen, i === 0 ? 8 : 5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
