import { describe, expect, it } from 'vitest'

import { isJS, parseResource } from '../src/utils'

describe('parseResource extension extraction', () => {
  it('extracts a plain file extension', () => {
    expect(parseResource('foo.js')).toMatchObject({ resourceType: 'script', module: true })
  })

  it('extracts the extension when a query string is present', () => {
    const a = parseResource('foo.js')
    const b = parseResource('foo.js?v=123')
    expect(b).toEqual(a)
    expect(b.resourceType).toBe('script')
  })

  it('agrees with isJS on query-stringed JS paths', () => {
    expect(isJS('foo.js?v=123')).toBe(true)
    expect(parseResource('foo.js?v=123').resourceType).toBe('script')
  })

  it('returns no resourceType for an extensionless path', () => {
    expect(parseResource('foo').resourceType).toBeUndefined()
  })

  it('does not treat a dotted directory as an extension', () => {
    expect(parseResource('foo.bar/baz').resourceType).toBeUndefined()
  })

  it('extracts the leaf extension when a dotted directory precedes it', () => {
    expect(parseResource('foo.bar/baz.js').resourceType).toBe('script')
  })

  it('treats a trailing dot as no extension', () => {
    expect(parseResource('foo.').resourceType).toBeUndefined()
  })

  it('treats an empty query value as no-op', () => {
    expect(parseResource('foo.css?').resourceType).toBe('style')
  })

  it('handles mjs and cjs distinction', () => {
    expect(parseResource('foo.mjs')).toMatchObject({ resourceType: 'script', module: true })
    expect(parseResource('foo.cjs').module).toBeUndefined()
    expect(parseResource('foo.cjs').resourceType).toBe('script')
  })

  it('sets preload for module/script/style only', () => {
    expect(parseResource('foo.js').preload).toBe(true)
    expect(parseResource('foo.css').preload).toBe(true)
    expect(parseResource('foo.png').preload).toBeUndefined()
    expect(parseResource('foo.woff2').preload).toBeUndefined()
  })

  it('omits prefetch for fonts', () => {
    expect(parseResource('foo.woff2').prefetch).toBeUndefined()
    expect(parseResource('foo.js').prefetch).toBe(true)
  })
})
