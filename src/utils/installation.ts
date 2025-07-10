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
  platform: string
): Promise<InstallResult> => {
  // Check if binary exists
  let hasCorrectBinary = false;
  try {
    const { stdout } = await execAsync("dagger version", { timeout: 5000 });
    hasCorrectBinary = stdout.includes("dagger");
  } catch (error) {
    // dagger binary doesn't exist or failed to execute
    hasCorrectBinary = false;
  }

  // Check if Homebrew is installed (for macOS/Linux)
  let hasHomebrew: boolean | undefined;
  if (platform === "darwin" || platform === "linux") {
    try {
      await execAsync("brew --version");
      hasHomebrew = true;
    } catch (error) {
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
