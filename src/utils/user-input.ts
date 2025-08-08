import * as vscode from "vscode";

/**
 * Prompts the user for the ports to expose for a specific function. This is
 * used when exposing services for functions.
 * @param functionName The name of the function for which to expose ports.
 * @returns An array of ports to expose or undefined if cancelled.
 */
export const askForPorts = async (
  functionName: string,
): Promise<string[] | undefined> => {
  const portsInput = await vscode.window.showInputBox({
    prompt: `Enter ports to expose for function \`${functionName}\` (comma-separated, e.g. 8080:8080)`,
    placeHolder: "e.g. 8080:8080",
    value: "8080:8080",
    validateInput: (value) => {
      // Simple validation for port format - this should be improved
      const regex = /^\d+(:\d+)?(,\d+(:\d+)?)*$/;
      return regex.test(value)
        ? null
        : "Invalid port format. Use '8080:8080' or '8080,9090:9090'";
    },
  });

  if (!portsInput) {
    return undefined; // User cancelled input
  }

  const ports = portsInput.split(",").reduce(
    (acc, port) => {
      const [host, container] = port.split(":");
      acc[Number(host)] = Number(container);
      return acc;
    },
    {} as Record<number, number>,
  );

  return Object.entries(ports).map(
    ([host, container]) => `${host}:${container}`,
  );
};

/**
 * Prompts the user for the Dagger module address. This is used when installing a module for a workflow.
 * @returns The module address entered by the user or undefined if cancelled.
 */
export const askForModuleAddress = async (): Promise<string | undefined> => {
  const module = await vscode.window.showInputBox({
    placeHolder:
      "github.com/user/repo, https://github.com/user/repo.git, or . for current directory",
    prompt:
      "Enter the Dagger module address (Git URL, GitHub repository, or . for current directory)",
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "Please provide a valid module address.";
      }

      // Basic validation for common patterns
      const trimmedValue = value.trim();
      const isCurrentDir = trimmedValue === ".";
      const isGitUrl =
        trimmedValue.startsWith("http") || trimmedValue.startsWith("git@");
      const isGithubShorthand = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(
        trimmedValue,
      );
      const isGithubPath = trimmedValue.startsWith("github.com/");

      if (!isCurrentDir && !isGitUrl && !isGithubShorthand && !isGithubPath) {
        return "Please provide a valid Git URL, GitHub repository, or . for current directory";
      }

      return null;
    },
  });

  if (!module) {
    return undefined;
  }

  return module;
};

/**
 * Prompts the user for the export path. This is used for exporting files and directories
 * from functions.
 * @returns The export path entered by the user or undefined if cancelled.
 */
export const askForExportPath = async (): Promise<string | undefined> => {
  const exportPath = await vscode.window.showInputBox({
    prompt: "Enter the export path",
    value: "./dist",
    validateInput: (value) => {
      // must not be empty a valid path
      if (!value || value.trim() === "") {
        return "Export path cannot be empty.";
      }

      // cannot contain .. or / and must be relative
      if (value.startsWith("..") || value.startsWith("/")) {
        return "Export path cannot contain .. or / and must be relative to the workspace.";
      }

      // cannot contain any special characters
      const invalidChars = /[<>:"|?*]/;
      if (invalidChars.test(value)) {
        return 'Export path cannot contain special characters like <, >, :, ", |, ?, *';
      }

      // can't be environment variable
      if (value.startsWith("$")) {
        return "Export path cannot be an environment variable.";
      }

      return null; // no error
    },
  });

  return exportPath;
};

/**
 * Prompts the user for a file name. This is used when exporting files from functions.
 * @returns The file name entered by the user or undefined if cancelled.
 */
export const askForFileName = async (): Promise<string | undefined> => {
  const fileName = await vscode.window.showInputBox({
    prompt: "Enter the file name",
    validateInput: (value) => {
      if (!value || value.trim() === "") {
        return "File name cannot be empty.";
      }

      // cannot contain special characters
      const invalidChars = /[<>:"|?*]/;
      if (invalidChars.test(value)) {
        return 'File name cannot contain special characters like <, >, :, ", |, ?, *';
      }

      // no spaces allowed
      if (value.includes(" ")) {
        return "File name cannot contain spaces.";
      }

      return null; // no error
    },
  });

  return fileName;
};
