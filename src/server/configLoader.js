const fs = require('fs')
const path = require('path')
const vm = require('vm')
const url = require('url')

/**
 * Find the closest Europa configuration file to the given file path
 * @param {string} filePath - Path to the file (URI format)
 * @param {Array} workspaceFolders - Array of workspace folders
 * @returns {string|null} - Path to the Europa config file, or null if not found
 */
function findClosestEuropaConfigPath(filePath, workspaceFolders) {
  if (!filePath) return null

  // Convert URI to file path
  const fileSystemPath = filePath.startsWith('file://')
    ? url.fileURLToPath(filePath)
    : filePath.replace('file://', '')

  // Get directory of the file
  let dir = path.dirname(fileSystemPath)

  // Keep track of workspace boundaries
  const workspacePaths = workspaceFolders
    ? workspaceFolders.map(folder => folder.uri.replace('file://', ''))
    : []

  // Check if we're still in a workspace
  const isInWorkspace = dirPath => {
    return workspacePaths.some(wsPath => dirPath.startsWith(wsPath))
  }

  // Start from the file's directory and move up until we find a config
  // or reach the workspace boundary
  while (dir && isInWorkspace(dir)) {
    // Check for both .js and .cjs variants
    const jsConfigPath = path.join(dir, 'europa.config.js')
    const cjsConfigPath = path.join(dir, 'europa.config.cjs')

    if (fs.existsSync(jsConfigPath)) {
      return jsConfigPath
    }

    if (fs.existsSync(cjsConfigPath)) {
      return cjsConfigPath
    }

    // Move up one directory level
    const parentDir = path.dirname(dir)

    // If we've reached the root, stop searching
    if (parentDir === dir) {
      break
    }

    dir = parentDir
  }

  // If we couldn't find a nearest config, fall back to workspace-level configs
  return findEuropaConfigPath(workspaceFolders)
}

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

    // Check for both .js and .cjs variants
    const jsConfigPath = path.join(folderPath, 'europa.config.js')
    const cjsConfigPath = path.join(folderPath, 'europa.config.cjs')

    if (fs.existsSync(jsConfigPath)) {
      return jsConfigPath
    }

    if (fs.existsSync(cjsConfigPath)) {
      return cjsConfigPath
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
    return userConfig
  } catch (error) {
    return null
  }
}

module.exports = {
  findEuropaConfigPath,
  findClosestEuropaConfigPath,
  loadEuropaConfig,
}
