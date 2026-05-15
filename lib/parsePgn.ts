import { Chess } from 'chess.js';
import { GameTree, addMove, emptyTree } from './gameTree';

// ── Tokeniser ─────────────────────────────────────────────────────────────────

type Token =
  | { kind: 'num' }
  | { kind: 'dots' }
  | { kind: 'san'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'result' }
  | { kind: 'comment' };

function tokenise(pgn: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < pgn.length) {
    if (/\s/.test(pgn[i])) { i++; continue; }

    if (pgn[i] === '{') {
      const end = pgn.indexOf('}', i);
      tokens.push({ kind: 'comment' });
      i = end === -1 ? pgn.length : end + 1;
      continue;
    }
    if (pgn[i] === ';') {
      const end = pgn.indexOf('\n', i);
      i = end === -1 ? pgn.length : end + 1;
      continue;
    }
    if (pgn[i] === '(') { tokens.push({ kind: 'lparen' }); i++; continue; }
    if (pgn[i] === ')') { tokens.push({ kind: 'rparen' }); i++; continue; }
    if (pgn[i] === '$') {
      while (i < pgn.length && !/\s/.test(pgn[i])) i++;
      continue;
    }
    if (pgn.startsWith('1/2-1/2', i)) { tokens.push({ kind: 'result' }); i += 7; continue; }
    if (pgn.startsWith('1-0', i) || pgn.startsWith('0-1', i)) { tokens.push({ kind: 'result' }); i += 3; continue; }
    if (pgn[i] === '*') { tokens.push({ kind: 'result' }); i++; continue; }

    if (/\d/.test(pgn[i])) {
      while (i < pgn.length && /\d/.test(pgn[i])) i++;
      tokens.push({ kind: 'num' });
      let hasDot = false;
      while (i < pgn.length && pgn[i] === '.') { i++; hasDot = true; }
      if (hasDot) tokens.push({ kind: 'dots' });
      continue;
    }

    if (/[a-zA-Z]/.test(pgn[i])) {
      let san = '';
      while (i < pgn.length && /[a-zA-Z0-9+#=\-]/.test(pgn[i])) { san += pgn[i]; i++; }
      tokens.push({ kind: 'san', value: san });
      continue;
    }

    i++;
  }
  return tokens;
}

// ── Recursive parser ──────────────────────────────────────────────────────────

function parseMoves(
  tokens: Token[],
  pos: { i: number },
  tree: GameTree,
  parentId: string | null,
  fen: string,
  ply: number,
): GameTree {
  const chess = new Chess(fen);
  let currentParentId = parentId;
  let currentPly = ply;

  while (pos.i < tokens.length) {
    const tok = tokens[pos.i];

    if (tok.kind === 'result' || tok.kind === 'rparen') break;
    if (tok.kind === 'num' || tok.kind === 'dots' || tok.kind === 'comment') {
      pos.i++;
      continue;
    }

    if (tok.kind === 'lparen') {
      pos.i++; // consume '('
      // Variation starts from the position BEFORE the last move (currentParentId's parent)
      const varParentId = currentParentId === parentId
        ? parentId
        : (currentParentId !== null ? (tree.nodes[currentParentId]?.parentId ?? null) : null);
      const varFen = varParentId === null
        ? tree.startFen
        : (tree.nodes[varParentId]?.fen ?? tree.startFen);
      const varPly = varParentId === null ? 0 : (tree.nodes[varParentId]?.ply ?? 0);
      tree = parseMoves(tokens, pos, tree, varParentId, varFen, varPly);
      if (pos.i < tokens.length && tokens[pos.i].kind === 'rparen') pos.i++; // consume ')'
      continue;
    }

    if (tok.kind === 'san') {
      pos.i++;
      try {
        const move = chess.move(tok.value);
        if (!move) continue;
        const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
        const result = addMove(tree, currentParentId, uci, move.san, chess.fen(), currentPly + 1);
        tree = result.tree;
        currentParentId = result.nodeId;
        currentPly += 1;
      } catch {
        break; // illegal move — end this line
      }
      continue;
    }

    pos.i++;
  }

  return tree;
}

// ── Public entry point ────────────────────────────────────────────────────────

export function parsePgn(pgn: string): GameTree {
  const headers: Record<string, string> = {};
  const headerRe = /\[(\w+)\s+"([^"]*)"\]/g;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(pgn)) !== null) headers[m[1]] = m[2];

  const movesSection = pgn.replace(/\[[^\]]*\]\s*/g, '').trim();
  let tree = { ...emptyTree(), headers };

  const tokens = tokenise(movesSection);
  const pos = { i: 0 };
  tree = parseMoves(tokens, pos, tree, null, tree.startFen, 0);
  return tree;
}
