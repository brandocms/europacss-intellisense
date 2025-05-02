const vscode = require('vscode')
const { LanguageClient, TransportKind } = require('vscode-languageclient/node')
const path = require('path')

let client
let decorationTimeout = null

// Cache to store colors from the @color rules to avoid re-parsing
const colorCache = new Map()

// Regular expressions for finding color values in the document
const COLOR_REGEX = /@color\s+(fg|bg|fill|stroke|border|border-[a-z-]+)\s+([a-zA-Z0-9._-]+)/g
const HEX_COLOR_REGEX = /#([0-9a-fA-F]{3,8})\b/g

// Add a new regex for capturing nested color formats like blue.light
const NESTED_COLOR_REGEX = /([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)/g

const NAMED_COLORS = {
  aliceblue: '#F0F8FF',
  antiquewhite: '#FAEBD7',
  aqua: '#00FFFF',
  aquamarine: '#7FFFD4',
  azure: '#F0FFFF',
  beige: '#F5F5DC',
  black: '#000000',
  blue: '#0000FF',
  brown: '#A52A2A',
  cyan: '#00FFFF',
  darkblue: '#00008B',
  darkcyan: '#008B8B',
  darkgray: '#A9A9A9',
  darkgreen: '#006400',
  darkkhaki: '#BDB76B',
  darkmagenta: '#8B008B',
  darkolivegreen: '#556B2F',
  darkorange: '#FF8C00',
  darkorchid: '#9932CC',
  darkred: '#8B0000',
  darkseagreen: '#8FBC8F',
  darkslateblue: '#483D8B',
  darkslategray: '#2F4F4F',
  darkviolet: '#9400D3',
  deeppink: '#FF1493',
  deepskyblue: '#00BFFF',
  dimgray: '#696969',
  dodgerblue: '#1E90FF',
  firebrick: '#B22222',
  ghostwhite: '#F8F8FF',
  gold: '#FFD700',
  goldenrod: '#DAA520',
  gray: '#808080',
  green: '#008000',
  honeydew: '#F0FFF0',
  hotpink: '#FF69B4',
  indianred: '#CD5C5C',
  indigo: '#4B0082',
  ivory: '#FFFFF0',
  khaki: '#F0E68C',
  lavender: '#E6E6FA',
  lemonchiffon: '#FFFACD',
  lightblue: '#ADD8E6',
  lightcoral: '#F08080',
  lightcyan: '#E0FFFF',
  lightgray: '#D3D3D3',
  lightgreen: '#90EE90',
  lightpink: '#FFB6C1',
  lightsalmon: '#FFA07A',
  lightseagreen: '#20B2AA',
  lightskyblue: '#87CEFA',
  lightslategray: '#778899',
  lightsteelblue: '#B0C4DE',
  lightyellow: '#FFFFE0',
  lime: '#00FF00',
  limegreen: '#32CD32',
  magenta: '#FF00FF',
  maroon: '#800000',
  navy: '#000080',
  olive: '#808000',
  orange: '#FFA500',
  orangered: '#FF4500',
  pink: '#FFC0CB',
  purple: '#800080',
  red: '#FF0000',
  salmon: '#FA8072',
  seagreen: '#2E8B57',
  sienna: '#A0522D',
  silver: '#C0C0C0',
  skyblue: '#87CEEB',
  slateblue: '#6A5ACD',
  slategray: '#708090',
  snow: '#FFFAFA',
  springgreen: '#00FF7F',
  steelblue: '#4682B4',
  tan: '#D2B48C',
  teal: '#008080',
  thistle: '#D8BFD8',
  tomato: '#FF6347',
  turquoise: '#40E0D0',
  violet: '#EE82EE',
  wheat: '#F5DEB3',
  white: '#FFFFFF',
  yellow: '#FFFF00',
  yellowgreen: '#9ACD32',
  transparent: 'transparent',
}

// Convert color name to hex
function getHexColor(colorName) {
  if (!colorName) return null

  // If it's already a hex color, return it
  if (colorName.startsWith('#')) {
    return colorName
  }

  // First check the cache for config colors - these come from the server
  if (colorCache.has(colorName)) {
    const cachedColor = colorCache.get(colorName)
    return cachedColor
  }

  // Always request color from server for next time, before falling back to named colors
  if (client) {
    client.sendNotification('europacss/getColorValue', { colorName })
  }

  // Special cases for common colors
  const lowerColor = colorName.toLowerCase()
  if (lowerColor === 'white' || lowerColor === 'black' || lowerColor === 'transparent') {
    const namedColor = NAMED_COLORS[lowerColor]
    if (namedColor) {
      return namedColor
    }
  }

  // As last resort, use built-in named colors
  // We only want to do this for actual CSS named colors, not for custom names
  // that might come from config in the future
  const namedColor = NAMED_COLORS[lowerColor]
  if (namedColor) {
    return namedColor
  }

  return null
}

// Get a color value from the Europa config
function getColorFromConfig(colorName) {
  // If we've already cached this color, return it
  if (colorCache.has(colorName)) {
    return colorCache.get(colorName)
  }

  // Handle nested color notation (e.g., "primary.light")
  const parts = colorName.split('.')

  // Send a notification to the server to ask about this color
  // This is an async operation, but we'll update the cache for next time
  if (client) {
    client.sendNotification('europacss/getColorValue', { colorName })
  }

  return null // We don't have the color yet, but we've requested it
}

// When the extension starts, request all colors from config
function requestInitialColors() {
  if (client) {
    setTimeout(() => {
      client.sendNotification('europacss/getAllColors')
    }, 1000) // Wait a second to ensure the server is ready
  }
}

function activate(context) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join('src', 'server', 'server.js'))

  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  }

  // Options to control the language client
  const clientOptions = {
    // Register the server for CSS files
    documentSelector: [
      { scheme: 'file', language: 'css' },
      { scheme: 'file', language: 'postcss' },
    ],
    synchronize: {
      // Notify the server about file changes to europa config files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher('**/europa.config.js'),
    },
    // Add middleware to intercept the completion requests
    middleware: {
      provideCompletionItem: async (document, position, context, token, next) => {
        const line = document.lineAt(position.line).text
        const linePrefix = line.substring(0, position.character)

        // If we just typed @, force show the completion immediately
        if (linePrefix.endsWith('@')) {
          // Trigger the completions manually right away
          setTimeout(() => {
            vscode.commands.executeCommand('editor.action.triggerSuggest')
          }, 10)

          // Let the request continue to the server
          return await next(document, position, context, token)
        }

        // For all other cases, let the server handle it
        return await next(document, position, context, token)
      },
    },
  }

  // Create the language client and start the client
  client = new LanguageClient(
    'europacssLanguageServer',
    'EuropaCSS Language Server',
    serverOptions,
    clientOptions
  )

  // Start the client. This will also launch the server
  client
    .start()
    .then(() => {
      // Listen for color information from the server
      client.onNotification('europacss/colorInfo', params => {
        if (params.colorName && params.hexValue) {
          // Cache the color value
          colorCache.set(params.colorName, params.hexValue)

          // Update decorations in active editor
          if (activeEditor) {
            updateDecorations(activeEditor)
          }
        }
      })

      // Request all colors from the config when client is ready
      requestInitialColors()
    })
    .catch(error => {
      vscode.window.showErrorMessage(
        `EuropaCSS IntelliSense failed to activate: ${error.message}`
      )
    })

  // Create decorator type for colors
  const colorDecorationType = vscode.window.createTextEditorDecorationType({
    before: {
      contentText: ' ',
      margin: '0.1em 0.2em 0 0.2em',
      width: '0.8em',
      height: '0.8em',
      border: '1px solid #00000033',
      borderRadius: '3px',
    },
  })

  // Function to update decorations in a specific editor
  function updateDecorations(editor) {
    if (!editor) {
      return
    }

    const document = editor.document

    // Only apply to CSS and PostCSS files
    if (document.languageId !== 'css' && document.languageId !== 'postcss') {
      return
    }

    const text = document.getText()
    const decorations = []

    // Set to keep track of all color names we encounter
    const allColorNames = new Set()

    // Find all @color rules
    let match
    COLOR_REGEX.lastIndex = 0 // Reset regex index

    try {
      while ((match = COLOR_REGEX.exec(text)) !== null) {
        const colorName = match[2]
        // Track all color names for potential server requests
        allColorNames.add(colorName)

        const hexColor = getHexColor(colorName)

        if (hexColor) {
          const startPos = document.positionAt(match.index + match[0].indexOf(colorName))
          const endPos = document.positionAt(
            match.index + match[0].indexOf(colorName) + colorName.length
          )

          // Create decoration with the color swatch
          const decoration = {
            range: new vscode.Range(startPos, endPos),
            renderOptions: {
              before: {
                backgroundColor: hexColor,
              },
            },
          }

          decorations.push(decoration)
        }
      }
    } catch (e) {
      // Silently handle regex errors
    }

    // Also find direct hex colors in the text
    HEX_COLOR_REGEX.lastIndex = 0 // Reset regex index

    try {
      while ((match = HEX_COLOR_REGEX.exec(text)) !== null) {
        const hexColor = match[0]

        const startPos = document.positionAt(match.index)
        const endPos = document.positionAt(match.index + hexColor.length)

        // Create decoration with the color swatch
        const decoration = {
          range: new vscode.Range(startPos, endPos),
          renderOptions: {
            before: {
              backgroundColor: hexColor,
            },
          },
        }

        decorations.push(decoration)
      }
    } catch (e) {
      // Silently handle regex errors
    }

    // Apply the decorations
    editor.setDecorations(colorDecorationType, decorations)

    // Request any missing colors from the server
    if (client && allColorNames.size > 0) {
      for (const colorName of allColorNames) {
        if (!colorCache.has(colorName)) {
          client.sendNotification('europacss/getColorValue', { colorName })
        }
      }

      // After requesting colors, schedule another decoration update in 1 second
      // to catch any colors that might have been added by the server
      setTimeout(() => {
        if (editor) {
          updateDecorations(editor)
        }
      }, 1000)
    }
  }

  // Set up triggers for updating decorations
  let activeEditor = vscode.window.activeTextEditor
  if (activeEditor) {
    // Request all colors first, then update decorations after a short delay
    requestInitialColors()
    setTimeout(() => updateDecorations(activeEditor), 1000)
  }

  // Update decorations when editor changes
  vscode.window.onDidChangeActiveTextEditor(
    editor => {
      activeEditor = editor
      if (editor) {
        updateDecorations(editor)
      }
    },
    null,
    context.subscriptions
  )

  // Update decorations when document changes
  vscode.workspace.onDidChangeTextDocument(
    event => {
      if (activeEditor && event.document === activeEditor.document) {
        // Use setTimeout to avoid updating too frequently
        clearTimeout(decorationTimeout)
        decorationTimeout = setTimeout(() => updateDecorations(activeEditor), 200)
      }
    },
    null,
    context.subscriptions
  )

  // Update decorations when configuration changes
  vscode.workspace.onDidChangeConfiguration(
    event => {
      if (event.affectsConfiguration('europacss')) {
        // Clear cache and request all colors again
        colorCache.clear()
        requestInitialColors()

        // Update decorations after a delay to allow colors to be received
        setTimeout(() => {
          if (activeEditor) {
            updateDecorations(activeEditor)
          }
        }, 1500)
      }
    },
    null,
    context.subscriptions
  )
}

function deactivate() {
  if (!client) {
    return undefined
  }
  return client.stop()
}

module.exports = {
  activate,
  deactivate,
}
