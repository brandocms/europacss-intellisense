const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const vm = require('vm')

/**
 * Finds the Europa configuration file in the workspace
 * @param {Array} workspaceFolders - Array of workspace folders
 * @returns {string|null} - Path to the Europa config file, or null if not found
 */
function findEuropaConfigPath(workspaceFolders) {
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null
  }

  // Check each workspace folder for config
  for (const folder of workspaceFolders) {
    const folderPath = folder.uri.replace('file://', '')
    const configPath = path.join(folderPath, 'europa.config.js')

    if (fs.existsSync(configPath)) {
      return configPath
    }
  }

  return null
}

/**
 * Loads the Europa configuration from the given path
 * @param {string} configPath - Path to the Europa config file
 * @returns {Object|null} - Loaded configuration or null if loading failed
 */
function loadEuropaConfig(configPath) {
  if (!configPath) return null

  try {
    // Read the file content
    const fileContent = fs.readFileSync(configPath, 'utf8')

    // Create a sandbox context with 'module' and 'exports'
    const sandbox = {
      module: { exports: {} },
      exports: {},
      require: require,
    }

    // Run the file content in the sandbox
    const script = new vm.Script(`
      ${fileContent};
      if (typeof module.exports === 'function') {
        module.exports = module.exports();
      }
    `)

    const context = vm.createContext(sandbox)
    script.runInContext(context)

    // Get the exported config
    const userConfig = sandbox.module.exports

    console.log(
      'Loaded Europa config:',
      JSON.stringify(userConfig, null, 2).substring(0, 500) + '...'
    )

    return userConfig
  } catch (error) {
    console.error(`Error loading Europa config: ${error.message}`)
    return null
  }
}

module.exports = {
  findEuropaConfigPath,
  loadEuropaConfig,
}
