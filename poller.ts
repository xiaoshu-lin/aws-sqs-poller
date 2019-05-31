import { Observable, Subscription } from "rxjs";

function setTimeoutAsPromise<T>(delay: number, value: T): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => resolve(value), delay);
  });
}

const DELAY_LIMIT = 2147483647;

export class Poller<T> {
  private _switch = true;
  private next: (value: T) => void;
  private error: (error: any) => void;
  private complete: () => void;
  private subscription: Subscription;

  constructor(private promise: () => Promise<T>,
              private timeout: number = DELAY_LIMIT,
              private errorHandler?: (error?) => any) {
  }

  launch() {
    let data;
    this._switch = true;
    this.subscription = Observable.create(async observable => {
      while (this._switch) {
        try {
          data = await this.startNewTurn();
        } catch (e) {
          data = "error";
          if (this.errorHandler) {
            this.errorHandler(e);
          }
        }
        if (data !== "timeout" && data !== "error") {
          observable.next(data);
        }
      }
    }).subscribe(this.next, this.error, this.complete);
  }

  // Now these two method(stop, destroy) has not been used, but they may be required for a poller, so keep them.
  stop() {
    this._switch = false;
    this.subscription.unsubscribe();
  }

  // Now this method is exactly the same with stop, but their aim is different, "stop" is to pause and can be restart sometime, destroy is
  // to manually destroy a poller to make sure it won't appear in callback stack.
  destroy() {
    this._switch = false;
    this.subscription.unsubscribe();
  }

  subscribe(next?: (value: T) => void, error?: (error: any) => void) {
    this.next = next;
    this.errorHandler = error;
    this.launch();
  }

  private startNewTurn(): Promise<string | T> {
    return this.timeout > 0
      ? Promise.race([setTimeoutAsPromise(this.timeout, "timeout"), this.promise()])
      : this.promise();
  }
}
