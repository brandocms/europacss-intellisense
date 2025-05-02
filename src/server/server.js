const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  CompletionItemKind,
  Hover,
  MarkupKind,
} = require('vscode-languageserver/node')

const { TextDocument } = require('vscode-languageserver-textdocument')
const { findEuropaConfigPath, loadEuropaConfig } = require('./configLoader')
const {
  getAtRuleCompletions,
  getColorCompletions,
  getBreakpointCompletions,
  getFontFamilyCompletions,
  getFontSizeCompletions,
  getSpacingCompletions,
} = require('./completions')

// Create a connection for the server, using Node's IPC as a transport
// Also include all preview / proposed LSP features
const connection = createConnection(ProposedFeatures.all)

// Create a simple text document manager
const documents = new TextDocuments(TextDocument)

// User configuration and Europa configuration
let config = {
  europaConfigPath: null,
  workspaceFolders: [],
}

let europaConfig = null

connection.onInitialize(params => {
  const capabilities = params.capabilities
  config.workspaceFolders = params.workspaceFolders || []

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['@', ' ', '.', '/', '-'],
      },
      // Add hover support
      hoverProvider: true,
    },
  }
})

connection.onInitialized(async () => {
  // Find and load Europa configuration
  config.europaConfigPath = findEuropaConfigPath(config.workspaceFolders)

  if (config.europaConfigPath) {
    europaConfig = loadEuropaConfig(config.europaConfigPath)
  }

  // Set up handlers for client-server communication about colors
  connection.onNotification('europacss/getAllColors', () => {
    sendAllColorsToClient()
  })

  connection.onNotification('europacss/getColorValue', params => {
    const colorValue = getColorFromConfig(params.colorName)

    if (colorValue) {
      connection.sendNotification('europacss/colorInfo', {
        colorName: params.colorName,
        hexValue: colorValue,
      })
    }
  })
})

// Handle completion requests
connection.onCompletion(params => {
  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return null
  }

  const text = document.getText()
  const position = params.position
  const offset = document.offsetAt(position)

  // Get the current line up to the cursor position
  const currentLine = getCurrentLine(text, offset)

  // Just use the regular completion items provider
  return getCompletionItems(currentLine)
})

// Handle completion item resolve requests
connection.onCompletionResolve(item => {
  // Check if this is a color completion item
  if (item.kind === CompletionItemKind.Color) {
    let colorValue = null
    let originalColor = null

    // Try multiple ways to get the color value, in order of preference
    if (item.data) {
      if (item.data.colorValue) {
        colorValue = item.data.colorValue
      } else if (item.data.color) {
        colorValue = item.data.color
      }

      // Get the original color if available
      if (item.data.originalColor) {
        originalColor = item.data.originalColor
      }
    }

    // Fallback to extracting from detail
    if (!colorValue) {
      const colorMatch = item.detail?.match(/Color: (.*?)$/)
      if (colorMatch && colorMatch[1]) {
        colorValue = colorMatch[1]
        originalColor = colorMatch[1]
      }
    }

    if (colorValue) {
      // Set documentation to show the hex color for the swatch
      item.documentation = colorValue

      // Make sure data property has all color information
      if (!item.data) item.data = {}
      item.data = {
        ...item.data,
        color: colorValue,
        type: 'color',
        colorValue: colorValue,
        originalColor: originalColor || colorValue,
      }

      // Update the detail to show both the original and hex if they differ
      if (
        originalColor &&
        originalColor !== colorValue &&
        originalColor !== 'transparent' &&
        colorValue !== 'transparent'
      ) {
        item.detail = `Color: ${originalColor} (${colorValue})`
      }
    }
  }

  return item
})

