import { prisma } from "../../config/database";
import {
  CampaignStatus,
  CampaignRecipientStatus,
  ContactStatus,
  Prisma,
} from "@prisma/client";
import { addCampaignDispatchJob } from "../../queues/campaign.queue";
import { GmailSmtpProvider } from "../../providers";

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CampaignStatus;
  sortBy?: "createdAt" | "updatedAt" | "name" | "status";
  sortOrder?: "asc" | "desc";
}

export interface RecipientPaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CampaignRecipientStatus;
}

export interface CreateCampaignDTO {
  name: string;
  subject: string;
  preheader?: string | null;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
  templateId?: string | null;
  htmlContent: string;
  targetListIds?: string[];
  targetTagIds?: string[];
  scheduledAt?: string | null;
}

export interface UpdateCampaignDTO {
  name?: string;
  subject?: string;
  preheader?: string | null;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string | null;
  templateId?: string | null;
  htmlContent?: string;
  targetListIds?: string[];
  targetTagIds?: string[];
  scheduledAt?: string | null;
  status?: CampaignStatus;
}

export interface CampaignValidationResult {
  canSend: boolean;
  errors: string[];
  checklist: {
    hasSubject: boolean;
    hasFromEmail: boolean;
    hasFromName: boolean;
    hasContent: boolean;
    hasAudience: boolean;
    hasValidProvider: boolean;
    hasValidSenderDomain: boolean;
  };
  audienceSummary: {
    totalEligibleActive: number;
    excludedUnsubscribed: number;
    excludedBounced: number;
  };
}

const BATCH_SIZE = 50;

