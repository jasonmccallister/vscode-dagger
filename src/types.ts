export interface FunctionArg {
  name: string;
  description?: string;
  typeDef: {
    kind: string;
  };
}

export interface ModuleFunction {
  name: string;
  args: FunctionArg[];
}

export interface ModuleObject {
  asObject: {
    name: string;
    functions: ModuleFunction[];
  } | null;
}

export interface ModuleResult {
  loadDirectoryFromID: {
    asModule: {
      name: string;
      objects: ModuleObject[];
    };
  };
}