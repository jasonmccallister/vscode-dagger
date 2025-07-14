export interface DirectoryIdResult {
  host: {
    directory: {
      id: string;
    };
  };
}

export interface FunctionArgTypeDef {
  kind: string;
  name?: string;
  optional?: boolean;
}

export interface FunctionArg {
  name: string;
  description?: string;
  typeDef: FunctionArgTypeDef;
}

export interface ModuleFunction {
  id: string; // Add the function ID
  name: string;
  description?: string;
  returnType: FunctionArgTypeDef; // Add return type information
  args: FunctionArg[];
}

export interface ObjectInfo {
  name: string;
  functions: ModuleFunction[];
}

export interface ModuleObject {
  name?: string;
  asObject?: ObjectInfo;
}

export interface ModuleResult {
  loadDirectoryFromID: {
    asModule: {
      id: string;
      description?: string; // Add module description
      name: string;
      objects: ModuleObject[];
    };
  };
}
