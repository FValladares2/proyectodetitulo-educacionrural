const stripInlineMarkdown = (text) =>
  text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim()

const slugify = (text) => {
  const slug = stripInlineMarkdown(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'seccion'
}

const createUniqueId = (label, usedIds) => {
  const baseId = slugify(label)
  const count = usedIds.get(baseId) || 0
  const id = count === 0 ? baseId : `${baseId}-${count + 1}`

  usedIds.set(baseId, count + 1)
  return id
}

const extractHeadings = (markdown = '') => {
  const headings = []
  const usedIds = new Map()
  let insideCodeFence = false

  markdown.split(/\r?\n/).forEach((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      insideCodeFence = !insideCodeFence
      return
    }

    if (insideCodeFence) return

    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!match) return

    const label = stripInlineMarkdown(match[2])
    if (!label) return

    headings.push({
      id: createUniqueId(label, usedIds),
      label,
      level: match[1].length,
    })
  })

  return headings
}

const createHeadingIdFactory = () => {
  const usedIds = new Map()

  return (children) => {
    const getTextContent = (value) => {
      if (Array.isArray(value)) return value.map(getTextContent).join('')
      if (value && typeof value === 'object') return getTextContent(value.props?.children)
      return String(value ?? '')
    }

    const label = getTextContent(children)
    return createUniqueId(label, usedIds)
  }
}

export { createHeadingIdFactory, extractHeadings }
