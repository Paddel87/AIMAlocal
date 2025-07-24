import { Router } from 'express';
import {
  getWebhooks,
  getWebhookById,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
  retryWebhookDelivery,
  getWebhookStats,
} from '../controllers/webhookController';
import { authenticate, selfOrAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { WebhookStatus, WebhookEvent } from '@prisma/client';

const router = Router();

// Validation schemas
const getWebhooksSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    status: z.nativeEnum(WebhookStatus).optional(),
    event: z.nativeEnum(WebhookEvent).optional(),
  }),
});

const createWebhookSchema = z.object({
  body: z.object({
    url: z.string().url('Invalid webhook URL'),
    events: z.array(z.nativeEnum(WebhookEvent)).min(1, 'At least one event must be specified'),
    secret: z.string().min(16).optional(),
    description: z.string().optional(),
  }),
});

const updateWebhookSchema = z.object({
  body: z.object({
    url: z.string().url().optional(),
    events: z.array(z.nativeEnum(WebhookEvent)).min(1).optional(),
    secret: z.string().min(16).optional(),
    description: z.string().optional(),
    status: z.nativeEnum(WebhookStatus).optional(),
  }),
});

const webhookIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid webhook ID'),
  }),
});

const getWebhookDeliveriesSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    status: z.enum(['success', 'failed']).optional(),
  }),
});

const deliveryIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid webhook ID'),
    deliveryId: z.string().uuid('Invalid delivery ID'),
  }),
});

// Routes
router.get('/', authenticate, validate(getWebhooksSchema), getWebhooks);
router.get('/stats', authenticate, getWebhookStats);
router.get('/:id', authenticate, validate(webhookIdSchema), getWebhookById);
router.get('/:id/deliveries', 
  authenticate, 
  validate(webhookIdSchema.merge(getWebhookDeliveriesSchema)), 
  getWebhookDeliveries
);

router.post('/', authenticate, validate(createWebhookSchema), createWebhook);
router.post('/:id/test', authenticate, validate(webhookIdSchema), testWebhook);
router.post('/:id/deliveries/:deliveryId/retry', 
  authenticate, 
  selfOrAdmin, 
  validate(deliveryIdSchema), 
  retryWebhookDelivery
);

router.put('/:id', 
  authenticate, 
  selfOrAdmin, 
  validate(webhookIdSchema.merge(updateWebhookSchema)), 
  updateWebhook
);

router.delete('/:id', 
  authenticate, 
  selfOrAdmin, 
  validate(webhookIdSchema), 
  deleteWebhook
);

export default router;