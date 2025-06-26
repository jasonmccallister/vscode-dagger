import * as vscode from 'vscode';
import Cli from '../dagger/dagger';
import { askToInstall } from '../actions/install';
import { initProjectCommand } from '../actions/init';

export const registerInstallModuleCommand = (context: vscode.ExtensionContext): void => {
    const cli = new Cli();
    
    context.subscriptions.push(
        vscode.commands.registerCommand('dagger.installModule', async () => {
            if (!await cli.isInstalled()) {
                askToInstall();
                return;
            }

            if (!await cli.isDaggerProject()) {
                initProjectCommand();
                return;
            }

            // if workspace is not set, use the current workspace folder or cwd
            let workspace: string;

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                workspace = workspaceFolders[0].uri.fsPath;
            } else {
                workspace = process.cwd();
            }

            // prompt the user if they want to search the daggerverse for modules first?
            const searchForLocalModules = await vscode.window.showInformationMessage(
                'Do you want to search the Daggerverse for modules?',
                { modal: true },
                'Yes',
                'No'
            );

            const localModules: string[] = [];
            if (searchForLocalModules === 'Yes') {
                // find all subdirectories in the workspace that contain a dagger.json file
                const subdirs = await findSubdirectoriesWithFile(workspace, 'dagger.json');
                if (subdirs.length === 0) {
                    vscode.window.showInformationMessage('No local modules found.');
                } else {
                    localModules.push(...subdirs);
                }

                // if there are local modules, show them in a quick pick
                if (localModules.length > 0) {
                    const modulePick = await vscode.window.showQuickPick(
                        localModules.map(dir => ({
                            label: dir,
                            description: 'Local module found in workspace'
                        })),
                        {
                            placeHolder: 'Select a local module to install',
                            canPickMany: true
                        }
                    );

                    if (!modulePick) {
                        return;
                    }

                    const selectedModules = modulePick.map(item => item.label);

                    if (selectedModules.length === 0) {
                        return;
                    }
                    // for each module run the dagger install command
                    for (const module of selectedModules) {
                        await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: `Installing module from ${module}`,
                            cancellable: false
                        }, async (progress) => {
                            progress.report({ message: `Installing module from ${module}...` });
                            const result = await cli.run(['install', module], { cwd: workspace });
                            if (!result.success) {
                                vscode.window.showErrorMessage(`Failed to install module from ${module}`);
                                console.error(`Dagger install module command failed for ${module}: ${result.stderr}`);
                                return;
                            }
                            vscode.window.showInformationMessage(`Module installed successfully from ${module}`);
                        });
                    }
                }

                return;
            }

            // prompt the user to provide a git repository URL for the module
            const gitUrl = await vscode.window.showInputBox({
                placeHolder: 'Enter the Git repository URL for the module',
                prompt: 'You can also provide a local path to a module directory',
                validateInput: (value) => {
                    if (!value) {
                        return 'Please provide a valid Git repository URL or local path.';
                    }
                    return null; // No error
                }
            });

            if (!gitUrl) {
                vscode.window.showInformationMessage('Installation cancelled. You can install modules later by running the "Dagger: Install Module" command.');
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Dagger: Installing module',
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Running `dagger install`...' });
                const result = await cli.run(['install', gitUrl], { cwd: workspace });
                if (!result.success) {
                    vscode.window.showErrorMessage(`Failed to install module`);
                    console.error(`Dagger install module command failed: ${result.stderr}`);
                    return;
                }
                vscode.window.showInformationMessage('Module installed successfully');
            });
        })
    );
};

function findSubdirectoriesWithFile(basePath: string, fileName: string): Promise<string[]> {
    const fs = require('fs').promises;
    const path = require('path');

    async function findDirs(dir: string): Promise<string[]> {
        let results: string[] = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (await fileExists(path.join(fullPath, fileName))) {
                    results.push(fullPath);
                }
                results = results.concat(await findDirs(fullPath));
            }
        }
        return results;
    }

    async function fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    return findDirs(basePath);
}