export class CampaignService {
  /**
   * Resolves active workspace for user
   */
  static async resolveActiveWorkspace(
    supabaseId: string,
    requestedWorkspaceId?: string
  ): Promise<{
    user: { id: string; email: string; name: string | null };
    workspaceId: string;
    role: string;
  }> {
    let user = await prisma.user.findUnique({
      where: { supabaseId },
      include: {
        memberships: {
          include: { workspace: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user) {
      // Auto-provision user record if not yet synced from Supabase Auth
      try {
        const { AuthService } = await import("../auth/auth.service");
        const { supabaseAdmin } = await import("../../config/supabase");
        const { data } = await supabaseAdmin.auth.admin.getUserById(supabaseId);
        if (data?.user) {
          await AuthService.syncUserFromSupabase(data.user);
          user = await prisma.user.findUnique({
            where: { supabaseId },
            include: {
              memberships: {
                include: { workspace: true },
                orderBy: { createdAt: "asc" },
              },
            },
          });
        }
      } catch (e: any) {
        console.warn("[CampaignService] Auto-sync attempt notice:", e.message);
      }
    }

    if (!user) {
      const err: any = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    if (user.memberships.length === 0) {
      const err: any = new Error("User does not belong to any workspace");
      err.statusCode = 403;
      throw err;
    }

    let targetWorkspaceId = requestedWorkspaceId || user.activeWorkspaceId;

    let targetMembership = user.memberships.find(
      (m) => m.workspaceId === targetWorkspaceId
    );

    if (!targetMembership) {
      targetMembership = user.memberships[0];
      targetWorkspaceId = targetMembership.workspaceId;

      await prisma.user.update({
        where: { id: user.id },
        data: { activeWorkspaceId: targetWorkspaceId },
      });
    }

    return {
      user: { id: user.id, email: user.email, name: user.name },
      workspaceId: targetMembership.workspaceId,
      role: targetMembership.role,
    };
  }

  /**
   * List campaigns for workspace with filtering and pagination
   */
  static async getCampaigns(workspaceId: string, params: PaginationParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CampaignWhereInput = {
      workspaceId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { subject: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const sortBy = params.sortBy || "createdAt";
    const sortOrder = params.sortOrder || "desc";

    const [total, items] = await Promise.all([
      prisma.campaign.count({ where }),
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          template: {
            select: { id: true, name: true, category: true },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single campaign by ID
   */
  static async getCampaignById(workspaceId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    if (!campaign) {
      const err: any = new Error("Campaign not found");
      err.statusCode = 404;
      throw err;
    }

    return campaign;
  }

  /**
   * Create a new campaign
   */
  static async createCampaign(workspaceId: string, data: CreateCampaignDTO) {
    // If templateId provided, verify it belongs to this workspace
    if (data.templateId) {
      const template = await prisma.emailTemplate.findFirst({
        where: { id: data.templateId, workspaceId },
      });
      if (!template) {
        const err: any = new Error("Referenced template does not exist in this workspace");
        err.statusCode = 400;
        throw err;
      }
    }

    const campaign = await prisma.campaign.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        subject: data.subject.trim(),
        preheader: data.preheader?.trim() || null,
        fromName: data.fromName.trim(),
        fromEmail: data.fromEmail.trim().toLowerCase(),
        replyTo: data.replyTo?.trim() ? data.replyTo.trim().toLowerCase() : null,
        templateId: data.templateId || null,
        htmlContent: data.htmlContent,
        targetListIds: data.targetListIds || [],
        targetTagIds: data.targetTagIds || [],
        status: data.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    return campaign;
  }

  /**
   * Update an existing campaign
   */
  static async updateCampaign(
    workspaceId: string,
    campaignId: string,
    data: UpdateCampaignDTO
  ) {
    const existing = await this.getCampaignById(workspaceId, campaignId);

    // Only allow editing if status is DRAFT or SCHEDULED
    if (
      existing.status !== CampaignStatus.DRAFT &&
      existing.status !== CampaignStatus.SCHEDULED
    ) {
      const err: any = new Error(
        `Cannot edit campaign in ${existing.status} status. Only DRAFT or SCHEDULED campaigns can be modified.`
      );
      err.statusCode = 400;
      throw err;
    }

    if (data.templateId) {
      const template = await prisma.emailTemplate.findFirst({
        where: { id: data.templateId, workspaceId },
      });
      if (!template) {
        const err: any = new Error("Referenced template does not exist in this workspace");
        err.statusCode = 400;
        throw err;
      }
    }

    const updateData: Prisma.CampaignUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.subject !== undefined) updateData.subject = data.subject.trim();
    if (data.preheader !== undefined) updateData.preheader = data.preheader?.trim() || null;
    if (data.fromName !== undefined) updateData.fromName = data.fromName.trim();
    if (data.fromEmail !== undefined) updateData.fromEmail = data.fromEmail.trim().toLowerCase();
    if (data.replyTo !== undefined) updateData.replyTo = data.replyTo?.trim() ? data.replyTo.trim().toLowerCase() : null;
    if (data.templateId !== undefined) {
      updateData.template = data.templateId
        ? { connect: { id: data.templateId } }
        : { disconnect: true };
    }
    if (data.htmlContent !== undefined) updateData.htmlContent = data.htmlContent;
    if (data.targetListIds !== undefined) updateData.targetListIds = data.targetListIds;
    if (data.targetTagIds !== undefined) updateData.targetTagIds = data.targetTagIds;
    if (data.scheduledAt !== undefined) {
      updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
      if (data.scheduledAt && existing.status === CampaignStatus.DRAFT) {
        updateData.status = CampaignStatus.SCHEDULED;
      }
    }
    if (data.status !== undefined) updateData.status = data.status;

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    return updated;
  }

  /**
   * Delete campaign
   */
  static async deleteCampaign(workspaceId: string, campaignId: string) {
    const existing = await this.getCampaignById(workspaceId, campaignId);

    if (
      existing.status === CampaignStatus.SENDING ||
      existing.status === CampaignStatus.QUEUED
    ) {
      const err: any = new Error("Cannot delete campaign while it is actively sending or queued");
      err.statusCode = 400;
      throw err;
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    return { id: campaignId, deleted: true };
  }

  /**
   * Duplicate campaign as a new DRAFT
   */
  static async duplicateCampaign(workspaceId: string, campaignId: string) {
    const existing = await this.getCampaignById(workspaceId, campaignId);

    const duplicated = await prisma.campaign.create({
      data: {
        workspaceId,
        name: `Copy of ${existing.name}`,
        subject: existing.subject,
        preheader: existing.preheader,
        fromName: existing.fromName,
        fromEmail: existing.fromEmail,
        replyTo: existing.replyTo,
        templateId: existing.templateId,
        htmlContent: existing.htmlContent,
        targetListIds: existing.targetListIds,
        targetTagIds: existing.targetTagIds,
        status: CampaignStatus.DRAFT,
      },
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    return duplicated;
  }

  /**
   * Resolve audience contacts honoring safety invariants:
   * 1. ACTIVE contacts only
   * 2. Exclude UNSUBSCRIBED and BOUNCED
   * 3. Normalize email and deduplicate
   */
  static async resolveAudienceContacts(
    workspaceId: string,
    targetListIds: string[] = [],
    targetTagIds: string[] = []
  ) {
    // Build audience targeting condition
    const targetingOr: Prisma.ContactWhereInput[] = [];

    if (targetListIds.length > 0) {
      targetingOr.push({
        listMemberships: {
          some: {
            listId: { in: targetListIds },
          },
        },
      });
    }

    if (targetTagIds.length > 0) {
      targetingOr.push({
        tagAssignments: {
          some: {
            tagId: { in: targetTagIds },
          },
        },
      });
    }

    const audienceCondition: Prisma.ContactWhereInput =
      targetingOr.length > 0 ? { OR: targetingOr } : {};

    // 1. Fetch eligible active contacts
    const activeContacts = await prisma.contact.findMany({
      where: {
        workspaceId,
        status: ContactStatus.ACTIVE,
        ...audienceCondition,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // 2. Count excluded unsubscribed and bounced contacts for reporting
    const unsubscribedCount = await prisma.contact.count({
      where: {
        workspaceId,
        status: ContactStatus.UNSUBSCRIBED,
        ...audienceCondition,
      },
    });

    const bouncedCount = await prisma.contact.count({
      where: {
        workspaceId,
        status: ContactStatus.BOUNCED,
        ...audienceCondition,
      },
    });

    // Deduplicate by normalized lowercase email
    const seenEmails = new Set<string>();
    const deduplicatedActiveContacts: typeof activeContacts = [];

    for (const c of activeContacts) {
      const normalizedEmail = c.email.trim().toLowerCase();
      if (!seenEmails.has(normalizedEmail)) {
        seenEmails.add(normalizedEmail);
        deduplicatedActiveContacts.push({
          ...c,
          email: normalizedEmail,
        });
      }
    }

    return {
      contacts: deduplicatedActiveContacts,
      stats: {
        totalEligibleActive: deduplicatedActiveContacts.length,
        excludedUnsubscribed: unsubscribedCount,
        excludedBounced: bouncedCount,
      },
    };
  }

  /**
   * Validate campaign readiness for sending
   */
  static async validateCampaign(
    workspaceId: string,
    campaignId: string,
    options?: { isTest?: boolean }
  ): Promise<CampaignValidationResult> {
    const campaign = await this.getCampaignById(workspaceId, campaignId);

    const hasSubject = campaign.subject.trim().length > 0;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasFromEmail = emailRegex.test(campaign.fromEmail);
    const hasFromName = campaign.fromName.trim().length > 0;
    const hasContent = campaign.htmlContent.trim().length > 0;

    const audience = await this.resolveAudienceContacts(
      workspaceId,
      campaign.targetListIds,
      campaign.targetTagIds
    );

    const hasAudience = audience.stats.totalEligibleActive > 0;
    const isProviderConfigured =
      GmailSmtpProvider.isConfigured() ||
      GmailSmtpProvider.isTestModeEnabled() ||
      Boolean(options?.isTest);
    const hasValidSender = hasFromEmail && campaign.fromEmail.includes("@");

    const errors: string[] = [];
    if (!hasSubject) errors.push("Campaign subject line is required.");
    if (!hasFromName) errors.push("Sender name ('From Name') is required.");
    if (!hasFromEmail) errors.push("Valid sender email ('From Email') is required.");
    if (!hasContent) errors.push("Campaign email HTML content is required.");
    if (!hasAudience) {
      errors.push(
        "No active recipients found matching target audience. Excluded unsubscribed/bounced contacts cannot receive emails."
      );
    }
    if (!isProviderConfigured) {
      errors.push(
        "Gmail SMTP delivery provider is unconfigured. Set GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD in environment before dispatching live campaigns."
      );
    }

    return {
      canSend: errors.length === 0,
      errors,
      checklist: {
        hasSubject,
        hasFromEmail,
        hasFromName,
        hasContent,
        hasAudience,
        hasValidProvider: isProviderConfigured,
        hasValidSenderDomain: hasValidSender,
      },
      audienceSummary: audience.stats,
    };
  }

  /**
   * Send campaign: Snapshot recipients, transition to QUEUED, and enqueue BullMQ jobs
   */
  static async sendCampaign(
    workspaceId: string,
    campaignId: string,
    options?: { isTest?: boolean }
  ) {
    const campaign = await this.getCampaignById(workspaceId, campaignId);

    if (
      campaign.status === CampaignStatus.QUEUED ||
      campaign.status === CampaignStatus.SENDING ||
      campaign.status === CampaignStatus.SENT
    ) {
      const err: any = new Error(`Campaign has already been sent or is currently sending.`);
      err.statusCode = 400;
      throw err;
    }

    // Run validation checks
    const validation = await this.validateCampaign(workspaceId, campaignId, options);
    if (!validation.canSend) {
      const err: any = new Error(
        `Campaign validation failed: ${validation.errors.join("; ")}`
      );
      err.statusCode = 400;
      throw err;
    }

    // Resolve eligible audience
    const audience = await this.resolveAudienceContacts(
      workspaceId,
      campaign.targetListIds,
      campaign.targetTagIds
    );

    const eligibleContacts = audience.contacts;

    // Remove any previous stale recipient snapshots for this campaign
    await prisma.campaignRecipient.deleteMany({
      where: { campaignId },
    });

    // Create recipient snapshot records in batches of 100
    const snapshotBatchSize = 100;
    for (let i = 0; i < eligibleContacts.length; i += snapshotBatchSize) {
      const chunk = eligibleContacts.slice(i, i + snapshotBatchSize);
      await prisma.campaignRecipient.createMany({
        data: chunk.map((contact) => ({
          campaignId,
          contactId: contact.id,
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          status: CampaignRecipientStatus.PENDING,
          attempts: 0,
        })),
        skipDuplicates: true,
      });
    }

    // Fetch created recipient IDs
    const createdRecipients = await prisma.campaignRecipient.findMany({
      where: { campaignId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    const recipientIds = createdRecipients.map((r) => r.id);

    // Update campaign status to QUEUED and record total recipients count
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.QUEUED,
        recipientCount: recipientIds.length,
        sentCount: 0,
        failedCount: 0,
        startedAt: null,
        completedAt: null,
      },
      include: {
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    // Enqueue BullMQ batch jobs
    const totalBatches = Math.ceil(recipientIds.length / BATCH_SIZE);
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchRecipientIds = recipientIds.slice(
        batchIndex * BATCH_SIZE,
        (batchIndex + 1) * BATCH_SIZE
      );

      await addCampaignDispatchJob({
        campaignId,
        workspaceId,
        recipientIds: batchRecipientIds,
        batchIndex,
        totalBatches,
        isTest: options?.isTest,
      });
    }

    console.log(
      `[CampaignService] Enqueued ${totalBatches} batches for campaign ${campaignId} (${recipientIds.length} recipients)`
    );

    return updatedCampaign;
  }

  /**
   * Reconcile any orphaned QUEUED or in-flight SENDING campaigns on server startup
   */
  static async reconcileOrphanedCampaigns() {
    try {
      const orphanedCampaigns = await prisma.campaign.findMany({
        where: {
          status: {
            in: [CampaignStatus.QUEUED, CampaignStatus.SENDING],
          },
        },
        include: {
          recipients: {
            where: {
              status: {
                in: [CampaignRecipientStatus.PENDING, CampaignRecipientStatus.PROCESSING],
              },
            },
            select: { id: true },
          },
        },
      });

      for (const camp of orphanedCampaigns) {
        if (camp.recipients.length === 0) {
          const sent = await prisma.campaignRecipient.count({
            where: {
              campaignId: camp.id,
              status: { in: [CampaignRecipientStatus.SENT, CampaignRecipientStatus.DELIVERED] },
            },
          });
          await prisma.campaign.update({
            where: { id: camp.id },
            data: {
              status: sent > 0 ? CampaignStatus.SENT : CampaignStatus.FAILED,
              completedAt: new Date(),
            },
          });
          continue;
        }

        // Reset any hanging PROCESSING recipients back to PENDING
        await prisma.campaignRecipient.updateMany({
          where: {
            campaignId: camp.id,
            status: CampaignRecipientStatus.PROCESSING,
          },
          data: {
            status: CampaignRecipientStatus.PENDING,
          },
        });

        const pendingRecipientIds = camp.recipients.map((r) => r.id);
        const totalBatches = Math.ceil(pendingRecipientIds.length / BATCH_SIZE);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batchRecipientIds = pendingRecipientIds.slice(
            batchIndex * BATCH_SIZE,
            (batchIndex + 1) * BATCH_SIZE
          );

          await addCampaignDispatchJob({
            campaignId: camp.id,
            workspaceId: camp.workspaceId,
            recipientIds: batchRecipientIds,
            batchIndex,
            totalBatches,
          });
        }

        console.log(
          `[CampaignService] Reconciled and re-enqueued orphaned campaign "${camp.name}" (${camp.id}) with ${pendingRecipientIds.length} pending recipients.`
        );
      }
    } catch (err: any) {
      console.error("[CampaignService] Startup reconciliation error:", err.message);
    }
  }

  /**
   * Cancel an in-flight or queued campaign
   */
  static async cancelCampaign(workspaceId: string, campaignId: string) {
    const campaign = await this.getCampaignById(workspaceId, campaignId);

    if (
      campaign.status !== CampaignStatus.QUEUED &&
      campaign.status !== CampaignStatus.SENDING &&
      campaign.status !== CampaignStatus.SCHEDULED &&
      campaign.status !== CampaignStatus.DRAFT
    ) {
      const err: any = new Error(
        `Cannot cancel campaign in ${campaign.status} status. Only active campaigns (DRAFT, SCHEDULED, QUEUED, SENDING) can be cancelled.`
      );
      err.statusCode = 400;
      throw err;
    }

    // Mark campaign as CANCELLED
    const cancelled = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    // Mark remaining PENDING recipients as SKIPPED
    await prisma.campaignRecipient.updateMany({
      where: {
        campaignId,
        status: CampaignRecipientStatus.PENDING,
      },
      data: {
        status: CampaignRecipientStatus.SKIPPED,
        errorMessage: "Campaign was cancelled by user",
      },
    });

    return cancelled;
  }

  /**
   * Get paginated recipient logs for a campaign
   */
  static async getCampaignRecipients(
    workspaceId: string,
    campaignId: string,
    params: RecipientPaginationParams
  ) {
    await this.getCampaignById(workspaceId, campaignId);

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CampaignRecipientWhereInput = {
      campaignId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: "insensitive" } },
              { firstName: { contains: params.search, mode: "insensitive" } },
              { lastName: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.campaignRecipient.count({ where }),
      prisma.campaignRecipient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get detailed delivery stats for a campaign
   */
  static async getCampaignStats(workspaceId: string, campaignId: string) {
    const campaign = await this.getCampaignById(workspaceId, campaignId);

    const [pending, processing, sent, delivered, bounced, failed, skipped] = await Promise.all([
      prisma.campaignRecipient.count({
        where: { campaignId, status: CampaignRecipientStatus.PENDING },
      }),
      prisma.campaignRecipient.count({
        where: { campaignId, status: CampaignRecipientStatus.PROCESSING },
      }),
      prisma.campaignRecipient.count({
        where: { campaignId, status: CampaignRecipientStatus.SENT },
      }),
      prisma.campaignRecipient.count({
        where: { campaignId, status: CampaignRecipientStatus.DELIVERED },
      }),
      prisma.campaignRecipient.count({
        where: { campaignId, status: CampaignRecipientStatus.BOUNCED },
      }),
      prisma.campaignRecipient.count({
        where: { campaignId, status: CampaignRecipientStatus.FAILED },
      }),
      prisma.campaignRecipient.count({
        where: { campaignId, status: CampaignRecipientStatus.SKIPPED },
      }),
    ]);

    const totalAcceptedByProvider = sent + delivered;
    const totalProcessed = totalAcceptedByProvider + bounced + failed + skipped;
    const totalRecipients = campaign.recipientCount;
    const progressPercent =
      totalRecipients > 0 ? Math.round((totalProcessed / totalRecipients) * 100) : 0;
    
    // Confirmed delivery rate: only verified email.delivered events count toward delivered
    const deliveryRate =
      totalAcceptedByProvider > 0 ? Math.round((delivered / totalAcceptedByProvider) * 100) : 0;
    const sendSuccessRate =
      totalProcessed > 0 ? Math.round((totalAcceptedByProvider / totalProcessed) * 100) : 0;

    let durationSeconds: number | null = null;
    if (campaign.startedAt && campaign.completedAt) {
      durationSeconds = Math.max(
        0,
        Math.round((campaign.completedAt.getTime() - campaign.startedAt.getTime()) / 1000)
      );
    }

    return {
      campaignId: campaign.id,
      status: campaign.status,
      recipientCount: campaign.recipientCount,
      sentCount: totalAcceptedByProvider,
      deliveredCount: delivered,
      bouncedCount: bounced,
      failedCount: failed,
      pendingCount: pending,
      processingCount: processing,
      skippedCount: skipped,
      progressPercent,
      deliveryRate,
      sendSuccessRate,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      durationSeconds,
    };
  }

  /**
   * Send a test email of a campaign directly to the logged-in user with real sample contact interpolation
   */
  static async sendTestEmail(
    workspaceId: string,
    userEmail: string,
    data: {
      campaignId?: string;
      subject?: string;
      htmlContent?: string;
      fromName?: string;
      targetEmail?: string;
    }
  ) {
    let subject = data.subject || "";
    let htmlContent = data.htmlContent || "";
    let fromName = data.fromName || "MailPilot";
    let fromEmail = "notifications@mailpilot.io";

    if (data.campaignId) {
      const camp = await this.getCampaignById(workspaceId, data.campaignId);
      subject = subject || camp.subject;
      htmlContent = htmlContent || camp.htmlContent;
      fromName = fromName || camp.fromName;
      fromEmail = camp.fromEmail;
    }

    const destinationEmail = (data.targetEmail || userEmail).trim();
    if (!destinationEmail || !destinationEmail.includes("@")) {
      const err: any = new Error("Invalid destination email for test dispatch.");
      err.statusCode = 400;
      throw err;
    }

    // Pick a real sample contact from workspace for personalization demonstration
    const sampleContact = await prisma.contact.findFirst({
      where: { workspaceId, status: ContactStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
    });

    const mergeTags = {
      firstName: sampleContact?.firstName || "Alex",
      lastName: sampleContact?.lastName || "Taylor",
      email: destinationEmail,
      company: sampleContact?.company || "Acme Corp",
      subject: subject || "Campaign Preview",
    };

    const personalizedSubject = `[Test] ${GmailSmtpProvider.interpolateMergeTags(
      subject || "Test Campaign Preview",
      mergeTags
    )}`;

    const personalizedHtml = GmailSmtpProvider.interpolateMergeTags(
      htmlContent || "<p>This is a test preview of your campaign.</p>",
      mergeTags
    );

    const testBanner = `<div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#475569;margin-bottom:20px;border-radius:6px;">
      <strong style="color:#0f172a;">MailPilot Preview:</strong> Sent to <strong>${destinationEmail}</strong> with sample contact data (<em>${mergeTags.firstName} ${mergeTags.lastName}</em>).
    </div>`;

    const finalHtml = testBanner + personalizedHtml;

    const result = await GmailSmtpProvider.send(
      {
        to: destinationEmail,
        fromName,
        fromEmail,
        subject: personalizedSubject,
        html: finalHtml,
        workspaceId,
      },
      { isTest: GmailSmtpProvider.isTestModeEnabled() }
    );

    if (!result.success) {
      const err: any = new Error(
        result.error || "Could not send test email. Please check your Gmail connection in Settings."
      );
      err.statusCode = 502;
      throw err;
    }

    return {
      success: true,
      message: `Test email sent to ${destinationEmail}`,
      messageId: result.messageId,
      sampleDataUsed: {
        firstName: mergeTags.firstName,
        lastName: mergeTags.lastName,
        company: mergeTags.company,
      },
    };
  }
}