// Modified hover handler with better breakpoint support
connection.onHover(params => {
  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return null
  }

  const text = document.getText()
  const position = params.position

  // Get the current line
  const lines = text.split(/\r?\n/g)
  const line = lines[position.line] || ''

  // Simplify hover detection by extracting the word at cursor position
  const wordAtPosition = getWordAtPosition(line, position.character)

  if (wordAtPosition) {
    // Check if it's a breakpoint collection with $ prefix
    if (wordAtPosition.startsWith('$')) {
      if (
        europaConfig?.theme?.breakpointCollections &&
        europaConfig.theme.breakpointCollections[wordAtPosition]
      ) {
        const collectionValue = europaConfig.theme.breakpointCollections[wordAtPosition]
        return {
          contents: {
            kind: 'markdown',
            value: `### Breakpoint Collection: ${wordAtPosition}\n\n**Value:** \`${collectionValue}\`\n\n**Definition:**\n\n${getBreakpointCollectionDescription(
              collectionValue
            )}`,
          },
        }
      }
    }

    // Check if it's a regular breakpoint
    if (isKnownBreakpoint(wordAtPosition)) {
      const breakpointInfo = getBreakpointHoverInfo(wordAtPosition)
      if (breakpointInfo) {
        return {
          contents: {
            kind: 'markdown',
            value: breakpointInfo,
          },
        }
      }
    }

    // Check if it's a font family
    if (line.includes('@font') && isFontFamily(wordAtPosition)) {
      const fontInfo = getFontHoverInfo(wordAtPosition)
      if (fontInfo) {
        return {
          contents: {
            kind: 'markdown',
            value: fontInfo,
          },
        }
      }
    }

    // Check if it's a font size
    if ((line.includes('@font') || line.includes('@fontsize')) && isFontSize(wordAtPosition)) {
      const sizeInfo = getFontSizeHoverInfo(wordAtPosition)
      if (sizeInfo) {
        return {
          contents: {
            kind: 'markdown',
            value: sizeInfo,
          },
        }
      }
    }

    // Check if it's a color
    if (line.includes('@color') && isColor(wordAtPosition)) {
      const colorInfo = getColorHoverInfo(wordAtPosition)
      if (colorInfo) {
        return {
          contents: {
            kind: 'markdown',
            value: colorInfo,
          },
        }
      }
    }
  }

  return null
})

/**
 * Extract the word at a specific position in a line of text
 * @param {string} line - The text line
 * @param {number} position - The character position
 * @returns {string|null} - The word at the position or null if not found
 */
function getWordAtPosition(line, position) {
  // Define word boundaries (spaces, semicolons, etc.)
  const boundaries = /[\s;{}()]/

  // Find the start of the word
  let start = position
  while (start > 0 && !boundaries.test(line[start - 1])) {
    start--
  }

  // Find the end of the word
  let end = position
  while (end < line.length && !boundaries.test(line[end])) {
    end++
  }

  // Extract the word if the position is within its bounds
  if (start <= position && position <= end) {
    return line.substring(start, end)
  }

  return null
}

/**
 * Check if a word is a font family in the config
 * @param {string} word - The word to check
 * @returns {boolean} - Whether it's a font family
 */
function isFontFamily(word) {
  if (
    !europaConfig ||
    !europaConfig.theme ||
    !europaConfig.theme.typography ||
    !europaConfig.theme.typography.families
  ) {
    return false
  }

  return !!europaConfig.theme.typography.families[word]
}

/**
 * Check if a word is a font size in the config
 * @param {string} word - The word to check
 * @returns {boolean} - Whether it's a font size
 */
function isFontSize(word) {
  if (
    !europaConfig ||
    !europaConfig.theme ||
    !europaConfig.theme.typography ||
    !europaConfig.theme.typography.sizes
  ) {
    return false
  }

  return !!europaConfig.theme.typography.sizes[word]
}

/**
 * Check if a word is a color in the config
 * @param {string} word - The word to check
 * @returns {boolean} - Whether it's a color
 */
