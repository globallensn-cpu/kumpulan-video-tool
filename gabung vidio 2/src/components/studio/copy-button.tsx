"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export function CopyButton({
  text,
  label = "Salin",
  className,
  size = "sm",
}: {
  text: string
  label?: string
  className?: string
  size?: "sm" | "default"
}) {
  const [copied, setCopied] = React.useState(false)
  const { toast } = useToast()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback untuk konteks non-secure (HTTP)
      const ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      ta.remove()
    }
    setCopied(true)
    toast({ title: "Tersalin ke clipboard ✅" })
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Button variant="outline" size={size} onClick={copy} className={cn("gap-1.5", className)}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Tersalin!" : label}
    </Button>
  )
}
