(function () {
  "use strict";

  const DEFAULT_LIMITS = Object.freeze({
    maxComponentVariables: 26,
    maxSearchNodes: 600000,
    maxSolutions: 120000
  });

  function keyOf(cell) {
    return `${cell.row},${cell.col}`;
  }

  function positionOf(key) {
    const [row, col] = key.split(",").map(Number);
    return { row, col };
  }

  function combination(n, k) {
    if (k < 0 || k > n) return 0;
    const r = Math.min(k, n - k);
    let result = 1;
    for (let i = 1; i <= r; i++) {
      result *= (n - r + i) / i;
    }
    return result;
  }

  function makeMove(type, key, probability = type === "flag" ? 1 : 0) {
    return { type, ...positionOf(key), mineProbability: probability };
  }

  function dedupeMoves(moves) {
    const seen = new Set();
    return moves.filter((move) => {
      const id = `${move.type}:${move.row},${move.col}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function normalizeConstraints(constraints) {
    const bySignature = new Map();

    constraints.forEach((constraint) => {
      const cells = [...new Set(constraint.cells)].sort();
      const signature = cells.join("|");
      const existing = bySignature.get(signature);
      if (!existing || constraint.count < existing.count) {
        bySignature.set(signature, { cells, count: constraint.count });
      }
    });

    return [...bySignature.values()]
      .filter((constraint) => constraint.cells.length > 0)
      .filter((constraint) => constraint.count >= 0 && constraint.count <= constraint.cells.length);
  }

  function collectConstraints(game) {
    const constraints = [];
    const unknownKeys = new Set();

    game.board.flat().forEach((cell) => {
      if (!cell.isRevealed || cell.isMine || cell.nearbyMines === 0) return;

      const neighbors = game.getNeighbors(cell);
      const flags = neighbors.filter((neighbor) => neighbor.isFlagged).length;
      const unknowns = neighbors
        .filter((neighbor) => !neighbor.isRevealed && !neighbor.isFlagged)
        .map(keyOf);

      unknowns.forEach((key) => unknownKeys.add(key));
      if (unknowns.length > 0) {
        constraints.push({
          cells: unknowns,
          count: cell.nearbyMines - flags
        });
      }
    });

    return {
      constraints: normalizeConstraints(constraints),
      unknownKeys
    };
  }

  function inferCertainMoves(constraints) {
    let working = normalizeConstraints(constraints);
    const safe = new Set();
    const flags = new Set();
    let changed = true;

    while (changed) {
      changed = false;

      working.forEach((constraint) => {
        const cells = constraint.cells.filter((key) => !safe.has(key) && !flags.has(key));
        const count = constraint.count - constraint.cells.filter((key) => flags.has(key)).length;

        if (cells.length === 0) return;
        if (count === 0) {
          cells.forEach((key) => {
            if (!safe.has(key)) {
              safe.add(key);
              changed = true;
            }
          });
        } else if (count === cells.length) {
          cells.forEach((key) => {
            if (!flags.has(key)) {
              flags.add(key);
              changed = true;
            }
          });
        }
      });

      working = normalizeConstraints(
        working.map((constraint) => {
          const cells = constraint.cells.filter((key) => !safe.has(key) && !flags.has(key));
          const count = constraint.count - constraint.cells.filter((key) => flags.has(key)).length;
          return { cells, count };
        })
      );

      for (let i = 0; i < working.length; i++) {
        const left = working[i];
        const leftSet = new Set(left.cells);
        for (let j = 0; j < working.length; j++) {
          if (i === j) continue;
          const right = working[j];
          if (left.cells.length >= right.cells.length) continue;
          if (!left.cells.every((key) => right.cells.includes(key))) continue;

          const diff = right.cells.filter((key) => !leftSet.has(key));
          const count = right.count - left.count;
          if (diff.length === 0) continue;

          if (count === 0) {
            diff.forEach((key) => {
              if (!safe.has(key)) {
                safe.add(key);
                changed = true;
              }
            });
          } else if (count === diff.length) {
            diff.forEach((key) => {
              if (!flags.has(key)) {
                flags.add(key);
                changed = true;
              }
            });
          }
        }
      }
    }

    return {
      safeMoves: [...safe].map((key) => makeMove("reveal", key, 0)),
      flagMoves: [...flags].map((key) => makeMove("flag", key, 1))
    };
  }

  function buildComponents(frontierKeys, constraints) {
    const parent = new Map();
    const find = (key) => {
      if (parent.get(key) !== key) parent.set(key, find(parent.get(key)));
      return parent.get(key);
    };
    const union = (a, b) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent.set(rootB, rootA);
    };

    frontierKeys.forEach((key) => parent.set(key, key));
    constraints.forEach((constraint) => {
      constraint.cells.slice(1).forEach((key) => union(constraint.cells[0], key));
    });

    const grouped = new Map();
    frontierKeys.forEach((key) => {
      const root = find(key);
      if (!grouped.has(root)) grouped.set(root, []);
      grouped.get(root).push(key);
    });

    return [...grouped.values()].map((keys) => {
      const keySet = new Set(keys);
      return {
        keys,
        constraints: constraints.filter((constraint) =>
          constraint.cells.some((key) => keySet.has(key))
        )
      };
    });
  }

  function enumerateComponent(component, limits) {
    if (component.keys.length > limits.maxComponentVariables) {
      return { skipped: true, reason: "component-too-large" };
    }

    const degree = new Map(component.keys.map((key) => [key, 0]));
    component.constraints.forEach((constraint) => {
      constraint.cells.forEach((key) => degree.set(key, (degree.get(key) ?? 0) + 1));
    });

    const orderedKeys = [...component.keys].sort((a, b) => degree.get(b) - degree.get(a));
    const indexOf = new Map(orderedKeys.map((key, index) => [key, index]));
    const constraints = component.constraints.map((constraint) => ({
      cells: constraint.cells.map((key) => indexOf.get(key)),
      count: constraint.count
    }));

    const assigned = Array(orderedKeys.length).fill(-1);
    const byMineCount = new Map();
    const cellMineCountsByMineCount = new Map(orderedKeys.map((key) => [key, new Map()]));
    let nodes = 0;
    let solutionCount = 0;
    let stopped = false;

    function constraintsStillPossible() {
      return constraints.every((constraint) => {
        let mines = 0;
        let unknown = 0;
        constraint.cells.forEach((index) => {
          if (assigned[index] === 1) mines++;
          else if (assigned[index] === -1) unknown++;
        });
        return mines <= constraint.count && mines + unknown >= constraint.count;
      });
    }

    function recordSolution() {
      const mines = assigned.reduce((sum, value) => sum + value, 0);
      byMineCount.set(mines, (byMineCount.get(mines) ?? 0) + 1);
      orderedKeys.forEach((key, index) => {
        if (assigned[index] !== 1) return;
        const counts = cellMineCountsByMineCount.get(key);
        counts.set(mines, (counts.get(mines) ?? 0) + 1);
      });
      solutionCount++;
      if (solutionCount >= limits.maxSolutions) stopped = true;
    }

    function backtrack(index) {
      if (stopped) return;
      nodes++;
      if (nodes > limits.maxSearchNodes) {
        stopped = true;
        return;
      }
      if (!constraintsStillPossible()) return;
      if (index === orderedKeys.length) {
        recordSolution();
        return;
      }

      assigned[index] = 0;
      backtrack(index + 1);
      assigned[index] = 1;
      backtrack(index + 1);
      assigned[index] = -1;
    }

    backtrack(0);

    if (stopped) {
      return { skipped: true, reason: "search-limit" };
    }

    return {
      skipped: false,
      keys: orderedKeys,
      byMineCount,
      cellMineCountsByMineCount,
      solutionCount
    };
  }

  function estimateLocalProbabilities(constraints, unknownKeys, fallbackProbability) {
    const totals = new Map();
    const counts = new Map();

    constraints.forEach((constraint) => {
      const estimate = constraint.count / constraint.cells.length;
      constraint.cells.forEach((key) => {
        totals.set(key, (totals.get(key) ?? 0) + estimate);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });

    return [...unknownKeys].map((key) => ({
      ...positionOf(key),
      mineProbability: counts.has(key) ? totals.get(key) / counts.get(key) : fallbackProbability,
      source: "estimate"
    }));
  }

  function calculateProbabilities(game, constraints, frontierKeys) {
    const allUnknown = game.board.flat()
      .filter((cell) => !cell.isRevealed && !cell.isFlagged)
      .map(keyOf);
    const allUnknownSet = new Set(allUnknown);
    const frontierSet = new Set(frontierKeys);
    const offFrontierKeys = allUnknown.filter((key) => !frontierSet.has(key));
    const fallbackProbability = allUnknown.length > 0 ? game.minesLeft / allUnknown.length : 0;

    if (frontierKeys.length === 0) {
      return allUnknown.map((key) => ({
        ...positionOf(key),
        mineProbability: fallbackProbability,
        source: "global"
      }));
    }

    const components = buildComponents(frontierKeys, constraints);
    const enumerated = components.map((component) =>
      enumerateComponent(component, DEFAULT_LIMITS)
    );

    if (enumerated.some((component) => component.skipped || component.solutionCount === 0)) {
      return estimateLocalProbabilities(constraints, allUnknownSet, fallbackProbability);
    }

    const totalWeightByComponent = new Map();
    const mineWeightByKey = new Map();
    let totalWeight = 0;
    let offFrontierMineWeight = 0;

    function walk(componentIndex, mineSum, weight, selectedCounts) {
      if (componentIndex === enumerated.length) {
        const offMines = game.minesLeft - mineSum;
        const offWays = combination(offFrontierKeys.length, offMines);
        if (offWays === 0) return;

        const finalWeight = weight * offWays;
        totalWeight += finalWeight;
        offFrontierMineWeight += finalWeight * offMines;

        selectedCounts.forEach((mineCount, index) => {
          const component = enumerated[index];
          const componentWeight = finalWeight;
          totalWeightByComponent.set(index, (totalWeightByComponent.get(index) ?? 0) + componentWeight);
          component.keys.forEach((key) => {
            const count = component.cellMineCountsByMineCount.get(key).get(mineCount) ?? 0;
            const solutions = component.byMineCount.get(mineCount);
            mineWeightByKey.set(
              key,
              (mineWeightByKey.get(key) ?? 0) + componentWeight * (count / solutions)
            );
          });
        });
        return;
      }

      const component = enumerated[componentIndex];
      component.byMineCount.forEach((solutions, mines) => {
        selectedCounts.push(mines);
        walk(componentIndex + 1, mineSum + mines, weight * solutions, selectedCounts);
        selectedCounts.pop();
      });
    }

    walk(0, 0, 1, []);

    if (totalWeight === 0) {
      return estimateLocalProbabilities(constraints, allUnknownSet, fallbackProbability);
    }

    const probabilities = [];
    frontierKeys.forEach((key) => {
      probabilities.push({
        ...positionOf(key),
        mineProbability: (mineWeightByKey.get(key) ?? 0) / totalWeight,
        source: "exact"
      });
    });

    const offProbability = offFrontierKeys.length > 0
      ? offFrontierMineWeight / totalWeight / offFrontierKeys.length
      : 1;
    offFrontierKeys.forEach((key) => {
      probabilities.push({
        ...positionOf(key),
        mineProbability: offProbability,
        source: "global"
      });
    });

    return probabilities;
  }

  function scoreMove(game, probability) {
    const cell = game.getCell(probability.row, probability.col);
    const nearbyRevealedNumbers = game.getNeighbors(cell)
      .filter((neighbor) => neighbor.isRevealed && neighbor.nearbyMines > 0).length;
    return probability.mineProbability - nearbyRevealedNumbers * 0.0001;
  }

  function solve(game) {
    if (game.state === "won" || game.state === "lost") {
      return {
        safeMoves: [],
        flagMoves: [],
        probabilities: [],
        bestMove: null,
        explanation: "游戏已经结束。/ Game over."
      };
    }

    if (game.state === "ready") {
      const row = Math.floor(game.rows / 2);
      const col = Math.floor(game.cols / 2);
      return {
        safeMoves: [{ type: "reveal", row, col, mineProbability: 0 }],
        flagMoves: [],
        probabilities: [],
        bestMove: { type: "reveal", row, col, mineProbability: 0 },
        explanation: "第一步安全，AI 选择棋盘中心附近开局。/ First move is safe; AI opens near the center."
      };
    }

    const { constraints, unknownKeys } = collectConstraints(game);
    const certain = inferCertainMoves(constraints);
    const safeMoves = dedupeMoves(certain.safeMoves);
    const flagMoves = dedupeMoves(certain.flagMoves);

    if (safeMoves.length > 0 || flagMoves.length > 0) {
      return {
        safeMoves,
        flagMoves,
        probabilities: [],
        bestMove: safeMoves[0] ?? flagMoves[0],
        explanation: `发现 ${safeMoves.length} 个确定安全格，${flagMoves.length} 个确定雷。/ Found ${safeMoves.length} certainly safe cells and ${flagMoves.length} certain mines.`,
        stats: { constraints: constraints.length, frontier: unknownKeys.size }
      };
    }

    const probabilities = calculateProbabilities(game, constraints, [...unknownKeys])
      .filter((entry) => {
        const cell = game.getCell(entry.row, entry.col);
        return cell && !cell.isRevealed && !cell.isFlagged;
      })
      .sort((a, b) => scoreMove(game, a) - scoreMove(game, b));

    const best = probabilities[0] ?? null;
    return {
      safeMoves: [],
      flagMoves: [],
      probabilities,
      bestMove: best ? { type: "reveal", ...best } : null,
      explanation: best
        ? `没有确定步，选择估计雷率最低的格子：${Math.round(best.mineProbability * 1000) / 10}%。/ No certain move; choosing the lowest estimated mine risk.`
        : "没有可执行的 AI 步。/ No playable AI move.",
      stats: { constraints: constraints.length, frontier: unknownKeys.size }
    };
  }

  window.MinesweeperSolver = Object.freeze({ solve });
})();
