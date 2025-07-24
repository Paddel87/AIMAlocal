import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import axios from 'axios';
import { 
  NotFoundError, 
  AuthorizationError, 
  ValidationError,
  ConflictError,
  ExternalServiceError,
  asyncHandler 
} from '../middleware/errorHandler';
import { UserRole, WebhookStatus, WebhookEvent } from '@prisma/client';

// Get all webhooks
export const getWebhooks = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, status, event } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Build where clause
  const where: any = {};
  
  // Non-admin users can only see their own webhooks
  if (currentUser.role !== UserRole.ADMIN) {
    where.userId = currentUser.id;
  }

  if (status && Object.values(WebhookStatus).includes(status as WebhookStatus)) {
    where.status = status as WebhookStatus;
  }

  if (event && Object.values(WebhookEvent).includes(event as WebhookEvent)) {
    where.events = {
      has: event as WebhookEvent,
    };
  }

  const [webhooks, total] = await Promise.all([
    prisma.webhook.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
    }),
    prisma.webhook.count({ where }),
  ]);

  const totalPages = Math.ceil(total / take);

  res.json({
    success: true,
    data: {
      webhooks,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    },
  });
});

// Get webhook by ID
export const getWebhookById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const webhook = await prisma.webhook.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      deliveries: {
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!webhook) {
    throw new NotFoundError('Webhook not found');
  }

  // Check if user can access this webhook
  if (currentUser.role !== UserRole.ADMIN && webhook.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  res.json({
    success: true,
    data: { webhook },
  });
});

// Create new webhook
export const createWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { url, events, secret, description } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new ValidationError('Invalid webhook URL');
  }

  // Validate events
  if (!Array.isArray(events) || events.length === 0) {
    throw new ValidationError('At least one event must be specified');
  }

  const invalidEvents = events.filter(event => !Object.values(WebhookEvent).includes(event));
  if (invalidEvents.length > 0) {
    throw new ValidationError(`Invalid events: ${invalidEvents.join(', ')}`);
  }

  // Check if webhook with same URL already exists for this user
  const existingWebhook = await prisma.webhook.findFirst({
    where: {
      url,
      userId: currentUser.id,
    },
  });

  if (existingWebhook) {
    throw new ConflictError('Webhook with this URL already exists');
  }

  // Generate secret if not provided
  const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

  const webhook = await prisma.webhook.create({
    data: {
      url,
      events,
      secret: webhookSecret,
      description,
      userId: currentUser.id,
      status: WebhookStatus.ACTIVE,
    },
  });

  logger.info('Webhook created', {
    webhookId: webhook.id,
    url: webhook.url,
    events: webhook.events,
    userId: currentUser.id,
  });

  res.status(201).json({
    success: true,
    message: 'Webhook created successfully',
    data: { webhook },
  });
});

// Update webhook
export const updateWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { url, events, secret, description, status } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const webhook = await prisma.webhook.findUnique({
    where: { id },
  });

  if (!webhook) {
    throw new NotFoundError('Webhook not found');
  }

  // Check if user can update this webhook
  if (currentUser.role !== UserRole.ADMIN && webhook.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  // Validate URL if provided
  if (url) {
    try {
      new URL(url);
    } catch {
      throw new ValidationError('Invalid webhook URL');
    }

    // Check for conflicts if URL is being changed
    if (url !== webhook.url) {
      const existingWebhook = await prisma.webhook.findFirst({
        where: {
          url,
          userId: webhook.userId,
          id: { not: id },
        },
      });

      if (existingWebhook) {
        throw new ConflictError('Webhook with this URL already exists');
      }
    }
  }

  // Validate events if provided
  if (events) {
    if (!Array.isArray(events) || events.length === 0) {
      throw new ValidationError('At least one event must be specified');
    }

    const invalidEvents = events.filter(event => !Object.values(WebhookEvent).includes(event));
    if (invalidEvents.length > 0) {
      throw new ValidationError(`Invalid events: ${invalidEvents.join(', ')}`);
    }
  }

  // Validate status if provided
  if (status && !Object.values(WebhookStatus).includes(status)) {
    throw new ValidationError('Invalid webhook status');
  }

  const updatedWebhook = await prisma.webhook.update({
    where: { id },
    data: {
      ...(url && { url }),
      ...(events && { events }),
      ...(secret && { secret }),
      ...(description !== undefined && { description }),
      ...(status && { status }),
      updatedAt: new Date(),
    },
  });

  // Invalidate cache
  await redis.del(`webhook:${id}`);

  res.json({
    success: true,
    message: 'Webhook updated successfully',
    data: { webhook: updatedWebhook },
  });
});

