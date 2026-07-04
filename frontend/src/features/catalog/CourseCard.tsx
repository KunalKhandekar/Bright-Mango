import { Link } from 'react-router-dom'
import { ImageIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PriceTag } from '@/components/shared/PriceTag'
import type { Course } from '@/types/models'

export function CourseCard({ course }: { course: Course }) {
  return (
    <Link to={`/courses/${course.slug}`} className="group">
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
        <div className="bg-muted aspect-video w-full overflow-hidden">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageIcon className="text-muted-foreground/40 size-8" />
            </div>
          )}
        </div>
        <CardContent className="space-y-2 p-4">
          <h3 className="line-clamp-2 font-medium leading-snug">{course.title}</h3>
          {course.shortDescription && (
            <p className="text-muted-foreground line-clamp-2 text-sm">
              {course.shortDescription}
            </p>
          )}
          <PriceTag price={course.price} className="text-base" />
        </CardContent>
      </Card>
    </Link>
  )
}
