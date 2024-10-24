/* eslint-disable @typescript-eslint/no-explicit-any */
// Class for managing and executing a queue of promises sequentially.  Used for tasks where the order of execution is important and error handling is needed.
class WaterflowPromises {
  private queue: any[] = [] // Queue of functions returning promises.
  private output: any[] = [] // Array to store the results or errors from each promise.

  // Adds a function that returns a promise to the queue.
  add(fn: () => Promise<any>): void {
    this.queue.push(fn)
  }

  // Executes the queue of promises sequentially, handling errors gracefully.
  async execute(): Promise<any[]> {
    for (const fn of this.queue) {
      await Promise.resolve() // Allows for asynchronous operations between promises.
      try {
        const output = await fn() // Executes the promise and stores the result.
        this.output.push(output) // Pushes the result to the output array.
      } catch (err) {
        this.output.push(err) // Pushes the error to the output array if an error occurs.
      }
      // this.output.push(await fn()) // Original commented-out line.
    }
    return this.output // Returns the array containing results or errors.
  }
}

// Utility class for working with different object types in TypeScript.  Used throughout the 'src/' directory for type checking and manipulation.
export class ObjectType {
  // Symbols representing different JavaScript types. Used for type checking and comparisons.
  static Promise = Symbol.for("promise")
  static String = Symbol.for("string")
  static Number = Symbol.for("number")
  static Bool = Symbol.for("boolean")
  static Object = Symbol.for("object")
  static Array = Symbol.for("array")
  static Function = Symbol.for("function")
  static Symbol = Symbol.for("symbol")
  static Error = Symbol.for("error")
  static Date = Symbol.for("date")
  static Null = Symbol.for("null")
  static Undefined = Symbol.for("undefined")
  static Map = Symbol.for("map")
  static WeakMap = Symbol.for("weakmap")
  static Set = Symbol.for("set")
  static WeakSet = Symbol.for("weakset")
  static RegExp = Symbol.for("regexp")

  // constructor() {} // Original commented-out line.

  // Determines the type of an object using Symbol.for(). Used internally by other methods in this class.
  public static of(obj: any): symbol {
    const type = ({}.toString.call(obj).split(" ")[1] as string).slice(0, -1).toLowerCase()
    switch (type) {
      case "map":
      case "weakmap":
      case "set":
      case "weakset":
      case "regexp":
        return Symbol.for(type)
      default:
        return Symbol.for(type)
    }
  }

  // Checks if an object is of a specified type or a subtype (Map, WeakMap, Set, WeakSet for Object type). Used for type validation.
  public static expect(obj: any, type: symbol): boolean {
    const objType = this.of(obj)
    return (
      type === objType ||
      (type === this.Object &&
        (objType === this.Map ||
          objType === this.WeakMap ||
          objType === this.Set ||
          objType === this.WeakSet))
    )
  }

  // Checks if an object is considered empty based on its type. Used for various checks throughout the application.
  public static isEmpty(obj: any): boolean {
    switch (this.of(obj)) {
      case this.String:
        return (
          !obj ||
          obj.length === 0 ||
          obj.trim().length === 0 ||
          obj?.toLowerCase() === "null" ||
          obj?.toLowerCase() === "undefined" ||
          obj === "NaN" ||
          obj === "Infinity" ||
          obj === "-Infinity" ||
          obj === ""
        )
      case this.Number:
        return (
          !obj ||
          obj === 0 ||
          obj === 0.0 ||
          // eslint-disable-next-line no-compare-neg-zero
          obj === -0.0 ||
          Number.isNaN(obj) ||
          obj === Infinity ||
          obj === -Infinity
        )
      case this.Bool:
        return !obj || obj === false
      case this.Object:
        return !obj || Object.keys(obj).length === 0 || Object.getOwnPropertyNames(obj).length === 0
      case this.Array:
        return !obj || obj.length === 0
      case this.Function:
        return !obj
      case this.Symbol:
        return this.isEmpty(obj.description)
      case this.Date:
        return !obj
      case this.Null:
        return !obj
      case this.Undefined:
        return !obj
      case this.Map:
        return !obj || obj.size === 0 || [...obj.keys()].length === 0
      case this.WeakMap:
        // WeakMap has no size property and cannot be iterated (no enumeration)
        return !obj || true
      case this.Set:
        return !obj || obj.size === 0 || [...obj.keys()].length === 0
      case this.WeakSet:
        // WeakSet has no size property and cannot be iterated (no enumeration)
        return !obj || true
      case this.RegExp:
        return !obj || obj.toString() === "/(?:)/"
      default:
        return !obj
    }
  }

