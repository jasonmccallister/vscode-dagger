# Dagger for VS Code

The VS Code extension for [Dagger](https://dagger.io). Simplify containerized CI/CD workflows with IDE integration.

[![Version](https://img.shields.io/visual-studio-marketplace/v/jasonmccallister.vscode-dagger)](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/jasonmccallister.vscode-dagger)](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/jasonmccallister.vscode-dagger)](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger)

## Features

### ⚙️ CLI Management
Install, update, or uninstall the Dagger CLI with one click. Supports macOS, Linux, and Windows.

### 🌲 Functions Explorer
Browse and execute Dagger functions directly in VS Code. View arguments and details in a tree view.

### ⚡ Function Execution
Run Dagger functions with validated arguments. Output is shown in the integrated terminal.

### 📝 Save as VS Code Tasks
Convert function calls into reusable tasks. Automatically updates `.vscode/tasks.json`.

### 🏗️ Project Initialization
Start new Dagger projects or work with existing ones. Includes an interactive setup wizard.

### 🛠️ Development Workflow
Use `dagger develop`, manage modules, and run commands with proper environment setup in the IDE.

### 🤖 AI-Powered Documentation (Experimental)
Search Dagger docs directly in VS Code.

## Getting Started

### Prerequisites
- VS Code 1.101.0 or higher
- Docker Desktop

### Installation
1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger).
2. Open a workspace folder.
3. Follow the CLI installation guide if prompted.

### Quick Start
1. Open the Dagger panel.
2. Initialize a project or browse functions.
3. Execute functions with one click.
4. Save calls as tasks for reuse.

## Contributing

We welcome contributions! See the [Contributing Guide](CONTRIBUTING.md).

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jasonmccallister/vscode-dagger
cd vscode-dagger

# Install dependencies
yarn install

# Open in VS Code
code .

# Launch Extension Development Host
Press F5
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Issues & Feedback

- **Bug Reports**: [Create an issue](https://github.com/jasonmccallister/vscode-dagger/issues/new?template=bug_report.md)
- **Feature Requests**: [Request a feature](https://github.com/jasonmccallister/vscode-dagger/issues/new?template=feature_request.md)
- **Discussions**: [Join the conversation](https://github.com/jasonmccallister/vscode-dagger/discussions)

## License

Licensed under the MIT License. See [LICENSE](LICENSE).

---

**Made for the Dagger community**