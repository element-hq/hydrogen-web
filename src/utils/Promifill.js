"use strict";

const [PENDING, FULFILLED, REJECTED] =
  [void 0, true, false];

export class Promifill {
  get state () {
    return PENDING;
  }

  get value () {
    return void 0;
  }

  get settled () {
    return false;
  }

  constructor (executor) {
    if (typeof executor != "function") {
      throw new TypeError(`Promise resolver ${Object.prototype.toString.call(executor)} is not a function`);
    }

    defineProperty(this, "chain", []);
    defineProperty(this, "observers", []);

    const secret = [];

    const resolve =
      (value, bypassKey) => {
        if (this.settled && bypassKey !== secret) {
          return;
        }

        defineProperty(this, "settled", true);

        const then_ = value && value.then;
        const thenable = typeof then_ == "function";

        if (thenable) {
          defineProperty(value, "preventThrow", true);
        }

        if (thenable && value.state === PENDING) {
          then_.call(
            value,
            (v) =>
              resolve(v, secret),
            (r) =>
              reject(r, secret)
          );
        } else {
          defineProperty(this, "value",
            thenable
              ? value.value
              : value);
          defineProperty(this, "state",
            thenable
              ? value.state
              : FULFILLED);

          schedule(
            this.observers.map((observer) => (
              {
                handler: this.state === FULFILLED
                  ? observer.onfulfill
                  : observer.onreject,
                value: this.value
              }))
          );

          if (this.state === REJECTED) {
            raiseUnhandledPromiseRejectionException(this.value, this);
          }
        }
      };

    const reject =
      (reason, bypassKey) => {
        if (this.settled && bypassKey !== secret) {
          return;
        }

        defineProperty(this, "settled", true);

        defineProperty(this, "value", reason);
        defineProperty(this, "state", REJECTED);

        schedule(
          this.observers.map((observer) => (
            {
              handler: observer.onreject,
              value: this.value
            }))
        );

        raiseUnhandledPromiseRejectionException(this.value, this);
      };

    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  then (onfulfill, onreject) {
    const chainedPromise = new this.constructor((resolve, reject) => {
      const internalOnfulfill =
        (value) => {
          try {
            resolve(
              typeof onfulfill == "function"
                ? onfulfill(value)
                : value
            );
          } catch (error) {
            reject(error);
          }
        };

      const internalOnreject =
        (reason) => {
          try {
            if (typeof onreject == "function") {
              resolve(onreject(reason));
            } else {
              reject(reason);
            }
          } catch (error) {
            reject(error);
          }
        };

      if (this.state === PENDING) {
        this.observers.push({ onfulfill: internalOnfulfill, onreject: internalOnreject });
      } else {
        schedule(
          [{
            handler: this.state === FULFILLED
              ? internalOnfulfill
              : internalOnreject,
            value: this.value
          }]
        );
      }
    });

    this.chain.push(chainedPromise);
    return chainedPromise;
  }

  catch (onreject) {
    return this.then(null, onreject);
  }

  finally (oncomplete) {
    const chainedPromise = new this.constructor((resolve, reject) => {
      const internalOncomplete =
        () => {
          try {
            oncomplete();
            if (this.state === FULFILLED) {
              resolve(this.value);
            } else {
              reject(this.value);
            }
          } catch (error) {
            reject(error);
          }
        };

      if (this.state === PENDING) {
        this.observers.push({ onfulfill: internalOncomplete, onreject: internalOncomplete });
      } else {
        schedule([{
          handler: internalOncomplete
        }]);
      }
    });

    this.chain.push(chainedPromise);
    return chainedPromise;
  }

  static resolve (value) {
    return value && value.constructor === Promifill
      ? value
      : new Promifill((resolve) => {
        resolve(value);
      });
  }

  static reject (reason) {
    return new Promifill((_, reject) => {
      reject(reason);
    });
  }

  static all (iterable) {
    return new Promifill((resolve, reject) => {
      validateIterable(iterable);

      let iterableSize = 0;
      const values = [];

      if (isEmptyIterable(iterable)) {
        return resolve(values);
      }

      const add =
        (value, index) => {
          values[index] = value;
          if (values.filter(() => true).length === iterableSize) {
            resolve(values);
          }
        };

      for (let item of iterable) {
        ((entry, index) => {
          Promifill.resolve(entry)
            .then(
              (value) =>
                add(value, index),
              reject
            );
        })(item, iterableSize++);
      }
    });
  }

  static race (iterable) {
    return new Promifill((resolve, reject) => {
      validateIterable(iterable);

      if (isEmptyIterable(iterable)) {
        return;
      }

      for (let entry of iterable) {
        Promifill.resolve(entry)
          .then(resolve, reject);
      }
    });
  }

  static flushQueue() {
    console.log("flushing promise queue sync");
    schedule.flushQueue();
  }
}

const defineProperty =
  (obj, propName, propValue) => {
    Object.defineProperty(obj, propName, { value: propValue });
  };

const defer =
  (handler) =>
    (...args) => {
      setTimeout(handler, 0, ...args);
    };

const thrower =
  (error) => {
    throw error instanceof Error
      ? error
      : new Error(error);
  };

const raiseUnhandledPromiseRejectionException =
  defer((error, promise) => {
    if (promise.preventThrow || promise.chain.length > 0) {
      return;
    }
    thrower(error);
  });

class MutationObserverStrategy {
  constructor (handler) {
    const observer = new MutationObserver(handler);
    const node = this.node =
      document.createTextNode("");
    observer.observe(node, { characterData: true });
  }

  trigger () {
    this.node.data = this.node.data === 1
      ? 0
      : 1;
  }
}

class NextTickStrategy {
  constructor (handler) {
    this.scheduleNextTick =
      () => process.nextTick(handler);
  }

  trigger () {
    this.scheduleNextTick();
  }
}

class BetterThanNothingStrategy {
  constructor (handler) {
    this.scheduleAsap =
      () => setTimeout(handler, 0);
  }

  trigger () {
    this.scheduleAsap();
  }
}

const getStrategy =
  () => {
    if (typeof window != "undefined" && typeof window.MutationObserver == "function") {
      return MutationObserverStrategy;
    }
    if (typeof global != "undefined" && typeof process != "undefined" && typeof process.nextTick == "function") {
      return NextTickStrategy;
    }

    return BetterThanNothingStrategy;
  };

const schedule =
  (() => {
    let microtasks = [];

    const run =
      () => {
        let handler, value;
        while (microtasks.length > 0 && ({ handler, value } = microtasks.shift())) {
          handler(value);
        }
      };

    const Strategy = getStrategy();
    const ctrl = new Strategy(run);

    const scheduleFn = (observers) => {
      if (observers.length == 0) {
        return;
      }

      microtasks = microtasks.concat(observers);
      observers.length = 0;

      ctrl.trigger();
    };

    scheduleFn.flushQueue = function() {
        run();
    };

    return scheduleFn;
  })();

const isIterable =
  (subject) => subject != null && typeof subject[Symbol.iterator] == "function";

const validateIterable =
  (subject) => {
    if (isIterable(subject)) {
      return;
    }

    throw new TypeError(`Cannot read property 'Symbol(Symbol.iterator)' of ${Object.prototype.toString.call(subject)}.`);
  };

const isEmptyIterable =
  (subject) => {
    for (let _ of subject) { // eslint-disable-line no-unused-vars
      return false;
    }

    return true;
  };
