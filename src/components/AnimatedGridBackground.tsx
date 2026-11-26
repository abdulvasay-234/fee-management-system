import { useEffect, useRef } from 'react'

interface LightPulse {
  x: number
  y: number
  direction: 'up' | 'down' | 'left' | 'right'
  speed: number
  trail: Array<{ x: number; y: number }>
  color: string
  segmentsTraveled: number
  maxSegments: number
  turnChance: number
}

export function AnimatedGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const pulsesRef = useRef<LightPulse[]>([])
  const gridSizeRef = useRef<number>(50)
  const shouldReduceMotionRef = useRef<boolean>(false)

  useEffect(() => {
    // Check for prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    shouldReduceMotionRef.current = mediaQuery.matches

    const handleMotionPreference = (e: MediaQueryListEvent) => {
      shouldReduceMotionRef.current = e.matches
    }

    mediaQuery.addEventListener('change', handleMotionPreference)

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const setCanvasSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      // Responsive grid size
      if (window.innerWidth < 768) {
        gridSizeRef.current = 40
      } else {
        gridSizeRef.current = 50
      }
    }

    setCanvasSize()
    window.addEventListener('resize', setCanvasSize)

    // Draw grid
    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.08)'
      ctx.lineWidth = 1

      // Vertical lines
      for (let x = 0; x < canvas.width; x += gridSizeRef.current) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      // Horizontal lines
      for (let y = 0; y < canvas.height; y += gridSizeRef.current) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }
    }

    // Create new light pulse - SHORT, snake-like
    const createPulse = (): LightPulse => {
      const directions: Array<'up' | 'down' | 'left' | 'right'> = [
        'up',
        'down',
        'left',
        'right',
      ]
      const colors = [
        'rgba(20, 184, 196, 0.5)', // Cyan
        'rgba(255, 255, 255, 0.4)', // White
        'rgba(244, 91, 53, 0.25)', // Orange (rare)
      ]

      const startX =
        Math.floor(Math.random() * (canvas.width / gridSizeRef.current)) *
        gridSizeRef.current
      const startY =
        Math.floor(Math.random() * (canvas.height / gridSizeRef.current)) *
        gridSizeRef.current

      // Randomly choose color (orange is very rare)
      let color: string
      const colorRoll = Math.random()
      if (colorRoll < 0.7) {
        color = colors[0] // Cyan - 70%
      } else if (colorRoll < 0.95) {
        color = colors[1] // White - 25%
      } else {
        color = colors[2] // Orange - 5%
      }

      return {
        x: startX,
        y: startY,
        direction: directions[Math.floor(Math.random() * directions.length)],
        speed: 30 + Math.random() * 50, // pixels per second
        trail: [],
        color,
        segmentsTraveled: 0,
        maxSegments: 3 + Math.floor(Math.random() * 4), // 3-6 segments
        turnChance: 0.15, // 15% chance to turn at intersections
      }
    }

    // Update pulses
    const updatePulses = (deltaTime: number) => {
      pulsesRef.current = pulsesRef.current.filter((pulse) => {
        // Move pulse
        const moveDistance = (pulse.speed * deltaTime) / 1000
        const totalDistance = pulse.segmentsTraveled + moveDistance

        // Check how many grid segments have been covered
        const segmentsCovered = Math.floor(
          totalDistance / gridSizeRef.current
        )

        // Check if pulse should end
        if (segmentsCovered >= pulse.maxSegments) {
          return false
        }

        // Update position based on direction
        switch (pulse.direction) {
          case 'up':
            pulse.y -= moveDistance
            break
          case 'down':
            pulse.y += moveDistance
            break
          case 'left':
            pulse.x -= moveDistance
            break
          case 'right':
            pulse.x += moveDistance
            break
        }

        pulse.segmentsTraveled += moveDistance

        // Snap to grid
        pulse.x = Math.round(pulse.x / gridSizeRef.current) * gridSizeRef.current
        pulse.y = Math.round(pulse.y / gridSizeRef.current) * gridSizeRef.current

        // Keep in bounds with margin
        pulse.x = Math.max(0, Math.min(pulse.x, canvas.width - gridSizeRef.current))
        pulse.y = Math.max(0, Math.min(pulse.y, canvas.height - gridSizeRef.current))

        // Add to trail only if position changed
        if (
          pulse.trail.length === 0 ||
          pulse.trail[0].x !== pulse.x ||
          pulse.trail[0].y !== pulse.y
        ) {
          pulse.trail.unshift({
            x: pulse.x,
            y: pulse.y,
          })

          // Keep trail to 3-6 segments max
          pulse.trail = pulse.trail.slice(0, 6)
        }

        // Occasionally turn at intersections
        if (Math.random() < pulse.turnChance) {
          const directions: Array<'up' | 'down' | 'left' | 'right'> = [
            'up',
            'down',
            'left',
            'right',
          ]
          pulse.direction =
            directions[Math.floor(Math.random() * directions.length)]
        }

        return true
      })
    }

    // Draw pulses
    const drawPulses = () => {
      pulsesRef.current.forEach((pulse) => {
        // Draw trail with fade
        pulse.trail.forEach((point, index) => {
          const opacity = 1 - (index / pulse.trail.length) * 0.7
          
          // Extract color without opacity and apply new opacity
          const colorMatch = pulse.color.match(/rgba\(([^)]+)\)/)
          if (colorMatch) {
            const colorValues = colorMatch[1]
            ctx.fillStyle = `rgba(${colorValues.split(',').slice(0, 3).join(',')}, ${opacity * 0.3})`
            ctx.beginPath()
            ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2)
            ctx.fill()
          }
        })

        // Draw pulse head with minimal glow
        ctx.shadowColor = pulse.color.replace(/[\d.]+\)/, '0.4)')
        ctx.shadowBlur = 6 // Reduced from 15
        ctx.fillStyle = pulse.color
        ctx.beginPath()
        ctx.arc(pulse.x, pulse.y, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      })
    }

    // Animation loop
    let lastTime = Date.now()
    let spawnCooldown = 0
    const animate = () => {
      const currentTime = Date.now()
      const deltaTime = Math.min(currentTime - lastTime, 50) // Cap deltaTime
      lastTime = currentTime
      spawnCooldown -= deltaTime

      // Clear canvas with background color
      ctx.fillStyle = '#fafbfc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw grid
      drawGrid()

      if (!shouldReduceMotionRef.current) {
        // Update and draw pulses
        updatePulses(deltaTime)

        // Spawn new pulses occasionally (keep only 2-3)
        if (
          pulsesRef.current.length < 3 &&
          spawnCooldown <= 0 &&
          deltaTime < 50
        ) {
          pulsesRef.current.push(createPulse())
          spawnCooldown = 800 + Math.random() * 400 // 800-1200ms between spawns
        }

        drawPulses()
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    // Start animation
    animationRef.current = requestAnimationFrame(animate)

    // Initialize with 2 pulses
    for (let i = 0; i < 2; i++) {
      pulsesRef.current.push(createPulse())
    }

    return () => {
      window.removeEventListener('resize', setCanvasSize)
      mediaQuery.removeEventListener('change', handleMotionPreference)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="animated-grid-background"
      aria-hidden="true"
    />
  )
}

