

class Api {
  constructor(ws) {
    this.ws = ws;
    this.resolvers = {};
    this.onMessage = this.onMessage.bind(this);
    this.ws.addEventListener("message", this.onMessage);
  }

  onMessage(event) {
    try {
      const resultAction = JSON.parse(event.data);
      const { procedure, result, error } = resultAction;

      if (error) {
        console.error(`Error in procedure "${procedure}":`, error);
        this.triggerResolvers(procedure, null, error); // Оповещаем всех подписчиков об ошибке
        return;
      }

      if (this.resolvers[procedure] && this.resolvers[procedure].length > 0) {
        this.resolvers[procedure].shift()(result); // Резолвим первый подписчик
      }
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  }

  send(procedureName, data = {}) {
    return new Promise((resolve, reject) => {
      this.ws.send(
        JSON.stringify({
          procedure: procedureName,
          data,
        })
      );

      if (!this.resolvers[procedureName]) {
        this.resolvers[procedureName] = [];
      }

      this.resolvers[procedureName].push((data, error) => {
        if (error) {
          reject(error); // Отклоняем промис при ошибке
        } else {
          resolve(data); // Резолвим промис при успешном результате
        }
      });
    });
  }

  triggerResolvers(procedure, data, error) {
    const resolvers = this.resolvers[procedure];
    if (resolvers) {
      while (resolvers.length > 0) {
        const resolver = resolvers.shift();
        resolver(data, error);
      }
    }
  }

  cleanup() {
    this.ws.removeEventListener("message", this.onMessage);
    this.resolvers = {}; // Очищаем все резолверы
  }
}

export class GameRemoteProxy {
  constructor(numberUtility, eventEmitter, ws) {
    this.eventEmitter = eventEmitter;
    this.numberUtility = numberUtility;
    this.ws = ws;
    this.api = new Api(this.ws);

    this.googlePosition = null;
    this.player1Position = null;
    this.player2Position = null;
    this.score = null;

    this.ws.addEventListener("open", () => {
      console.log("WebSocket connection opened.");
    });

    this.ws.addEventListener("close", () => {
      console.log("WebSocket connection closed.");
      this.cleanup();
    });

    this.ws.addEventListener("error", (err) => {
      console.error("WebSocket error:", err);
    });

    this.ws.addEventListener("message", (webEvent) => {
      try {
        const event = JSON.parse(webEvent.data);
        switch (event.procedure) {
          case "updatePosition":
            this.updatePlayerPositions(event.result);
            this.eventEmitter.emit("change"); // Уведомляем об изменении
            break;
          default:
            console.warn(`Unknown procedure received: ${event.procedure}`);
        }
      } catch (e) {
        console.error("Failed to process message:", e);
      }
    });
  }

  async start(settings) {
    return new Promise((resolve, reject) => {
      this.api.send("startGame", {settings}).then(resolve).catch(reject);
    });
  }

  async restart(settings) {
    try {
      await this.api.send("restart", { settings }); // Отправляем запрос "restart" на сервер
      this.eventEmitter.emit("change"); // Уведомляем подписчиков об изменении состояния
    } catch (error) {
      console.error("Error during game restart:", error);
      throw error;
    }
  }

  updatePlayerPositions(newPositions) {
    this.googlePosition = newPositions.googlePosition;
    this.player1Position = newPositions.player1Position;
    this.player2Position = newPositions.player2Position;
    this.score = newPositions.score;
  }

  async stop() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.cleanup();
  }

  cleanup() {
    if (this.api) {
      this.api.cleanup();
    }
    this.ws = null;
    this.api = null;
  }

  async movePlayer(direction, playerId) {
    try {
      const response = await this.api.send("movePlayer", { direction, playerId });
      this.updatePlayerPositions(response);
      this.eventEmitter.emit("change");
      return response;
    } catch (error) {
      console.error("Error moving player:", error);
      throw error;
    }
  }

  async setSettings(settings){
    try {
      const response = await this.api.send("setSettings", { settings} )
      console.log(`proxy, ${settings}`)
      this.initialSettings(response)
      this.eventEmitter.emit("change");
      return response;
    } catch(error) {
      console.error("Error set Settings:", error);
      throw error;
    }
  }

  async getData(procedure) {
    try {
      return await this.api.send(procedure);
    } catch (error) {
      console.error(`Error fetching data for procedure "${procedure}":`, error);
      throw error;
    }
  }

  async getEventEmitter() {
    return this.eventEmitter;
  }

  async getSettings() {
    return this.getData("getSettings");
  }

  async getStatus() {
    return this.getData("getStatus");
  }

  async getPlayer1Position() {
    return this.getData("getPlayer1Position");
  }

  async getPlayer2Position() {
    return this.getData("getPlayer2Position");
  }

  async getGooglePosition() {
    return this.getData("getGooglePosition");
  }

  async getScore() {
    return this.getData("getScore");
  }
}