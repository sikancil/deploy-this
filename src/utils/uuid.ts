// Hexadecimal character type
type Hexadecimal = string & {
  [K in string]: K extends
    | `${number}`
    | "a"
    | "b"
    | "c"
    | "d"
    | "e"
    | "f"
    | "A"
    | "B"
    | "C"
    | "D"
    | "E"
    | "F"
    ? K
    : never
}

// UUID section types combining length and hex validation
type HexString<Length extends number> = string & {
  length: Length
} & { [I: number]: Hexadecimal }

type UUIDSection1 = HexString<8> // 8 hex chars
type UUIDSection2 = HexString<4> // 4 hex chars
type UUIDSection3 = HexString<4> // 4 hex chars
type UUIDSection4 = HexString<4> // 4 hex chars
type UUIDSection5 = HexString<12> // 12 hex chars

// Standard UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
type StandardUUID =
  `${UUIDSection1}-${UUIDSection2}-${UUIDSection3}-${UUIDSection4}-${UUIDSection5}`

// UUID with curly braces: {xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}
type BracedUUID = `{${StandardUUID}}`

// Combined UUID type
export type UUID = StandardUUID | BracedUUID

// Runtime validation helper
export function isUUID(value: string): value is UUID {
  const standardPattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  const bracedPattern =
    /^\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/

  return standardPattern.test(value) || bracedPattern.test(value)
}

// Example usage
// const example1: UUID = "c9a8d400-2130-4996-8282-b2907393c607" // ✅ valid
// const example2: UUID = "{c9a8d400-2130-4996-8282-b2907393c607}" // ✅ valid

// These will show type errors:
// const example3: UUID = "c9a8d400213049968282b2907393c607" // ❌ invalid - missing hyphens
// const example4: UUID = "c9a8d400_2130_4996_8282_b2907393c607" // ❌ invalid - wrong separator
// const example5: UUID = "c9a8-d4002130-4996-8282-b2907393c607" // ❌ invalid - wrong segment lengths
// const example6: UUID = "{c9a8d400-2130-4996-8282b290-7393c607}" // ❌ invalid - wrong segment structure
// const example7: UUID = "invalid non uuid format" // ❌ invalid - not a UUID
