type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Deep merge two objects together. For arrays, replace instead of merge.
 * @param target The base object
 * @param source The object whose properties take precedence
 * @returns A new object with merged properties
 */
export function deepMerge<T extends object>(
  target: T,
  source: DeepPartial<T>
): T {
  const output = { ...target } as T

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (sourceValue === null || sourceValue === undefined) {
        continue // Skip null/undefined values from source
      }

      // For arrays, replace entirely
      if (Array.isArray(sourceValue)) {
        output[key as keyof T] = sourceValue as T[keyof T]
        continue
      }

      // For objects (but not arrays), deep merge
      if (
        typeof sourceValue === 'object' &&
        typeof targetValue === 'object' &&
        !Array.isArray(sourceValue) &&
        !Array.isArray(targetValue)
      ) {
        output[key as keyof T] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[keyof T]
        continue
      }

      // For primitives or when target is not an object, overwrite
      output[key as keyof T] = sourceValue as T[keyof T]
    }
  }

  return output
}
