// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { WHATSAPP_NUMBER, WHATSAPP_DISPLAY, DIRECCION } from '@/lib/tienda'

const SRC = join(import.meta.dirname, '..')
const WRONG_NUMBER = /658[\s.-]?509[\s.-]?332/

const sourceFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(jsx?|css|html)$/.test(name) ? [path] : []
  })

describe('datos de contacto de la tienda', () => {
  it('el WhatsApp correcto es 34638970807 y se muestra como 638 970 807', () => {
    expect(WHATSAPP_NUMBER).toBe('34638970807')
    expect(WHATSAPP_DISPLAY).toBe('638 970 807')
  })

  it('la dirección es la confirmada (Calle Ciudad de Carlet)', () => {
    expect(DIRECCION).toBe('Calle Ciudad de Carlet, 10, Local 2 — Parque Alcosa, 41019 Sevilla')
  })

  it('el número erróneo 658 509 332 no aparece en ningún archivo de src/', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !file.endsWith('tienda.test.js'))
      .filter((file) => WRONG_NUMBER.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(SRC.length + 1))

    expect(offenders).toEqual([])
  })
})
