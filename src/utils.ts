// Utilities to render script and link tags, and link headers
export const renderScriptToString = (attrs: Record<string, string | null>) =>
  `<script${Object.entries(attrs).map(([key, value]) => value === null ? '' : value ? ` ${key}="${value}"` : ' ' + key).join('')}></script>`

export type LinkAttributes = {
  rel: string | null
  href: string
  as?: string | null
  type?: string | null
  crossorigin?: '' | null
}

export const renderLinkToString = (attrs: LinkAttributes) =>
  `<link${Object.entries(attrs).map(([key, value]) => value === null ? '' : value ? ` ${key}="${value}"` : ' ' + key).join('')}>`

export const renderLinkToHeader = (attrs: LinkAttributes) =>
  `<${attrs.href}>${Object.entries(attrs).map(([key, value]) => key === 'href' || value === null ? '' : value ? `; ${key}="${value}"` : `; ${key}`).join('')}`
