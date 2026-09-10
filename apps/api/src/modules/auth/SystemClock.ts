/** `AuthService` takes the clock as a dependency so a spec can stand it still by subclassing this. */
export class SystemClock {
  now(): Date {
    return new Date();
  }
}
