'use client';

import { useState, useRef } from 'react';
import { Chess } from 'chess.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ImportPGNDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (pgn: string) => void;
}

function splitPGNGames(raw: string): string[] {
  // Split on [Event boundaries
  const chunks = raw.split(/(?=\[Event\s)/).map(s => s.trim()).filter(Boolean);
  return chunks.length ? chunks : [raw.trim()];
}

function parseHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const regex = /\[(\w+)\s+"([^"]*)"\]/g;
  let m;
  while ((m = regex.exec(pgn)) !== null) {
    headers[m[1]] = m[2];
  }
  return headers;
}

export default function ImportPGNDialog({ open, onClose, onImport }: ImportPGNDialogProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [games, setGames] = useState<string[]>([]);
  const [step, setStep] = useState<'input' | 'select'>('input');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText('');
    setError('');
    setGames([]);
    setStep('input');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validate = (pgn: string): boolean => {
    try {
      const c = new Chess();
      c.loadPgn(pgn);
      return true;
    } catch {
      return false;
    }
  };

  const handleParse = () => {
    setError('');
    const raw = text.trim();
    if (!raw) { setError('Please paste a PGN or upload a file.'); return; }

    const chunks = splitPGNGames(raw);
    if (chunks.length > 1) {
      const valid = chunks.filter(validate);
      if (valid.length === 0) { setError('No valid games found in the file.'); return; }
      setGames(valid);
      setStep('select');
    } else {
      if (!validate(raw)) { setError('Invalid PGN — check the format and try again.'); return; }
      onImport(raw);
      handleClose();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText((ev.target?.result as string) ?? '');
    reader.readAsText(file);
  };

  const handleSelectGame = (pgn: string) => {
    onImport(pgn);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import PGN</DialogTitle>
          <DialogDescription>
            Paste PGN text or upload a .pgn file. Multi-game files are supported.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-3">
            <textarea
              className="w-full h-48 rounded-md border border-border bg-background p-3 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={'[Event "My Game"]\n[White "Me"]\n[Black "You"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 ...'}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="flex-1">
                Upload .pgn file
              </Button>
              <input ref={fileRef} type="file" accept=".pgn,.txt" className="hidden" onChange={handleFile} />
              <Button onClick={handleParse} className="flex-1">Load Game</Button>
            </div>
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{games.length} games found — pick one:</p>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {games.map((pgn, i) => {
                const h = parseHeaders(pgn);
                return (
                  <button
                    key={i}
                    onClick={() => handleSelectGame(pgn)}
                    className="w-full text-left rounded-md border border-border px-3 py-2 hover:bg-accent transition-colors text-sm"
                  >
                    <span className="font-medium">{h.White ?? '?'} vs {h.Black ?? '?'}</span>
                    <span className="text-muted-foreground ml-2">{h.Result ?? ''}</span>
                    {h.Event && <span className="text-muted-foreground ml-2">— {h.Event}</span>}
                  </button>
                );
              })}
            </div>
            <Button variant="outline" onClick={() => setStep('input')} className="w-full">Back</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
