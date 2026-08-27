/**
 * Time as a dependency. `AuthService` takes one instead of calling `new Date()` itself,
 * so a spec can stand the clock still by subclassing this.
 */
export class SystemClock {
  now(): Date {
    return new Date();
  }
}
