/**
 * Seeds the bootstrap mentor. Idempotent — run once before students can sign up
 * (the OTP flow maps new students to this mentor).
 *
 *   npm run seed:mentor
 */
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { disconnectRedis } from '../config/redis.js';
import { env } from '../config/env.js';
import { ROLES } from '../common/constants/roles.js';
import { User } from '../modules/user/user.model.js';
import { logger } from '../common/utils/logger.js';
import { normalizeEmail } from '../common/utils/otp.util.js';

async function run(): Promise<void> {
  await connectDatabase();

  const email = normalizeEmail(env.seedMentorEmail);
  const existing = await User.findOne({ email });

  if (existing) {
    logger.info(`[seed] mentor already exists: ${email}`);
  } else {
    await User.create({
      email,
      name: env.seedMentorName,
      role: ROLES.MENTOR,
      emailVerified: true,
      status: 'active',
    });
    logger.info(`[seed] mentor created: ${email}`);
  }

  await disconnectDatabase();
  await disconnectRedis();
  process.exit(0);
}

run().catch((err) => {
  logger.error({ err }, '[seed] failed');
  process.exit(1);
});
