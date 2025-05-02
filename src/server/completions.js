const { CompletionItemKind } = require('vscode-languageserver/node')

/**
 * Mapping of CSS named colors to their hex values
 * This helps VS Code show color swatches for named colors
 */
const namedColors = {
  aliceblue: '#F0F8FF',
  antiquewhite: '#FAEBD7',
  aqua: '#00FFFF',
  aquamarine: '#7FFFD4',
  azure: '#F0FFFF',
  beige: '#F5F5DC',
  bisque: '#FFE4C4',
  black: '#000000',
  blanchedalmond: '#FFEBCD',
  blue: '#0000FF',
  blueviolet: '#8A2BE2',
  brown: '#A52A2A',
  burlywood: '#DEB887',
  cadetblue: '#5F9EA0',
  chartreuse: '#7FFF00',
  chocolate: '#D2691E',
  coral: '#FF7F50',
  cornflowerblue: '#6495ED',
  cornsilk: '#FFF8DC',
  crimson: '#DC143C',
  cyan: '#00FFFF',
  darkblue: '#00008B',
  darkcyan: '#008B8B',
  darkgoldenrod: '#B8860B',
  darkgray: '#A9A9A9',
  darkgreen: '#006400',
  darkgrey: '#A9A9A9',
  darkkhaki: '#BDB76B',
  darkmagenta: '#8B008B',
  darkolivegreen: '#556B2F',
  darkorange: '#FF8C00',
  darkorchid: '#9932CC',
  darkred: '#8B0000',
  darksalmon: '#E9967A',
  darkseagreen: '#8FBC8F',
  darkslateblue: '#483D8B',
  darkslategray: '#2F4F4F',
  darkslategrey: '#2F4F4F',
  darkturquoise: '#00CED1',
  darkviolet: '#9400D3',
  deeppink: '#FF1493',
  deepskyblue: '#00BFFF',
  dimgray: '#696969',
  dimgrey: '#696969',
  dodgerblue: '#1E90FF',
  firebrick: '#B22222',
  floralwhite: '#FFFAF0',
  forestgreen: '#228B22',
  fuchsia: '#FF00FF',
  gainsboro: '#DCDCDC',
  ghostwhite: '#F8F8FF',
  gold: '#FFD700',
  goldenrod: '#DAA520',
  gray: '#808080',
  green: '#008000',
  greenyellow: '#ADFF2F',
  grey: '#808080',
  honeydew: '#F0FFF0',
  hotpink: '#FF69B4',
  indianred: '#CD5C5C',
  indigo: '#4B0082',
  ivory: '#FFFFF0',
  khaki: '#F0E68C',
  lavender: '#E6E6FA',
  lavenderblush: '#FFF0F5',
  lawngreen: '#7CFC00',
  lemonchiffon: '#FFFACD',
  lightblue: '#ADD8E6',
  lightcoral: '#F08080',
  lightcyan: '#E0FFFF',
  lightgoldenrodyellow: '#FAFAD2',
  lightgray: '#D3D3D3',
  lightgreen: '#90EE90',
  lightgrey: '#D3D3D3',
  lightpink: '#FFB6C1',
  lightsalmon: '#FFA07A',
  lightseagreen: '#20B2AA',
  lightskyblue: '#87CEFA',
  lightslategray: '#778899',
  lightslategrey: '#778899',
  lightsteelblue: '#B0C4DE',
  lightyellow: '#FFFFE0',
  lime: '#00FF00',
  limegreen: '#32CD32',
  linen: '#FAF0E6',
  magenta: '#FF00FF',
  maroon: '#800000',
  mediumaquamarine: '#66CDAA',
  mediumblue: '#0000CD',
  mediumorchid: '#BA55D3',
  mediumpurple: '#9370DB',
  mediumseagreen: '#3CB371',
  mediumslateblue: '#7B68EE',
  mediumspringgreen: '#00FA9A',
  mediumturquoise: '#48D1CC',
  mediumvioletred: '#C71585',
  midnightblue: '#191970',
  mintcream: '#F5FFFA',
  mistyrose: '#FFE4E1',
  moccasin: '#FFE4B5',
  navajowhite: '#FFDEAD',
  navy: '#000080',
  oldlace: '#FDF5E6',
  olive: '#808000',
  olivedrab: '#6B8E23',
  orange: '#FFA500',
  orangered: '#FF4500',
  orchid: '#DA70D6',
  palegoldenrod: '#EEE8AA',
  palegreen: '#98FB98',
  paleturquoise: '#AFEEEE',
  palevioletred: '#DB7093',
  papayawhip: '#FFEFD5',
  peachpuff: '#FFDAB9',
  peru: '#CD853F',
  pink: '#FFC0CB',
  plum: '#DDA0DD',
  powderblue: '#B0E0E6',
  purple: '#800080',
  rebeccapurple: '#663399',
  red: '#FF0000',
  rosybrown: '#BC8F8F',
  royalblue: '#4169E1',
  saddlebrown: '#8B4513',
  salmon: '#FA8072',
  sandybrown: '#F4A460',
  seagreen: '#2E8B57',
  seashell: '#FFF5EE',
  sienna: '#A0522D',
  silver: '#C0C0C0',
  skyblue: '#87CEEB',
  slateblue: '#6A5ACD',
  slategray: '#708090',
  slategrey: '#708090',
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
  whitesmoke: '#F5F5F5',
  yellow: '#FFFF00',
  yellowgreen: '#9ACD32',
  transparent: 'transparent',
}