// Delete webhook
export const deleteWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const webhook = await prisma.webhook.findUnique({
    where: { id },
  });

  if (!webhook) {
    throw new NotFoundError('Webhook not found');
  }

  // Check if user can delete this webhook
  if (currentUser.role !== UserRole.ADMIN && webhook.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  // Delete webhook and related deliveries (cascade delete)
  await prisma.webhook.delete({
    where: { id },
  });

  // Invalidate cache
  await redis.del(`webhook:${id}`);

  logger.info('Webhook deleted', {
    webhookId: id,
    url: webhook.url,
    userId: webhook.userId,
  });

  res.json({
    success: true,
    message: 'Webhook deleted successfully',
  });
});

// Test webhook
export const testWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const webhook = await prisma.webhook.findUnique({
    where: { id },
  });

  if (!webhook) {
    throw new NotFoundError('Webhook not found');
  }

  // Check if user can test this webhook
  if (currentUser.role !== UserRole.ADMIN && webhook.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  if (webhook.status !== WebhookStatus.ACTIVE) {
    throw new ValidationError('Webhook must be active to test');
  }

  // Create test payload
  const testPayload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook delivery',
      webhook_id: webhook.id,
      user_id: webhook.userId,
    },
  };

  try {
    // Send test webhook
    const result = await sendWebhook(webhook, testPayload, 'webhook.test');
    
    res.json({
      success: true,
      message: 'Test webhook sent successfully',
      data: {
        delivery: result,
      },
    });
  } catch (error) {
    logger.error('Test webhook failed', {
      webhookId: webhook.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw new ExternalServiceError('Failed to send test webhook');
  }
});

// Get webhook deliveries
export const getWebhookDeliveries = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 10, status } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const webhook = await prisma.webhook.findUnique({
    where: { id },
  });

  if (!webhook) {
    throw new NotFoundError('Webhook not found');
  }

  // Check access
  if (currentUser.role !== UserRole.ADMIN && webhook.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: any = { webhookId: id };
  if (status) {
    where.success = status === 'success';
  }

  const [deliveries, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.webhookDelivery.count({ where }),
  ]);

  const totalPages = Math.ceil(total / take);

  res.json({
    success: true,
    data: {
      deliveries,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    },
  });
});

