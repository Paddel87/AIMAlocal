import { create } from 'zustand';
import { apiService } from '../services/apiService';

export interface PersonRecognition {
  id: string;
  jobId: string;
  mediaFileId: string;
  timestamp?: number; // for video
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  features: {
    face?: {
      landmarks: number[];
      encoding: number[];
      emotions: Record<string, number>;
    };
    body?: {
      pose: number[];
      clothing: string[];
      accessories: string[];
    };
    voice?: {
      speakerProfile: number[];
      duration: number;
      quality: number;
    };
  };
  detectedAt: Date;
}

export interface AudioTranscription {
  id: string;
  jobId: string;
  mediaFileId: string;
  text: string;
  language: string;
  confidence: number;
  startTime: number;
  endTime: number;
  speakerId?: string;
  keywords: string[];
  sentiment: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  };
  createdAt: Date;
}

export interface PersonDossier {
  id: string;
  currentName: string;
  nameHistory: {
    name: string;
    changedAt: Date;
    changedBy: string;
  }[];
  recognitions: PersonRecognition[];
  transcriptions: AudioTranscription[];
  physicalCharacteristics: {
    height?: number;
    build?: string;
    hairColor?: string;
    eyeColor?: string;
    tattoos: string[];
    piercings: string[];
    scars: string[];
    distinctiveFeatures: string[];
  };
  clothingHistory: {
    jobId: string;
    items: string[];
    style: string;
    materials: string[];
    detectedAt: Date;
  }[];
  voiceProfile: {
    characteristics: string[];
    languages: string[];
    accent?: string;
    speakingPatterns: string[];
  };
  behaviorAnalysis: {
    movementPatterns: string[];
    interactions: string[];
    emotionalStates: Record<string, number>;
    activities: string[];
  };
  socialConnections: {
    personId: string;
    relationshipType: string;
    interactionCount: number;
    lastSeen: Date;
  }[];
  nsfwData: {
    activities: string[];
    preferences: string[];
    contexts: string[];
    restraintMethods: string[];
  };
  statistics: {
    totalAppearances: number;
    totalDuration: number; // in seconds
    firstSeen: Date;
    lastSeen: Date;
    averageConfidence: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface PersonStore {
  persons: PersonDossier[];
  selectedPerson: PersonDossier | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createPerson: (name: string) => string;
  updatePersonName: (id: string, newName: string) => void;
  addRecognition: (personId: string, recognition: PersonRecognition) => void;
  addTranscription: (personId: string, transcription: AudioTranscription) => void;
  mergePerson: (sourceId: string, targetId: string) => void;
  deletePerson: (id: string) => void;
  selectPerson: (person: PersonDossier | null) => void;
  searchPersons: (query: string) => void;
  updatePhysicalCharacteristics: (id: string, characteristics: Partial<PersonDossier['physicalCharacteristics']>) => void;
  addClothingEntry: (id: string, entry: PersonDossier['clothingHistory'][0]) => void;
  fetchPersons: () => Promise<void>;
  clearError: () => void;
}

export const usePersonStore = create<PersonStore>((set, get) => ({
  persons: [
    {
      id: 'person-001',
      currentName: 'Person_001',
      nameHistory: [
        {
          name: 'Person_001',
          changedAt: new Date('2024-01-15T10:30:00'),
          changedBy: 'system'
        }
      ],
      recognitions: [
        {
          id: 'rec-001',
          jobId: 'job-123',
          mediaFileId: 'media-001',
          timestamp: 120,
          confidence: 0.95,
          boundingBox: { x: 100, y: 50, width: 200, height: 300 },
          features: {
            face: {
              landmarks: [1, 2, 3, 4, 5],
              encoding: [0.1, 0.2, 0.3],
              emotions: {
                happy: 0.8,
                neutral: 0.2
              }
            },
            body: {
              pose: [1, 2, 3],
              clothing: ['dress', 'heels'],
              accessories: ['necklace']
            }
          },
          detectedAt: new Date('2024-01-15T10:32:00')
        }
      ],
      transcriptions: [
        {
          id: 'trans-001',
          jobId: 'job-123',
          mediaFileId: 'media-001',
          text: 'Das ist ein Beispieltext für die Transkription.',
          language: 'de',
          confidence: 0.92,
          startTime: 120,
          endTime: 125,
          speakerId: 'person-001',
          keywords: ['Beispiel', 'Transkription'],
          sentiment: {
            score: 0.1,
            label: 'neutral'
          },
          createdAt: new Date('2024-01-15T10:33:00')
        }
      ],
      physicalCharacteristics: {
        height: 165,
        build: 'slim',
        hairColor: 'brown',
        eyeColor: 'blue',
        tattoos: ['small rose on wrist'],
        piercings: ['ears'],
        scars: [],
        distinctiveFeatures: ['dimples when smiling']
      },
      clothingHistory: [
        {
          jobId: 'job-123',
          items: ['black dress', 'high heels', 'silver necklace'],
          style: 'elegant',
          materials: ['silk', 'leather', 'metal'],
          detectedAt: new Date('2024-01-15T10:32:00')
        }
      ],
      voiceProfile: {
        characteristics: ['clear', 'medium pitch'],
        languages: ['German', 'English'],
        accent: 'Northern German',
        speakingPatterns: ['measured pace', 'clear articulation']
      },
      behaviorAnalysis: {
        movementPatterns: ['confident walk', 'expressive gestures'],
        interactions: ['friendly', 'engaging'],
        emotionalStates: {
          happy: 0.6,
          neutral: 0.3,
          surprised: 0.1
        },
        activities: ['conversation', 'posing']
      },
      socialConnections: [],
      nsfwData: {
        activities: [],
        preferences: [],
        contexts: [],
        restraintMethods: []
      },
      statistics: {
        totalAppearances: 1,
        totalDuration: 300,
        firstSeen: new Date('2024-01-15T10:32:00'),
        lastSeen: new Date('2024-01-15T10:37:00'),
        averageConfidence: 0.95
      },
      createdAt: new Date('2024-01-15T10:30:00'),
      updatedAt: new Date('2024-01-15T10:37:00')
    },
    {
      id: 'person-002',
      currentName: 'Person_002',
      nameHistory: [
        {
          name: 'Person_002',
          changedAt: new Date('2024-01-15T11:00:00'),
          changedBy: 'system'
        }
      ],
      recognitions: [],
      transcriptions: [],
      physicalCharacteristics: {
        tattoos: [],
        piercings: [],
        scars: [],
        distinctiveFeatures: []
      },
      clothingHistory: [],
      voiceProfile: {
        characteristics: [],
        languages: [],
        speakingPatterns: []
      },
      behaviorAnalysis: {
        movementPatterns: [],
        interactions: [],
        emotionalStates: {},
        activities: []
      },
      socialConnections: [],
      nsfwData: {
        activities: [],
        preferences: [],
        contexts: [],
        restraintMethods: []
      },
      statistics: {
        totalAppearances: 0,
        totalDuration: 0,
        firstSeen: new Date('2024-01-15T11:00:00'),
        lastSeen: new Date('2024-01-15T11:00:00'),
        averageConfidence: 0
      },
      createdAt: new Date('2024-01-15T11:00:00'),
      updatedAt: new Date('2024-01-15T11:00:00')
    }
  ],
  selectedPerson: null,
  searchQuery: '',
  isLoading: false,
  error: null,

  createPerson: (name) => {
    const newPerson: PersonDossier = {
      id: `person-${Date.now()}`,
      currentName: name,
      nameHistory: [
        {
          name,
          changedAt: new Date(),
          changedBy: 'user'
        }
      ],
      recognitions: [],
      transcriptions: [],
      physicalCharacteristics: {
        tattoos: [],
        piercings: [],
        scars: [],
        distinctiveFeatures: []
      },
      clothingHistory: [],
      voiceProfile: {
        characteristics: [],
        languages: [],
        speakingPatterns: []
      },
      behaviorAnalysis: {
        movementPatterns: [],
        interactions: [],
        emotionalStates: {},
        activities: []
      },
      socialConnections: [],
      nsfwData: {
        activities: [],
        preferences: [],
        contexts: [],
        restraintMethods: []
      },
      statistics: {
        totalAppearances: 0,
        totalDuration: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        averageConfidence: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    set((state) => ({
      persons: [...state.persons, newPerson]
    }));
    
    return newPerson.id;
  },

  updatePersonName: (id, newName) => {
    set((state) => ({
      persons: state.persons.map(person => {
        if (person.id === id) {
          return {
            ...person,
            currentName: newName,
            nameHistory: [
              ...person.nameHistory,
              {
                name: newName,
                changedAt: new Date(),
                changedBy: 'user'
              }
            ],
            updatedAt: new Date()
          };
        }
        return person;
      })
    }));
  },

  addRecognition: (personId, recognition) => {
    set((state) => ({
      persons: state.persons.map(person => {
        if (person.id === personId) {
          const updatedRecognitions = [...person.recognitions, recognition];
          const totalConfidence = updatedRecognitions.reduce((sum, rec) => sum + rec.confidence, 0);
          
          return {
            ...person,
            recognitions: updatedRecognitions,
            statistics: {
              ...person.statistics,
              totalAppearances: updatedRecognitions.length,
              averageConfidence: totalConfidence / updatedRecognitions.length,
              lastSeen: recognition.detectedAt
            },
            updatedAt: new Date()
          };
        }
        return person;
      })
    }));
  },

  addTranscription: (personId, transcription) => {
    set((state) => ({
      persons: state.persons.map(person => {
        if (person.id === personId) {
          return {
            ...person,
            transcriptions: [...person.transcriptions, transcription],
            updatedAt: new Date()
          };
        }
        return person;
      })
    }));
  },

  mergePerson: (sourceId, targetId) => {
    set((state) => {
      const sourcePerson = state.persons.find(p => p.id === sourceId);
      const targetPerson = state.persons.find(p => p.id === targetId);
      
      if (!sourcePerson || !targetPerson) return state;
      
      const mergedPerson: PersonDossier = {
        ...targetPerson,
        recognitions: [...targetPerson.recognitions, ...sourcePerson.recognitions],
        transcriptions: [...targetPerson.transcriptions, ...sourcePerson.transcriptions],
        clothingHistory: [...targetPerson.clothingHistory, ...sourcePerson.clothingHistory],
        nameHistory: [...targetPerson.nameHistory, ...sourcePerson.nameHistory],
        updatedAt: new Date()
      };
      
      return {
        persons: state.persons
          .filter(p => p.id !== sourceId)
          .map(p => p.id === targetId ? mergedPerson : p),
        selectedPerson: state.selectedPerson?.id === sourceId ? null : state.selectedPerson
      };
    });
  },

  deletePerson: (id) => {
    set((state) => ({
      persons: state.persons.filter(person => person.id !== id),
      selectedPerson: state.selectedPerson?.id === id ? null : state.selectedPerson
    }));
  },

  selectPerson: (person) => {
    set({ selectedPerson: person });
  },

  searchPersons: (query) => {
    set({ searchQuery: query });
  },

  updatePhysicalCharacteristics: (id, characteristics) => {
    set((state) => ({
      persons: state.persons.map(person =>
        person.id === id
          ? {
              ...person,
              physicalCharacteristics: {
                ...person.physicalCharacteristics,
                ...characteristics
              },
              updatedAt: new Date()
            }
          : person
      )
    }));
  },

  addClothingEntry: (id, entry) => {
    set((state) => ({
      persons: state.persons.map(person =>
        person.id === id
          ? {
              ...person,
              clothingHistory: [...person.clothingHistory, entry],
              updatedAt: new Date()
            }
          : person
      )
    }));
  },

  fetchPersons: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.makeRequest('/test');
      if (response.success && response.data?.mockPersons) {
        // Convert API data to our format
        const apiPersons = response.data.mockPersons.map((person: any) => ({
          id: person.id,
          name: person.name,
          recognitions: [{
            id: `recognition-${person.id}`,
            confidence: 0.95,
            boundingBox: { x: 100, y: 100, width: 200, height: 200 },
            mediaFileId: `media-${person.id}`,
            timestamp: new Date().toISOString(),
            verified: true
          }],
          transcriptions: [{
            id: `transcription-${person.id}`,
            text: `Sample transcription for ${person.name}`,
            confidence: 0.92,
            language: 'de',
            mediaFileId: `media-${person.id}`,
            timestamp: new Date().toISOString(),
            verified: false
          }],
          totalRecognitions: person.recognitions || 5,
          totalTranscriptions: 3,
          firstSeen: new Date(Date.now() - 86400000).toISOString(),
          lastSeen: new Date().toISOString(),
          tags: ['VIP', 'Frequent'],
          notes: `Person dossier for ${person.name} - automatically generated from API data`,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date().toISOString()
        }));
        set({ persons: apiPersons, isLoading: false });
      } else {
        // Fallback to existing mock data if API fails
        set({ isLoading: false });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch persons' 
      });
    }
  },

  clearError: () => {
    set({ error: null });
  }
}));