/**
 * Converts a CSS color value to its hex representation if it's a named color
 * @param {string} colorValue - The color value to convert
 * @returns {string} - The hex representation of the color, or the original value if not a named color
 */
function getHexColor(colorValue) {
  if (!colorValue) return colorValue

  // If already a hex, rgb, rgba, hsl, hsla color, return as is
  if (/^#|rgb|hsl/.test(colorValue)) {
    return colorValue
  }

  // Convert to lowercase for case-insensitive comparison
  const colorLower = colorValue.toLowerCase()

  // Return the hex value if it's a known named color
  return namedColors[colorLower] || colorValue
}

/**
 * Creates a completion item with the given properties
 * @param {string} label - The label for the completion item
 * @param {string} detail - The detail/description for the completion item
 * @param {string} documentation - Optional documentation for the completion item
 * @param {CompletionItemKind} kind - The kind of completion item
 * @returns {CompletionItem} - The completion item
 */
function createCompletionItem(label, detail, documentation, kind = CompletionItemKind.Snippet) {
  return {
    label,
    kind,
    detail,
    documentation,
    insertText: label,
    commitCharacters: [' '],
  }
}

/**
 * Provides at-rule completions
 * @returns {Array} - Array of completion items for at-rules
 */
function getAtRuleCompletions() {
  return [
    createAtRuleCompletionItem(
      '@color',
      'EuropaCSS color at-rule',
      '@color fg|bg|fill|stroke|border [color]'
    ),
    createAtRuleCompletionItem(
      '@space',
      'EuropaCSS spacing at-rule',
      '@space [property] [size] [breakpoint]'
    ),
    createAtRuleCompletionItem(
      '@font',
      'EuropaCSS font at-rule',
      '@font [family] [size] [breakpoint]'
    ),
    createAtRuleCompletionItem(
      '@fontsize',
      'EuropaCSS font size at-rule',
      '@fontsize [size] [breakpoint]'
    ),
    createAtRuleCompletionItem(
      '@responsive',
      'EuropaCSS responsive at-rule',
      '@responsive [breakpoint] { ... }'
    ),
    createAtRuleCompletionItem('@grid', 'EuropaCSS grid at-rule', '@grid'),
    createAtRuleCompletionItem('@column', 'EuropaCSS column at-rule', '@column [span]'),
    createAtRuleCompletionItem('@display', 'EuropaCSS display at-rule', '@display [value]'),
    createAtRuleCompletionItem('@abs100', 'EuropaCSS absolute positioning at-rule', '@abs100'),
    createAtRuleCompletionItem('@if', 'EuropaCSS conditional at-rule', '@if [condition]'),
    createAtRuleCompletionItem('@iterate', 'EuropaCSS iteration at-rule', '@iterate [values]'),
    createAtRuleCompletionItem('@unpack', 'EuropaCSS unpacking at-rule', '@unpack [properties]'),
  ]
}

