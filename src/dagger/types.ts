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
  name: string;
  description?: string;
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
      name: string;
      objects: ModuleObject[];
    };
  };
}