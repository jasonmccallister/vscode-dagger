/**
 * Common constants for the Dagger VS Code extension.
 * Centralize values for reuse and easy maintenance.
 */

// Extension metadata
export const EXTENSION_NAME = 'Dagger';
export const EXTENSION_ID = 'vscode-dagger';

// Icon paths (relative to extension root)
export const ICON_PATH = 'images/icon.png';
export const ICON_PATH_WHITE = 'images/icon-white.png';

// Install commands
export const INSTALL_COMMAND_HOMEBREW = 'brew install dagger/tap/dagger';
export const INSTALL_COMMAND_CURL = 'curl -fsSL https://raw.githubusercontent.com/dagger/dagger/main/install.sh | bash';

// Documentation and help links
export const DOCS_URL = 'https://docs.dagger.io/';
export const QUICKSTART_URL = 'https://docs.dagger.io/quickstart';
export const GITHUB_URL = 'https://github.com/dagger/dagger';
export const ISSUES_URL = 'https://github.com/dagger/dagger/issues';

// URLs for feedback and issues
export const FEEDBACK_URL = 'https://github.com/jasonmccallister/vscode-dagger/issues/new?template=bug_report.md';
export const FEATURE_REQUEST_URL = 'https://github.com/jasonmccallister/vscode-dagger/issues/new?template=feature_request.md';
export const DISCUSSIONS_URL = 'https://github.com/jasonmccallister/vscode-dagger/discussions';

// Miscellaneous
export const CHAT_PARTICIPANT_ID = 'dagger';
export const CHAT_PARTICIPANT_NAME = '@dagger';
export const CHAT_PARTICIPANT_DESCRIPTION = 'Searches docs.dagger.io for information on developing Dagger modules.';
export const CHAT_PARTICIPANT_ICON_DEFAULT = 'source-control';

// Add more shared constants as needed for future extensions
