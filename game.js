// ===== Game State Management =====
class CheckersGame {
  constructor() {
    this.board = [];
    this.currentPlayer = "red";
    this.selectedPiece = null;
    this.selectedSquare = null;
    this.validMoves = [];
    this.mustCapture = false;
    this.continueCapture = false;
    this.gameOver = false;

    this.initBoard();
    this.renderBoard();
    this.updateUI();
    this.attachEventListeners();
  }

  // ===== Board Initialization =====
  initBoard() {
    // Create 8x8 board
    for (let row = 0; row < 8; row++) {
      this.board[row] = [];
      for (let col = 0; col < 8; col++) {
        this.board[row][col] = null;
      }
    }

    // Place black pieces (top 3 rows on dark squares)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 0) {
          this.board[row][col] = { color: "black", king: false };
        }
      }
    }

    // Place red pieces (bottom 3 rows on dark squares)
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 0) {
          this.board[row][col] = { color: "red", king: false };
        }
      }
    }
  }

  // ===== Board Rendering =====
  renderBoard() {
    const boardEl = document.getElementById("game-board");
    boardEl.innerHTML = "";

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = document.createElement("div");
        square.className = "square";
        square.classList.add((row + col) % 2 === 0 ? "dark" : "light");
        square.dataset.row = row;
        square.dataset.col = col;

        const piece = this.board[row][col];
        if (piece) {
          const pieceEl = document.createElement("div");
          pieceEl.className = `piece ${piece.color}`;
          if (piece.king) {
            pieceEl.classList.add("king");
          }
          square.appendChild(pieceEl);
        }

        square.addEventListener("click", () =>
          this.handleSquareClick(row, col)
        );
        boardEl.appendChild(square);
      }
    }
  }

  // ===== Square Click Handler =====
  handleSquareClick(row, col) {
    if (this.gameOver) return;

    const piece = this.board[row][col];

    // If we have a selected piece and click a valid move
    if (this.selectedPiece && this.isValidMove(row, col)) {
      this.movePiece(
        this.selectedSquare.row,
        this.selectedSquare.col,
        row,
        col
      );
      return;
    }

    // Select a piece
    if (piece && piece.color === this.currentPlayer) {
      // Check if there are forced captures
      if (
        this.continueCapture &&
        this.selectedSquare &&
        (this.selectedSquare.row !== row || this.selectedSquare.col !== col)
      ) {
        return; // Must continue with the same piece
      }

      this.selectPiece(row, col);
    } else {
      this.deselectPiece();
    }
  }

  // ===== Piece Selection =====
  selectPiece(row, col) {
    this.selectedPiece = this.board[row][col];
    this.selectedSquare = { row, col };

    // Calculate valid moves
    if (this.continueCapture) {
      this.validMoves = this.getCaptureMoves(row, col);
    } else {
      this.validMoves = this.getValidMoves(row, col);
    }

    this.highlightSquares();
  }

  deselectPiece() {
    if (this.continueCapture) return; // Can't deselect during multi-capture

    this.selectedPiece = null;
    this.selectedSquare = null;
    this.validMoves = [];
    this.highlightSquares();
  }

  // ===== Move Validation =====
  isValidMove(row, col) {
    return this.validMoves.some((move) => move.row === row && move.col === col);
  }

  getValidMoves(row, col) {
    const piece = this.board[row][col];
    if (!piece) return [];

    const captureMoves = this.getCaptureMoves(row, col);

    // If there are any captures available for this player, they must capture
    const allCaptures = this.getAllCaptureMoves(piece.color);
    if (allCaptures.length > 0) {
      this.mustCapture = true;
      return captureMoves;
    }

    this.mustCapture = false;
    const normalMoves = this.getNormalMoves(row, col);
    return [...captureMoves, ...normalMoves];
  }

  getNormalMoves(row, col) {
    const piece = this.board[row][col];
    const moves = [];

    // Determine movement directions
    const directions = piece.king
      ? [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ] // Kings move in all diagonal directions
      : piece.color === "red"
      ? [
          [-1, -1],
          [-1, 1],
        ] // Red moves up
      : [
          [1, -1],
          [1, 1],
        ]; // Black moves down

    for (const [dRow, dCol] of directions) {
      if (piece.king) {
        // Kings can move multiple squares along the diagonal
        let distance = 1;
        while (true) {
          const newRow = row + (dRow * distance);
          const newCol = col + (dCol * distance);
          
          if (!this.isValidPosition(newRow, newCol)) {
            break; // Out of bounds
          }
          
          if (this.board[newRow][newCol]) {
            break; // Hit a piece, stop
          }
          
          // Empty square, valid move
          moves.push({ row: newRow, col: newCol, capture: null });
          distance++;
        }
      } else {
        // Regular pieces: only move one square
        const newRow = row + dRow;
        const newCol = col + dCol;

        if (this.isValidPosition(newRow, newCol) && !this.board[newRow][newCol]) {
          moves.push({ row: newRow, col: newCol, capture: null });
        }
      }
    }

    return moves;
  }

  getCaptureMoves(row, col) {
    const piece = this.board[row][col];
    const moves = [];

    // All diagonal directions for checking jumps
    const directions = piece.king
      ? [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ]
      : piece.color === "red"
      ? [
          [-1, -1],
          [-1, 1],
        ]
      : [
          [1, -1],
          [1, 1],
        ];

    for (const [dRow, dCol] of directions) {
      if (piece.king) {
        // Kings can capture at any distance along the diagonal
        let distance = 1;
        let foundEnemy = false;
        let enemyPos = null;
        
        while (true) {
          const checkRow = row + (dRow * distance);
          const checkCol = col + (dCol * distance);
          
          if (!this.isValidPosition(checkRow, checkCol)) {
            break; // Out of bounds
          }
          
          const currentSquare = this.board[checkRow][checkCol];
          
          if (!foundEnemy) {
            // Still looking for an enemy piece
            if (!currentSquare) {
              // Empty square, keep looking
              distance++;
              continue;
            } else if (currentSquare.color !== piece.color) {
              // Found enemy piece
              foundEnemy = true;
              enemyPos = { row: checkRow, col: checkCol };
              distance++;
              continue;
            } else {
              // Found own piece, stop this direction
              break;
            }
          } else {
            // Already found enemy, now looking for landing squares
            if (!currentSquare) {
              // Valid landing spot after jumping enemy
              moves.push({
                row: checkRow,
                col: checkCol,
                capture: enemyPos,
              });
              distance++;
              continue;
            } else {
              // Hit another piece, stop
              break;
            }
          }
        }
      } else {
        // Regular pieces: only adjacent captures
        const jumpRow = row + dRow;
        const jumpCol = col + dCol;
        const landRow = row + dRow * 2;
        const landCol = col + dCol * 2;

        // Check if we can jump over an opponent piece
        if (
          this.isValidPosition(jumpRow, jumpCol) &&
          this.isValidPosition(landRow, landCol)
        ) {
          const jumpedPiece = this.board[jumpRow][jumpCol];
          const landSquare = this.board[landRow][landCol];

          if (jumpedPiece && jumpedPiece.color !== piece.color && !landSquare) {
            moves.push({
              row: landRow,
              col: landCol,
              capture: { row: jumpRow, col: jumpCol },
            });
          }
        }
      }
    }

    return moves;
  }

  getAllCaptureMoves(color) {
    const allMoves = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && piece.color === color) {
          const captures = this.getCaptureMoves(row, col);
          if (captures.length > 0) {
            allMoves.push(...captures);
          }
        }
      }
    }
    return allMoves;
  }

  isValidPosition(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  // ===== Piece Movement =====
  movePiece(fromRow, fromCol, toRow, toCol) {
    const move = this.validMoves.find(
      (m) => m.row === toRow && m.col === toCol
    );
    if (!move) return;

    const piece = this.board[fromRow][fromCol];

    // Move the piece
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    // Handle capture
    let wasCapture = false;
    if (move.capture) {
      const capturedPiece = this.board[move.capture.row][move.capture.col];
      this.animateCapture(move.capture.row, move.capture.col);
      this.board[move.capture.row][move.capture.col] = null;
      wasCapture = true;
    }

    // Check for king promotion
    const shouldPromote =
      (piece.color === "red" && toRow === 0) ||
      (piece.color === "black" && toRow === 7);

    if (shouldPromote && !piece.king) {
      piece.king = true;
      this.animatePromotion(toRow, toCol);
    }

    this.renderBoard();

    // Check for additional captures (multi-jump)
    if (wasCapture) {
      const additionalCaptures = this.getCaptureMoves(toRow, toCol);
      if (additionalCaptures.length > 0) {
        // Continue turn with the same piece
        this.continueCapture = true;
        this.selectPiece(toRow, toCol);
        this.updateStatusMessage(
          `¡Captura múltiple! Continúa con Jugador ${
            this.currentPlayer === "red" ? "Rojo" : "Negro"
          }`
        );
        return;
      }
    }

    // End turn
    this.continueCapture = false;
    this.deselectPiece();
    this.switchPlayer();
    this.checkWinCondition();
    this.updateUI();
  }

  switchPlayer() {
    this.currentPlayer = this.currentPlayer === "red" ? "black" : "red";
  }

  // ===== UI Updates =====
  highlightSquares() {
    const squares = document.querySelectorAll(".square");
    squares.forEach((square) => {
      square.classList.remove("selected", "valid-move");
    });

    // Highlight selected square
    if (this.selectedSquare) {
      const selectedEl = document.querySelector(
        `.square[data-row="${this.selectedSquare.row}"][data-col="${this.selectedSquare.col}"]`
      );
      if (selectedEl) {
        selectedEl.classList.add("selected");
      }
    }

    // Highlight valid moves
    this.validMoves.forEach((move) => {
      const square = document.querySelector(
        `.square[data-row="${move.row}"][data-col="${move.col}"]`
      );
      if (square) {
        square.classList.add("valid-move");
      }
    });
  }

  updateUI() {
    // Update player indicators
    document
      .querySelector(".player-red")
      .classList.toggle("active", this.currentPlayer === "red");
    document
      .querySelector(".player-black")
      .classList.toggle("active", this.currentPlayer === "black");

    // Update piece counts
    const redCount = this.countPieces("red");
    const blackCount = this.countPieces("black");

    document.getElementById("red-count").textContent = `${redCount} pieza${
      redCount !== 1 ? "s" : ""
    }`;
    document.getElementById("black-count").textContent = `${blackCount} pieza${
      blackCount !== 1 ? "s" : ""
    }`;

    // Update status message
    if (!this.gameOver) {
      const player = this.currentPlayer === "red" ? "Rojo" : "Negro";
      this.updateStatusMessage(`Turno del Jugador ${player}`);
    }
  }

  updateStatusMessage(message) {
    const statusEl = document.getElementById("status-message");
    statusEl.textContent = message;
  }

  countPieces(color) {
    let count = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (this.board[row][col] && this.board[row][col].color === color) {
          count++;
        }
      }
    }
    return count;
  }

  // ===== Win Condition =====
  checkWinCondition() {
    const redPieces = this.countPieces("red");
    const blackPieces = this.countPieces("black");

    // Check if a player has no pieces
    if (redPieces === 0) {
      this.endGame("black");
      return;
    }
    if (blackPieces === 0) {
      this.endGame("red");
      return;
    }

    // Check if current player has no valid moves
    const hasValidMoves = this.playerHasValidMoves(this.currentPlayer);
    if (!hasValidMoves) {
      const winner = this.currentPlayer === "red" ? "black" : "red";
      this.endGame(winner);
    }
  }

  playerHasValidMoves(color) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && piece.color === color) {
          const moves = this.getValidMoves(row, col);
          if (moves.length > 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  endGame(winner) {
    this.gameOver = true;
    const statusEl = document.getElementById("status-message");
    const winnerName = winner === "red" ? "Rojo" : "Negro";
    statusEl.textContent = `🎉 ¡Victoria del Jugador ${winnerName}! 🎉`;
    statusEl.classList.add("winner");

    // Celebration animation
    this.celebrateWin();
  }

  celebrateWin() {
    const boardEl = document.getElementById("game-board");
    boardEl.style.animation = "winnerAnnounce 1s ease-in-out";
    setTimeout(() => {
      boardEl.style.animation = "";
    }, 1000);
  }

  // ===== Animations =====
  animateCapture(row, col) {
    const square = document.querySelector(
      `.square[data-row="${row}"][data-col="${col}"]`
    );
    if (square) {
      const piece = square.querySelector(".piece");
      if (piece) {
        piece.classList.add("capturing");
      }
    }
  }

  animatePromotion(row, col) {
    setTimeout(() => {
      const square = document.querySelector(
        `.square[data-row="${row}"][data-col="${col}"]`
      );
      if (square) {
        const piece = square.querySelector(".piece");
        if (piece) {
          piece.classList.add("promoting");
          setTimeout(() => {
            piece.classList.remove("promoting");
          }, 800);
        }
      }
    }, 100);
  }

  // ===== Game Controls =====
  resetGame() {
    this.board = [];
    this.currentPlayer = "red";
    this.selectedPiece = null;
    this.selectedSquare = null;
    this.validMoves = [];
    this.mustCapture = false;
    this.continueCapture = false;
    this.gameOver = false;

    const statusEl = document.getElementById("status-message");
    statusEl.classList.remove("winner");

    this.initBoard();
    this.renderBoard();
    this.updateUI();
  }

  showHint() {
    if (this.gameOver) return;

    // Find all pieces of current player with valid moves
    const piecesWithMoves = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && piece.color === this.currentPlayer) {
          const moves = this.getValidMoves(row, col);
          if (moves.length > 0) {
            piecesWithMoves.push({ row, col, moves });
          }
        }
      }
    }

    if (piecesWithMoves.length > 0) {
      // Select a random piece with moves
      const randomPiece =
        piecesWithMoves[Math.floor(Math.random() * piecesWithMoves.length)];
      this.selectPiece(randomPiece.row, randomPiece.col);
      this.updateStatusMessage("💡 Aquí hay un movimiento posible");
    } else {
      this.updateStatusMessage("No hay movimientos válidos disponibles");
    }
  }

  // ===== Event Listeners =====
  attachEventListeners() {
    document.getElementById("reset-btn").addEventListener("click", () => {
      this.resetGame();
    });

    document.getElementById("hint-btn").addEventListener("click", () => {
      this.showHint();
    });
  }
}

// ===== Initialize Game =====
let game;
document.addEventListener("DOMContentLoaded", () => {
  game = new CheckersGame();
});
