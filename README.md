# Dagger for VS Code

The ultimate VS Code extension for [Dagger](https://dagger.io) developers. Streamline your containerized CI/CD workflows with powerful IDE integration, intelligent function management, and seamless cloud connectivity.

[![Version](https://img.shields.io/visual-studio-marketplace/v/jasonmccallister.vscode-dagger)](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/jasonmccallister.vscode-dagger)](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/jasonmccallister.vscode-dagger)](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger)

## ✨ Key Features

### 🚀 One-Click CLI Management
Never worry about Dagger CLI installation again. The extension automatically detects your system and provides intelligent installation options.

**📹 Video: CLI Installation Demo**
*[Drag your CLI installation demo video here]*

- Automatic package manager detection (Homebrew, curl)
- Cross-platform support (macOS, Linux, Windows)
- One-click updates and version management
- Clean uninstallation when needed

### 🎯 Interactive Functions Explorer
Browse and execute your Dagger functions with a dedicated tree view that makes complex pipelines feel simple.

**📹 Video: Functions Explorer Overview**
*[Drag your functions explorer demo video here]*

- Real-time function discovery
- Hierarchical argument visualization with types
- Expandable function details
- Smart refresh and expand-all controls

### ⚡ Execute Functions Instantly
Run any Dagger function directly from the IDE with intelligent argument collection and validation.

**📹 Video: Function Execution Demo**
*[Drag your function execution demo video here]*

- One-click function execution from tree view
- Interactive argument prompts with type validation
- Support for required and optional parameters
- Integrated terminal output with proper working directory

### 💾 Save as VS Code Tasks
Convert any function call into a reusable VS Code task for repeated execution and team sharing.

**📹 Video: Save as Task Feature**
*[Drag your save-as-task demo video here]*

- Transform function calls into persistent tasks
- Custom task naming with intelligent defaults
- Automatic `.vscode/tasks.json` management
- Optional immediate execution after saving
- Full integration with VS Code's task system

### 🏗️ Project Initialization Made Easy
Get started with new Dagger projects instantly, or seamlessly work with existing ones.

**📹 Video: Project Setup Demo**
*[Drag your project initialization demo video here]*

- Interactive project initialization wizard
- Automatic Dagger project detection
- Smart guidance for non-Dagger workspaces
- Context-aware command availability

### ☁️ Dagger Cloud Integration
Connect to Dagger Cloud with enterprise-grade token management and connection testing.

**📹 Video: Cloud Setup Demo**
*[Drag your cloud integration demo video here]*

- Multi-source token management (env vars, secure storage, config)
- Connection validation and testing
- Secure authentication session management
- Dismissible setup notifications

### 🛠️ Enhanced Development Workflow
Supercharge your module development with integrated tools and commands.

**📹 Video: Development Workflow Demo**
*[Drag your development workflow demo video here]*

- `dagger develop` integration
- Module installation and management
- Integrated shell with proper environment
- Local module development assistance

### 🤖 AI-Powered Documentation (Experimental)
Get instant help with the `@dagger` chat participant that searches Dagger documentation.

**📹 Video: Chat Integration Demo**
*[Drag your chat integration demo video here]*

- Intelligent documentation search
- Context-aware help and guidance
- Integration with docs.dagger.io
- Experimental feature with gradual rollout

## 🎨 User Experience Highlights

### Smart & Adaptive
- **Context-Aware Commands**: Features adapt based on your project state and CLI availability
- **Progress Indicators**: Visual feedback for all long-running operations
- **Error Handling**: Comprehensive error messages with actionable next steps

### Highly Configurable
- **Installation Methods**: Choose between Homebrew and curl installation
- **Auto-Execute Control**: Toggle automatic command execution behavior
- **Experimental Features**: Opt-in access to cutting-edge functionality
- **Cloud Notifications**: Persistent notification dismissal options

## 🚀 Getting Started

### Prerequisites
- VS Code 1.101.0 or higher
- A Dagger project (or create one with the extension!)

### Installation
1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger)
2. Open a workspace folder
3. The extension will guide you through Dagger CLI installation if needed

### Quick Start
1. **Open the Dagger panel** in the Activity Bar
2. **Initialize a project** if you don't have one
3. **Browse functions** in the Functions explorer
4. **Execute functions** with a single click
5. **Save frequently used calls** as VS Code tasks

## ⚙️ Configuration

Access settings via `File > Preferences > Settings` and search for "Dagger":

```json
{
  "dagger.installMethod": "brew",           // Installation method preference
  "dagger.autoExecute": true,               // Auto-execute commands in terminal
  "dagger.experimentalFeatures": false,     // Enable experimental features
  "dagger.cloudNotificationDismissed": false // Cloud setup notification state
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/jasonmccallister/vscode-dagger
cd vscode-dagger

# Install dependencies
yarn install

# Open in VS Code
code .

# Press F5 to launch Extension Development Host
```

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes and feature history.

## 🐛 Issues & Feedback

- **Bug Reports**: [Create an issue](https://github.com/jasonmccallister/vscode-dagger/issues/new?template=bug_report.md)
- **Feature Requests**: [Request a feature](https://github.com/jasonmccallister/vscode-dagger/issues/new?template=feature_request.md)
- **Discussions**: [Join the conversation](https://github.com/jasonmccallister/vscode-dagger/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for the Dagger community**

*Transform your containerized CI/CD workflows with the power of VS Code integration*