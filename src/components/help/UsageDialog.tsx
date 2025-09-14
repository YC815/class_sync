'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
interface InstructionStep {
  title: string
  bullets: string[]
  image?: string
}

interface InstructionStepperProps {
  file: string
}

function InstructionStepper({ file }: InstructionStepperProps) {
  const [steps, setSteps] = useState<InstructionStep[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(file)
        const data = await res.json()
        setSteps(data)
        setIndex(0)
      } catch {
        setSteps([{ title: '載入說明失敗', bullets: [] }])
      }
    }
    load()
  }, [file])

  const prev = () => setIndex(i => Math.max(i - 1, 0))
  const next = () => setIndex(i => Math.min(i + 1, steps.length - 1))

  const step = steps[index]

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto pr-2">
        {step && (
          <>
            <h1 className="mb-4 text-2xl font-bold leading-relaxed">{step.title}</h1>
            {step.bullets.length > 0 && (
              <ul className="mb-4 list-disc space-y-2 pl-5">
                {step.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {step.image && (
              <img src={step.image} alt={step.title} className="mt-2" />
            )}
          </>
        )}
      </div>
      {steps.length > 1 && (
        <div className="mt-4 flex justify-between">
          <Button variant="outline" disabled={index === 0} onClick={prev}>
            上一步
          </Button>
          <Button variant="outline" disabled={index === steps.length - 1} onClick={next}>
            下一步
          </Button>
        </div>
      )}
    </div>
  )
}

interface UsageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function UsageDialog({ open, onOpenChange }: UsageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>使用說明</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="schedule" className="w-full flex-1 overflow-hidden">
          <TabsList className="mb-4 flex-shrink-0">
            <TabsTrigger value="schedule">週課表說明</TabsTrigger>
            <TabsTrigger value="courses">課程庫說明</TabsTrigger>
            <TabsTrigger value="rooms">教室庫說明</TabsTrigger>
          </TabsList>
          <TabsContent value="schedule" className="h-full">
            <InstructionStepper file="/instructions/schedule.json" />
          </TabsContent>
          <TabsContent value="courses" className="h-full">
            <InstructionStepper file="/instructions/courses.json" />
          </TabsContent>
          <TabsContent value="rooms" className="h-full">
            <InstructionStepper file="/instructions/rooms.json" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

