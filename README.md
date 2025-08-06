# Dagger for VS Code

The VS Code extension for [Dagger](https://dagger.io). Built for developers who use Dagger and VS Code together. Run Dagger commands, edit workflows, and manage projects - without leaving your editor.

[![Version](https://img.shields.io/visual-studio-marketplace/v/jasonmccallister.vscode-dagger)](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/jasonmccallister.vscode-dagger)](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/jasonmccallister.vscode-dagger)](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger)

## Features

### IDE Integration

- 🌲 **Functions Explorer:** Browse and execute Dagger functions directly in VS Code. View arguments and details in a tree view.
- ⚡ **Function Execution:** Run Dagger functions with validated arguments. Output is shown in the integrated terminal.
- 📝 **Save as VS Code Tasks:** Convert function calls into reusable tasks. Automatically updates `.vscode/tasks.json`.
- 🐚 **Dagger Shell:** Open a terminal with Dagger Shell for interactive command execution.
- 🌐 **Expose Services:** Automatically expose services from Dagger modules for easy access (with the option to save as a VS Code Task).
- 📤 **Export Files and Directories:** Save files and directories from Dagger modules to your local workspace (with the option to save as a VS Code Task).

<video src="https://github.com/user-attachments/assets/a840ea0e-d7f2-451b-bca4-adba985b31c4"></video>

### AI Integration

- 🛠️ **MCP Module Management:** Interactively add a Dagger Module as an MCP server and register with VS Code.

<video src="https://github.com/user-attachments/assets/87284fe0-508e-4f3b-984a-b9c0b616e788"></video>

### Development Workflow

- 🏗️ **Project Initialization:** Initialize new Dagger projects or work with existing ones. Includes an interactive setup prompt.
- 🛠️ **Development Workflow:** Use `dagger develop`, install modules, and run commands with proper environment setup from the IDE.
- 🌐 **GraphQL Server:** Automatically start a GraphQL server to explore, allowing you to interact with extending Dagger functionality.

### ⚙️ CLI Management

Install, update, or uninstall the Dagger CLI with one click. Supports macOS, Linux, and Windows.

## Getting Started

### Prerequisites

- VS Code 1.101.0 or higher
- Docker Desktop or a container runtime installed and running (e.g., [Podman](https://podman.io/), [nerdctl](https://github.com/containerd/nerdctl), or other Docker-like systems)

### Installation

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jasonmccallister.vscode-dagger).
2. Open a workspace folder.
3. Follow the installation guide if prompted.

### Quick Start

1. Open the Dagger panel.
2. Initialize a project or browse functions.
3. Execute functions with one click.
4. Save function calls as tasks for reuse.
5. Clear cache using the "Dagger: Clear Cache" command when needed.

## Commands

Access the following commands from the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **Dagger: Initialize Project** - Create a new Dagger project
- **Dagger: Call Function** - Execute a Dagger function
- **Dagger: Clear Cache** - Remove cached function data
- **Dagger: View Functions** - Browse available functions
- **Dagger: Install CLI** - Install the Dagger CLI
- **Dagger: Update CLI** - Update the Dagger CLI to the latest version
- **Dagger: Uninstall CLI** - Uninstall the Dagger CLI
- **Dagger: Add MCP Module** - Register a Dagger Module as an MCP server
- **Dagger: Develop Local Modules** - Start the Dagger development workflow
- **Dagger: Save as Task** - Save a function call as a reusable VS Code task
- **Dagger: Install Module** - Install a Dagger module (local or remote)
- **Dagger: Open Shell** - Open a terminal with Dagger Shell
- **Dagger: Start GraphQL Server** - Start a GraphQL server for exploring Dagger functionality
- **Dagger: Expose Service** - Expose a service from a Dagger module
- **Dagger: Export File or Directory** - Save files from Dagger modules to your local workspace

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

**Made with ❤️ for the Dagger community**
