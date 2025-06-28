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
export const INSTALL_COMMAND_CURL = 'curl -L https://dl.dagger.io/dagger/install.sh | sh';

// Documentation and help links
export const DOCS_URL = 'https://docs.dagger.io/';
export const QUICKSTART_URL = 'https://docs.dagger.io/quickstart';
export const GITHUB_URL = 'https://github.com/dagger/dagger';
export const ISSUES_URL = 'https://github.com/dagger/dagger/issues';

// Command names
export const COMMAND_INIT = 'dagger.init';
export const COMMAND_DEVELOP = 'dagger.develop';
export const COMMAND_CALL = 'dagger.call';
export const COMMAND_SAVE_TASK = 'dagger.saveTask';
export const COMMAND_SAVE_TASK_FROM_TREE = 'dagger.saveTaskFromTree';
export const COMMAND_FUNCTIONS = 'dagger.functions';
export const COMMAND_INSTALL = 'dagger.install';
export const COMMAND_INSTALL_MODULE = 'dagger.installModule';
export const COMMAND_SETUP_CLOUD = 'dagger.setupCloud';
export const COMMAND_UNINSTALL = 'dagger.uninstall';
export const COMMAND_VERSION = 'dagger.version';
export const COMMAND_UPDATE = 'dagger.update';
export const COMMAND_RESET = 'dagger.reset';
export const COMMAND_SHELL = 'dagger.shell';
export const COMMAND_REFRESH = 'dagger.refresh';
export const COMMAND_EXPAND = 'dagger.expand';

// Tree view and icon constants
export const TREE_VIEW_ID = 'daggerTreeView';
export const TREE_VIEW_CONTAINER_ID = 'daggerViewContainer';
export const FUNCTION_ICON_NAME = 'symbol-function';
export const ARGUMENT_ICON_NAME = 'symbol-parameter';
export const ACTION_ICON_NAME = 'arrow-right';

// Context values
export const CONTEXT_FUNCTION = 'function';
export const CONTEXT_ARGUMENT = 'argument';
export const CONTEXT_ACTION = 'action';
export const CONTEXT_EMPTY = 'empty';

// Configuration keys
export const CONFIG_INSTALL_METHOD = 'dagger.installMethod';
export const CONFIG_CLOUD_NOTIFICATION_DISMISSED = 'dagger.cloudNotificationDismissed';
export const CONFIG_AUTO_EXECUTE = 'dagger.autoExecute';
export const CONFIG_EXPERIMENTAL_FEATURES = 'dagger.experimentalFeatures';
export const CONFIG_SAVE_TASK_PROMPT_DISMISSED = 'dagger.saveTaskPromptDismissed';
export const CONFIG_FUNCTION_CALLS_RUN_IN_BACKGROUND = 'dagger.functionCalls.runInBackground';

// Notification and progress titles
export const NOTIFY_DAGGER_INSTALLED = 'Dagger is already installed and ready to use!';
export const NOTIFY_INSTALL_FAILED = 'Failed to check installation:';
export const NOTIFY_INSTALL_SUCCESS = 'Dagger installed successfully!';
export const NOTIFY_INSTALL_METHOD_UNKNOWN = 'Unknown installation method provided.';
export const NOTIFY_NO_METHOD_FOUND = 'No suitable installation method found for your platform.';
export const NOTIFY_SELECT_METHOD_PLACEHOLDER = 'Dagger is not installed. Please select an installation method:';
export const NOTIFY_INSTALLATION_STARTED = 'Dagger CLI installed. Activating extension...';
export const NOTIFY_INSTALLATION_NOT_STARTED = 'Installation was not started. You can install Dagger later using the install command.';
export const NOTIFY_TREE_VIEW_NOT_AVAILABLE = 'Tree view not available';
export const NOTIFY_TASK_SAVED = 'Task "{name}" saved! You can run it from the Run Task menu.';

// Placeholders and labels
export const PLACEHOLDER_SELECT_INSTALL_METHOD = 'Dagger is not installed. Please select an installation method:';
export const LABEL_INSTALL_HOMEBREW = 'Install using Homebrew (recommended)';
export const LABEL_INSTALL_CURL = 'Install using curl script';
export const LABEL_LEARN_CREATE_FUNCTIONS = 'Learn how to create functions';
export const LABEL_NO_FUNCTIONS_FOUND = 'No functions found';
export const LABEL_LOADING_FUNCTIONS = 'Loading Dagger functions...';
export const LABEL_RELOADING_FUNCTIONS = 'Reloading Dagger functions...';
export const LABEL_LOADING_ARGUMENTS = 'Loading arguments...';
export const LABEL_FAILED_TO_LOAD_FUNCTIONS = 'Failed to load functions';
export const LABEL_FAILED_TO_LOAD_ARGUMENTS = 'Failed to load arguments';
export const LABEL_INVALID_FUNCTION_NAME = 'Invalid function name';
export const LABEL_NOT_DAGGER_PROJECT = 'Not a Dagger project';
export const LABEL_INSTALL_CLI = 'Install Dagger CLI';
export const LABEL_INIT_PROJECT = 'Initialize Dagger Project';
export const LABEL_FUNCTION = 'Function';
export const LABEL_ARGUMENT = 'Argument';
export const LABEL_ACTION = 'Action';
export const LABEL_EMPTY = 'Empty';

// Theme icon names
export const THEME_ICON_INFO = 'info';
export const THEME_ICON_REFRESH = 'refresh';
export const THEME_ICON_EXPAND_ALL = 'expand-all';
export const THEME_ICON_SAVE = 'save';
export const THEME_ICON_PLAY = 'play';

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
