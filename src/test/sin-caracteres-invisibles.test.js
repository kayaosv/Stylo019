// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Zero-width characters, bidirectional overrides and control characters hidden
// in source code are unreviewable and make GitHub flag the file. Tests that need
// them must write them as escape sequences, never as the raw character.
const RANGOS = [
  [0x0000, 0x0008],
  [0x000b, 0x001f],
  [0x007f, 0x009f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x2069],
  [0xfeff, 0xfeff],
]
const esInvisible = (codigo) => RANGOS.some(([desde, hasta]) => codigo >= desde && codigo <= hasta)

const RAIZ = join(import.meta.dirname, '..', '..')
const CARPETAS = ['src', 'supabase', 'specs']
const EXTENSIONES = /\.(jsx?|tsx?|css|html|sql|md|json)$/

const archivos = (dir) =>
  readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta)
    return EXTENSIONES.test(nombre) ? [ruta] : []
  })

describe('código fuente sin caracteres invisibles', () => {
  it('ningún archivo contiene caracteres invisibles, bidireccionales o de control literales', () => {
    const afectados = CARPETAS.flatMap((carpeta) => archivos(join(RAIZ, carpeta)))
      .flatMap((ruta) =>
        readFileSync(ruta, 'utf8')
          .split('\n')
          .flatMap((linea, i) => ([...linea].some((c) => esInvisible(c.codePointAt(0))) ? [`${ruta.slice(RAIZ.length + 1)}:${i + 1}`] : [])),
      )

    expect(afectados).toEqual([])
  })
})