// Retry webhook delivery
export const retryWebhookDelivery = asyncHandler(async (req: Request, res: Response) => {
  const { id, deliveryId } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const webhook = await prisma.webhook.findUnique({
    where: { id },
  });

  if (!webhook) {
    throw new NotFoundError('Webhook not found');
  }

  // Check access
  if (currentUser.role !== UserRole.ADMIN && webhook.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery || delivery.webhookId !== id) {
    throw new NotFoundError('Webhook delivery not found');
  }

  if (delivery.success) {
    throw new ValidationError('Cannot retry successful delivery');
  }

  if (webhook.status !== WebhookStatus.ACTIVE) {
    throw new ValidationError('Webhook must be active to retry delivery');
  }

  try {
    // Retry the webhook delivery
    const result = await sendWebhook(webhook, delivery.payload, delivery.event);
    
    res.json({
      success: true,
      message: 'Webhook delivery retried successfully',
      data: {
        delivery: result,
      },
    });
  } catch (error) {
    logger.error('Webhook retry failed', {
      webhookId: webhook.id,
      deliveryId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw new ExternalServiceError('Failed to retry webhook delivery');
  }
});

// Get webhook statistics
export const getWebhookStats = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const where = currentUser.role === UserRole.ADMIN ? {} : { userId: currentUser.id };

  const [totalWebhooks, activeWebhooks, deliveryStats, recentDeliveries] = await Promise.all([
    prisma.webhook.count({ where }),
    prisma.webhook.count({ 
      where: { 
        ...where, 
        status: WebhookStatus.ACTIVE 
      } 
    }),
    prisma.webhookDelivery.groupBy({
      by: ['success'],
      where: {
        webhook: where,
      },
      _count: { id: true },
    }),
    prisma.webhookDelivery.findMany({
      where: {
        webhook: where,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        webhook: {
          select: {
            id: true,
            url: true,
          },
        },
      },
    }),
  ]);

  const successfulDeliveries = deliveryStats.find(stat => stat.success)?._count.id || 0;
  const failedDeliveries = deliveryStats.find(stat => !stat.success)?._count.id || 0;
  const totalDeliveries = successfulDeliveries + failedDeliveries;
  const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

  res.json({
    success: true,
    data: {
      totalWebhooks,
      activeWebhooks,
      deliveryStats: {
        total: totalDeliveries,
        successful: successfulDeliveries,
        failed: failedDeliveries,
        successRate: Math.round(successRate * 100) / 100,
      },
      recentDeliveries,
    },
  });
});

// Helper function to send webhook
export async function sendWebhook(webhook: any, payload: any, event: string) {
  const timestamp = Date.now().toString();
  const body = JSON.stringify(payload);
  
  // Create signature
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(timestamp + body)
    .digest('hex');

  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Event': event,
    'User-Agent': 'AIMAS-Webhook/1.0',
  };

  const startTime = Date.now();
  let delivery;

  try {
    const response = await axios.post(webhook.url, payload, {
      headers,
      timeout: 30000, // 30 seconds
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    const responseTime = Date.now() - startTime;
    const success = response.status >= 200 && response.status < 300;

    // Record delivery
    delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload,
        success,
        statusCode: response.status,
        responseBody: response.data,
        responseTime,
        error: success ? null : `HTTP ${response.status}: ${response.statusText}`,
      },
    });

    if (success) {
      logger.info('Webhook delivered successfully', {
        webhookId: webhook.id,
        deliveryId: delivery.id,
        statusCode: response.status,
        responseTime,
      });
    } else {
      logger.warn('Webhook delivery failed', {
        webhookId: webhook.id,
        deliveryId: delivery.id,
        statusCode: response.status,
        error: delivery.error,
      });
    }

    return delivery;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Record failed delivery
    delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload,
        success: false,
        statusCode: 0,
        responseBody: null,
        responseTime,
        error: errorMessage,
      },
    });

    logger.error('Webhook delivery error', {
      webhookId: webhook.id,
      deliveryId: delivery.id,
      error: errorMessage,
    });

    throw error;
  }
}

// Helper function to trigger webhook for events
export async function triggerWebhook(event: WebhookEvent, payload: any, userId?: string) {
  try {
    const where: any = {
      status: WebhookStatus.ACTIVE,
      events: {
        has: event,
      },
    };

    if (userId) {
      where.userId = userId;
    }

    const webhooks = await prisma.webhook.findMany({
      where,
    });

    const deliveryPromises = webhooks.map(webhook => 
      sendWebhook(webhook, payload, event).catch(error => {
        logger.error('Failed to send webhook', {
          webhookId: webhook.id,
          event,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      })
    );

    await Promise.allSettled(deliveryPromises);
  } catch (error) {
    logger.error('Failed to trigger webhooks', {
      event,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}