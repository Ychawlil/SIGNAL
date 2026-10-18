'use client'

import { useEffect, useState } from 'react'

type BgItem = { id: number; part: number; ext: string }

export function RandomBackground() {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/backgrounds.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: BgItem[]) => {
        if (cancelled || !Array.isArray(list) || list.length === 0) return
        const img = list[Math.floor(Math.random() * list.length)]
        const url = `/image/original/${img.id}_p${img.part}.${img.ext}`

        const preload = new Image()
        preload.onload = () => {
          if (!cancelled) setSrc(url)
        }
        preload.onerror = () => {
          if (!cancelled) setSrc(null)
        }
        preload.src = url
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
      <div className="absolute inset-0 bg-background/65" />
    </div>
  )
}