/**
 * Creates a completion item specifically for at-rules
 * @param {string} label - The at-rule name (without @)
 * @param {string} detail - The detail/description
 * @param {string} documentation - Optional documentation
 * @returns {CompletionItem} - The completion item
 */
function createAtRuleCompletionItem(label, detail, documentation) {
  return {
    label: label,
    kind: CompletionItemKind.Snippet,
    detail: detail,
    documentation: documentation,
    insertText: label,
    // Always suggest next parameter after inserting
    command: {
      title: 'Suggest',
      command: 'editor.action.triggerSuggest',
    },
    // Sort by label alphabetically
    sortText: label,
  }
}

/**
 * Provides color completions
 * @param {Object} europaConfig - The Europa configuration
 * @returns {Array} - Array of completion items for colors
 */
function getColorCompletions(europaConfig) {
  const completions = []

  if (!europaConfig || !europaConfig.theme || !europaConfig.theme.colors) {
    return completions
  }

  let colorConfig = europaConfig.theme.colors

  // If colors is a function, it needs to be executed (in EuropaCSS it can be a function)
  if (typeof colorConfig === 'function') {
    try {
      colorConfig = colorConfig()
    } catch (e) {
      console.error('Error executing color config function:', e)
    }
  }

  let sortOrder = 0

  // Use Object.entries to preserve order
  Object.entries(colorConfig).forEach(([colorName, colorValue]) => {
    // Skip nested color objects for now - they'll be handled recursively
    if (typeof colorValue === 'object' && colorValue !== null) {
      return
    }

    // Convert named colors to hex for better VS Code color swatch support
    const hexColorValue = getHexColor(colorValue)

    completions.push({
      label: colorName,
      kind: CompletionItemKind.Color,
      detail: `Color: ${colorValue}`,
      // Use the hex color for the swatch, but keep the original in detail
      documentation: hexColorValue,
      data: {
        color: hexColorValue,
        type: 'color',
        colorValue: hexColorValue,
        originalColor: colorValue,
      },
      sortText: String(sortOrder++).padStart(5, '0'),
    })
  })

  // Now handle nested color objects if any
  Object.entries(colorConfig).forEach(([colorGroup, colorObj]) => {
    if (typeof colorObj !== 'object' || colorObj === null) {
      return
    }

    // Process nested colors
    Object.entries(colorObj).forEach(([nestedName, colorValue]) => {
      if (typeof colorValue === 'string') {
        // Convert named colors to hex for better VS Code color swatch support
        const hexColorValue = getHexColor(colorValue)

        completions.push({
          label: `${colorGroup}.${nestedName}`,
          kind: CompletionItemKind.Color,
          detail: `Color: ${colorValue}`,
          // Use the hex color for the swatch, but keep the original in detail
          documentation: hexColorValue,
          data: {
            color: hexColorValue,
            type: 'color',
            colorValue: hexColorValue,
            originalColor: colorValue,
          },
          sortText: String(sortOrder++).padStart(5, '0'),
        })
      }
    })
  })

  return completions
}

/**
 * Provides breakpoint completions
 * @param {Object} europaConfig - The Europa configuration
 * @returns {Array} - Array of completion items for breakpoints
 */
