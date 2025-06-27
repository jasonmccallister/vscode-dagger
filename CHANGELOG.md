# Change Log

All notable changes to the "vscode-dagger" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added
#### Core Features
- **Dagger CLI Management**: Complete lifecycle management for Dagger CLI installation, updates, and removal
  - Automatic detection of package managers (Homebrew, curl script)
  - Platform-specific installation methods for macOS, Linux, and Windows
  - Update checking and CLI version management
  - Clean uninstallation with user confirmation

#### Functions Explorer
- **Interactive Functions Tree View**: Dedicated activity bar panel for browsing Dagger functions
  - Real-time function discovery and display
  - Hierarchical view showing function arguments with type information
  - Context-aware icons for functions, arguments, and actions
  - Expandable/collapsible function details
  - Refresh and expand-all functionality

#### Function Execution
- **One-Click Function Calls**: Direct execution of Dagger functions from the tree view
  - Interactive argument collection with type validation
  - Support for required and optional parameters
  - Smart argument selection UI with multi-pick capabilities
  - Integrated terminal execution with proper working directory

#### Task Management
- **Save as VS Code Tasks**: Convert function calls into reusable VS Code tasks
  - Interactive argument collection matching function call workflow
  - Custom task naming with intelligent defaults
  - Automatic `.vscode/tasks.json` creation and management
  - Optional immediate task execution after creation
  - Integration with VS Code's built-in task system

#### Project Management
- **Dagger Project Initialization**: Streamlined project setup workflow
  - Interactive project initialization for new Dagger projects
  - Automatic detection of existing Dagger projects
  - Guidance for non-Dagger workspaces

#### Cloud Integration
- **Dagger Cloud Setup**: Comprehensive cloud connectivity features
  - Multi-source token management (environment variables, secure storage, configuration)
  - Connection testing and validation
  - Token refresh and authentication session management
  - Cloud setup notifications with dismissal options

#### Development Tools
- **Module Development Support**: Enhanced development workflow tools
  - `dagger develop` command integration
  - Module installation and management
  - Local module development assistance
  - Integrated shell access with proper environment setup

#### Chat Integration (Experimental)
- **AI-Powered Documentation Search**: Intelligent help system
  - `@dagger` chat participant for documentation queries
  - Integration with docs.dagger.io search functionality
  - Experimental feature flag for gradual rollout
  - Contextual help and guidance

### User Experience
- **Smart Installation Detection**: Automatic CLI presence verification with guided setup
- **Context-Aware Commands**: Commands adapt based on project state and CLI availability
- **Progress Indicators**: Visual feedback for long-running operations
- **Error Handling**: Comprehensive error messages with actionable suggestions
- **Configuration Management**: Flexible settings for installation methods and behavior preferences

### Technical Features
- **TypeScript Implementation**: Modern ES2020+ features with strict type safety
- **Dependency Injection**: Modular architecture for better testability
- **Event-Driven Updates**: Reactive UI updates based on project state changes
- **Cross-Platform Support**: Native support for macOS, Linux, and Windows
- **VS Code API Integration**: Deep integration with VS Code's extension ecosystem

### Configuration Options
- **Installation Method Selection**: Choose between Homebrew and curl installation
- **Auto-Execute Toggle**: Control automatic command execution behavior
- **Cloud Notification Management**: Persistent dismissal of setup notifications
- **Experimental Features**: Opt-in access to cutting-edge functionality

### Initial release