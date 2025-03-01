export class EventEmitter {
    #subscribers = {};

    subscribe(eventName, callback) {
      if (!this.#subscribers[eventName]) {
      this.#subscribers[eventName] = [];
      }
      this.#subscribers[eventName].push(callback);
  }
    addEventListener(eventName, callback) {
      this.subscribe(eventName, callback)
    }
    on(eventName, callback) {
      this.subscribe(eventName, callback)
    }

    emit(eventName, data) {
        this.#subscribers[eventName]?.forEach(callback => callback(data));
    }

    off(eventName, callback) {
        this.#subscribers[eventName] = this.#subscribers[eventName]?.filter(
        (cb) => cb !== callback
        );
        }
        subscribe(eventName, callback) {
        if (!this.#subscribers[eventName]) {
        this.#subscribers[eventName] = [];
        }
        this.#subscribers[eventName].push(callback);
        return () => {
        this.#subscribers[eventName] = this.#subscribers[eventName]?.filter(
        (cb) => cb !== callback
        );
        };
        }
  }