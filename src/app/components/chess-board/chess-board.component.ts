import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';

interface Square {
  piece: string | null;
  row: number;
  col: number;
}

@Component({
  selector: 'app-chess-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chess-board.component.html',
  styleUrl: './chess-board.component.css',
})
export class ChessBoardComponent implements OnInit {
  selectedSquare: string | null = null;
  highlightedSquares: string[] = [];
  isGameMenuOpen = false;

  board: (string | null)[][] = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
  ];

  pieceSymbols: { [key: string]: string } = {
    K: '♔',
    Q: '♕',
    R: '♖',
    B: '♗',
    N: '♘',
    P: '♙',
    k: '♚',
    q: '♛',
    r: '♜',
    b: '♝',
    n: '♞',
    p: '♟',
  };

  files: string[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  ranks: string[] = ['8', '7', '6', '5', '4', '3', '2', '1'];

  ngOnInit(): void {}

  isLightSquare(row: number, col: number): boolean {
    return (row + col) % 2 === 0;
  }

  handleSquareClick(row: number, col: number): void {
    const squareId = `${col}-${row}`;

    if (this.selectedSquare) {
      if (this.selectedSquare === squareId) {
        // Deselect if clicking the same square
        this.selectedSquare = null;
        this.highlightedSquares = [];
      } else {
        // Move piece (simplified logic)
        const [fromCol, fromRow] = this.selectedSquare.split('-').map(Number);
        this.board[row][col] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;
        this.selectedSquare = null;
        this.highlightedSquares = [];
      }
    } else {
      // Select piece if there's one on the square
      if (this.board[row][col]) {
        this.selectedSquare = squareId;
        // Add some example highlighted squares for possible moves
        const possibleMoves = [
          `${col + 1}-${row}`,
          `${col - 1}-${row}`,
          `${col}-${row + 1}`,
          `${col}-${row - 1}`,
        ].filter((square) => {
          const [c, r] = square.split('-').map(Number);
          return c >= 0 && c < 8 && r >= 0 && r < 8;
        });
        this.highlightedSquares = possibleMoves;
      }
    }
  }

  getSquareClasses(row: number, col: number): string {
    const squareId = `${col}-${row}`;
    const isSelected = this.selectedSquare === squareId;
    const isHighlighted = this.highlightedSquares.includes(squareId);
    const isLight = this.isLightSquare(row, col);

    let classes =
      'relative flex items-center justify-center cursor-pointer transition-all duration-200 ';

    if (isLight) {
      classes += 'bg-slate-100 ';
    } else {
      classes += 'bg-slate-700 ';
    }

    if (isSelected) {
      classes += 'ring-4 ring-blue-400 ring-opacity-70 ';
    }

    if (isHighlighted) {
      classes +=
        "after:content-[''] after:absolute after:inset-2 after:bg-emerald-400 after:bg-opacity-30 after:rounded-full ";
    }

    classes += 'hover:shadow-lg ';

    return classes;
  }

  toggleGameMenu(): void {
    this.isGameMenuOpen = !this.isGameMenuOpen;
  }

  closeGameMenu(): void {
    this.isGameMenuOpen = false;
  }

  takeBack(): void {
    console.log('Take back move');
    this.closeGameMenu();
    // Implement take back logic
  }

  offerDraw(): void {
    console.log('Offer draw');
    this.closeGameMenu();
    // Implement offer draw logic
  }

  resign(): void {
    console.log('Resign game');
    this.closeGameMenu();
    // Implement resign logic
  }
}
