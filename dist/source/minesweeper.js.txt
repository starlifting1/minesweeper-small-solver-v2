(function () {
  "use strict";

  const LEVELS = Object.freeze({
    beginner: Object.freeze({ rows: 9, cols: 9, mines: 8 }),
    intermediate: Object.freeze({ rows: 12, cols: 12, mines: 16 }),
    hard: Object.freeze({ rows: 12, cols: 12, mines: 30 }),
    expert: Object.freeze({ rows: 20, cols: 20, mines: 80 }),
    extreme: Object.freeze({ rows: 30, cols: 30, mines: 200 })
  });

  class Minesweeper {
    constructor(levelName = "beginner") {
      this.reset(levelName);
    }

    reset(levelName) {
      const level = LEVELS[levelName];
      if (!level) throw new Error(`Unknown level: ${levelName}`);

      this.levelName = levelName;
      this.rows = level.rows;
      this.cols = level.cols;
      this.mineCount = level.mines;
      this.flagCount = 0;
      this.revealedCount = 0;
      this.state = "ready";
      this.board = Array.from({ length: this.rows }, (_, row) =>
        Array.from({ length: this.cols }, (_, col) => ({
          row,
          col,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          nearbyMines: 0
        }))
      );
    }

    getCell(row, col) {
      return this.board[row]?.[col] ?? null;
    }

    getNeighbors(cell) {
      const neighbors = [];

      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
          if (rowOffset === 0 && colOffset === 0) continue;

          const neighbor = this.getCell(
            cell.row + rowOffset,
            cell.col + colOffset
          );
          if (neighbor) neighbors.push(neighbor);
        }
      }

      return neighbors;
    }

    placeMines(safeCell) {
      const candidates = this.board.flat().filter((cell) => {
        const rowDistance = Math.abs(cell.row - safeCell.row);
        const colDistance = Math.abs(cell.col - safeCell.col);
        return rowDistance > 1 || colDistance > 1;
      });

      this.shuffle(candidates);
      candidates.slice(0, this.mineCount).forEach((cell) => {
        cell.isMine = true;
      });

      this.board.flat().forEach((cell) => {
        cell.nearbyMines = this.getNeighbors(cell)
          .filter((neighbor) => neighbor.isMine).length;
      });
    }

    shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

    reveal(row, col) {
      if (this.state === "won" || this.state === "lost") return;

      const cell = this.getCell(row, col);
      if (!cell || cell.isFlagged) return;

      if (this.state === "ready") {
        this.placeMines(cell);
        this.state = "playing";
      }

      if (cell.isRevealed) {
        this.revealAroundNumber(cell);
      } else {
        this.revealArea(cell);
      }

      this.checkForWin();
    }

    revealArea(startCell) {
      const pending = [startCell];

      while (pending.length > 0 && this.state === "playing") {
        const cell = pending.pop();
        if (cell.isRevealed || cell.isFlagged) continue;

        cell.isRevealed = true;
        this.revealedCount++;

        if (cell.isMine) {
          this.state = "lost";
          this.revealAllMines();
          return;
        }

        if (cell.nearbyMines === 0) {
          this.getNeighbors(cell).forEach((neighbor) => {
            if (!neighbor.isRevealed && !neighbor.isMine) {
              pending.push(neighbor);
            }
          });
        }
      }
    }

    revealAroundNumber(cell) {
      if (cell.nearbyMines === 0) return;

      const neighbors = this.getNeighbors(cell);
      const nearbyFlags = neighbors.filter((neighbor) => neighbor.isFlagged).length;
      if (nearbyFlags !== cell.nearbyMines) return;

      neighbors
        .filter((neighbor) => !neighbor.isFlagged && !neighbor.isRevealed)
        .forEach((neighbor) => this.revealArea(neighbor));
    }

    toggleFlag(row, col) {
      if (this.state === "won" || this.state === "lost") return;

      const cell = this.getCell(row, col);
      if (!cell || cell.isRevealed) return;
      if (!cell.isFlagged && this.flagCount >= this.mineCount) return;

      cell.isFlagged = !cell.isFlagged;
      this.flagCount += cell.isFlagged ? 1 : -1;
    }

    checkForWin() {
      const safeCellCount = this.rows * this.cols - this.mineCount;
      if (this.state !== "lost" && this.revealedCount === safeCellCount) {
        this.state = "won";
        this.board.flat().filter((cell) => cell.isMine).forEach((cell) => {
          cell.isFlagged = true;
        });
        this.flagCount = this.mineCount;
      }
    }

    revealAllMines() {
      this.board.flat().filter((cell) => cell.isMine).forEach((cell) => {
        cell.isRevealed = true;
      });
    }

    get minesLeft() {
      return this.mineCount - this.flagCount;
    }
  }

  window.MinesweeperGame = Object.freeze({ LEVELS, Minesweeper });
})();