function isColor(word) {
  if (!europaConfig || !europaConfig.theme || !europaConfig.theme.colors) {
    return false
  }

  let colorConfig = europaConfig.theme.colors
  if (typeof colorConfig === 'function') {
    try {
      colorConfig = colorConfig()
    } catch (e) {
      return false
    }
  }

  // Check if it's a direct color
  if (colorConfig[word]) {
    return true
  }

  // Check if it's a nested color (format: group.name)
  const parts = word.split('.')
  if (parts.length === 2) {
    return (
      colorConfig[parts[0]] &&
      typeof colorConfig[parts[0]] === 'object' &&
      colorConfig[parts[0]][parts[1]] !== undefined
    )
  }

  return false
}

/**
 * Check if a string is a known breakpoint
 * @param {string} name - The name to check
 * @returns {boolean} - Whether it's a known breakpoint
 */
function isKnownBreakpoint(name) {
  if (!europaConfig || !europaConfig.theme) return false

  // Check regular breakpoints
  if (europaConfig.theme.breakpoints && europaConfig.theme.breakpoints[name]) {
    return true
  }

  // Check if it's a breakpoint collection (with $ prefix)
  if (name.startsWith('$')) {
    if (
      europaConfig.theme.breakpointCollections &&
      europaConfig.theme.breakpointCollections[name]
    ) {
      return true
    }
  }

  return false
}

/**
 * Get hover information for a breakpoint
 * @param {string} breakpointName - The breakpoint name to get info for
 * @returns {string|null} - The markdown content or null if not found
 */
function getBreakpointHoverInfo(breakpointName) {
  if (!europaConfig || !europaConfig.theme) {
    return null
  }

  // Handle regular breakpoints
  if (europaConfig.theme.breakpoints && europaConfig.theme.breakpoints[breakpointName]) {
    const breakpointValue = europaConfig.theme.breakpoints[breakpointName]

    let content = `### Breakpoint: ${breakpointName}\n\n`
    content += `**Value:** \`${breakpointValue}\`\n\n`

    // Add media query example
    content += '**Media Query Equivalent:**\n\n'
    content += '```css\n@media (min-width: ' + breakpointValue + ') {\n  /* styles */\n}\n```\n\n'

    return content
  }

  return null
}

/**
 * Get hover information for a color
 * @param {string} colorName - The color name to get info for
 * @returns {string|null} - The markdown content or null if not found
 */
function getColorHoverInfo(colorName) {
  if (!europaConfig || !europaConfig.theme || !europaConfig.theme.colors) {
    return null
  }

  // Handle function-based color config
  let colorConfig = europaConfig.theme.colors
  if (typeof colorConfig === 'function') {
    try {
      colorConfig = colorConfig()
    } catch (e) {
      return null
    }
  }

  // Check for nested color names (e.g. 'primary.light')
  const parts = colorName.split('.')
  if (parts.length > 1) {
    const group = parts[0]
    const name = parts[1]

    if (
      colorConfig[group] &&
      typeof colorConfig[group] === 'object' &&
      colorConfig[group][name]
    ) {
      const colorValue = colorConfig[group][name]
      // Simple hover info with just the text value
      let content = `### Color: ${colorName}\n\n`
      content += `**Value:** \`${colorValue}\`\n`
      return content
    }
  }

  // Check for direct color names
  if (colorConfig[colorName]) {
    const colorValue = colorConfig[colorName]

    // Skip if it's an object (color group)
    if (typeof colorValue === 'object' && colorValue !== null) {
      return null
    }

    // Simple hover info with just the text value
    let content = `### Color: ${colorName}\n\n`
    content += `**Value:** \`${colorValue}\`\n`
    return content
  }

  return null
}

/**
 * Get hover information for a font family
 * @param {string} fontFamily - The font family name to get info for
 * @returns {string|null} - The markdown content or null if not found
 */
