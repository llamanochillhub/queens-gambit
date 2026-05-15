import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { ArrowRight, Upload, Cpu, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-20 text-center">
      {/* Hero */}
      <div className="mb-12 space-y-4 max-w-2xl">
        <div className="text-7xl mb-6 select-none">♛</div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Your personal chess workbench
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Import any game, replay it move by move, analyze with Stockfish, and export clean PGN —
          no account required.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link href="/analyze" className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}>
            Open Analysis Board <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/puzzles" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
            Puzzles (coming soon)
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
        <div className="rounded-xl border border-border bg-card p-6 text-left space-y-2">
          <Upload className="h-6 w-6 text-primary" />
          <h3 className="font-semibold">Import PGN</h3>
          <p className="text-sm text-muted-foreground">
            Paste a PGN or upload a file. Supports multi-game files — pick the one you want.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-left space-y-2">
          <Cpu className="h-6 w-6 text-primary" />
          <h3 className="font-semibold">Engine Analysis</h3>
          <p className="text-sm text-muted-foreground">
            Stockfish runs right in your browser. Toggle it on to see centipawn scores and best lines.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-left space-y-2">
          <Puzzle className="h-6 w-6 text-muted-foreground" />
          <h3 className="font-semibold text-muted-foreground">Puzzles (soon)</h3>
          <p className="text-sm text-muted-foreground">
            Tactical puzzles from the Lichess database. Sharpen your pattern recognition.
          </p>
        </div>
      </div>
    </div>
  );
}
