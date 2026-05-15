import { Chess } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface MoveNode {
  id: string;
  san: string;
  uci: string;
  fen: string;   // position AFTER this move
  ply: number;   // 1 = white's first move, 2 = black's first move, …
  parentId: string | null;
  childIds: string[]; // [0] = main continuation, [1…] = variations
}

export interface GameTree {
  startFen: string;
  rootChildIds: string[]; // [0] = main line first move, [1…] = first-move alternatives
  nodes: Record<string, MoveNode>;
  headers: Record<string, string>;
}

export function emptyTree(startFen = START_FEN): GameTree {
  return { startFen, rootChildIds: [], nodes: {}, headers: {} };
}

let _counter = 0;
function uid(): string { return `n${++_counter}`; }

// ── Mutation helpers (return new tree, never mutate) ──────────────────────────

export function addMove(
  tree: GameTree,
  parentId: string | null,
  uci: string,
  san: string,
  fen: string,
  ply: number,
): { tree: GameTree; nodeId: string } {
  // If this exact move already exists as a child, just return it
  const siblings = parentId === null ? tree.rootChildIds : (tree.nodes[parentId]?.childIds ?? []);
  const existing = siblings.find(id => tree.nodes[id]?.uci === uci);
  if (existing) return { tree, nodeId: existing };

  const id = uid();
  const node: MoveNode = { id, san, uci, fen, ply, parentId, childIds: [] };
  const newNodes = { ...tree.nodes, [id]: node };

  if (parentId === null) {
    return {
      tree: { ...tree, nodes: newNodes, rootChildIds: [...tree.rootChildIds, id] },
      nodeId: id,
    };
  }
  const parent = tree.nodes[parentId];
  const newParent = { ...parent, childIds: [...parent.childIds, id] };
  return {
    tree: { ...tree, nodes: { ...newNodes, [parentId]: newParent } },
    nodeId: id,
  };
}

// ── Navigation helpers ────────────────────────────────────────────────────────

export function fenAt(tree: GameTree, nodeId: string | null): string {
  return nodeId === null ? tree.startFen : (tree.nodes[nodeId]?.fen ?? tree.startFen);
}

export function parentOf(tree: GameTree, nodeId: string | null): string | null {
  if (nodeId === null) return null;
  return tree.nodes[nodeId]?.parentId ?? null;
}

export function mainChild(tree: GameTree, nodeId: string | null): string | null {
  if (nodeId === null) return tree.rootChildIds[0] ?? null;
  return tree.nodes[nodeId]?.childIds[0] ?? null;
}

export function mainLineEnd(tree: GameTree, fromId: string | null): string | null {
  let cur = mainChild(tree, fromId);
  while (cur !== null) {
    const next = mainChild(tree, cur);
    if (next === null) break;
    cur = next;
  }
  return cur;
}

// ── Apply a UCI move string to a FEN ─────────────────────────────────────────

export function applyUci(
  fen: string,
  uci: string,
): { san: string; fen: string } | null {
  try {
    const c = new Chess(fen);
    const result = c.move({
      from: uci.slice(0, 2) as any,
      to: uci.slice(2, 4) as any,
      promotion: (uci[4] as any) || undefined,
    });
    return result ? { san: result.san, fen: c.fen() } : null;
  } catch {
    return null;
  }
}

// ── PGN export ────────────────────────────────────────────────────────────────

export function toPgn(tree: GameTree): string {
  const headerLines = Object.entries(tree.headers)
    .map(([k, v]) => `[${k} "${v}"]`)
    .join('\n');
  const body = writeMoves(tree, tree.rootChildIds[0] ?? null, true);
  return headerLines ? `${headerLines}\n\n${body}` : body;
}

function writeMoves(tree: GameTree, nodeId: string | null, needsNum: boolean): string {
  if (!nodeId || !tree.nodes[nodeId]) return '';
  const node = tree.nodes[nodeId];
  const parts: string[] = [];
  const moveNum = Math.ceil(node.ply / 2);
  const isWhite = node.ply % 2 === 1;

  if (isWhite) {
    parts.push(`${moveNum}.`);
  } else if (needsNum) {
    parts.push(`${moveNum}...`);
  }
  parts.push(node.san);

  // Inline variations (non-main children) with parentheses
  let hadVariation = false;
  for (let i = 1; i < node.childIds.length; i++) {
    const varText = writeMoves(tree, node.childIds[i], true);
    if (varText) {
      parts.push(`(${varText})`);
      hadVariation = true;
    }
  }

  // Continue main line
  const next = node.childIds[0] ?? null;
  if (next) {
    const nextIsBlack = tree.nodes[next]?.ply % 2 === 0;
    // Black needs move number re-statement only after a variation was written
    const nextNeedsNum = hadVariation && nextIsBlack;
    parts.push(writeMoves(tree, next, nextNeedsNum));
  }

  return parts.filter(Boolean).join(' ');
}
