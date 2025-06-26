import { spawn } from 'child_process';

/**
 * Configuration interface for binary existence check
 */
interface BinaryCheckOptions {
  readonly args?: readonly string[];
  readonly requiredOutput?: string;
  readonly timeout?: number;
}

/**
 * Utility functions for file and directory operations in VS Code workspace
 */

/**
 * Checks if a binary exists in the system by running it with specified args
 * and optionally verifying the output contains specific text with exit code 0
 * @param command The name of the binary to check
 * @param options Configuration options for the check
 * @returns A promise that resolves to true if the binary exists and meets criteria, false otherwise
 */
export const exists = async (
    command: string, 
    { args = ['-h'], requiredOutput, timeout = 5000 }: BinaryCheckOptions = {}
): Promise<boolean> => {

    return new Promise((resolve) => {
        try {
            const childProcess = spawn(command, args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            childProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            childProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            childProcess.on('close', (code) => {
                const exitCodeOk = code === 0;
                
                // If no required output is specified, just check exit code
                if (!requiredOutput) {
                    resolve(exitCodeOk);
                    return;
                }
                
                // Check if exit code is 0 and output contains required text
                const output = stdout + stderr;
                const hasRequiredOutput = output.toLowerCase().includes(requiredOutput.toLowerCase());
                
                resolve(exitCodeOk && hasRequiredOutput);
            });

            childProcess.on('error', (error) => {
                console.error(`Error checking for binary ${command}:`, error);
                resolve(false);
            });

            // Set a timeout to avoid hanging
            setTimeout(() => {
                childProcess.kill();
                resolve(false);
            }, timeout);

        } catch (error) {
            console.error(`Error checking for binary ${command}:`, error);
            resolve(false);
        }
    });
};