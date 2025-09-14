'use client'

import { useState, useEffect, ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

// A simple component to display the instruction content
interface InstructionDisplayProps {
  loading: boolean
  step: InstructionStep | undefined
}

function InstructionDisplay({ loading, step }: InstructionDisplayProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3 p-4">
        <div className="h-6 w-2/3 rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
        <div className="h-4 w-4/6 rounded bg-muted" />
        <div className="h-4 w-3/6 rounded bg-muted" />
      </div>
    )
  }

  if (!step) {
    return null
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold leading-relaxed">{step.title}</h1>
      {step.bullets.length > 0 && (
        <ul className="mb-4 list-disc space-y-2 pl-5">
          {step.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {step.image && (
        <img src={step.image} alt={step.title} className="mt-2 max-w-full rounded" />
      )}
    </div>
  )
}

interface InstructionStep {
  title: string
  bullets: string[]
  image?: string
}

interface UsageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function UsageDialog({ open, onOpenChange }: UsageDialogProps) {
  const [activeTab, setActiveTab] = useState('schedule')
  const [steps, setSteps] = useState<InstructionStep[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fileMap: { [key: string]: string } = {
      schedule: '/instructions/schedule.json',
      courses: '/instructions/courses.json',
      rooms: '/instructions/rooms.json',
    }
    const file = fileMap[activeTab]

    if (!file) return

    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(file)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = (await res.json()) as InstructionStep[]
        const sanitized = Array.isArray(data)
          ? data.filter(
              (s): s is InstructionStep =>
                !!s && typeof s.title === 'string' && Array.isArray(s.bullets)
            )
          : []
        setSteps(
          sanitized.length > 0
            ? sanitized
            : [{ title: '目前沒有可顯示的說明', bullets: [] }]
        )
        setIndex(0)
      } catch {
        setSteps([{ title: '載入說明失敗', bullets: [] }])
        setIndex(0)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [activeTab])

  const prev = () => setIndex(i => Math.max(i - 1, 0))
  const next = () => setIndex(i => Math.min(i + 1, steps.length - 1))

  const step = steps[index]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>使用說明</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-scroll pr-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
              <TabsTrigger value="schedule">週課表說明</TabsTrigger>
              <TabsTrigger value="courses">課程庫說明</TabsTrigger>
              <TabsTrigger value="rooms">教室庫說明</TabsTrigger>
            </TabsList>
            <InstructionDisplay loading={loading} step={step} />
          </Tabs>
        </div>

        <DialogFooter>
          {steps.length > 1 && !loading && (
            <div className="flex w-full items-center justify-between">
              <Button variant="outline" disabled={index === 0} onClick={prev}>
                上一步
              </Button>
              <div className="text-sm text-muted-foreground">
                {index + 1} / {steps.length}
              </div>
              <Button variant="outline" disabled={index === steps.length - 1} onClick={next}>
                下一步
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}