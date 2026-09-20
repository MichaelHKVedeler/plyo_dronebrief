import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Actor } from '../model/cloud'

function actorInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = Array.from(parts[0]!)
  const last = parts.length === 1 ? first.slice(1, 2) : Array.from(parts[parts.length - 1]!).slice(0, 1)
  return `${first[0] ?? ''}${last[0] ?? ''}`.toLocaleUpperCase()
}

export function ActorAvatar({ actor, at, label }: { actor: Actor; at: string; label: string }) {
  const timestamp = new Date(at).toLocaleString()
  const detail = `${label} ${actor.name} · ${timestamp}`
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" className="rounded-full" aria-label={detail}>
          <Avatar size="sm">
            <AvatarFallback className="text-[10px] font-medium">{actorInitials(actor.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="text-left">
        <div className="grid gap-0.5">
          <p className="font-medium">{actor.name}</p>
          <p>{timestamp}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
