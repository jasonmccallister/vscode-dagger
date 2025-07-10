# Change Log

All notable changes to the "vscode-dagger" extension will be documented in this file.

## [Unreleased]

### Added
- **CLI Management**: Lifecycle management for Dagger CLI (install, update, uninstall)
- **Function Explorer**: Tree view for browsing Dagger functions and arguments
- **Function Execution**: Run Dagger functions with argument collection
- **Task Integration**: Save Dagger calls as VS Code tasks
- **Project Management**: Initialize and develop Dagger projects
- **Cloud Integration**: Authentication and token management for Dagger Cloud
- **Terminal Integration**: Custom terminal profile for Dagger commands
- **Cache Management**: Clear cached function data with the clear cache command
- **Return Type Display**: Function return types are now captured and displayed in tooltips

### Changed
- **UI Improvement**: Functions without arguments are no longer expandable in the tree view
- **Performance**: Optimized tree view creation by directly using FunctionInfo objects
- **Performance**: Improved call command to avoid redundant API calls when function information is already available
- **Performance**: Updated selectFunction to return full FunctionInfo objects rather than just basic properties
- **Code Improvement**: Removed redundant properties from TreeItem and streamlined data access through FunctionInfo objects
- **Code Improvement**: Removed FunctionQuickPickItem interface to simplify data flow and use FunctionInfo directly
- **UX Improvement**: Made function call operations cancellable to allow users to abort long-running operations