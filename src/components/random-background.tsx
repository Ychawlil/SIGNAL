'use client'

import { useEffect, useState } from 'react'

type BgItem = { id: number; part: number; ext: string }

const DARK_THRESHOLD = 135

async function getAverageBrightness(url: string): Promise<number> {
  const img = new Image()
  img.src = url
  await img.decode()

  const canvas = document.createElement('canvas')
  const size = 64
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 128

  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return sum / (data.length / 4)
}

export function RandomBackground() {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/backgrounds.json')
      .then((r) => (r.ok ? r.json() : []))
      .then(async (list: BgItem[]) => {
        if (cancelled || !Array.isArray(list) || list.length === 0) return

        const img = list[Math.floor(Math.random() * list.length)]
        const url = `/image/original/${img.id}_p${img.part}.${img.ext}`

        try {
          const brightness = await getAverageBrightness(url)
          if (cancelled) return

          const shouldBeDark = brightness < DARK_THRESHOLD
          document.documentElement.classList.toggle('dark', shouldBeDark)

          setSrc(url)
        } catch {
          if (!cancelled) setSrc(null)
        }
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!src) return null

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${src}")` }}
      />
      <div className="absolute inset-0 bg-background/15" />
    </div>
  )
}