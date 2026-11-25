import { describe, it, expect } from 'vitest'
import {
  ARGENTINA_TIMEZONE,
  getTodayArIso,
  toArIsoDate,
  formatDateAr,
  formatDayMonthAr,
  formatTimeAr,
  formatDateTimeAr,
  formatLongSpanishDateAr,
  buildArTimestampIso,
  compareIsoDatesDesc,
  compareIsoDatesAsc
} from '../../src/lib/dateTimeCanonical.js'
import {
  getLocalDateKey,
  formatLocalTimeHHMM,
  buildTransactionTimestampIso
} from '../../src/lib/panolBasketsEngine.js'
import { formatDate } from '../../src/lib/tercerosConstants.js'
import { formatShortDate } from '../../src/lib/workOrdersConstants.js'
import { formatLongSpanishDate } from '../../src/lib/aloncarLogoSvg.js'

describe('Motor Canónico de Fecha y Hora Argentina (FL-024)', () => {
  it('mantiene zona horaria fija America/Argentina/Buenos_Aires', () => {
    expect(ARGENTINA_TIMEZONE).toBe('America/Argentina/Buenos_Aires')
  })

  it('NO salta al día siguiente entre las 21:00 y 23:59 hora Argentina (cuando UTC ya es mañana)', () => {
    // 23/11/2026 21:30 ART === 24/11/2026 00:30 UTC
    const lateNightAr = new Date('2026-11-24T00:30:00.000Z')
    expect(getTodayArIso(lateNightAr)).toBe('2026-11-23')
    expect(formatDateAr(lateNightAr)).toBe('23/11/2026')
    expect(formatTimeAr(lateNightAr)).toBe('21:30')
    expect(formatDateTimeAr(lateNightAr)).toBe('23/11/2026 21:30')

    // 23/11/2026 23:59:59 ART === 24/11/2026 02:59:59 UTC
    const almostMidnightAr = new Date('2026-11-24T02:59:59.000Z')
    expect(getTodayArIso(almostMidnightAr)).toBe('2026-11-23')
    expect(formatTimeAr(almostMidnightAr, { includeSeconds: true })).toBe('23:59:59')

    // 24/11/2026 00:00:00 ART === 24/11/2026 03:00:00 UTC (medianoche debe ser 00:00, nunca 24:00)
    const exactMidnightAr = new Date('2026-11-24T03:00:00.000Z')
    expect(getTodayArIso(exactMidnightAr)).toBe('2026-11-24')
    expect(formatTimeAr(exactMidnightAr)).toBe('00:00')
    expect(formatDateTimeAr(exactMidnightAr)).toBe('24/11/2026 00:00')
  })

  it('preserva fechas calendario puras YYYY-MM-DD sin correr un día hacia atrás', () => {
    expect(toArIsoDate('2026-11-23')).toBe('2026-11-23')
    expect(formatDateAr('2026-11-23')).toBe('23/11/2026')
    expect(formatDateAr('2026-11-23', { shortYear: true })).toBe('23/11/26')
    expect(formatDayMonthAr('2026-11-23')).toBe('23/11')
    expect(formatTimeAr('2026-11-23')).toBe('')
    expect(formatLongSpanishDateAr('2026-11-23')).toBe('23 de Noviembre de 2026')
  })

  it('interpreta correctamente timestamps Postgres con espacio y +00', () => {
    expect(toArIsoDate('2026-11-23 17:08:30.299+00')).toBe('2026-11-23')
    expect(formatDateAr('2026-11-23 17:08:30.299+00')).toBe('23/11/2026')
    expect(formatTimeAr('2026-11-23 17:08:30.299+00')).toBe('14:08')

    // Retiro cargado 22:15 ART del 23/11 guardado en Postgres como 01:15+00 del 24/11
    expect(toArIsoDate('2026-11-24 01:15:00+00')).toBe('2026-11-23')
    expect(formatDateAr('2026-11-24 01:15:00+00')).toBe('23/11/2026')
    expect(formatTimeAr('2026-11-24 01:15:00+00')).toBe('22:15')
  })

  it('construye timestamps ISO anclados a Argentina (-03:00) independientes del huso del dispositivo', () => {
    const iso = buildArTimestampIso('2026-11-23', '22:30')
    expect(iso).toBe('2026-11-24T01:30:00.000Z')
    expect(toArIsoDate(iso)).toBe('2026-11-23')
    expect(formatDateAr(iso)).toBe('23/11/2026')
    expect(formatTimeAr(iso)).toBe('22:30')

    // Fecha pasada sin hora explícita se fija a mediodía ART (15:00 UTC)
    const pastNoon = buildArTimestampIso('2026-10-15', null, new Date('2026-11-24T15:00:00.000Z'))
    expect(pastNoon).toBe('2026-10-15T15:00:00.000Z')
    expect(formatDateAr(pastNoon)).toBe('15/10/2026')
    expect(formatTimeAr(pastNoon)).toBe('12:00')
  })

  it('ordena fechas cronológicamente (no alfabéticamente por día)', () => {
    const fechas = ['2026-11-29', '2026-12-02', '2026-11-05', '2026-10-31']
    expect([...fechas].sort(compareIsoDatesDesc)).toEqual([
      '2026-12-02',
      '2026-11-29',
      '2026-11-05',
      '2026-10-31'
    ])
    expect([...fechas].sort(compareIsoDatesAsc)).toEqual([
      '2026-10-31',
      '2026-11-05',
      '2026-11-29',
      '2026-12-02'
    ])
  })

  it('mantiene compatibilidad 100% en los helpers delegados de Pañol, Terceros, OTs y Membrete', () => {
    expect(getLocalDateKey('2026-11-24T01:30:00.000Z')).toBe('2026-11-23')
    expect(formatLocalTimeHHMM('2026-11-24T01:30:00.000Z')).toBe('22:30')
    expect(buildTransactionTimestampIso('2026-11-23', '08:15')).toBe('2026-11-23T11:15:00.000Z')
    expect(formatDate('2026-11-23')).toBe('23/11/2026')
    expect(formatDate('')).toBe('-')
    expect(formatShortDate('2026-11-23', true)).toBe('23/11/2026')
    expect(formatShortDate('2026-11-23', false)).toBe('23/11/26')
    expect(formatLongSpanishDate('2026-11-23')).toBe('23 de Noviembre de 2026')
  })
})
