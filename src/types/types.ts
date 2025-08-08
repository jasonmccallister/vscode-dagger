// types for Dagger return types

// create a custom string type for Service
export const ServiceType = "Service";
export const ContainerType = "Container";
export const FileType = "File";
export const DirectoryType = "Directory";

// GraphQL query: host { directory(path: $path) { id } }
export interface DirectoryIdResult {
  host: {
    directory: {
      id: string;
    };
  };
}

// GraphQL field: args.typeDef and returnType in functions
export interface FunctionArgTypeDef {
  kind: string; // GraphQL: typeDef.kind or returnType.kind
  optional: boolean; // GraphQL: typeDef.optional or returnType.optional
  asObject?: {
    // GraphQL: typeDef.asObject or returnType.asObject
    name: string; // GraphQL: asObject.name
  };
}

// GraphQL field: args in functions
export interface FunctionArg {
  name: string; // GraphQL: args.name
  description?: string; // GraphQL: args.description
  typeDef: FunctionArgTypeDef; // GraphQL: args.typeDef
}

// GraphQL field: functions in asObject
export interface ModuleFunction {
  id: string; // GraphQL: functions.id
  name: string; // GraphQL: functions.name
  description?: string; // GraphQL: functions.description
  returnType: FunctionArgTypeDef; // GraphQL: functions.returnType
  args: FunctionArg[]; // GraphQL: functions.args
}

// GraphQL field: asObject in objects
export interface ObjectInfo {
  name: string; // GraphQL: asObject.name
  functions: ModuleFunction[]; // GraphQL: asObject.functions
}

// GraphQL field: objects in asModule
export interface ModuleObject {
  asObject?: ObjectInfo; // GraphQL: objects.asObject
}

// GraphQL response: loadDirectoryFromID
export interface ModuleResult {
  loadDirectoryFromID: {
    // GraphQL: loadDirectoryFromID(id: $id)
    asModule: {
      // GraphQL: loadDirectoryFromID.asModule
      id: string; // GraphQL: asModule.id
      name: string; // GraphQL: asModule.name
      objects: ModuleObject[]; // GraphQL: asModule.objects
    };
  };
}

// Internal type for function arguments in VS Code extension
export interface FunctionArgument {
  name: string;
  type: string;
  required: boolean;
}

// Internal type for function information in VS Code extension
export interface FunctionInfo {
  id: string;
  name: string;
  description?: string;
  module?: string; // Display grouping (e.g., "go-sdk")
  parentModule?: string; // CLI call parent (e.g., "sdk" for "dagger call sdk go ...")
  returnType: string;
  args: FunctionArgument[];
}
