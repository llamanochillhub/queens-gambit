'use client';

import { GameTree } from '@/lib/gameTree';

interface Props {
  tree: GameTree;
  currentId: string | null;
  onSelect: (id: string) => void;
}

export default function MoveList({ tree, currentId, onSelect }: Props) {
  if (tree.rootChildIds.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        Make a move or import a PGN to get started.
      </p>
    );
  }

  return (
    <div className="font-mono text-sm select-none">
      <MoveSequence
        tree={tree}
        startId={tree.rootChildIds[0]}
        currentId={currentId}
        onSelect={onSelect}
        isMainLine
      />
    </div>
  );
}

function MoveSequence({
  tree,
  startId,
  currentId,
  onSelect,
  isMainLine,
}: {
  tree: GameTree;
  startId: string | null;
  currentId: string | null;
  onSelect: (id: string) => void;
  isMainLine: boolean;
}) {
  const elements: React.ReactNode[] = [];
  let cur: string | null = startId;
  // Variations that should be rendered AFTER the next move (standard PGN order)
  let pendingVars: string[] = [];
  let needsNum = true;

  while (cur !== null) {
    const node = tree.nodes[cur];
    if (!node) break;

    const isWhite = node.ply % 2 === 1;
    const moveNum = Math.ceil(node.ply / 2);
    const isActive = cur === currentId;

    // Move number
    if (isWhite || needsNum) {
      elements.push(
        <span key={`num-${cur}`} className="text-muted-foreground text-xs">
          {isWhite ? `${moveNum}.` : `${moveNum}...`}
        </span>
      );
    }

    // Move button
    elements.push(
      <button
        key={cur}
        data-active={isActive ? 'true' : 'false'}
        onClick={() => onSelect(cur!)}
        className="px-1.5 py-0.5 rounded transition-colors hover:bg-accent data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
      >
        {node.san}
      </button>
    );
    needsNum = false;

    // Flush pending variations from the previous position (appear after this move)
    if (pendingVars.length > 0) {
      for (const varId of pendingVars) {
        elements.push(
          <div key={`var-${varId}`} className="w-full ml-4 pl-2 border-l-2 border-muted my-0.5">
            <MoveSequence
              tree={tree}
              startId={varId}
              currentId={currentId}
              onSelect={onSelect}
              isMainLine={false}
            />
          </div>
        );
      }
      pendingVars = [];
      needsNum = true; // after variation block, restate move number
    }

    // Queue this node's non-main children as pending variations
    pendingVars = node.childIds.slice(1);

    cur = node.childIds[0] ?? null;
  }

  // Flush any remaining pending variations at end of line
  for (const varId of pendingVars) {
    elements.push(
      <div key={`var-${varId}`} className="w-full ml-4 pl-2 border-l-2 border-muted my-0.5">
        <MoveSequence
          tree={tree}
          startId={varId}
          currentId={currentId}
          onSelect={onSelect}
          isMainLine={false}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-baseline gap-x-0.5 gap-y-0.5 ${isMainLine ? '' : 'text-xs text-muted-foreground'}`}>
      {elements}
    </div>
  );
}
