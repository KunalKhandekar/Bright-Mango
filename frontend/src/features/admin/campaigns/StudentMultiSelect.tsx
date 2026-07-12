import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { listStudents } from '@/api/users'
import { Badge } from '@/components/ui/badge'
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

export interface SelectedStudent {
  _id: string
  name?: string
  email: string
}

interface StudentMultiSelectProps {
  selected: SelectedStudent[]
  onChange: (students: SelectedStudent[]) => void
}

/** Searchable multi-select over the mentor's students (cmdk combobox + badges). */
export function StudentMultiSelect({ selected, onChange }: StudentMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'students', 'picker', { search: debouncedSearch }],
    queryFn: () => listStudents({ search: debouncedSearch, limit: 20 }),
    enabled: open,
  })
  const students = data?.students ?? []
  const selectedIds = new Set(selected.map((s) => s._id))

  const toggle = (student: SelectedStudent) => {
    if (selectedIds.has(student._id)) {
      onChange(selected.filter((s) => s._id !== student._id))
    } else {
      onChange([...selected, student])
    }
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selected.length > 0
              ? `${selected.length} student${selected.length === 1 ? '' : 's'} selected`
              : 'Select students…'}
            <ChevronsUpDown className="size-4 opacity-50" />
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
                  onSelect={() =>
                    toggle({ _id: student._id, name: student.name, email: student.email })
                  }
                >
                  <Check
                    className={cn('size-4', selectedIds.has(student._id) ? 'opacity-100' : 'opacity-0')}
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
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((student) => (
            <Badge key={student._id} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-40 truncate">{student.name || student.email}</span>
              <button
                type="button"
                aria-label={`Remove ${student.name || student.email}`}
                className="hover:bg-muted-foreground/20 rounded-sm p-0.5"
                onClick={() => toggle(student)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
