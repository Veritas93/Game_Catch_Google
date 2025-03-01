import { Position } from "./position.js"
class Player {
    #player = {
        id: 0,
        position: 0
    }
    #count = 0
    #numberUtility
    #gridSize
    constructor(numberUtility, gridSize ) {
        this.#numberUtility = numberUtility
        this.#gridSize = gridSize
        
    }
   async  getPlayer() {
       const newP = new Position(
            await this.#numberUtility.getRandomNumber(0, this.#gridSize.rowsCount - 1),
            await this.#numberUtility.getRandomNumber(0, this.#gridSize.columnsCount - 1),
            )
            this.#player.id = this.#count
            this.#player.position = newP
            this.#count++
            return this.#player
    }
}

export {Player, Position}