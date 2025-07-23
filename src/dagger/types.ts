// types for Dagger return types

// create a custom string type for Service
export const ServiceType = "Service";
export const ContainerType = "Container";
export const FileType = "File";
export const DirectoryType = "Directory";

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
  asObject?: {
    name: string;
  };
}

export interface FunctionArg {
  name: string;
  description?: string;
  typeDef: FunctionArgTypeDef;
}

export interface ModuleFunction {
  id: string;
  name: string;
  description?: string;
  returnType: FunctionArgTypeDef;
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
      description?: string;
      name: string;
      objects: ModuleObject[];
    };
  };
}
