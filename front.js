import { NumberUtility } from "./number-utility.js";
import { EventEmitter } from "./observer/observer.js";
import { GameRemoteProxy as Game } from "./game-remove-proxy.js";
import { MOVE_DIRECTIONS } from "./game.js";

let cellsCache = [];
let player1ScoreElement, player2ScoreElement, googleScoreElement;
let game;
let gridGame

const initScoreElements = () => {
  player1ScoreElement = document.querySelector(
    ".result-container .result-block:nth-child(1) .result"
  );
  player2ScoreElement = document.querySelector(
    ".result-container .result-block:nth-child(2) .result"
  );
  googleScoreElement = document.querySelector(
    ".result-container .result-block:nth-child(3) .result"
  );
};

const updateScores = (score) => {
  player1ScoreElement.innerText = score[2]?.points || 0;
  player2ScoreElement.innerText = score[3]?.points || 0;
  googleScoreElement.innerText = score[1]?.points || 0;
};

const showLoadingIndicator = () => {
  document.getElementById("loading-indicator").style.display = "block";
};

const hideLoadingIndicator = () => {
  document.getElementById("loading-indicator").style.display = "none";
};

async function createWebSocketConnection() {
  return new Promise((resolve, reject) => {
    // const socket = new WebSocket("ws://localhost:3001");
    const socket = new WebSocket("https://game-catch-google.onrender.com");
    socket.onopen = () => {
      console.log("Соединение WebSocket установлено.");
      resolve(socket);
    };

    socket.onerror = (error) => {
      console.error("Ошибка WebSocket:", error);
      reject(error);
    };

    socket.onclose = () => {
      console.log("Соединение WebSocket закрыто.");
      alert("Соединение с сервером потеряно. Пожалуйста, повторите попытку или перезапустите игру.");
      hideLoadingIndicator();
      reject(new Error("Соединение WebSocket закрыто"));
    };
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initScoreElements();
  firstScreen();

  document
    .querySelector(".button.main-button")
    .addEventListener("click", async () => {
      try {
        showLoadingIndicator(); // Показываем индикатор загрузки

        let socket;
        while (!socket) {
          try {
            socket = await createWebSocketConnection();
          } catch (error) {
            console.error("Не удалось установить соединение WebSocket. Повторная попытка...");
            await new Promise((resolve) => setTimeout(resolve, 3000)); // Повтор через 3 секунды
          }
        }

        const selectedSettings = await setSettings()
        if (!selectedSettings) {
          console.error("Настройки не были установлены.");
          hideLoadingIndicator();
          return;
        }

        const numberUtility = new NumberUtility();
        const eventEmitter = new EventEmitter();
        game = new Game(numberUtility, eventEmitter, socket);

        await game.start(selectedSettings);
        
        const emitter = await game.getEventEmitter();
        emitter.on("change", () => {
          render();
        });

        hideLoadingIndicator(); // Скрываем индикатор загрузки
        setupPlayerMovement()
        // render();
      } catch (error) {
        console.error("Ошибка при запуске игры:", error);
        alert("Не удалось начать игру. Пожалуйста, повторите попытку.");
        hideLoadingIndicator();
      }
    });
});
const createGrid = async () => {
  if (!game) return;
  const startButton = document.getElementById("startButton");
  if (startButton) {
    startButton.style.display = "none";
  }
  gridGame = document.getElementById("grid-game");
  if (gridGame) {
    gridGame.style.display = "flex";
  }
  
  cellsCache = []; // Очищаем кэш ячеек перед созданием новой сетки

  const settings = await game.getSettings();
  const googlePosition = await game.getGooglePosition();
  const player1Position = await game.getPlayer1Position();
  const player2Position = await game.getPlayer2Position();

  if (!settings || !googlePosition || !player1Position || !player2Position) {
    console.error("Game data is incomplete. Cannot render grid.");
    return;
  }

  if (!cellsCache.length) {
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");

    for (let y = 0; y < settings.rowsCount; y++) {
      const trElement = document.createElement("tr");
      for (let x = 0; x < settings.columnsCount; x++) {
        const tdElement = document.createElement("td");
        tdElement.classList.add("cell");
        trElement.appendChild(tdElement);
        cellsCache.push(tdElement);
      }
      tbody.appendChild(trElement);
    }

    table.appendChild(tbody);

    const gridGame = document.getElementById("grid-game");
    if (gridGame) {
      gridGame.innerHTML = "";
      gridGame.appendChild(table);
    } else {
      console.warn("Element 'grid-game' not found in DOM.");
    }
  }

  cellsCache.forEach((cell) => (cell.innerHTML = ""));

  const positions = [
    { position: googlePosition, src: "./assets/googleIcon.svg" },
    { position: player1Position, src: "./assets/player1.svg" },
    { position: player2Position, src: "./assets/player2.svg" },
  ];

  positions.forEach(({ position, src }) => {
    const cellIndex = position.y * settings.columnsCount + position.x;
    const cell = cellsCache[cellIndex];
    if (cell) {
      const img = document.createElement("img");
      img.src = src;
      cell.appendChild(img);
    }
  });
};

const showWinModal = async (playerIndex) => {
  if (!game) return;

  const score = await game.getScore();

  document.getElementById("grid-game").style.display = "none";
  document.getElementById("win").style.display = "block";
  document.getElementById("won").style.display = "none";

  const title = document.querySelector("#win .title-modal");
  const balls = document.querySelector(
    "#win .modal-result .result-block:nth-child(1) .result"
  );
  const miss = document.querySelector(
    "#win .modal-result .result-block:nth-child(2) .result"
  );
  const foto = document.querySelector("#win .modal-decoration img");

  if (title && balls && miss && foto) {
    title.innerText = playerIndex === 2 ? "Player 1 WIN!" : "Player 2 WIN!";
    balls.innerText = score[playerIndex]?.points || 0;
    miss.innerText = score[1]?.points || 0;
    foto.src = playerIndex === 2 ? "./assets/player1.svg" : "./assets/player2.svg";
  }

  setupRestartButton();
};

const showGoogleWinModal = async () => {
  if (!game) return;

  const score = await game.getScore();

  document.getElementById("grid-game").style.display = "none";
  document.getElementById("win").style.display = "none";
  document.getElementById("won").style.display = "block";

  const miss = document.querySelector(
    "#won .modal-result .result-block:nth-child(1) .result"
  );
  const player1 = document.querySelector(
    "#won .modal-result .result-block:nth-child(2) .result"
  );
  const player2 = document.querySelector(
    "#won .modal-result .result-block:nth-child(3) .result"
  );
  const foto = document.querySelector("#won .modal-decoration img");

  if (miss && player1 && player2 && foto) {
    miss.innerText = score[1]?.points || 0;
    player1.innerText = score[2]?.points || 0;
    player2.innerText = score[3]?.points || 0;
    foto.src = "./assets/googleIcon.svg";
  }

  setupRestartButton();
};

const render = async () => {
  if (!game) return;
  const status = await game.getStatus();
  const score = await game.getScore();

  updateScores(score);
  createGrid();

  if (status === "WIN-PLAYER-1" || status === "WIN-PLAYER-2") {
    const playerIndex = status === "WIN-PLAYER-1" ? 2 : 3;
    showWinModal(playerIndex);
  } else if (status === "WIN-GOOGLE") {
    showGoogleWinModal();
  }
};

const setupRestartButton = () => {
  document.querySelectorAll('.restart-button').forEach(button => {
    button.addEventListener('click', restart);
  });
}
const restart = async () => {
  firstScreen(); // Возвращаемся к начальному экрану

  if (player1ScoreElement) player1ScoreElement.innerText = 0;
  if (player2ScoreElement) player2ScoreElement.innerText = 0;
  if (googleScoreElement) googleScoreElement.innerText = 0;

  const selectedSettings = await setSettings(); // Собираем новые настройки
  if (!selectedSettings) {
    console.error("Настройки не были установлены.");
    return;
  }

  try {
    await game.restart(selectedSettings); // Вызываем метод restart прокси
    render(); // Перерисовываем игровое поле
  } catch (error) {
    console.error("Ошибка при перезапуске игры:", error);
    alert("Не удалось перезапустить игру. Пожалуйста, повторите попытку.");
  }
};
const firstScreen = () => {
  gridGame = document.getElementById("grid-game");
    gridGame.style.display = "flex";

  gridGame = document.getElementById("won");
    gridGame.style.display = "none";
  
  gridGame = document.getElementById("win");
    gridGame.style.display = "none";
};

const setupPlayerMovement = () => {
  const keyMap = {
    ArrowUp: { playerId: "1", direction: MOVE_DIRECTIONS.UP },
    ArrowDown: { playerId: "1", direction: MOVE_DIRECTIONS.DOWN },
    ArrowLeft: { playerId: "1", direction: MOVE_DIRECTIONS.LEFT},
    ArrowRight: { playerId: "1", direction: MOVE_DIRECTIONS.RIGHT },
    w: { playerId: "2", direction: MOVE_DIRECTIONS.UP },
    s: { playerId: "2", direction: MOVE_DIRECTIONS.DOWN },
    a: { playerId: "2", direction: MOVE_DIRECTIONS.LEFT },
    d: { playerId: "2", direction: MOVE_DIRECTIONS.RIGHT },
  };

  document.addEventListener("keydown", async (event) => {
    if (!game) return; // Если игра не инициализирована, ничего не делаем

    const action = keyMap[event.key];
    if (action) {
      try {
        await game.movePlayer(action.direction, action.playerId); // Вызываем movePlayer из прокси
      } catch (error) {
        console.error("Ошибка при движении игрока:", error);
      }
    }
  });
};

const setSettings = async (socket) => {
  const gridSize = document.querySelector("#gridSize").value;
  const pointsToWin = document.querySelector("#pointsToWin").value;
  const pointsToLose = document.querySelector("#pointsToLose").value;

  if (!gridSize || !pointsToWin || !pointsToLose) {
    console.error("Не все настройки выбраны.");
    return null;
  }

  const gridSizeNumber = parseInt(gridSize.split("x")[0], 10);

  const settings = {
    gridSize: {
      rowsCount: gridSizeNumber,
      columnsCount: gridSizeNumber,
    },
    pointsToWin: parseInt(pointsToWin, 10),
    pointsToLose: parseInt(pointsToLose, 10),
  };
  return settings
};