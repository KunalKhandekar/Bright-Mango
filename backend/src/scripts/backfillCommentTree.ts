import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Comment, CommentDoc } from '../modules/comment/comment.model.js';
import { logger } from '../common/utils/logger.js';

type CommentMap = Map<string, CommentDoc>;

function resolveTree(
  comment: CommentDoc,
  byId: CommentMap,
  visiting = new Set<string>(),
): { ancestorIds: Types.ObjectId[]; depth: number; rootCommentId: Types.ObjectId | null } {
  const id = comment._id.toString();
  if (!comment.parentCommentId) return { ancestorIds: [], depth: 0, rootCommentId: null };
  if (visiting.has(id)) return { ancestorIds: [], depth: 0, rootCommentId: null };

  const parent = byId.get(comment.parentCommentId.toString());
  if (!parent) return { ancestorIds: [], depth: 0, rootCommentId: null };

  visiting.add(id);
  const parentTree = resolveTree(parent, byId, visiting);
  visiting.delete(id);

  const ancestorIds = [...parentTree.ancestorIds, parent._id];
  return {
    ancestorIds,
    depth: ancestorIds.length,
    rootCommentId: parentTree.rootCommentId ?? parent._id,
  };
}

async function main(): Promise<void> {
  await connectDatabase();

  const comments = await Comment.find({}).sort({ createdAt: 1 }).lean<CommentDoc[]>();
  const byId = new Map(comments.map((comment) => [comment._id.toString(), comment]));
  const directReplyCounts = new Map<string, number>();

  for (const comment of comments) {
    if (!comment.parentCommentId) continue;
    const parentId = comment.parentCommentId.toString();
    directReplyCounts.set(parentId, (directReplyCounts.get(parentId) ?? 0) + 1);
  }

  let updated = 0;
  for (const comment of comments) {
    const tree = resolveTree(comment, byId);
    const directReplyCount = directReplyCounts.get(comment._id.toString()) ?? 0;

    await Comment.updateOne(
      { _id: comment._id },
      {
        $set: {
          ancestorIds: tree.ancestorIds,
          depth: tree.depth,
          rootCommentId: tree.rootCommentId,
          directReplyCount,
        },
      },
    );
    updated += 1;
  }

  logger.info({ updated }, '[backfillCommentTree] completed');
  await disconnectDatabase();
}

main().catch(async (err) => {
  logger.error({ err }, '[backfillCommentTree] failed');
  await disconnectDatabase();
  process.exit(1);
});
