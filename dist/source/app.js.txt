(function () {
  "use strict";

  const { Minesweeper } = window.MinesweeperGame;
  const { solve } = window.MinesweeperSolver;

  const elements = {
    board: document.querySelector("#board"),
    difficulty: document.querySelector("#difficulty"),
    restart: document.querySelector("#restart"),
    flagMode: document.querySelector("#flag-mode"),
    aiHint: document.querySelector("#ai-hint"),
    aiStep: document.querySelector("#ai-step"),
    aiAuto: document.querySelector("#ai-auto"),
    minesLeft: document.querySelector("#mines-left"),
    time: document.querySelector("#time"),
    status: document.querySelector("#status")
  };

  let game;
  let seconds;
  let timerId;
  let flagMode;
  let aiTimerId;
  let aiRunning;
  let aiMessage;
  let aiOverlay;

  function startGame() {
    stopTimer();
    stopAi();
    game = new Minesweeper(elements.difficulty.value);
    seconds = 0;
    flagMode = false;
    aiMessage = "";
    aiOverlay = new Map();

    elements.time.value = 0;
    elements.flagMode.setAttribute("aria-pressed", "false");
    elements.board.style.setProperty("--columns", game.cols);

    buildBoard();
    render();
  }

  function buildBoard() {
    const fragment = document.createDocumentFragment();

    game.board.flat().forEach((cell) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.row = cell.row;
      button.dataset.col = cell.col;
      button.setAttribute("role", "gridcell");
      fragment.append(button);
    });

    elements.board.replaceChildren(fragment);
  }

  function render() {
    elements.minesLeft.value = game.minesLeft;
    elements.status.textContent = getStatusMessage();

    elements.board.querySelectorAll(".cell").forEach((button) => {
      const cell = game.getCell(
        Number(button.dataset.row),
        Number(button.dataset.col)
      );
      renderCell(button, cell);
    });
  }

  function renderCell(button, cell) {
    button.className = "cell";
    button.textContent = "";
    button.title = "";

    if (cell.isRevealed) {
      button.classList.add("revealed");

      if (cell.isMine) {
        button.textContent = "✹";
        button.classList.add("mine");
        button.setAttribute("aria-label", "地雷 / Mine");
      } else if (cell.nearbyMines > 0) {
        button.textContent = cell.nearbyMines;
        button.classList.add(`n${cell.nearbyMines}`);
        button.setAttribute("aria-label", `附近有 ${cell.nearbyMines} 个雷 / ${cell.nearbyMines} adjacent mines`);
      } else {
        button.setAttribute("aria-label", "空白格 / Empty cell");
      }
    } else if (cell.isFlagged) {
      button.textContent = "⚑";
      button.setAttribute("aria-label", "已插旗 / Flagged");
    } else {
      button.setAttribute("aria-label", `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列 / Row ${cell.row + 1}, column ${cell.col + 1}`);
    }

    const overlay = aiOverlay.get(getPositionKey(cell.row, cell.col));
    if (overlay && !cell.isRevealed && !cell.isFlagged) {
      button.classList.add(overlay.className);
      button.title = overlay.title;
    }
  }

  function getStatusMessage() {
    const messages = {
      ready: "点击任意格开始。/ Click any cell to start.",
      playing: "游戏进行中。/ Playing.",
      won: `胜利！用时 ${seconds} 秒。/ You won in ${seconds} seconds.`,
      lost: "踩到雷了。点击“重新开始 / Restart”再试一次。/ Mine hit. Restart to try again."
    };
    return aiMessage ? `${messages[game.state]} ${aiMessage}` : messages[game.state];
  }

  function startTimer() {
    timerId = setInterval(() => {
      seconds++;
      elements.time.value = seconds;
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function stopAi() {
    clearInterval(aiTimerId);
    aiTimerId = null;
    aiRunning = false;
    if (elements.aiAuto) elements.aiAuto.setAttribute("aria-pressed", "false");
  }

  function finishTurn(previousState) {
    if (previousState === "ready" && game.state === "playing") startTimer();
    if (game.state === "won" || game.state === "lost") {
      stopTimer();
      stopAi();
    }
    render();
  }

  function getPositionKey(row, col) {
    return `${row},${col}`;
  }

  function setAiOverlay(result) {
    aiOverlay.clear();

    result.safeMoves.forEach((move) => {
      aiOverlay.set(getPositionKey(move.row, move.col), {
        className: "ai-safe",
        title: "AI判断：确定安全 / AI: certainly safe"
      });
    });

    result.flagMoves.forEach((move) => {
      aiOverlay.set(getPositionKey(move.row, move.col), {
        className: "ai-flag",
        title: "AI判断：确定是雷 / AI: certainly a mine"
      });
    });

    if (result.safeMoves.length === 0 && result.flagMoves.length === 0 && result.bestMove) {
      aiOverlay.set(getPositionKey(result.bestMove.row, result.bestMove.col), {
        className: "ai-best",
        title: `AI建议：雷率约 ${formatProbability(result.bestMove.mineProbability)} / AI: mine risk about ${formatProbability(result.bestMove.mineProbability)}`
      });
    }
  }

  function formatProbability(probability) {
    return `${Math.round(probability * 1000) / 10}%`;
  }

  function showAiHint() {
    const result = solve(game);
    aiMessage = result.explanation;
    setAiOverlay(result);
    render();
  }

  function applyAiStep() {
    if (game.state === "won" || game.state === "lost") {
      stopAi();
      return;
    }

    const result = solve(game);
    aiMessage = result.explanation;
    aiOverlay.clear();

    const previousState = game.state;
    result.flagMoves.forEach((move) => {
      const cell = game.getCell(move.row, move.col);
      if (cell && !cell.isFlagged && !cell.isRevealed) {
        game.toggleFlag(move.row, move.col);
      }
    });

    const revealMove = result.safeMoves[0] ?? (
      result.bestMove?.type === "reveal" ? result.bestMove : null
    );

    if (revealMove) {
      game.reveal(revealMove.row, revealMove.col);
    } else if (result.flagMoves.length === 0) {
      aiMessage = "AI没有找到可执行的下一步。/ AI found no playable move.";
      stopAi();
    }

    finishTurn(previousState);
  }

  function toggleAiAuto() {
    if (aiRunning) {
      stopAi();
      aiMessage = "AI接管已暂停。/ AI auto-play paused.";
      render();
      return;
    }

    aiRunning = true;
    elements.aiAuto.setAttribute("aria-pressed", "true");
    applyAiStep();
    aiTimerId = setInterval(applyAiStep, 260);
  }

  function getCellFromEvent(event) {
    const button = event.target.closest(".cell");
    if (!button) return null;
    return {
      row: Number(button.dataset.row),
      col: Number(button.dataset.col)
    };
  }

  elements.board.addEventListener("click", (event) => {
    const position = getCellFromEvent(event);
    if (!position) return;

    stopAi();
    aiMessage = "";
    aiOverlay.clear();
    const previousState = game.state;
    if (flagMode) {
      game.toggleFlag(position.row, position.col);
    } else {
      game.reveal(position.row, position.col);
    }
    finishTurn(previousState);
  });

  elements.board.addEventListener("contextmenu", (event) => {
    const position = getCellFromEvent(event);
    if (!position) return;

    event.preventDefault();
    stopAi();
    aiMessage = "";
    aiOverlay.clear();
    game.toggleFlag(position.row, position.col);
    render();
  });

  elements.flagMode.addEventListener("click", () => {
    flagMode = !flagMode;
    elements.flagMode.setAttribute("aria-pressed", String(flagMode));
  });

  elements.aiHint.addEventListener("click", showAiHint);
  elements.aiStep.addEventListener("click", applyAiStep);
  elements.aiAuto.addEventListener("click", toggleAiAuto);
  elements.restart.addEventListener("click", startGame);
  elements.difficulty.addEventListener("change", startGame);

  startGame();
})();
