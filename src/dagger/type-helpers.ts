/**
 * Helper functions for converting GraphQL type information to user-friendly type names
 * in the context of Dagger modules and functions.
 */

/**
 * Converts GraphQL return type information to a friendly Dagger type name.
 * This is optimized for function return types which are often Dagger objects
 * like Container, Service, File, Directory, etc.
 * 
 * @param typeInfo The GraphQL return type info object or string
 * @returns A friendly return type name (e.g., Container, Service, String, Int)
 */
export const getReturnTypeName = (typeInfo: any): string => {
  // If typeInfo is an object with asObject.name, use that as it's the actual Dagger type name
  if (typeInfo && typeof typeInfo === "object") {
    if (typeInfo.asObject && typeInfo.asObject.name) {
      return typeInfo.asObject.name;
    }

    // Fall back to kind-based conversion
    if (typeInfo.kind) {
      return convertGraphQLType(typeInfo.kind);
    }
  }

  // If typeInfo is a string, convert it
  if (typeof typeInfo === "string") {
    return convertGraphQLType(typeInfo);
  }

  return "unknown";
};

/**
 * Converts GraphQL argument type information to a friendly Dagger type name.
 * This is optimized for function arguments which are often basic types
 * like String, Int, Boolean, or Dagger objects.
 * 
 * @param typeInfo The GraphQL argument type info object or string
 * @returns A friendly argument type name (e.g., String, Int, Boolean, Container)
 */
export const getArgumentTypeName = (typeInfo: any): string => {
  // If typeInfo is an object with asObject.name, use that as it's the actual Dagger type name
  if (typeInfo && typeof typeInfo === "object") {
    if (typeInfo.asObject && typeInfo.asObject.name) {
      return typeInfo.asObject.name;
    }

    // Fall back to kind-based conversion
    if (typeInfo.kind) {
      return convertGraphQLType(typeInfo.kind);
    }
  }

  // If typeInfo is a string, convert it
  if (typeof typeInfo === "string") {
    return convertGraphQLType(typeInfo);
  }

  return "unknown";
};

/**
 * Core function to convert various GraphQL type formats to Dagger-style type names.
 * Handles multiple patterns: OBJECT_, KIND_, _kind suffix, and direct scalar types.
 * 
 * @param graphQLType The GraphQL type string to convert
 * @returns A friendly Dagger-style type name
 * @private
 */
const convertGraphQLType = (graphQLType: string): string => {
  // Handle null or undefined
  if (!graphQLType) {
    return "unknown";
  }

  // Handle OBJECT_ prefixed types (e.g., OBJECT_STRING, OBJECT_INT)
  if (graphQLType.startsWith("OBJECT_")) {
    const typeWithoutPrefix = graphQLType.substring(7).toLowerCase();
    return mapScalarType(typeWithoutPrefix);
  }

  // Handle KIND_ prefixed types (e.g., KIND_STRING, KIND_INT)
  if (graphQLType.startsWith("KIND_")) {
    const typeWithoutPrefix = graphQLType.substring(5).toLowerCase();
    return mapScalarType(typeWithoutPrefix);
  }

  // Handle _kind suffixed types (e.g., string_kind, int_kind)
  if (graphQLType.toLowerCase().endsWith("_kind")) {
    const typeWithoutSuffix = graphQLType.substring(0, graphQLType.length - 5).toLowerCase();
    return mapScalarType(typeWithoutSuffix);
  }

  // Handle direct GraphQL scalar types
  switch (graphQLType.toUpperCase()) {
    case "STRING":
      return "String";
    case "INT":
    case "INTEGER":
      return "Int";
    case "FLOAT":
      return "Float";
    case "BOOLEAN":
      return "Boolean";
    case "ID":
      return "String";
    default:
      // If we can't map it, use the original type (likely a Dagger type like Container, Service, etc.)
      return graphQLType;
  }
};

/**
 * Maps scalar type names to Dagger-style type names.
 * 
 * @param scalarType The scalar type name (lowercase)
 * @returns The mapped Dagger-style type name
 * @private
 */
const mapScalarType = (scalarType: string): string => {
  switch (scalarType) {
    case "string":
      return "String";
    case "int":
    case "integer":
      return "Int";
    case "float":
    case "double":
      return "Float";
    case "boolean":
      return "Boolean";
    case "object":
      return "Object";
    case "array":
      return "Array";
    case "list":
      return "Array";
    case "map":
      return "Object";
    case "void":
    case "nil":
    case "null":
      return "Void";
    default:
      // For unrecognized types, return as-is (might be custom types)
      return scalarType;
  }
};
