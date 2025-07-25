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
  persons: [],
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
      const response = await apiService.makeRequest('/persons');
      if (response.success && response.data) {
        // Use real API data from /persons endpoint
        const apiPersons: PersonDossier[] = response.data.persons?.map((person: any) => ({
          id: person.id,
          currentName: person.currentName || person.name || 'Unknown Person',
          nameHistory: person.nameHistory || [{
            name: person.currentName || person.name || 'Unknown Person',
            changedAt: new Date(person.createdAt || Date.now()),
            changedBy: 'system'
          }],
          recognitions: person.recognitions || [],
          transcriptions: person.transcriptions || [],
          physicalCharacteristics: person.physicalCharacteristics || {
             height: null,
             build: 'unknown',
             hairColor: 'unknown',
             eyeColor: 'unknown',
             tattoos: [],
             piercings: [],
             scars: [],
             distinctiveFeatures: []
           },
          clothingHistory: person.clothingHistory || [],
          statistics: person.statistics || {
              totalAppearances: person.recognitions?.length || 0,
              totalDuration: 0,
              firstSeen: new Date(person.createdAt || Date.now()),
              lastSeen: new Date(person.updatedAt || Date.now()),
              averageConfidence: 0
            },
           voiceProfile: person.voiceProfile || {
              characteristics: [],
              languages: [],
              accent: 'unknown',
              speakingPatterns: []
            },
           behaviorAnalysis: person.behaviorAnalysis || {
              movementPatterns: [],
              interactions: [],
              emotionalStates: {},
              activities: []
            },
           socialConnections: person.socialConnections || [],
           nsfwData: person.nsfwData || {
              activities: [],
              preferences: [],
              contexts: [],
              restraintMethods: []
            },
           tags: person.tags || [],
           notes: person.notes || '',
           createdAt: new Date(person.createdAt || Date.now()),
           updatedAt: new Date(person.updatedAt || Date.now())
        })) || [];
        set({ persons: apiPersons, isLoading: false });
      } else {
        // If no real data available, clear persons array
        set({ persons: [], isLoading: false });
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