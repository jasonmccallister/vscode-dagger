import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface InstallResult {
  isInstalled: boolean;
  hasCorrectBinary: boolean;
  hasHomebrew?: boolean;
  platform: string;
}

export const checkInstallation = async (
  platform: string,
): Promise<InstallResult> => {
  // Check if binary exists
  let hasCorrectBinary = false;
  try {
    // Use login shell to ensure proper environment is loaded
    const shell = process.env.SHELL || "/bin/bash";
    const isFish = shell.includes("fish");

    // For fish shell, we need to use login shell to load the user's environment
    // For other shells, we can use the shell directly with login flag
    const command = isFish
      ? `${shell} -l -c "dagger version"`
      : "dagger version";

    const execOptions = isFish
      ? { timeout: 5000 }
      : {
          timeout: 5000,
          shell: `${shell} -l`,
          env: {
            ...process.env,
            // Ensure PATH is properly set from the user's shell
            PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
          },
        };

    const { stdout } = await execAsync(command, execOptions);
    hasCorrectBinary = stdout.includes("dagger");
  } catch (error) {
    // dagger binary doesn't exist or failed to execute
    console.error("Failed to check dagger installation:", error);
    hasCorrectBinary = false;
  }

  // Check if Homebrew is installed (for macOS/Linux)
  let hasHomebrew: boolean | undefined;
  if (platform === "darwin" || platform === "linux") {
    try {
      const shell = process.env.SHELL || "/bin/bash";
      const isFish = shell.includes("fish");

      const command = isFish
        ? `${shell} -l -c "brew --version"`
        : "brew --version";

      const execOptions = isFish
        ? { timeout: 5000 }
        : {
            timeout: 5000,
            shell: `${shell} -l`,
            env: {
              ...process.env,
              PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
            },
          };

      await execAsync(command, execOptions);
      hasHomebrew = true;
    } catch (error) {
      console.error("Failed to check homebrew installation:", error);
      hasHomebrew = false;
    }
  }

  return {
    isInstalled: hasCorrectBinary,
    hasCorrectBinary,
    hasHomebrew,
    platform,
  };
};
