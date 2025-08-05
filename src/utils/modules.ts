/**
 * Converts a string to PascalCase.
 * @param name - The name to convert to PascalCase
 * @returns The PascalCase version of the input string
 */
export const nameToPascalCase = (name: string): string => {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
};

/**
 * Converts a string to kebab-case.
 * @param name - The name to convert to kebab-case
 * @returns The kebab-case version of the input string
 */
export const nameToKebabCase = (name: string): string => {
  return name
    .split(/(?=[A-Z])/) // Split before uppercase letters
    .join("-") // Join with hyphen
    .toLowerCase(); // Convert to lowercase
};
