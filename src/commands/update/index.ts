import * as vscode from 'vscode';
import Cli from '../../dagger';
import { exec } from 'child_process';
import * as https from 'https';
import { checkInstallation } from '../../utils/installation';
import { DaggerSettings } from '../../settings';

const COMMAND = 'dagger.update';

export const registerUpdateCommand = (
    context: vscode.ExtensionContext,
    cli: Cli,
    settings: DaggerSettings
): void => {
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMAND, async () => {
            await vscode.window.withProgress({
                title: 'Dagger',
                location: vscode.ProgressLocation.Notification
            }, async (progress) => {
                progress.report({ message: 'Checking for Dagger updates...' });

                try {
                    // Get current version
                    const versionResult = await cli.run(['version']);
                    if (!versionResult.success) {
                        vscode.window.showErrorMessage(`Failed to get current Dagger version: ${versionResult.stderr}`);
                        return;
                    }

                    // Parse current version (example: dagger v0.18.10 ...)
                    const currentVersionMatch = versionResult.stdout.match(/v(\d+\.\d+\.\d+)/);
                    if (!currentVersionMatch) {
                        vscode.window.showErrorMessage('Could not parse current Dagger version');
                        return;
                    }
                    const currentVersion = currentVersionMatch[1];

                    // Get install method from settings
                    const installMethod = settings.installMethod;

                    let hasUpdate = false;
                    let latestVersion = '';
                    let updateCommand = '';

                    if (installMethod === 'brew' && await checkInstallation('brew')) {
                        // Check for brew updates
                        progress.report({ message: 'Checking Homebrew for updates...' });

                        const brewResult = await runCommand('brew outdated dagger/tap/dagger');
                        if (brewResult.success && brewResult.stdout.trim()) {
                            hasUpdate = true;
                            updateCommand = 'brew upgrade dagger/tap/dagger';
                            const fetchedVersion = await getLatestGithubVersion();
                            if (fetchedVersion) {
                                latestVersion = fetchedVersion;
                            }
                        }
                    } else {
                        // Check for curl/GitHub updates
                        progress.report({ message: 'Checking GitHub for updates...' });
                        const fetchedVersion = await getLatestGithubVersion();
                        
                        if (fetchedVersion) {
                            latestVersion = fetchedVersion;
                            if (compareVersions(latestVersion, currentVersion) > 0) {
                                hasUpdate = true;
                                updateCommand = 'curl -fsSL https://raw.githubusercontent.com/dagger/dagger/main/install.sh | bash';
                            }
                        }
                    }

                    if (hasUpdate) {
                        await handleUpdate(latestVersion, currentVersion, updateCommand);
                    } else {
                        vscode.window.showInformationMessage(`Dagger is already up to date (v${currentVersion})`);
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Error checking for Dagger updates: ${error}`);
                }
            });
        })
    );
};

/**
 * Handles the update process
 * @param latestVersion The latest version available
 * @param currentVersion The current installed version
 * @param updateCommand The command to run for updating
 */
const handleUpdate = async (latestVersion: string, currentVersion: string, updateCommand: string): Promise<void> => {
    const updateOption = await vscode.window.showInformationMessage(
        `A new version of Dagger is available: v${latestVersion} (currently v${currentVersion})`,
        'Update Now',
        'Later'
    );

    if (updateOption === 'Update Now') {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Updating Dagger',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Installing update...' });
            
            try {
                const result = await runCommand(updateCommand);
                if (result.success) {
                    vscode.window.showInformationMessage(`Dagger updated to v${latestVersion} successfully!`);
                    
                    // Suggest a window reload to ensure the extension picks up the new version
                    const reloadOption = await vscode.window.showInformationMessage(
                        'Reload window to ensure extension picks up the new Dagger version?',
                        'Reload',
                        'Later'
                    );
                    
                    if (reloadOption === 'Reload') {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                } else {
                    vscode.window.showErrorMessage(`Failed to update Dagger: ${result.stderr}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error updating Dagger: ${error}`);
            }
        });
    }
};

// Helper function to run shell commands
function runCommand(command: string): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
            resolve({
                success: !error,
                stdout: stdout.toString(),
                stderr: stderr.toString() || error?.message || ''
            });
        });
    });
}

// Helper function to fetch latest GitHub release
async function getLatestGithubVersion(): Promise<string | null> {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            path: '/repos/dagger/dagger/releases/latest',
            method: 'GET',
            headers: {
                'User-Agent': 'vscode-dagger-extension'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        console.error(`GitHub API request failed: ${res.statusCode}`);
                        resolve(null);
                        return;
                    }

                    const release = JSON.parse(data) as { tag_name?: string };
                    resolve(release.tag_name || null);
                } catch (error) {
                    console.error('Failed to parse GitHub release response:', error);
                    resolve(null);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Failed to fetch GitHub release:', error);
            resolve(null);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            console.error('GitHub API request timed out');
            resolve(null);
        });

        req.end();
    });
}

// Helper function to compare semantic versions
function compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;

        if (v1Part > v2Part) {
            return 1;
        }
        if (v1Part < v2Part) {
            return -1;
        }
    }

    return 0;
}
