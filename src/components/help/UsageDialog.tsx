'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import ReactMarkdown from 'react-markdown'

interface MarkdownStepperProps {
  file: string
}

function MarkdownStepper({ file }: MarkdownStepperProps) {
  const [steps, setSteps] = useState<string[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(file)
        const text = await res.text()
        const parts = text.split('\n---\n')
        setSteps(parts)
        setIndex(0)
      } catch {
        setSteps(['載入說明失敗'])
      }
    }
    load()
  }, [file])

  const prev = () => setIndex(i => Math.max(i - 1, 0))
  const next = () => setIndex(i => Math.min(i + 1, steps.length - 1))

  return (
    <div className="flex h-full flex-col">
      <div className="prose max-w-none flex-1 overflow-y-auto pr-2 prose-h1:mb-4 prose-h1:text-2xl prose-h1:font-bold prose-h1:leading-relaxed prose-ul:list-disc prose-ul:pl-5">
        <ReactMarkdown>{steps[index] || ''}</ReactMarkdown>
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
            <MarkdownStepper file="/instructions/schedule.md" />
          </TabsContent>
          <TabsContent value="courses" className="h-full">
            <MarkdownStepper file="/instructions/courses.md" />
          </TabsContent>
          <TabsContent value="rooms" className="h-full">
            <MarkdownStepper file="/instructions/rooms.md" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

