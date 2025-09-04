/**
 * Replace placeholders in a string with values from a parameters object
 * @param str The string containing placeholders in the format {{key}}
 * @param params Object containing key-value pairs to replace placeholders
 * @returns The string with placeholders replaced by corresponding values
 */
export function interpolate(str: string, params?: Record<string, string>): string {
  if (!params) return str
  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }, str)
}
