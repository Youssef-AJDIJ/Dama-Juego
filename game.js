// ===== Game State Management =====
class CheckersGame {
  constructor() {
    this.board = [];
    this.currentPlayer = null;
    this.selectedPiece = null;
    this.selectedSquare = null;
    this.validMoves = [];
    this.mustCapture = false;
    this.continueCapture = false;
    this.gameOver = false;
    
    // Player statistics
    this.stats = {
      red: { wins: 0, losses: 0, draws: 0, name: "Jugador Rojo" },
      black: { wins: 0, losses: 0, draws: 0, name: "Jugador Negro" }
    };
    
    // Load stats from localStorage if available
    this.loadStats();

    this.initBoard();
    this.renderBoard();
    this.updateUI();
    this.attachEventListeners();
    this.attachNameInputListeners();
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
    const wasKingBefore = piece.king; // Track if piece was already a king

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

    let wasPromoted = false;
    if (shouldPromote && !piece.king) {
      piece.king = true;
      wasPromoted = true;
      this.animatePromotion(toRow, toCol);
    }

    this.renderBoard();

    // If piece was just promoted, turn ends immediately (standard checkers rule)
    if (wasPromoted) {
      this.continueCapture = false;
      this.deselectPiece();
      this.switchPlayer();
      this.checkWinCondition();
      this.updateUI();
      return;
    }

    // Check for additional captures (multi-jump) only if piece wasn't just promoted
    if (wasCapture) {
      const additionalCaptures = this.getCaptureMoves(toRow, toCol);
      if (additionalCaptures.length > 0) {
        // Continue turn with the same piece
        this.continueCapture = true;
        this.selectPiece(toRow, toCol);
        const playerName = this.currentPlayer === "red" ? this.stats.red.name : this.stats.black.name;
        this.updateStatusMessage(`¡Captura múltiple! Continúa ${playerName}`);
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
      this.updateStatusMessage(this.getStatusMessage());
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
    const winnerName = winner === "red" ? this.stats.red.name : this.stats.black.name;
    statusEl.textContent = `🎉 ¡Victoria de ${winnerName}! 🎉`;
    statusEl.classList.add("winner");
    
    // Record the win in statistics
    this.recordWin(winner);

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
    this.currentPlayer = null;
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

  // ===== Statistics Management =====
  loadStats() {
    const savedStats = localStorage.getItem('checkersStats');
    console.log(savedStats);
    if (savedStats) {
      this.stats = JSON.parse(savedStats);
      this.updateStatsDisplay();
      this.updatePlayerNames();
    }
  }
  
  saveStats() {
    localStorage.setItem('checkersStats', JSON.stringify(this.stats));
  }
  
  updateStatsDisplay() {
    document.getElementById('red-wins').textContent = this.stats.red.wins;
    document.getElementById('red-losses').textContent = this.stats.red.losses;
    document.getElementById('red-draws').textContent = this.stats.red.draws;
    
    document.getElementById('black-wins').textContent = this.stats.black.wins;
    document.getElementById('black-losses').textContent = this.stats.black.losses;
    document.getElementById('black-draws').textContent = this.stats.black.draws;
  }
  
  updatePlayerNames() {
    document.getElementById('red-name-input').value = this.stats.red.name;
    document.getElementById('black-name-input').value = this.stats.black.name;
    document.getElementById('red-player-name').textContent = this.stats.red.name;
    document.getElementById('black-player-name').textContent = this.stats.black.name;
  }
  
  recordWin(winner) {
    const loser = winner === 'red' ? 'black' : 'red';
    this.stats[winner].wins++;
    this.stats[loser].losses++;
    this.updateStatsDisplay();
    this.saveStats();
  }
  
  recordDraw() {
    this.stats.red.draws++;
    this.stats.black.draws++;
    this.updateStatsDisplay();
    this.saveStats();
  }
  
  resetStats() {
    const confirmed = document.createElement('div');
    confirmed.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg-secondary); padding: 2rem; border-radius: 1rem; border: 2px solid var(--color-king-gold); z-index: 10000; text-align: center;';
    confirmed.innerHTML = `
      <p style="margin-bottom: 1rem; font-size: 1.1rem;">¿Estás seguro de que quieres resetear todas las estadísticas?</p>
      <button id="confirm-yes" class="btn btn-primary" style="margin-right: 1rem;">Sí</button>
      <button id="confirm-no" class="btn btn-secondary">No</button>
    `;
    document.body.appendChild(confirmed);
    
    document.getElementById('confirm-yes').onclick = () => {
      this.stats.red.wins = 0;
      this.stats.red.losses = 0;
      this.stats.red.draws = 0;
      this.stats.black.wins = 0;
      this.stats.black.losses = 0;
      this.stats.black.draws = 0;
      this.updateStatsDisplay();
      this.saveStats();
      confirmed.remove();
    };
    
    document.getElementById('confirm-no').onclick = () => {
      confirmed.remove();
    };
  }

  // ===== Event Listeners =====
  attachEventListeners() {
    document.getElementById("reset-btn").addEventListener("click", () => {
      this.resetGame();
    });

    document.getElementById("hint-btn").addEventListener("click", () => {
      this.showHint();
    });
    
    // Game starter toggle
    const gameToggle = document.getElementById("game-starter-toggle");
    const gameRedLabel = document.getElementById("game-red-label");
    const gameBlackLabel = document.getElementById("game-black-label");
    
    gameToggle.addEventListener("change", (e) => {
      console.log(e.target.checked);
      this.currentPlayer = e.target.checked ? "black" : "red";
      gameRedLabel.classList.toggle("active", !e.target.checked);
      gameBlackLabel.classList.toggle("active", e.target.checked);
      this.updateUI();
      // this.resetGame();
    });
    
    document.getElementById("reset-stats-btn").addEventListener("click", () => {
      this.resetStats();
    });
  }
  
  attachNameInputListeners() {
    const redNameInput = document.getElementById('red-name-input');
    const blackNameInput = document.getElementById('black-name-input');
    
    redNameInput.addEventListener('input', (e) => {
      this.stats.red.name = e.target.value || 'Jugador Rojo';
      document.getElementById('red-player-name').textContent = this.stats.red.name;
      this.saveStats();
      this.updateStatusMessage(this.getStatusMessage());
    });
    
    blackNameInput.addEventListener('input', (e) => {
      this.stats.black.name = e.target.value || 'Jugador Negro';
      document.getElementById('black-player-name').textContent = this.stats.black.name;
      this.saveStats();
      this.updateStatusMessage(this.getStatusMessage());
    });
  }
  
  getStatusMessage() {
    if (this.gameOver) return document.getElementById('status-message').textContent;
    const playerName = this.currentPlayer === 'red' ? this.stats.red.name : this.stats.black.name;
    return `Turno de ${playerName}`;
  }
}

// ===== Setup Screen Management =====
function initializeSetupScreen() {
  const setupScreen = document.getElementById('setup-screen');
  const gameContainer = document.getElementById('game-container');
  const startGameBtn = document.getElementById('start-game-btn');
  const setupRedName = document.getElementById('setup-red-name');
  const setupBlackName = document.getElementById('setup-black-name');
  const starterToggle = document.getElementById('starter-toggle');
  const redLabel = document.getElementById('red-label');
  const blackLabel = document.getElementById('black-label');
  
  

  //////////////////////////////////////////////////
  // Update toggle labels with names
  function updateToggleLabels() {
    redLabel.textContent = setupRedName.value || 'Jugador Rojo';
    blackLabel.textContent = setupBlackName.value || 'Jugador Negro';
    
    redLabel.classList.toggle('active', !starterToggle.checked);
    blackLabel.classList.toggle('active', starterToggle.checked);
  }
  
  // Update labels when names change
  setupRedName.addEventListener('input', updateToggleLabels);
  setupBlackName.addEventListener('input', updateToggleLabels);
  
  // Update labels when toggle changes
  starterToggle.addEventListener('change', updateToggleLabels);
  
  // Initialize labels
  updateToggleLabels();
  
  // Start game button
  startGameBtn.addEventListener('click', () => {
    const redName = setupRedName.value.trim() || 'Jugador Rojo';
    const blackName = setupBlackName.value.trim() || 'Jugador Negro';
    const startingPlayer = starterToggle.checked ? 'black' : 'red';
    
    
    // Save names to localStorage before creating game
    const savedStats = {
      red: { wins: 0, losses: 0, draws: 0, name: redName },
      black: { wins: 0, losses: 0, draws: 0, name: blackName }
    };
    
    // Try to load existing stats and merge with new names
    const existingStats = localStorage.getItem('checkersStats');
    if (existingStats) {
      const parsed = JSON.parse(existingStats);
      savedStats.red.wins = parsed.red.wins || 0;
      savedStats.red.losses = parsed.red.losses || 0;
      savedStats.red.draws = parsed.red.draws || 0;
      savedStats.black.wins = parsed.black.wins || 0;
      savedStats.black.losses = parsed.black.losses || 0;
      savedStats.black.draws = parsed.black.draws || 0;
    }
    
    localStorage.setItem('checkersStats', JSON.stringify(savedStats));
    
    // Hide setup screen and show game
    setupScreen.style.display = 'none';
    gameContainer.style.display = 'block';
    
    // Initialize game with selected settings
    window.game = new CheckersGame();
    
    // Override the starting player after game creation
    game.currentPlayer = startingPlayer;
    
    // Update all name displays
    document.getElementById('red-name-input').value = redName;
    document.getElementById('black-name-input').value = blackName;
    document.getElementById('red-player-name').textContent = redName;
    document.getElementById('black-player-name').textContent = blackName;

    game.redName = redName;
    game.blackName = blackName;
    
    // Update UI to show correct starting player
    game.updateUI();
    
    // Sync game toggle with starting player
    const gameToggle = document.getElementById('game-starter-toggle');
    gameToggle.checked = startingPlayer === 'black';
    document.getElementById('game-red-label').classList.toggle('active', startingPlayer === 'red');
    document.getElementById('game-black-label').classList.toggle('active', startingPlayer === 'black');
  });
}

// ===== Initialize Game =====
let game;
document.addEventListener("DOMContentLoaded", () => {
  initializeSetupScreen();
});
