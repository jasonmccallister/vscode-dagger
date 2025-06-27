# Release Process

This document outlines the automated release process for the VS Code Dagger extension.

## Overview

The extension uses GitHub Actions to automatically publish to the VS Code Marketplace when a new release is created on GitHub.

## Setup Requirements

### 1. VS Code Marketplace Access Token

You need to obtain a Personal Access Token (PAT) from Azure DevOps to publish to the VS Code Marketplace:

1. Visit [Azure DevOps](https://dev.azure.com/)
2. Go to User Settings > Personal Access Tokens
3. Create a new token with:
   - **Name**: VS Code Extension Publishing
   - **Organization**: All accessible organizations
   - **Scopes**: Custom defined > Marketplace > Manage

### 2. GitHub Repository Secrets

Add the following secrets to your GitHub repository (Settings > Secrets and variables > Actions):

- `VSCE_PAT`: Your VS Code Marketplace Personal Access Token

### 3. Optional: Open VSX Registry

If you want to also publish to the Open VSX Registry (alternative marketplace):

1. Create an account at [Open VSX Registry](https://open-vsx.org/)
2. Generate an access token
3. Add `OVSX_PAT` secret to your GitHub repository
4. Set the repository variable `PUBLISH_TO_OPENVSX` to `true`

## Release Process

### 1. Prepare for Release

1. Update the version in `package.json`:
   ```bash
   npm version patch  # or minor, major
   ```

2. Update `CHANGELOG.md` with release notes

3. Commit and push changes:
   ```bash
   git add .
   git commit -m "chore: prepare release v1.0.0"
   git push
   ```

### 2. Create GitHub Release

1. Go to your repository on GitHub
2. Click "Releases" > "Create a new release"
3. Create a new tag (e.g., `v1.0.0`) that matches the version in `package.json`
4. Fill in the release title and description
5. Click "Publish release"

### 3. Automated Publishing

Once the release is published, the GitHub Action will automatically:

1. **Validate** the release:
   - Check that the package.json version matches the release tag
   - Run type checking, linting, and tests
   - Build the extension

2. **Publish** to marketplaces:
   - Publish to VS Code Marketplace
   - Upload .vsix file to the GitHub release
   - Optionally publish to Open VSX Registry

## Workflow Jobs

The release workflow consists of these jobs:

- **🔍 Validate Release**: Ensures code quality and version consistency
- **🚀 Publish to Marketplace**: Publishes to VS Code Marketplace
- **📦 Publish to Open VSX**: (Optional) Publishes to Open VSX Registry

## Manual Publishing

If you need to publish manually:

```bash
# Install dependencies
yarn install

# Build and package
yarn run package

# Publish to VS Code Marketplace
yarn run publish

# Publish to Open VSX (optional)
yarn run publish:ovsx

# Create .vsix package file
yarn run package:vsix
```

## Troubleshooting

### Version Mismatch Error

If the workflow fails with a version mismatch error:
- Ensure the release tag matches the version in `package.json`
- Tags should follow the format `v1.0.0` (the workflow strips the `v` prefix)

### Publishing Errors

Common issues:
- **Invalid PAT**: Check that your `VSCE_PAT` is valid and has the correct permissions
- **Extension name conflict**: Ensure your extension name is unique in the marketplace
- **Missing publisher**: Make sure the `publisher` field is set in `package.json`

### Testing the Workflow

You can test the workflow by creating a pre-release:
1. Create a release marked as "pre-release"
2. The workflow will run but won't affect the main marketplace listing