  // Applies properties from source object 'c' to target object 'o', optionally using 'defaults' first. Used for merging configurations.
  public static apply(o: any, c: any, defaults?: any): any {
    if (defaults) {
      this.apply(o, defaults)
    }
    if (o && c && this.expect(c, this.Object)) {
      for (const p in c) {
        o[p] = c[p]
      }
    }
    return o
  }

  // Applies properties from source object 'c' to target object 'o' only if the property doesn't exist in 'o'. Used for merging configurations selectively.
  public static applyIf(o: any, c: any): any {
    if (o) {
      for (const p in c) {
        if (!(typeof o[p] !== "undefined")) {
          o[p] = c[p]
        }
      }
    }
    return o
  }

  // Recursively converts Class object into a plain object. Used for data transformation and normalization.
  public static castFrom(obj: any): { [key: string]: any } {
    if (!this.expect(obj, this.Array) || !this.expect(obj, this.Object)) {
      return obj
    }
    const o: { [key: string]: any } =
      Object.getOwnPropertyNames(obj).reduce((p: any, c: string) => ((p[c] = obj[c]), p), {}) || {}
    Object.keys(o).map((_k: string) => {
      const _v: any =
        this.of(o[_k]) === this.Array
          ? o[_k].map((__k: any) => this.castFrom(__k))
          : this.of(o[_k]) === this.Object
            ? this.castFrom(o[_k])
            : o[_k]
      o[_k] = _v
      return _v
    })
    return o
  }

  // Extracts the origin stack name from a stack trace string.  Used for debugging and error reporting.  Likely interacts with error handling in other parts of 'src/'.
  public static originStackName(stack: string): string {
    const me = "module.exports"
    const fid = stack.split("\n").reduce((p, c) => (c.includes(me) ? c.trim() : p), "")
    return fid.substr(
      fid.search(me) + me.length + 1,
      fid.indexOf(" (") - fid.search(me) - me.length - 1,
    )
  }

  // Parses a string value into an integer, returning a default value if parsing fails. Used for safe integer parsing from various sources.
  public static tryParseInt(value: string, defaultValue = 0): number {
    if (this.isEmpty(value)) return defaultValue
    try {
      return Number.isNaN(parseInt(value)) ? defaultValue : parseInt(value)
    } catch (e) {
      return defaultValue
    }
  }

  // Parses a string value into a floating-point number, returning a default value if parsing fails. Used for safe floating-point parsing from various sources.
  public static tryParseFloat(value: string, defaultValue = 0): number {
    if (this.isEmpty(value)) return defaultValue
    try {
      return Number.isNaN(parseFloat(value)) ? defaultValue : parseFloat(value)
    } catch (e) {
      return defaultValue
    }
  }

  // Parses a string value into a JSON object, returning a default value if parsing fails. Used for safe JSON parsing from various sources.
  public static tryParseJSON(
    value: string,
    defaultValue: object | Error | null = {
      jsonParser: "invalid content format",
    },
  ): any {
    if (this.isEmpty(value)) return defaultValue
    try {
      return JSON.parse(value)
    } catch (e) {
      return defaultValue
    }
  }

  // Iterates over an array of data, applying an optional callback function to each item.  Handles errors during iteration.  Used for asynchronous processing of data.
  public static async iteratePromises(
    data: any[],
    cb: ((item: any) => Promise<any>) | null = null,
  ): Promise<any[]> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      const iterOutput: any[] = []
      await data.reduce(async (prev, curr) => {
        await prev
        try {
          iterOutput.push(cb ? await cb(curr) : curr)
        } catch (err) {
          iterOutput.push(err)
        }
      }, Promise.resolve())
      resolve(iterOutput)
    })
  }

  // Exposes the WaterflowPromises class for use.
  public static WaterflowPromises = WaterflowPromises
}
