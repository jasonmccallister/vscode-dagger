import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface InstallResult {
  isInstalled: boolean;
  hasCorrectBinary: boolean;
  hasHomebrew?: boolean;
  platform: string;
}

/**
 * Checks if Dagger is installed and accessible.
 *
 * @param platform The platform to check installation for (e.g., "darwin", "linux", "win32").
 * @returns A promise that resolves to an InstallResult object indicating the installation status.
 */
export const checkInstallation = async (
  platform: string,
): Promise<InstallResult> => {
  let hasCorrectBinary = false;
  try {
    const shell = process.env.SHELL;
    if (!shell) {
      throw new Error("SHELL environment variable is not set.");
    }

    const { stdout } = await execAsync("dagger version", {
      timeout: 5000,
    });
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
      const shell = process.env.SHELL;

      const command = "brew --version";

      await execAsync(command, {
        timeout: 5000,
        shell,
      });

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