function getFontHoverInfo(fontFamily) {
  if (
    !europaConfig ||
    !europaConfig.theme ||
    !europaConfig.theme.typography ||
    !europaConfig.theme.typography.families
  ) {
    return null
  }

  const fontFamilies = europaConfig.theme.typography.families

  if (fontFamilies[fontFamily]) {
    const fontValue = fontFamilies[fontFamily]
    let fontString

    if (Array.isArray(fontValue)) {
      fontString = fontValue.join(', ')
    } else {
      fontString = String(fontValue)
    }

    let content = `### Font Family: ${fontFamily}\n\n`
    content += '```css\nfont-family: ' + fontString + ';\n```\n\n'
    content += '#### Preview:\n'

    if (Array.isArray(fontValue)) {
      content += fontValue
        .map(font => {
          // Properly escape font names with spaces for CSS
          const formattedFont =
            font.includes(' ') && !font.includes('"') && !font.includes("'") ? `"${font}"` : font
          return `<div style="font-family: ${formattedFont}; margin-bottom: 10px;">${formattedFont}: The quick brown fox jumps over the lazy dog.</div>`
        })
        .join('')
    } else {
      content += `<div style="font-family: ${fontString};">${fontString}: The quick brown fox jumps over the lazy dog.</div>`
    }

    return content
  }

  return null
}

/**
 * Get hover information for a font size
 * @param {string} fontSize - The font size name to get info for
 * @returns {string|null} - The markdown content or null if not found
 */
function getFontSizeHoverInfo(fontSize) {
  if (
    !europaConfig ||
    !europaConfig.theme ||
    !europaConfig.theme.typography ||
    !europaConfig.theme.typography.sizes
  ) {
    return null
  }

  const fontSizes = europaConfig.theme.typography.sizes

  if (fontSizes[fontSize]) {
    const fontSizeValue = fontSizes[fontSize]
    let content = `### Font Size: ${fontSize}\n\n`

    if (typeof fontSizeValue === 'object' && fontSizeValue !== null) {
      // For responsive font sizes
      content += 'Responsive font sizes across breakpoints:\n\n'
      content += '| Breakpoint | Size |\n| --- | --- |\n'

      Object.entries(fontSizeValue).forEach(([breakpoint, value]) => {
        content += `| ${breakpoint} | ${value} |\n`
      })

      content += '\n\n#### Preview:\n'

      // Add previews for each breakpoint
      Object.entries(fontSizeValue).forEach(([breakpoint, value]) => {
        content += `<div style="font-size: ${value}; margin-bottom: 8px;">${breakpoint}: Text at ${value}</div>`
      })
    } else {
      // For single font size value
      content += '```css\nfont-size: ' + fontSizeValue + ';\n```\n\n'
      content += '#### Preview:\n'
      content += `<div style="font-size: ${fontSizeValue};">Text at ${fontSizeValue}</div>`
    }

    return content
  }

  return null
}

// Get the current line text up to the cursor position
function getCurrentLine(text, offset) {
  const lines = text.split(/\r?\n/g)
  let currentOffset = 0

  for (const line of lines) {
    const lineLength = line.length + 1 // +1 for the newline character

    if (currentOffset + lineLength > offset) {
      // Found the line containing the cursor
      const positionInLine = offset - currentOffset
      return line.substring(0, positionInLine)
    }

    currentOffset += lineLength
  }

  return ''
}

