import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name?: string
  email?: string
  avatar?: string
  className?: string
}

export function UserAvatar({ name, email, avatar, className }: UserAvatarProps) {
  const label = name || email || '?'
  const initials = label
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <Avatar className={cn('size-8', className)}>
      {avatar && <AvatarImage src={avatar} alt={label} />}
      <AvatarFallback className="text-xs">{initials || '?'}</AvatarFallback>
    </Avatar>
  )
}
