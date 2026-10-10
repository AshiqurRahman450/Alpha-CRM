import { Types } from 'mongoose';
import { ProjectActivity, ActivityType } from '../../models';

export async function logProjectActivity(params: {
  projectId: Types.ObjectId | string;
  projectCode: string;
  type: ActivityType;
  description: string;
  userId?: Types.ObjectId | string;
  userName?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await ProjectActivity.create({
      projectId: params.projectId,
      projectCode: params.projectCode,
      type: params.type,
      description: params.description,
      userId: params.userId,
      userName: params.userName || 'System Automation',
      metadata: params.metadata,
    });
  } catch (err: any) {
    console.error(`[ProjectActivity] Failed to log activity:`, err.message);
  }
}