// Provide completion items based on the current context
function getCompletionItems(currentLine) {
  // Ensure at-rule completions are shown when typing @
  // Both when @ is the only character and when it's at the end of a string
  if (currentLine === '@' || currentLine.endsWith('@')) {
    return getAtRuleCompletions()
  }

  // First check for specific completion types based on the current input

  // Color target completion (after '@color')
  // This matches exactly "@color " with a space at the end
  if (/^.*@color\s$/.test(currentLine)) {
    return [
      { label: 'fg', kind: CompletionItemKind.Value, detail: 'Foreground (text) color' },
      { label: 'bg', kind: CompletionItemKind.Value, detail: 'Background color' },
      { label: 'fill', kind: CompletionItemKind.Value, detail: 'SVG fill color' },
      { label: 'stroke', kind: CompletionItemKind.Value, detail: 'SVG stroke color' },
      { label: 'border', kind: CompletionItemKind.Value, detail: 'Border color' },
      { label: 'border-top', kind: CompletionItemKind.Value, detail: 'Top border color' },
      { label: 'border-bottom', kind: CompletionItemKind.Value, detail: 'Bottom border color' },
      { label: 'border-left', kind: CompletionItemKind.Value, detail: 'Left border color' },
      { label: 'border-right', kind: CompletionItemKind.Value, detail: 'Right border color' },
    ]
  }

  // Color completion (after '@color fg ' or similar)
  // This matches @color followed by any of the targets and a space
  if (
    /^.*@color\s+(fg|bg|fill|stroke|border|border-top|border-bottom|border-left|border-right)\s$/.test(
      currentLine
    )
  ) {
    return getColorCompletions(europaConfig)
  }

  // If the line starts with @ or contains some at-rule, provide at-rule completions
  if (currentLine.trim().startsWith('@')) {
    // Check for specific at-rule completions first

    // Font family completion (after '@font')
    if (/@font\s$/.test(currentLine)) {
      return getFontFamilyCompletions(europaConfig)
    }

    // Font size completion (after '@font [family]' or '@fontsize')
    if (/@font\s+\w+\s$/.test(currentLine) || /@fontsize\s$/.test(currentLine)) {
      return getFontSizeCompletions(europaConfig)
    }

    // Responsive first parameter completion (breakpoints and collections)
    if (/@responsive\s$/.test(currentLine)) {
      return getBreakpointCompletions(europaConfig)
    }

    // Column second parameter completion (after '@column [any-value]')
    // No specific completions for first param, but breakpoints for second param
    if (/@column\s+\S+\s$/.test(currentLine)) {
      return getBreakpointCompletions(europaConfig)
    }

    // Space second parameter (spacing values from config)
    // First parameter can be any CSS property, no specific autocomplete
    if (/@space\s+[\w-]+\s$/.test(currentLine)) {
      // Get spacing completions
      const spacingCompletions = getSpacingCompletions(europaConfig)
      return spacingCompletions
    }

    // Space third parameter (breakpoints)
    // After @space property spacing-value
    if (/@space\s+[\w-]+\s+[\w.-]+\s$/.test(currentLine)) {
      return getBreakpointCompletions(europaConfig)
    }

    // Breakpoint completion (after font family and size, or after fontsize and a size, or for other at-rules)
    const fontWithSizeRegex = /@font\s+\w+\s+\w+\s$/
    const fontsizeWithSizeRegex = /@fontsize\s+\w+\s$/
    const otherAtRulesRegex = /@(responsive)\s+.+\s$/

    if (
      fontWithSizeRegex.test(currentLine) ||
      fontsizeWithSizeRegex.test(currentLine) ||
      otherAtRulesRegex.test(currentLine)
    ) {
      return getBreakpointCompletions(europaConfig)
    }
  }

  // For blank lines or lines with just whitespace, provide at-rule completions
  if (currentLine.trim() === '' || /^\s+$/.test(currentLine)) {
    return getAtRuleCompletions()
  }

  return []
}

// Helper function to log color structure
function logColorStructure(colors, prefix = '') {
  return
}

// Get all colors from the Europa config and send them to the client
function sendAllColorsToClient() {
  if (!europaConfig || !europaConfig.theme) {
    return
  }

  // Check for colors directly in theme
  if (europaConfig.theme.colors) {
    // Process flat colors first
    Object.entries(europaConfig.theme.colors).forEach(([colorName, colorValue]) => {
      if (typeof colorValue === 'string') {
        connection.sendNotification('europacss/colorInfo', {
          colorName,
          hexValue: colorValue,
        })
      }
      // Handle nested color objects (like primary: { light: '#value', dark: '#value' })
      else if (typeof colorValue === 'object' && colorValue !== null) {
        Object.entries(colorValue).forEach(([nestedName, nestedValue]) => {
          if (typeof nestedValue === 'string') {
            const fullColorName = `${colorName}.${nestedName}`
            connection.sendNotification('europacss/colorInfo', {
              colorName: fullColorName,
              hexValue: nestedValue,
            })
          }
        })
      }
    })
  } else if (europaConfig.theme.color) {
    // Try to find colors in theme.color (singular)
    Object.entries(europaConfig.theme.color).forEach(([colorName, colorValue]) => {
      if (typeof colorValue === 'string') {
        connection.sendNotification('europacss/colorInfo', {
          colorName,
          hexValue: colorValue,
        })
      }
    })
  }
}

