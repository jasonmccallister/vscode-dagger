import fs from "fs";
import { FunctionInfo } from "./types/types";
import { DaggerSettings } from "./settings";
import { CliCache } from "./cache";
import crypto from "crypto";

export interface Output {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd: string;
  stdin?: string;
  env?: Record<string, string>;
  timeout?: number;
}

const queryHostDirectory = `query hostDirectory($path: String!) {
    host {
        directory(path: $path) {
            id
        }
    }
}`;

const queryFunctions = `query directoryAsModule($id: DirectoryID!) {
    loadDirectoryFromID(id: $id) {
    name
    asModule {
        id
        name
        objects {
        asObject {
            name
            id
            functions {
            id
            name
            description
            returnType {
                kind
                optional
                asObject {
                name
                }
            }
            args {
                name
                description
                typeDef {
                asObject {
                    name
                }
                kind
                optional
                }
            }
            }
        }
        }
    }
    }
}`;

export class DaggerCLI {
  constructor(
    private cache: CliCache,
    private settings: DaggerSettings,
  ) {
    this.cache = cache;
    this.settings = settings;
  }

  /**
   * Clears the cache.
   * This method removes all cached data.
   */
  clearCache(): void {
    this.cache.clear();
    console.log("Cache cleared successfully.");
  }

  /**
   * Retrieves the functions defined in the Dagger project at the specified path.
   * This method executes a GraphQL query to fetch the functions and their details.
   *
   * @param path The path to the Dagger project.
   * @returns A promise that resolves to an array of FunctionInfo objects.
   */
  async getFunctions(path: string): Promise<FunctionInfo[]> {
    // is cache enabled?
    if (this.settings.enableCache) {
      const cacheKey = this.cacheKey(path);
      console.log(`Checking cache for key: ${cacheKey}`);
    }

    const { stdout, stderr, exitCode } = await this.execQuery(
      queryFunctions,
      { id: await this.getDirectoryID(path) },
      path,
    );

    if (exitCode !== 0) {
      console.error("Failed to get functions:", stderr);

      throw new Error(`Failed to get functions: ${stderr}`);
    }

    try {
      const data = JSON.parse(stdout);

      if (!data.functions) {
        console.error("Invalid functions response:", stdout);

        throw new Error("Invalid functions response");
      }

      const functions = data.functions.map((func: any) => ({
        name: func.name,
        description: func.description,
        functionId: func.functionId,
        module: func.module,
        isParentModule: func.isParentModule,
        parentModule: func.parentModule,
        returnType: func.returnType,
        args: func.args.map((arg: any) => ({
          name: arg.name,
          type: arg.type,
          required: arg.required,
        })),
      }));

      // is cache enabled?
      if (this.settings.enableCache) {
        console.log(`Caching functions for key: ${this.cacheKey(path)}`);
        this.cache.set(this.cacheKey(path), functions);
      }

      return functions;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error("Error parsing functions response:", errorMessage);

      throw new Error(`Failed to parse functions response: ${errorMessage}`);
    }
  }

  /**
   * Runs a command using the Dagger CLI.
   *
   * @param args The arguments to pass to the Dagger CLI command.
   * @param options Options for running the command, including working directory, environment variables, and timeout.
   * @returns A promise that resolves to the output of the command execution.
   */
  async run(args: string[], options: RunOptions): Promise<Output> {
    const { cwd, env, timeout = 30_000 } = options;
    const shell = process.env.SHELL;
    if (!shell) {
      console.error("SHELL environment variable is not set.");
      throw new Error("SHELL environment variable is not set.");
    }

    try {
      let stdout = "";
      let stderr = "";

      let child = require("child_process").spawn("dagger", args, {
        cwd,
        env: { ...process.env, ...env },
        timeout,
        shell,
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      // if options.stdin is provided, write it to the child's stdin
      if (options.stdin) {
        child.stdin.write(options.stdin || "");
        child.stdin.end();
      }

      await new Promise((resolve, reject) => {
        child.on("close", (code: number) => {
          if (code !== 0) {
            console.error("GraphQL query failed:", stderr);
            reject(new Error(stderr || `Dagger exited with code ${code}`));
          } else {
            resolve(undefined);
          }
        });
      });

      return {
        exitCode: 0,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
      };
    } catch (error) {
      console.error("Error executing Dagger CLI command:", error);

      const errorStatus =
        error && typeof error === "object" && "status" in error
          ? (error.status as number)
          : 1;
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred while executing the command.";

      if (error instanceof Error) {
        console.error("Error message:", error.message);
      }

      return {
        exitCode: errorStatus,
        stdout: "",
        stderr: errorMessage,
      };
    }
  }

  /**
   * Executes a query against the Dagger API.
   *
   * @param query The GraphQL query string.
   * @param variables The variables for the query.
   * @param cwd The current working directory for the command execution.
   * @returns A promise that resolves to the output of the query execution.
   */
  async execQuery(
    query: string,
    variables: Record<string, any>,
    cwd: string,
  ): Promise<Output> {
    const vars = Object.entries(variables)
      .map(([key, value]) => `${JSON.stringify(key)}=${JSON.stringify(value)}`)
      .join(" ");
    const { stdout, stderr, exitCode } = await this.run(
      ["query", "--vars", vars],
      { cwd, stdin: query },
    );

    return {
      exitCode,
      stdout,
      stderr,
    };
  }

  /**
   * Checks if the specified path is a Dagger project.
   *
   * @param path The path to check.
   * @returns A promise that resolves to true if the path is a Dagger project, false otherwise.
   */
  async isDaggerProject(path: string): Promise<boolean> {
    try {
      // is the dagger.json file present?
      return fs.existsSync(`${path}/dagger.json`);
    } catch (error) {
      console.error("Error checking Dagger project:", error);
      return false;
    }
  }

  /**
   * Retrieves the directory ID for the specified path.
   * This method executes a GraphQL query to fetch the directory ID.
   *
   * @param path The path to the directory.
   * @returns A promise that resolves to the directory ID as a string.
   */
  private async getDirectoryID(path: string): Promise<string> {
    const { stdout, stderr, exitCode } = await this.execQuery(
      queryHostDirectory,
      { path: path },
      path, // pass the path because the cli command needs to come from the same path
    );

    if (exitCode !== 0) {
      throw new Error(`Failed to get directory ID: ${stderr}`);
    }

    return stdout.trim();
  }

  private cacheKey(path: string): string {
    return crypto
      .createHash("md5")
      .update("dagger-functions-" + path)
      .digest("hex");
  }
}
