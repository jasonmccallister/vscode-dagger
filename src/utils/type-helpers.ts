import {
  FunctionArg,
  FunctionArgument,
} from "../types/types";
import { nameToKebabCase } from "./modules";

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
 * @deprecated Use functionArgTypeToFunctionArgument instead.
 *
 * Converts GraphQL argument type information to a friendly Dagger type name.
 * This is optimized for function arguments which are often basic types
 * like String, Int, Boolean, or Dagger objects.
 *
 * @param typeInfo The GraphQL argument type info object or string
 * @returns A friendly argument type name (e.g., String, Int, Boolean, Container)
 */
export const getArgumentTypeName = (typeInfo: any): string => {
  // If typeInfo is an object, prioritize asObject.name as it contains the actual Dagger type name
  if (typeInfo && typeof typeInfo === "object") {
    // First priority: Use asObject.name if available (e.g., "Container", "Service", "File")
    if (typeInfo.asObject && typeInfo.asObject.name) {
      return typeInfo.asObject.name;
    }

    // Second priority: Fall back to kind-based conversion for scalar types
    if (typeInfo.kind) {
      return convertGraphQLType(typeInfo.kind);
    }
  }

  // If typeInfo is a string, convert it using kind-based logic
  if (typeof typeInfo === "string") {
    return convertGraphQLType(typeInfo);
  }

  return "unknown";
};

/**
 * Converts a FunctionArg to a FunctionArgument.
 * @param arg The FunctionArg to convert.
 * @returns The converted FunctionArgument.
 */
export const functionArgTypeToFunctionArgument = (
  arg: FunctionArg,
): FunctionArgument => {
  let funcArg: FunctionArgument = {
    name: nameToKebabCase(arg.name),
    type: "unknown",
    required: !arg.typeDef.optional,
  };

  if (arg.typeDef.asObject && arg.typeDef.asObject.name) {
    funcArg.type = arg.typeDef.asObject.name;

    return funcArg;
  }

  switch (arg.typeDef.kind) {
    case "STRING_KIND":
      funcArg.type = "String";
      break;
    case "INT_KIND":
      funcArg.type = "Int";
      break;
    case "FLOAT_KIND":
      funcArg.type = "Float";
      break;
    case "BOOLEAN_KIND":
      funcArg.type = "Boolean";
      break;
  }

  return funcArg;
};

/**
 * @deprecated Use functionArgTypeToFunctionArgument instead.
 *
 * Core function to convert various GraphQL type formats to Dagger-style type names.
 * Handles multiple patterns: OBJECT_, KIND_, _kind suffix, and direct scalar types.
 *
 * @param graphQLType The GraphQL type string to convert
 * @returns A friendly Dagger-style type name
 * @private
 */
const convertGraphQLType = (graphQLType: string): string => {
  // Handle OBJECT_ prefixed types (e.g., OBJECT_STRING, OBJECT_INT)
  if (graphQLType.endsWith("_KIND")) {
    const typeWithoutPrefix = graphQLType
      .substring(0, graphQLType.length - 5)
      .toLowerCase();
    return mapScalarType(typeWithoutPrefix);
  }

  return "<unknown>";
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
