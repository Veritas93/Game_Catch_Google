

import { Player, Position } from "./player.js";

export class Game {
  #status = GAME_STATUSES.PENDING;
  #googleJumpIntervalId;
  #googleTimeoutId;
  #googleTimerStarted = false;
  #numberUtility;
  #eventEmitter;
  #players = [];
  #googlePosition;
  #player1Position;
  #player2Position;
  #settings = {
    gridSize: {
      rowsCount: 4,
      columnsCount: 4,
    },
    pointsToWin: 8,
    pointsToLose: 8,
    jumpInterval: 2000,
  };
  #score = {
    1: { points: 0 },
    2: { points: 0 },
    3: { points: 0 },
  };

  constructor(numberUtility, eventEmitter) {
    this.#numberUtility = numberUtility;
    this.#eventEmitter = eventEmitter;
  }

  async getScore() {
    return this.#score;
  }

  async setSettings(settings) {
    if (
      settings.gridSize.rowsCount * settings.gridSize.columnsCount < 3
    ) {
      throw new Error("Grid size must be at least 4 cells");
    }

    this.#settings = {
      ...this.#settings,
      ...settings,
      gridSize: settings.gridSize
        ? { ...this.#settings.gridSize, ...settings.gridSize }
        : this.#settings.gridSize,
    };
  }

  async getSettings() {
    return this.#settings.gridSize;
  }

  async getEventEmitter() {
    return this.#eventEmitter;
  }

  subscribe(callback) {
    this.#eventEmitter.subscribe("change", callback);
  }

  unsubscribe(callback) {
    this.#eventEmitter.off("change", callback);
  }

  async #initPlayersPosition() {
    const uniqueCoordinates = new Set();
    const maxPlayers = 3;
    let attempts = 0;

    while (this.#players.length < maxPlayers && attempts < 100) {
      const p = new Player(this.#numberUtility, this.#settings.gridSize);
      const pl = await p.getPlayer();
      const coordinatesKey = `${pl.position.x},${pl.position.y}`;

      if (!uniqueCoordinates.has(coordinatesKey)) {
        uniqueCoordinates.add(coordinatesKey);
        this.#players.push(pl);
      } else {
        console.warn(`Duplicate coordinates detected: ${coordinatesKey}`);
      }

      attempts++;
    }

    if (this.#players.length < maxPlayers) {
      throw new Error("Failed to initialize player positions.");
    }

    this.#googlePosition = this.#players[0].position;
    this.#player1Position = this.#players[1].position;
    this.#player2Position = this.#players[2].position;
  }

  async #jumpGoogle() {
    const newPosition = new Position(
      await this.#numberUtility.getRandomNumber(0, this.#settings.gridSize.rowsCount - 1),
      await this.#numberUtility.getRandomNumber(0, this.#settings.gridSize.columnsCount - 1)
    );

    if (
      newPosition.isEqual(this.#googlePosition) ||
      newPosition.isEqual(this.#player1Position) ||
      newPosition.isEqual(this.#player2Position)
    ) {
      return this.#jumpGoogle();
    }

    this.#googlePosition = newPosition;
    this.#eventEmitter.emit("change");
  }

  async #runGoogleJumpInterval() {
    this.#googleJumpIntervalId = setInterval(async () => {
      await this.#jumpGoogle();
    }, this.#settings.jumpInterval);
  }

  async startGoogleJumpTimer() {
    await this.#runGoogleJumpInterval();
    this.#startGoogleTimer();
  }

  async start() {
    if (this.#status !== GAME_STATUSES.PENDING) {
      console.warn("Game is already started or finished.");
      return;
    }

    try {
      console.log("Starting game...");
      this.#status = GAME_STATUSES.IN_PROGRESS;
      await this.#initPlayersPosition();
      await this.startGoogleJumpTimer();
    } catch (error) {
      console.error("Error starting the game:", error);
      this.#status = GAME_STATUSES.STOP;
      throw error;
    }
  }

  async restart() {
    if (this.#status === GAME_STATUSES.IN_PROGRESS) {
      console.warn("Cannot restart game while it's in progress.");
      return;
    }

    console.log("Restarting game...");

    if (this.#googleJumpIntervalId) {
      clearInterval(this.#googleJumpIntervalId);
    }
    if (this.#googleTimeoutId) {
      clearTimeout(this.#googleTimeoutId);
    }

    this.#status = GAME_STATUSES.PENDING;
    this.#score = {
      1: { points: 0 },
      2: { points: 0 },
      3: { points: 0 },
    };
    this.#googleTimerStarted = false;
    this.#status = GAME_STATUSES.IN_PROGRESS;
    await this.#initPlayersPosition();
    await this.#runGoogleJumpInterval();
    this.#startGoogleTimer();
    this.#eventEmitter.emit("change");
  }

  async #startGoogleTimer() {
    if (!this.#googleTimerStarted) {
      this.#googleTimerStarted = true;

      this.#googleTimeoutId = setInterval(async () => {
        try {
          this.#score[1].points++;
          console.log("Google gained a point.");
          this.#eventEmitter.emit("change");

          if (this.#score[1].points === this.#settings.pointsToLose) {
            console.log("Google reached the losing score.");
            clearInterval(this.#googleTimeoutId);
            await this.#finishGame();
          }
        } catch (error) {
          console.error("Error in Google timer:", error);
        }
      }, 3000);
    }
  }

  async getStatus() {
    return this.#status;
  }

  async getGooglePosition() {
    return this.#googlePosition;
  }

  async getPlayer1Position() {
    return this.#player1Position;
  }

  async getPlayer2Position() {
    return this.#player2Position;
  }

  async movePlayer(playerId, direction) {
    if (this.#status !== GAME_STATUSES.IN_PROGRESS) {
      console.warn("Game is not in progress.");
      return;
    }
    const delta = {
      [MOVE_DIRECTIONS.UP]: { x: 0, y: -1 },
      [MOVE_DIRECTIONS.RIGHT]: { x: 1, y: 0 },
      [MOVE_DIRECTIONS.DOWN]: { x: 0, y: 1 },
      [MOVE_DIRECTIONS.LEFT]: { x: -1, y: 0 },
    }[direction];

    if (!delta) {
      throw new Error(`Invalid direction ${direction}`);
    }

    const currentPlayer = {
      "1": this.#player1Position,
      "2": this.#player2Position,
    }[playerId];

    if (!currentPlayer) {
      throw new Error("Invalid player ID");
    }

    const newPosition = new Position(
      currentPlayer.x + delta.x,
      currentPlayer.y + delta.y
    );

    if (!this.#isPositionInGrid(newPosition)) {
      console.warn("New position is out of grid bounds.");
      return;
    }

    if (this.#isPositionBusy(newPosition)) {
      console.warn("New position is occupied by another player.");
      return;
    }

    await this.#checkGoogleCatching(newPosition, playerId);
  }

  #isPositionInGrid(position) {
    return (
      position.x >= 0 &&
      position.x < this.#settings.gridSize.columnsCount &&
      position.y >= 0 &&
      position.y < this.#settings.gridSize.rowsCount
    );
  }

  #isPositionBusy(position) {
    return (
      position.isEqual(this.#player1Position) || position.isEqual(this.#player2Position)
    );
  }

  async #checkGoogleCatching(position, playerId) {
    if (position.isEqual(this.#googlePosition)) {
      console.log(`Player ${playerId} caught Google!`);
      this.#score[parseInt(playerId) + 1].points++;

      if (this.#score[parseInt(playerId) + 1].points === this.#settings.pointsToWin) {
        console.log(`Player ${playerId} wins!`);
        await this.#finishGame();
        return;
      }

      await this.#initPlayersPosition();
      clearTimeout(this.#googleTimeoutId);
      this.#googleTimerStarted = false;
      this.#startGoogleTimer();
    } else {
      if (playerId === "1") {
        this.#player1Position = position;
      } else if (playerId === "2") {
        this.#player2Position = position;
      }
      this.#eventEmitter.emit("change");
    }
  }

  async #finishGame() {
    clearInterval(this.#googleJumpIntervalId);
    clearTimeout(this.#googleTimeoutId);

    if (this.#score[1].points === this.#settings.pointsToLose) {
      console.log("Google wins!");
      this.#status = GAME_STATUSES.WIN_GOOGLE;
    } else if (this.#score[2].points === this.#settings.pointsToWin) {
      console.log("Player 1 wins!");
      this.#status = GAME_STATUSES.WIN_PLAYER_1;
    } else if (this.#score[3].points === this.#settings.pointsToWin) {
      console.log("Player 2 wins!");
      this.#status = GAME_STATUSES.WIN_PLAYER_2;
    } else {
      console.log("Game finished with no winner.");
      this.#status = GAME_STATUSES.FINISHED;
    }

    this.#eventEmitter.emit("change");
  }

  async stop() {
    console.log("Stopping game...");

    clearInterval(this.#googleJumpIntervalId);
    clearTimeout(this.#googleTimeoutId);

    this.#status = GAME_STATUSES.STOP;
    this.#eventEmitter.emit("change");
  }
}

export const GAME_STATUSES = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN-PROGRESS",
  FINISHED: "FINISHED",
  WIN_GOOGLE: "WIN-GOOGLE",
  WIN_PLAYER_1: "WIN-PLAYER-1",
  WIN_PLAYER_2: "WIN-PLAYER-2",
  STOP: "STOP",
};

export const MOVE_DIRECTIONS = {
  RIGHT: "RIGHT",
  UP: "UP",
  DOWN: "DOWN",
  LEFT: "LEFT",
};