import { Queue } from "bullmq";
import { redis } from "../config/redis";

export const AUTOMATION_QUEUE_NAME = "automation-execution-queue";

export interface AutomationJobData {
  executionId: string;
  automationId: string;
  contactId: string;
  workspaceId: string;
  nodeId?: string; // If resuming at a specific node
}

export const automationQueue = new Queue<AutomationJobData>(AUTOMATION_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

/**
 * Add job to initiate an automation execution for a contact
 */
export async function addStartAutomationJob(data: AutomationJobData) {
  const jobId = `auto_start_${data.executionId}`;
  return automationQueue.add("start-execution", data, { jobId });
}

/**
 * Add job to execute or resume an automation node (with optional delay)
 */
export async function addStepAutomationJob(data: AutomationJobData, delayMs = 0) {
  const jobId = `auto_step_${data.executionId}_${data.nodeId || "next"}_${Date.now()}`;
  return automationQueue.add("execute-step", data, {
    jobId,
    delay: delayMs > 0 ? delayMs : undefined,
  });
}
