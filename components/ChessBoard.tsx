'use client';

import { useState, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
type ChessArrow = { startSquare: string; endSquare: string; color: string };
import { Chess, Square } from 'chess.js';

interface ArrowProp {
  from: string;
  to: string;
  color?: string;
}

interface ChessBoardProps {
  fen: string;
  onMove?: (move: { from: string; to: string; promotion?: string; san: string }) => void;
  arrows?: ArrowProp[];
  readOnly?: boolean;
  boardOrientation?: 'white' | 'black';
  boardTheme?: BoardTheme;
}

export type BoardTheme = 'classic' | 'ocean' | 'walnut';

const THEMES: Record<BoardTheme, { light: React.CSSProperties; dark: React.CSSProperties }> = {
  classic: { light: { backgroundColor: '#f0d9b5' }, dark: { backgroundColor: '#b58863' } },
  ocean:   { light: { backgroundColor: '#dee3e6' }, dark: { backgroundColor: '#8ca2ad' } },
  walnut:  { light: { backgroundColor: '#f0e0c8' }, dark: { backgroundColor: '#8b5d3b' } },
};

export default function ChessBoard({
  fen,
  onMove,
  arrows = [],
  readOnly = false,
  boardOrientation = 'white',
  boardTheme = 'classic',
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [squareStyles, setSquareStyles] = useState<Record<string, React.CSSProperties>>({});

  const theme = THEMES[boardTheme];

  const highlightLegal = useCallback((square: Square, chess: Chess) => {
    const moves = chess.moves({ square, verbose: true });
    if (moves.length === 0) {
      setSelectedSquare(null);
      setSquareStyles({});
      return;
    }
    const styles: Record<string, React.CSSProperties> = {
      [square]: { background: 'rgba(255, 255, 0, 0.4)' },
    };
    moves.forEach(m => {
      styles[m.to] = {
        background: chess.get(m.to)
          ? 'radial-gradient(circle, rgba(0,0,0,0.3) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0,0,0,0.2) 30%, transparent 30%)',
        borderRadius: '50%',
      };
    });
    setSelectedSquare(square);
    setSquareStyles(styles);
  }, []);

  const handleSquareClick = useCallback(({ square }: { piece: any; square: string }) => {
    if (readOnly) return;
    const chess = new Chess(fen);
    const sq = square as Square;

    if (selectedSquare) {
      const legalMoves = chess.moves({ square: selectedSquare, verbose: true });
      const match = legalMoves.find(m => m.to === sq);
      if (match) {
        const promotion = match.promotion ? 'q' : undefined; // auto-promote to queen for simplicity
        const result = chess.move({ from: selectedSquare, to: sq, promotion });
        if (result) {
          onMove?.({ from: selectedSquare, to: sq, promotion, san: result.san });
          setSelectedSquare(null);
          setSquareStyles({});
          return;
        }
      }
      setSelectedSquare(null);
      setSquareStyles({});
    }
    highlightLegal(sq, chess);
  }, [selectedSquare, fen, readOnly, onMove, highlightLegal]);

  const handlePieceDrop = useCallback(({ piece, sourceSquare, targetSquare }: {
    piece: any; sourceSquare: string; targetSquare: string | null;
  }): boolean => {
    if (readOnly || !targetSquare) return false;
    const chess = new Chess(fen);
    const isPromotion =
      piece?.pieceType?.[1] === 'P' &&
      ((piece.pieceType[0] === 'w' && targetSquare[1] === '8') ||
       (piece.pieceType[0] === 'b' && targetSquare[1] === '1'));

    const result = chess.move({
      from: sourceSquare as Square,
      to: targetSquare as Square,
      promotion: isPromotion ? 'q' : undefined,
    });
    if (!result) return false;
    onMove?.({ from: sourceSquare, to: targetSquare, promotion: isPromotion ? 'q' : undefined, san: result.san });
    setSelectedSquare(null);
    setSquareStyles({});
    return true;
  }, [fen, readOnly, onMove]);

  const chessArrows: ChessArrow[] = arrows.map(a => ({
    startSquare: a.from,
    endSquare: a.to,
    color: a.color ?? '#22c55e',
  }));

  return (
    <Chessboard
      options={{
        position: fen,
        boardOrientation,
        lightSquareStyle: theme.light,
        darkSquareStyle: theme.dark,
        squareStyles,
        arrows: chessArrows,
        allowDragging: !readOnly,
        onSquareClick: handleSquareClick,
        onPieceDrop: handlePieceDrop,
        animationDurationInMs: 150,
      }}
    />
  );
}
