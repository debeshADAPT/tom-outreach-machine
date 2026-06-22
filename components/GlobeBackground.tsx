'use client'

import { useEffect, useRef } from 'react'

const RADIUS = 620
const DOT_RADIUS = 1.6
const FILL_DOT_RADIUS = 0.9
const DOT_COLOR = '#484848'
const FILL_DOT_COLOR = '#282828'
const SPIN_SPEED = 0.0014

// Latitude lines (parallels) — evenly spaced, skip poles
const PARALLELS = [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75]
// Dots per full equator ring; polar rings get fewer (proportional to cos(lat))
const EQUATOR_DOTS = 90

// Longitude lines (meridians)
const MERIDIAN_COUNT = 18          // evenly spaced every 20°
const MERIDIAN_DOTS = 55           // dots per meridian arc (pole to pole)

export default function GlobeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Build grid dots — each has a fixed lat and a base lon (rotated at draw time)
    const dots: { lat: number; lon: number; fill: boolean }[] = []

    // Parallels
    for (const latDeg of PARALLELS) {
      const lat = (latDeg * Math.PI) / 180
      const count = Math.max(6, Math.round(EQUATOR_DOTS * Math.cos(lat)))
      for (let i = 0; i < count; i++) {
        dots.push({ lat, lon: (2 * Math.PI * i) / count, fill: false })
      }
    }

    // Meridians — skip latitudes within 1° of a parallel to prevent dot overlap at intersections
    const parallelRads = PARALLELS.map(d => d * (Math.PI / 180))
    const OVERLAP_THRESHOLD = (1 * Math.PI) / 180
    for (let m = 0; m < MERIDIAN_COUNT; m++) {
      const baseLon = (2 * Math.PI * m) / MERIDIAN_COUNT
      for (let i = 0; i < MERIDIAN_DOTS; i++) {
        const lat = ((i / (MERIDIAN_DOTS - 1)) * 160 - 80) * (Math.PI / 180)
        const nearParallel = parallelRads.some(p => Math.abs(lat - p) < OVERLAP_THRESHOLD)
        if (!nearParallel) dots.push({ lat, lon: baseLon, fill: false })
      }
    }

    // Fill dots — one per grid cell, centred between adjacent parallels and meridians
    const midParallels: number[] = []
    for (let i = 0; i < PARALLELS.length - 1; i++) {
      midParallels.push(((PARALLELS[i] + PARALLELS[i + 1]) / 2) * (Math.PI / 180))
    }
    const meridianStep = (2 * Math.PI) / MERIDIAN_COUNT
    for (const lat of midParallels) {
      for (let m = 0; m < MERIDIAN_COUNT; m++) {
        dots.push({ lat, lon: meridianStep * m + meridianStep / 2, fill: true })
      }
    }

    let spinAngle = 0
    let rafId: number

    function draw() {
      if (!canvas || !ctx) return
      const cx = canvas.width / 2
      const cy = canvas.height / 2

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      spinAngle += SPIN_SPEED

      for (const { lat, lon, fill } of dots) {
        const rotatedLon = lon + spinAngle
        const x = Math.cos(lat) * Math.sin(rotatedLon)
        const y = Math.sin(lat)
        const z = Math.cos(lat) * Math.cos(rotatedLon)

        if (z < 0) continue

        const opacity = fill
          ? (0.06 + 0.22 * z)   // fill dots: much darker
          : (0.12 + 0.55 * z)   // grid dots: normal depth shading
        ctx.beginPath()
        ctx.arc(cx + x * RADIUS, cy - y * RADIUS, fill ? FILL_DOT_RADIUS : DOT_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = fill ? FILL_DOT_COLOR : DOT_COLOR
        ctx.globalAlpha = opacity
        ctx.fill()
      }

      ctx.globalAlpha = 1
      rafId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
