import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Puzzle } from 'lucide-react';

export default function PuzzlesPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center px-4 py-20">
      <div className="rounded-full bg-muted p-6">
        <Puzzle className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Puzzle Trainer</h1>
        <p className="text-muted-foreground max-w-md">
          Tactical puzzles sourced from the Lichess open database are coming soon.
          You&apos;ll be able to sharpen your pattern recognition with rated positions.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/analyze" className={buttonVariants()}>
          Go to Analysis Board
        </Link>
        <Button variant="outline" disabled>Coming Soon</Button>
      </div>
    </div>
  );
}