// Get a color value from the Europa config
function getColorFromConfig(colorName) {
  if (!europaConfig || !europaConfig.theme) {
    return null
  }

  // Handle nested color notation (e.g., "primary.light")
  const parts = colorName.split('.')
  let result = null

  // First check in theme.colors (most common place)
  if (europaConfig.theme.colors) {
    let colorConfig = europaConfig.theme.colors
    if (typeof colorConfig === 'function') {
      try {
        colorConfig = colorConfig()
      } catch (e) {
        return null
      }
    }

    if (parts.length === 1) {
      // Direct color
      result = colorConfig[colorName]
    } else if (parts.length === 2) {
      // Nested color
      const [parentKey, childKey] = parts
      if (colorConfig[parentKey] && typeof colorConfig[parentKey] === 'object') {
        result = colorConfig[parentKey][childKey]
      }
    }
  }

  return result
}

// Helper function to generate breakpoint collection description
function getBreakpointCollectionDescription(collectionValue) {
  if (!collectionValue || typeof collectionValue !== 'string') {
    return ''
  }

  let description = ''

  if (collectionValue.includes('/')) {
    // Range format like "sm/lg"
    const [start, end] = collectionValue.split('/')
    description = `Includes all breakpoints from \`${start}\` to \`${end}\`.`

    if (europaConfig?.theme?.breakpoints) {
      description += '\n\n**Included breakpoints:**\n\n'
      let inRange = false
      Object.entries(europaConfig.theme.breakpoints).forEach(([bp, value]) => {
        if (bp === start) inRange = true
        if (inRange) {
          description += `- \`${bp}\`: \`${value}\`\n`
        }
        if (bp === end) inRange = false
      })
    }
  } else if (collectionValue.includes(',')) {
    // List format like "sm,md,lg"
    const breakpoints = collectionValue.split(',')
    description = 'Includes the following breakpoints:\n\n'

    if (europaConfig?.theme?.breakpoints) {
      breakpoints.forEach(bp => {
        const value = europaConfig.theme.breakpoints[bp.trim()]
        if (value) {
          description += `- \`${bp.trim()}\`: \`${value}\`\n`
        } else {
          description += `- \`${bp.trim()}\`: (unknown value)\n`
        }
      })
    }
  } else if (
    collectionValue.startsWith('>=') ||
    collectionValue.startsWith('<=') ||
    collectionValue.startsWith('>') ||
    collectionValue.startsWith('<')
  ) {
    // Comparison format like ">=md"
    const operator = collectionValue.substring(
      0,
      collectionValue.length - (collectionValue.length - 2)
    )
    const breakpoint = collectionValue.substring(2)

    const operatorText = getOperatorTextSimple(operator)
    description = `All breakpoints ${operatorText} \`${breakpoint}\`.`

    if (europaConfig?.theme?.breakpoints && europaConfig.theme.breakpoints[breakpoint]) {
      description += `\n\nReference value: \`${breakpoint}\` = \`${europaConfig.theme.breakpoints[breakpoint]}\``
    }
  }

  return description
}

// Simple version of operator text conversion
function getOperatorTextSimple(operator) {
  switch (operator) {
    case '>=':
      return 'greater than or equal to'
    case '<=':
      return 'less than or equal to'
    case '>':
      return 'greater than'
    case '<':
      return 'less than'
    default:
      return 'matching'
  }
}

// Make the connection listen on the process
documents.listen(connection)
connection.console.info('EuropaCSS language server ready')
connection.listen()
