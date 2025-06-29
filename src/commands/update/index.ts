import * as vscode from 'vscode';
import Cli from '../../dagger';
import { exec } from 'child_process';
import * as https from 'https';
import { checkInstallation } from '../../utils/installation';

const COMMAND = 'dagger.update';

export const registerUpdateCommand = (
    context: vscode.ExtensionContext,
    cli: Cli
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

                    // Get install method from configuration
                    const config = vscode.workspace.getConfiguration('dagger');
                    const installMethod: string = config.get('installMethod', 'curl');

                    let hasUpdate = false;
                    let latestVersion = '';
                    let updateCommand = '';

                    if (installMethod === 'brew' && await checkInstallation('brew')) {
                        // Check for brew updates
                        progress.report({ message: 'Checking Homebrew for updates...' });

                        const brewResult = await runCommand('brew outdated dagger/tap/dagger');
                        if (brewResult.success && brewResult.stdout.trim()) {
                            // If brew outdated returns output, there's an update available
                            hasUpdate = true;
                            // Try to extract version from brew outdated output
                            const brewVersionMatch = brewResult.stdout.match(/(\d+\.\d+\.\d+)/);
                            latestVersion = brewVersionMatch ? brewVersionMatch[1] : 'latest';
                            updateCommand = 'brew upgrade dagger/tap/dagger';
                        }
                    } else {
                        // Check GitHub releases for curl installs
                        progress.report({ message: 'Checking GitHub releases...' });

                        try {
                            const latestRelease = await fetchLatestGitHubRelease();
                            if (latestRelease) {
                                latestVersion = latestRelease.replace('v', '');
                                hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
                                updateCommand = 'curl -fsSL https://dl.dagger.io/dagger/install.sh | BIN_DIR=$HOME/.local/bin sh';
                            }
                        } catch (error) {
                            console.error('Failed to check GitHub releases:', error);
                            vscode.window.showErrorMessage('Failed to check for updates from GitHub releases');
                            return;
                        }
                    }

                    if (hasUpdate) {
                        const updateResponse = await vscode.window.showInformationMessage(
                            `Dagger update available! Current: v${currentVersion}, Latest: v${latestVersion}`,
                            { modal: true },
                            'Update Now',
                            'Later'
                        );

                        if (updateResponse === 'Update Now') {
                            progress.report({ message: 'Updating Dagger...' });

                            const updateResult = await runCommand(updateCommand);
                            if (updateResult.success) {
                                vscode.window.showInformationMessage(`✅ Dagger updated successfully to v${latestVersion}!`);
                            } else {
                                vscode.window.showErrorMessage(`Failed to update Dagger: ${updateResult.stderr}`);
                            }
                        }
                    } else {
                        vscode.window.showInformationMessage(`✅ Dagger is up to date (v${currentVersion})`);
                    }
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Failed to check for updates: ${error.message || error}`);
                }
            });
        })
    );
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
async function fetchLatestGitHubRelease(): Promise<string | null> {
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