function getBreakpointCompletions(europaConfig) {
  const completions = []

  if (!europaConfig || !europaConfig.theme) {
    return completions
  }

  let sortOrder = 0

  // Breakpoint collections first
  if (europaConfig.theme.breakpointCollections) {
    // Preserve order from config by using Object.entries and adding a sortText
    Object.entries(europaConfig.theme.breakpointCollections).forEach(
      ([collectionName, collectionValue]) => {
        completions.push({
          label: collectionName,
          kind: CompletionItemKind.Value,
          detail: `${collectionValue}`,
          documentation: `Includes: ${collectionValue}`,
          sortText: String(sortOrder++).padStart(5, '0'), // e.g. "00000", "00001", etc.
        })
      }
    )
  }

  // Regular breakpoints
  if (europaConfig.theme.breakpoints) {
    // Preserve order from config by using Object.entries and adding a sortText
    Object.entries(europaConfig.theme.breakpoints).forEach(([bpName, bpValue]) => {
      completions.push({
        label: bpName,
        kind: CompletionItemKind.Value,
        detail: `Breakpoint: ${bpValue}`,
        sortText: String(sortOrder++).padStart(5, '0'),
      })
    })
  }

  // Add breakpoint operators at the end
  completions.push(
    {
      label: '>=',
      kind: CompletionItemKind.Operator,
      detail: 'Greater than or equal to breakpoint',
      sortText: String(sortOrder++).padStart(5, '0'),
    },
    {
      label: '<=',
      kind: CompletionItemKind.Operator,
      detail: 'Less than or equal to breakpoint',
      sortText: String(sortOrder++).padStart(5, '0'),
    },
    {
      label: '>',
      kind: CompletionItemKind.Operator,
      detail: 'Greater than breakpoint',
      sortText: String(sortOrder++).padStart(5, '0'),
    },
    {
      label: '<',
      kind: CompletionItemKind.Operator,
      detail: 'Less than breakpoint',
      sortText: String(sortOrder++).padStart(5, '0'),
    }
  )

  return completions
}

/**
 * Provides font family completions
 * @param {Object} europaConfig - The Europa configuration
 * @returns {Array} - Array of completion items for font families
 */
function getFontFamilyCompletions(europaConfig) {
  const completions = []

  if (
    !europaConfig ||
    !europaConfig.theme ||
    !europaConfig.theme.typography ||
    !europaConfig.theme.typography.families
  ) {
    return completions
  }

  let sortOrder = 0

  // Use Object.entries to preserve order
  Object.entries(europaConfig.theme.typography.families).forEach(([fontFamily, fontValue]) => {
    // Format the font value for display
    let fontString
    let detailString
    let docString

    if (Array.isArray(fontValue)) {
      // For array of font names, format them properly
      fontString = fontValue.join(', ')
      detailString = `Font family: ${fontString}`

      // Create a rich markdown documentation display with formatted examples
      docString = `### ${fontFamily}\n\n`
      docString += '```css\nfont-family: ' + fontString + ';\n```\n\n'
      docString += '#### Preview:\n'
      docString += fontValue
        .map(font => {
          // Properly escape font names with spaces for CSS
          const formattedFont =
            font.includes(' ') && !font.includes('"') && !font.includes("'") ? `"${font}"` : font
          return `<span style="font-family: ${formattedFont};">The quick brown fox jumps over the lazy dog.</span>`
        })
        .join('\n\n')
    } else {
      // For single font name
      fontString = String(fontValue)
      detailString = `Font family: ${fontString}`

      // Create a rich markdown documentation display
      docString = `### ${fontFamily}\n\n`
      docString += '```css\nfont-family: ' + fontString + ';\n```\n\n'
      docString += '#### Preview:\n'
      docString += `<span style="font-family: ${fontString};">The quick brown fox jumps over the lazy dog.</span>`
    }

    completions.push({
      label: fontFamily,
      kind: CompletionItemKind.Value,
      detail: detailString,
      documentation: {
        kind: 'markdown',
        value: docString,
      },
      sortText: String(sortOrder++).padStart(5, '0'),
    })
  })

  return completions
}

