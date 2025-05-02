# EuropaCSS IntelliSense

IntelliSense extension for EuropaCSS providing autocomplete, syntax highlighting and other language features.

## Features

- **Autocomplete** for all EuropaCSS at-rules (`@color`, `@space`, `@font`, `@fontsize`, etc.)
- **Color suggestions** from your Europa configuration when using `@color`
- **Breakpoint suggestions** when using responsive features
- **Font family and size suggestions** from your configuration
- **Spacing suggestions** from your configuration
- **Syntax highlighting** for EuropaCSS at-rules

## Requirements

This extension requires:

1. A project with the EuropaCSS postcss plugin installed
2. A `europa.config.js` file in your workspace root

## Configuration

No additional configuration is needed. The extension automatically detects your `europa.config.js` file and uses it to provide intelligent suggestions.

## Extension Settings

This extension doesn't add any VS Code settings.

## Known Issues

- None reported yet

## Development

### Building the extension

```bash
# Install dependencies
npm install

# Build the extension
npm run esbuild
```

### Running the extension

- Press `F5` to open a new window with your extension loaded
- Create a CSS file and add EuropaCSS at-rules to see the extension in action
- Set breakpoints in your code inside `src/extension.js` to debug your extension
- Find output from your extension in the debug console

### Making changes

- You can relaunch the extension from the debug toolbar after changing code in `src/extension.js`
- You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes

### Packaging the extension

```bash
npm run vscode:prepublish
```

## Release Notes

### 1.0.0

Initial release of EuropaCSS IntelliSense 