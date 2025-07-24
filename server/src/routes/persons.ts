import { Router } from 'express';
import {
  getPersonDossiers,
  getPersonDossierById,
  createPersonDossier,
  updatePersonDossier,
  deletePersonDossier,
  getPersonRecognitions,
  getPersonTranscriptions,
  searchPersons,
  getPersonStats,
} from '../controllers/personController';
import { authenticate, selfOrAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Validation schemas
const getPersonDossiersSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    search: z.string().optional(),
    userId: z.string().uuid().optional(),
  }),
});

const createPersonDossierSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    knownAliases: z.array(z.string()).optional(),
    referenceImageUrl: z.string().url().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

const updatePersonDossierSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    knownAliases: z.array(z.string()).optional(),
    referenceImageUrl: z.string().url().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

const personDossierIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid person dossier ID'),
  }),
});

const getPersonRecognitionsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    minConfidence: z.string().regex(/^\d*\.?\d+$/).optional(),
  }),
});

const getPersonTranscriptionsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    minConfidence: z.string().regex(/^\d*\.?\d+$/).optional(),
  }),
});

const searchPersonsSchema = z.object({
  query: z.object({
    q: z.string().min(2, 'Search query must be at least 2 characters'),
    type: z.enum(['all', 'dossiers', 'transcriptions']).optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

// Routes
router.get('/', authenticate, validate(getPersonDossiersSchema), getPersonDossiers);
router.get('/search', authenticate, validate(searchPersonsSchema), searchPersons);
router.get('/stats', authenticate, getPersonStats);
router.get('/:id', authenticate, validate(personDossierIdSchema), getPersonDossierById);
router.get('/:id/recognitions', 
  authenticate, 
  validate(personDossierIdSchema.merge(getPersonRecognitionsSchema)), 
  getPersonRecognitions
);
router.get('/:id/transcriptions', 
  authenticate, 
  validate(personDossierIdSchema.merge(getPersonTranscriptionsSchema)), 
  getPersonTranscriptions
);

router.post('/', authenticate, validate(createPersonDossierSchema), createPersonDossier);

router.put('/:id', 
  authenticate, 
  selfOrAdmin, 
  validate(personDossierIdSchema.merge(updatePersonDossierSchema)), 
  updatePersonDossier
);

router.delete('/:id', 
  authenticate, 
  selfOrAdmin, 
  validate(personDossierIdSchema), 
  deletePersonDossier
);

export default router;