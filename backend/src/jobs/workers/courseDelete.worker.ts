import { Worker } from 'bullmq';
import { bullConnection, QUEUE_NAMES } from '../../config/queue.js';
import { logger } from '../../common/utils/logger.js';
import { Course } from '../../modules/course/course.model.js';
import { CourseDeletionRequest } from '../../modules/course/courseDeletionRequest.model.js';
import { hardDeleteCourseTree } from '../../modules/course/course.service.js';
import { LessonResource } from '../../modules/resource/lessonResource.model.js';
import { deleteVideo } from '../../integrations/stream.service.js';
import { deleteObject } from '../../integrations/r2.service.js';

interface CourseDeleteJob {
  courseId: string;
}

export function startCourseDeleteWorker(): Worker<CourseDeleteJob> {
  const worker = new Worker<CourseDeleteJob>(
    QUEUE_NAMES.COURSE_DELETE,
    async (job) => {
      const { courseId } = job.data;

      // Guard: only execute if a scheduled request still exists and the course is still
      // marked for deletion (a cancellation removes the job, but double-check anyway).
      const req = await CourseDeletionRequest.findOne({ courseId, status: 'scheduled' });
      const course = await Course.findById(courseId).lean();
      if (!req || !course || course.status !== 'scheduled_delete') {
        logger.info({ courseId }, '[courseDelete] skipped (cancelled or already handled)');
        return;
      }

      // Clean up external assets (R2 resources) before removing DB records.
      const resources = await LessonResource.find({ courseId }).select('fileKey').lean();
      await Promise.all([
        ...resources.map((r) => deleteObject(r.fileKey).catch(() => undefined)),
        course.thumbnailKey ? deleteObject(course.thumbnailKey).catch(() => undefined) : Promise.resolve(),
      ]);
      await LessonResource.deleteMany({ courseId });

      const { lessonUids } = await hardDeleteCourseTree(courseId);
      await Promise.all(lessonUids.map((uid) => deleteVideo(uid).catch(() => undefined)));

      req.status = 'executed';
      await req.save();
      logger.info({ courseId }, '[courseDelete] course hard-deleted');
    },
    { connection: bullConnection, concurrency: 2 },
  );

  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, '[courseDelete.worker] failed'));
  return worker;
}
