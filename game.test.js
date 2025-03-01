import { GAME_STATUSES, Game, MOVE_DIRECTIONS } from "./game.js"
import { NumberUtility } from "./number-utility.js"
import { Position } from "./position.js"
import { EventEmitter } from "./observer/observer.js"

expect.extend({
  toBeEqualPosition(received, expected) {
    const pass = received.isEqual(expected)
    if (pass) {
      return {
        message: () =>
          `expected Position(${received.x}, ${received.y}) not to be equal to Position(${expected.x}, ${expected.y})`,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `expected Position(${received.x}, ${received.y}) to be equal to Position(${expected.x}, ${expected.y})`,
        pass: false,
      }
    }
  },
})
class MockFakeNumberUtility extends NumberUtility {
  #returnsNumbers
  constructor(mockValues) {
    super()
    this.#returnsNumbers = mockValues
  }
  // [/*google*/ 0, 2, /*player*/ 2, 2]
  #callsCount = 0
  getRandomNumber() {
    const returnValue = this.#returnsNumbers[this.#callsCount]
    this.#callsCount++
    return returnValue
  }
}

describe("Game", () => {
  let game

  function createGame() {
    const numberUtility = new NumberUtility()
    const eventEmitter = new EventEmitter();
    game = new Game(numberUtility, eventEmitter)
  }
  beforeEach(async () => {
    createGame()
  })
  afterEach(async () => {
    await game.stop()
  })
  it("should return Pending status as initial", async () => {
    let status = await game.getStatus()
    expect(status).toBe("PENDING")
  })
  it("should return In-progress status after Start()", async () => {
    await game.start()
    let status = await game.getStatus()
    expect(status).toBe("IN-PROGRESS")
  })
  it("google should  have random correct position after start", async () => {
    await game.setSettings({
      gridSize: {
        rowsCount: 3,
        columnsCount: 3,
      },
    })
    await game.start()
    let googlePosition = await game.getGooglePosition()
    let googlePosition2 = await game.getGooglePosition()
    expect(googlePosition).toBeEqualPosition(googlePosition2)
    expect(googlePosition.x).toBeGreaterThanOrEqual(0)
    expect(googlePosition.x).toBeLessThanOrEqual(3)
    expect(googlePosition.y).toBeGreaterThanOrEqual(0)
    expect(googlePosition.y).toBeLessThanOrEqual(2)
    await game.stop()
  })
  it("google should  have random correct position after jump interval", async () => {
    for (let i = 0; i < 10; i++) {
      createGame()
      await game.setSettings({
        gridSize: {
          rowsCount: 1,
          columnsCount: 4,
        },
        jumpInterval: 10,
      })
      await game.start()
      let googlePosition = await game.getGooglePosition()
      await delay(10)
      let googlePosition2 = await game.getGooglePosition()
      expect(googlePosition).not.toBeEqualPosition(googlePosition2)
      await game.stop()
    }
  })
  it("player1, player2 should have unique coordinates", async () => {
    for (let i = 0; i < 10; i++) {
      createGame()
      await game.setSettings({
        gridSize: {
          rowsCount: 4,
          columnsCount: 4,
        },
        jumpInterval: 10,
      })

      await game.start()
      const player1Position = await game.getPlayer1Position
      const player2Position = await game.getPlayer2Position

      expect(player1Position.x !== player2Position.x || player1Position.y !== player2Position.y)
      await game.stop()
    }
  })
  it("player should  have random correct position inside grid after jump interval", async () => {
    await game.setSettings({
      gridSize: {
        rowsCount: 4,
        columnsCount: 4,
      },
      jumpInterval: 10,
    })
    await game.start()
    let player1Position = await game.getPlayer1Position()

    expect(player1Position.x).toBeGreaterThanOrEqual(0)
    expect(player1Position.x).toBeLessThanOrEqual(3)

    expect(player1Position.y).toBeGreaterThanOrEqual(0)
    expect(player1Position.y).toBeLessThanOrEqual(3)
    await game.stop()
  })
  it("player should  have random correct position not crossed with google  after start", async () => {
    for (let i = 0; i < 40; i++) {
      createGame()
      await game.setSettings({
        gridSize: {
          rowsCount: 4,
          columnsCount: 1,
        },
        jumpInterval: 10,
      })
      await game.start()
      let googlePosition = await game.getGooglePosition()
      let player1Position = await game.getPlayer1Position()

      expect(googlePosition).not.toBeEqualPosition(player1Position)
      await game.stop()
    }
  })
  it("moving is player1 is correct", async () => {
    const numberUtility = new MockFakeNumberUtility([/*google*/ 0, 2, /*player*/ 2, 2])
    game = new Game(numberUtility)
    await game.setSettings({
      gridSize: {
        rowsCount: 3,
        columnsCount: 3,
      },
      jumpInterval: 10,
    })
    await game.start()
    let position = await game.getPlayer1Position()
    let googlePosition = await game.getGooglePosition()
    expect(position).toBeEqualPosition(new Position(2, 2))
    expect(googlePosition).toBeEqualPosition(new Position(0, 2))
    //[  ][  ][  ]
    //[  ][  ][  ]
    //[ g][  ][p1]
    await game.movePlayer(MOVE_DIRECTIONS.DOWN, '1')
    position = await game.getPlayer1Position()
    expect(position).toBeEqualPosition(new Position(2, 2))
    //[  ][  ][  ]
    //[  ][  ][  ]
    //[ g][  ][p1]
    await game.movePlayer(MOVE_DIRECTIONS.RIGHT,'1')
    position = await game.getPlayer1Position()
    expect(position).toBeEqualPosition(new Position(2, 2))
    //   //[  ][  ][  ]
    //   //[  ][  ][  ]
    //   //[ g][  ][p1]
    await game.movePlayer(MOVE_DIRECTIONS.UP, '1')
    position = await game.getPlayer1Position()
    expect(position).toBeEqualPosition(new Position(2, 1))
    //   //[  ][  ][  ]
    //   //[  ][  ][p1]
    //   //[ g][  ][  ]
    await game.movePlayer(MOVE_DIRECTIONS.LEFT, '1')
    position = await game.getPlayer1Position()
    expect(position).toBeEqualPosition(new Position(1, 1))
    //   //[ ][  ][  ]
    //   //[  ][p1][  ]
    //   //[ g][  ][  ]
    await game.movePlayer(MOVE_DIRECTIONS.UP, '1')
    position = await game.getPlayer1Position()
    expect(position).toBeEqualPosition(new Position(1, 0))
    //   //[  ][p1][  ]
    //   //[  ][  ][  ]
    //   //[ g][  ][  ]
    await game.movePlayer(MOVE_DIRECTIONS.UP, '1')
    position = await game.getPlayer1Position()
    expect(position).toBeEqualPosition(new Position(1, 0))
    //   //[  ][p1][  ]
    //   //[  ][  ][  ]
    //   //[ g][  ][  ]
    await game.movePlayer(MOVE_DIRECTIONS.LEFT, '1')
    position = await game.getPlayer1Position()
    expect(position).toBeEqualPosition(new Position(0, 0))
    //   //[p1][  ][  ]
    //   //[  ][  ][  ]
    //   //[ g][  ][  ]
    await game.movePlayer(MOVE_DIRECTIONS.LEFT, '1')
    position = await game.getPlayer1Position()
    expect(position).toBeEqualPosition(new Position(0, 0))
    //   //[p1][  ][  ]
    //   //[  ][  ][  ]
    //   //[ g][  ][  ]
    await game.movePlayer(MOVE_DIRECTIONS.DOWN, '1')
    position = await game.getPlayer1Position()
    expect(position).toBeEqualPosition(new Position(0, 1))
    //   //[  ][  ][  ]
    //   //[p1][  ][  ]
    //   //[ g][  ][  ]
    await game.stop()
  })
  it("should return array Players", async () => {
    createGame()
    await game.setSettings({
      gridSize: {
        rowsCount: 4,
        columnsCount: 1,
      },
      jumpInterval: 10,
    })
    await game.start()
    let players = await game.getPlayers()
    expect(players.length).toBe(3)
    expect(players[0].position).not.toBeEqualPosition(players[1].position)
    expect(players[1].position).not.toBeEqualPosition(players[2].position)
    expect(players[0].position).not.toBeEqualPosition(players[2].position)
    await game.stop()
  })
  it("player1 catches Google", async () => {
    const numberUtility = new MockFakeNumberUtility([/*google*/ 1, 0, /*player*/ 0, 0])
     game = new Game(numberUtility)
    await game.setSettings({
      gridSize: { rowsCount: 1, columnsCount: 3 },
      jumpInterval: 10,
    })
    await game.start()

    await game.movePlayer(MOVE_DIRECTIONS.RIGHT, '1')
    let googlePosition = await game.getGooglePosition()
    let player1Position = await game.getPlayer1Position()
    
    expect(game.score[2].points).toBe(1) // Проверка, что игрок 1 набрал очко
    expect(googlePosition).not.toBeEqualPosition(player1Position) // Проверка захвата
    game.stop()
  })
  it('player1 fails to catch Google (player2 is in the way)', async () => {
    const numberUtility = new MockFakeNumberUtility([/*google*/ 2, 0, /*player1*/ 0, 0, /*player2*/ 1, 0])
     game = new Game(numberUtility)
    await game.setSettings({
      gridSize: { rowsCount: 1, columnsCount: 3 },
      jumpInterval: 10,
    })
    await game.start()

    await game.movePlayer(MOVE_DIRECTIONS.RIGHT, '1')
    let player1Position = await game.getPlayer1Position()
    let player2Position = await game.getPlayer2Position()
    
    expect(player2Position).not.toBeEqualPosition(player1Position) // Проверка захвата
    game.stop()
  });
  it('second player wins', async () => {
    const numberUtility = new MockFakeNumberUtility([
     /*google*/ 2, 0, 
      /*player1*/ 0, 0, 
      /*player2*/ 1, 0,
    ]);
     game = new Game(numberUtility);
    await game.setSettings({
      gridSize: { rowsCount: 1, columnsCount: 3 },
      pointsToWin: 3,
      jumpInterval: 10,
    });
  
    await game.start();
 
    while (true) {
      const status = await game.getStatus();
      if (status === GAME_STATUSES.FINISHED) {
        break;
      }
      await game.movePlayer(MOVE_DIRECTIONS.RIGHT, '2')
            await game.movePlayer(MOVE_DIRECTIONS.RIGHT, '2')
            await game.movePlayer(MOVE_DIRECTIONS.RIGHT, '2')
    }
  
    const status = await game.getStatus();
  
    expect(status).toBe(GAME_STATUSES.FINISHED);
    expect(game.score[3].points).toBe(3); // Проверка на выигрыш игрока (кроме Google)
  });
})

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
