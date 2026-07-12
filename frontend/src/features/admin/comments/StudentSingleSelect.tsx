import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { listStudents } from '@/api/users'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'
import type { SelectedStudent } from '@/features/admin/campaigns/StudentMultiSelect'

interface StudentSingleSelectProps {
  value: SelectedStudent | null
  onChange: (student: SelectedStudent | null) => void
  className?: string
}

/** Searchable single-select over the mentor's students (cmdk combobox). */
export function StudentSingleSelect({ value, onChange, className }: StudentSingleSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'students', 'picker', { search: debouncedSearch }],
    queryFn: () => listStudents({ search: debouncedSearch, limit: 20 }),
    enabled: open,
  })
  const students = data?.students ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between font-normal', className)}
        >
          <span className="truncate">
            {value ? value.name || value.email : 'Any student'}
          </span>
          {value ? (
            <span
              role="button"
              aria-label="Clear student filter"
              className="hover:bg-muted-foreground/20 -mr-1 rounded-sm p-0.5"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
            >
              <X className="size-4" />
            </span>
          ) : (
            <ChevronsUpDown className="size-4 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or email…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{isPending ? 'Searching…' : 'No students found.'}</CommandEmpty>
            {students.map((student) => (
              <CommandItem
                key={student._id}
                value={student._id}
                onSelect={() => {
                  onChange(
                    value?._id === student._id
                      ? null
                      : { _id: student._id, name: student.name, email: student.email },
                  )
                  setOpen(false)
                }}
              >
                <Check
                  className={cn('size-4', value?._id === student._id ? 'opacity-100' : 'opacity-0')}
                />
                <span className="truncate">{student.name || student.email}</span>
                {student.name && (
                  <span className="text-muted-foreground ml-auto truncate text-xs">
                    {student.email}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
