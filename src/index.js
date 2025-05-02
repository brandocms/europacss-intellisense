// This file is the entry point for the extension
// It handles loading both the grammar and the language server

const extension = require('./client/extension')

/**
 * Activate the extension
 * @param {import('vscode').ExtensionContext} context
 */
function activate(context) {
  // Register the TextMate grammar and then activate the language server
  extension.activate(context)
}

/**
 * Deactivate the extension
 */
function deactivate() {
  return extension.deactivate()
}

module.exports = {
  activate,
  deactivate,
}
