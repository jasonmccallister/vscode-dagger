import { spawn } from 'child_process';

/**
 * Utility functions for file and directory operations in VS Code workspace
 */

/**
 * Checks if a binary exists in the system by running it with -h flag
 * and optionally verifying the output contains specific text with exit code 0
 * @param command The name of the binary to check
 * @param requiredOutput Optional string that must be present in the output (case-insensitive)
 * @returns A promise that resolves to true if the binary exists and meets criteria, false otherwise
 */
export async function exists(command: string, args?: string[], requiredOutput?: string): Promise<boolean> {
    if (!args || args.length === 0) {
        args = ['-h']; // Default to -h if no arguments provided
    }

    return new Promise((resolve) => {
        try {
            const process = spawn(command, args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
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

            process.on('error', (error) => {
                console.error(`Error checking for binary ${command}:`, error);
                resolve(false);
            });

            // Set a timeout to avoid hanging
            setTimeout(() => {
                process.kill();
                resolve(false);
            }, 5000); // 5 second timeout

        } catch (error) {
            console.error(`Error checking for binary ${command}:`, error);
            resolve(false);
        }
    });
}