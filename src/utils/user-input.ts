import * as vscode from "vscode";

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
