

import { WebSocketServer } from 'ws';
import { Game, MOVE_DIRECTIONS } from './game.js';
import { EventEmitter } from './observer/observer.js';
import { NumberUtility } from './number-utility.js';

const eventEmitter = new EventEmitter();
const numberUtility = new NumberUtility();
let game;

// Инициализация WebSocket сервера
const wss = new WebSocketServer({ port: 3001 }, () => {
  console.log("WebSocket server started on port 3001");
});

wss.on("connection", async (ws) => {
  console.log("Client connected. Total connections:", wss.clients.size);

  // Обработка входящих сообщений от клиента
  ws.on("message", async (data) => {
    try {
      const action = JSON.parse(data);

      if (!action.procedure || typeof action.procedure !== "string") {
        ws.send(
          JSON.stringify({
            procedure: "error",
            result: "Invalid request format",
            type: "response",
          })
        );
        return;
      }

      switch (action.procedure) {
        case "startGame":
          await handleStartGame(action, ws);
          break;
        case "movePlayer":
          await handleMovePlayer(action, ws);
          break;
        case "restart":
          await handleRestart(action, ws);
          break;
        default:
          await handleGeneralProcedure(action, ws);
          break;
      }
    } catch (error) {
      console.error("Error handling message:", error);
      ws.send(
        JSON.stringify({
          procedure: "error",
          result: "Invalid or malformed request",
          type: "response",
        })
      );
    }
  });

  // Обработка закрытия соединения
  ws.on("close", () => {
    console.log("Client disconnected.");
    if (game) {
      game.unsubscribeAll(); // Отписываемся от всех обновлений
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error for client:", err);
  });
});

// // Обработчик начала игры
async function handleStartGame(action, ws) {
  try {
    if (game) {
      // Если игра уже существует, отправляем текущее состояние
      const status = await game.getStatus();
      const settings = await game.getSettings();
      const googlePosition = await game.getGooglePosition();

      const response = {
        procedure: "startGame",
        result: {
          status,
          settings,
          googlePosition,
        },
        type: "response",
      };

      ws.send(JSON.stringify(response));
      console.log("Game state sent to client.");
      return;
    }
    const { settings } = action.data;
    
    game = new Game(numberUtility, eventEmitter);
    await game.setSettings(settings)
    await game.start();

    
    console.log("Игра успешно инициализирована.");

    // Подписываемся на обновления для данного клиента
    const connectionHandler = async () => {
      try {
        const status = await game.getStatus();
        const settings = await game.getSettings();
        const googlePosition = await game.getGooglePosition();

        const response = {
          procedure: "updatePosition",
          result: {
            status,
            settings,
            googlePosition,
          },
          type: "response",
        };

        ws.send(JSON.stringify(response));
        console.log("Initial state sent to client:", response);
      } catch (error) {
        console.error("Error sending initial state:", error);
      }
    };

    game.subscribe(connectionHandler);

    // Отправляем начальное состояние игры клиенту
    const initialStateResponse = {
      procedure: "startGame",
      result: {
        status: await game.getStatus(),
        settings: await game.getSettings(),
        googlePosition: await game.getGooglePosition(),
      },
      type: "response",
    };

    ws.send(JSON.stringify(initialStateResponse));
    console.log("Game started and initial state sent to client.");
  } catch (error) {
    console.error("Error starting game:", error);
    ws.send(
      JSON.stringify({
        procedure: "error",
        result: "Failed to start game",
        type: "response",
      })
    );
  }
}

// // Обработчик движения игрока
async function handleMovePlayer(action, ws) {
  try {
    if (!game) {
      ws.send(
        JSON.stringify({
          procedure: "error",
          result: "Game is not initialized",
          type: "response",
        })
      );
      return;
    }

    const {  playerId, direction } = action.data;
    if (
      !["1", "2"].includes(playerId) ||
      ![MOVE_DIRECTIONS.UP, MOVE_DIRECTIONS.DOWN, MOVE_DIRECTIONS.LEFT, MOVE_DIRECTIONS.RIGHT].includes(direction)
    ) {
      ws.send(
        JSON.stringify({
          procedure: "error",
          result: "Invalid move parameters",
          type: "response",
        })
      );
      return;
    }

    await game.movePlayer( playerId, direction );
    const position =
      playerId === "1"
        ? await game.getPlayer1Position()
        : await game.getPlayer2Position();

    const response = {
      procedure: "updatePosition",
      result: position,
      type: "response",
    };

    ws.send(JSON.stringify(response));
  } catch (error) {
    console.error("Error moving player:", error);
    ws.send(
      JSON.stringify({
        procedure: "error",
        result: "Failed to move player",
        type: "response",
      })
    );
  }
}

async function handleRestart(action, ws) {
  try {
    if (!game) {
      ws.send(
        JSON.stringify({
          procedure: "error",
          result: "Game is not initialized",
          type: "response",
        })
      );
      return;
    }

    const { settings } = action.data; // Извлекаем новые настройки из action.data.settings

    if (!settings || !settings.gridSize || !settings.pointsToWin || !settings.pointsToLose) {
      ws.send(
        JSON.stringify({
          procedure: "error",
          result: "Invalid settings provided",
          type: "response",
        })
      );
      return;
    }

    // Создаем новую игру с указанными настройками
    game = new Game(numberUtility, eventEmitter);
    await game.setSettings(settings); // Применяем настройки
    await game.restart(); // Перезапускаем игру

    const status = await game.getStatus();
    const googlePosition = await game.getGooglePosition();

    const response = {
      procedure: "restart",
      result: {
        status,
        settings,
        googlePosition,
      },
      type: "response",
    };

    // Отправляем новое состояние игры всем клиентам
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(response));
      }
    });

    console.log("Game restarted and state sent to all clients.");
  } catch (error) {
    console.error("Error during game restart:", error);

    // Отправляем ошибку клиенту
    const errorResponse = {
      procedure: "error",
      result: "Failed to restart game",
      type: "response",
    };
    ws.send(JSON.stringify(errorResponse));
  }
}

async function handleGeneralProcedure(action, ws) {
  try {
    if (!game) {
      ws.send(
        JSON.stringify({
          procedure: "error",
          result: "Game is not initialized",
          type: "response",
        })
      );
      return;
    }

    const result = await game[action.procedure]();
    const response = {
      procedure: action.procedure,
      result,
      type: "response",
    };

    ws.send(JSON.stringify(response));
  } catch (error) {
    console.error(`Error executing procedure ${action.procedure}:`, error);
    ws.send(
      JSON.stringify({
        procedure: "error",
        result: "Failed to execute procedure",
        type: "response",
      })
    );
  }
}

