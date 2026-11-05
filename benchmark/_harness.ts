import { test } from 'vitest'

interface BenchOptions {
  time?: number
  warmupTime?: number
  warmupIterations?: number
  iterations?: number
  heavy?: boolean
}

// tinybench times each call individually, so bodies must do tens of
// microseconds of work or they measure `performance.now()` instead.
const DEFAULT_OPTIONS: BenchOptions = {
  time: 1000,
  warmupTime: 300,
  warmupIterations: 20,
}

const HEAVY_OPTIONS: BenchOptions = {
  time: 2000,
  warmupTime: 500,
  warmupIterations: 5,
}

export function bench(name: string, fn: () => void, options?: BenchOptions): void {
  const { heavy, ...rest } = options ?? {}
  test(name, async ({ bench }) => {
    await bench(name, fn).run({ ...(heavy ? HEAVY_OPTIONS : DEFAULT_OPTIONS), ...rest })
  })
}

const sinkBox = { value: 0 }

export function sink(value: unknown): void {
  if (typeof value === 'string') {
    sinkBox.value += value.length
  }
  else if (typeof value === 'number') {
    sinkBox.value += value
  }
  else if (value) {
    sinkBox.value += 1
  }
}