/**
 * Provides font size completions
 * @param {Object} europaConfig - The Europa configuration
 * @returns {Array} - Array of completion items for font sizes
 */
function getFontSizeCompletions(europaConfig) {
  const completions = []

  if (
    !europaConfig ||
    !europaConfig.theme ||
    !europaConfig.theme.typography ||
    !europaConfig.theme.typography.sizes
  ) {
    return completions
  }

  let sortOrder = 0

  // Use Object.entries to preserve order
  Object.entries(europaConfig.theme.typography.sizes).forEach(([fontSize, fontSizeValue]) => {
    // Format the font size value for display
    let detailText = 'Font size'
    let docString = `### Font Size: ${fontSize}\n\n`

    if (typeof fontSizeValue === 'object' && fontSizeValue !== null) {
      // For responsive font sizes (object with breakpoints)
      const responsiveValues = []

      // Collect breakpoint values
      Object.entries(fontSizeValue).forEach(([breakpoint, value]) => {
        responsiveValues.push(`${breakpoint}: ${value}`)
      })

      // Create detail text with summary of responsive sizes
      detailText = `Responsive font size: ${responsiveValues.join(', ')}`

      // Create documentation with detailed breakpoint table
      docString += 'Responsive font sizes across breakpoints:\n\n'
      docString += '| Breakpoint | Size |\n| --- | --- |\n'

      Object.entries(fontSizeValue).forEach(([breakpoint, value]) => {
        docString += `| ${breakpoint} | ${value} |\n`
      })

      docString += '\n\n#### Preview:\n'
      docString += `<span style="font-size: ${Object.values(fontSizeValue)[0]}">Example text at ${
        Object.values(fontSizeValue)[0]
      }</span>`
    } else {
      // For single font size value
      detailText = `Font size: ${fontSizeValue}`
      docString += '```css\nfont-size: ' + fontSizeValue + ';\n```\n\n'
      docString += '#### Preview:\n'
      docString += `<span style="font-size: ${fontSizeValue}">Example text at ${fontSizeValue}</span>`
    }

    completions.push({
      label: fontSize,
      kind: CompletionItemKind.Value,
      detail: detailText,
      documentation: {
        kind: 'markdown',
        value: docString,
      },
      sortText: String(sortOrder++).padStart(5, '0'),
    })
  })

  return completions
}

/**
 * Provides spacing completions
 * @param {Object} europaConfig - The Europa configuration
 * @returns {Array} - Array of completion items for spacing values
 */
function getSpacingCompletions(europaConfig) {
  const completions = []

  if (!europaConfig || !europaConfig.theme || !europaConfig.theme.spacing) {
    console.log('No spacing configuration found')
    return completions
  }

  let sortOrder = 0
  let spacingConfig = europaConfig.theme.spacing

  // Debug: Log the full spacing configuration
  console.log('SPACING CONFIG KEYS:', Object.keys(spacingConfig))

  // Simple implementation: just add all keys as completions
  // This ensures we don't miss any keys regardless of value type
  Object.keys(spacingConfig).forEach(spaceName => {
    // Get the value (if available) for the detail
    const spaceValue = spacingConfig[spaceName]
    const valueStr = typeof spaceValue === 'object' ? '[Object]' : String(spaceValue || '')

    console.log(`Adding spacing completion for ${spaceName}: ${valueStr}`)

    completions.push({
      label: spaceName,
      kind: CompletionItemKind.Value,
      detail: `Spacing: ${valueStr}`,
      sortText: String(sortOrder++).padStart(5, '0'),
    })
  })

  console.log(
    `Generated ${completions.length} spacing completions:`,
    completions.map(c => c.label).join(', ')
  )
  return completions
}

module.exports = {
  createCompletionItem,
  getAtRuleCompletions,
  getColorCompletions,
  getBreakpointCompletions,
  getFontFamilyCompletions,
  getFontSizeCompletions,
  getSpacingCompletions,
}
