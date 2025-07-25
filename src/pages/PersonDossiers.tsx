import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Eye, 
  Edit3, 
  Trash2, 
  MoreVertical,
  User,
  Calendar,
  Clock,
  MapPin,
  Mic,
  Camera,
  FileText,
  TrendingUp,
  Volume2
} from 'lucide-react';
import { usePersonStore, type PersonDossier } from '../stores/usePersonStore';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface PersonCardProps {
  person: PersonDossier;
  onSelect: (person: PersonDossier) => void;
  onEdit: (person: PersonDossier) => void;
  onDelete: (id: string) => void;
}

function PersonCard({ person, onSelect, onEdit, onDelete }: PersonCardProps) {
  const [showActions, setShowActions] = useState(false);

  const totalRecognitions = person.recognitions.length;
  const totalTranscriptions = person.transcriptions.length;
  const averageConfidence = person.statistics.averageConfidence;
  const daysSinceFirstSeen = Math.floor(
    (new Date().getTime() - person.statistics.firstSeen.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{person.currentName}</h3>
              <p className="text-sm text-gray-500">
                Created {format(person.createdAt, 'MMM dd, yyyy')}
              </p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showActions && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                <button
                  onClick={() => {
                    onSelect(person);
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Dossier
                </button>
                <button
                  onClick={() => {
                    onEdit(person);
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Person
                </button>
                <button
                  onClick={() => {
                    onDelete(person.id);
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Person
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Camera className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Recognitions</span>
              </div>
              <span className="text-lg font-bold text-blue-900">{totalRecognitions}</span>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mic className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Transcriptions</span>
              </div>
              <span className="text-lg font-bold text-green-900">{totalTranscriptions}</span>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">Confidence</span>
              </div>
              <span className="text-lg font-bold text-purple-900">
                {(averageConfidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">Duration</span>
              </div>
              <span className="text-lg font-bold text-orange-900">
                {Math.floor(person.statistics.totalDuration / 60)}m
              </span>
            </div>
          </div>
        </div>

        {/* Physical Characteristics */}
        {(person.physicalCharacteristics.height || 
          person.physicalCharacteristics.hairColor || 
          person.physicalCharacteristics.eyeColor) && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Physical Characteristics</h4>
            <div className="flex flex-wrap gap-2">
              {person.physicalCharacteristics.height && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                  {person.physicalCharacteristics.height}cm
                </span>
              )}
              {person.physicalCharacteristics.hairColor && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                  {person.physicalCharacteristics.hairColor} hair
                </span>
              )}
              {person.physicalCharacteristics.eyeColor && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                  {person.physicalCharacteristics.eyeColor} eyes
                </span>
              )}
              {person.physicalCharacteristics.tattoos.length > 0 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                  {person.physicalCharacteristics.tattoos.length} tattoo(s)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Activity</h4>
          <div className="space-y-2">
            {person.recognitions.slice(-2).map((recognition) => (
              <div key={recognition.id} className="flex items-center space-x-2 text-sm text-gray-600">
                <Camera className="h-3 w-3" />
                <span>Recognition in {recognition.jobId}</span>
                <span className="text-xs text-gray-400">
                  {format(recognition.detectedAt, 'MMM dd, HH:mm')}
                </span>
              </div>
            ))}
            {person.transcriptions.slice(-1).map((transcription) => (
              <div key={transcription.id} className="flex items-center space-x-2 text-sm text-gray-600">
                <Mic className="h-3 w-3" />
                <span className="truncate">"${transcription.text.substring(0, 30)}..."</span>
                <span className="text-xs text-gray-400">
                  {format(transcription.createdAt, 'MMM dd, HH:mm')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>{daysSinceFirstSeen} days ago</span>
            </span>
            <span className="flex items-center space-x-1">
              <MapPin className="h-4 w-4" />
              <span>{person.statistics.totalAppearances} appearances</span>
            </span>
          </div>
          <button
            onClick={() => onSelect(person)}
            className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
          >
            View Dossier
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PersonDossiers() {
  const { 
    persons, 
    selectedPerson, 
    searchQuery, 
    selectPerson, 
    searchPersons, 
    deletePerson,
    updatePersonName
  } = usePersonStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonDossier | null>(null);
  const [newPersonName, setNewPersonName] = useState('');
  const [editName, setEditName] = useState('');

  // Filter persons based on search
  const filteredPersons = persons.filter(person => 
    person.currentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    person.physicalCharacteristics.distinctiveFeatures.some(feature => 
      feature.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Statistics
  const totalPersons = persons.length;
  const totalRecognitions = persons.reduce((sum, person) => sum + person.recognitions.length, 0);
  const totalTranscriptions = persons.reduce((sum, person) => sum + person.transcriptions.length, 0);
  const averageConfidence = persons.length > 0 
    ? persons.reduce((sum, person) => sum + person.statistics.averageConfidence, 0) / persons.length
    : 0;

  const handleCreatePerson = () => {
    if (newPersonName.trim()) {
      // In real implementation, this would call createPerson from store
      setNewPersonName('');
      setShowCreateModal(false);
    }
  };

  const handleEditPerson = (person: PersonDossier) => {
    setEditingPerson(person);
    setEditName(person.currentName);
  };

  const handleSaveEdit = () => {
    if (editingPerson && editName.trim()) {
      updatePersonName(editingPerson.id, editName.trim());
      setEditingPerson(null);
      setEditName('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Person Dossiers</h1>
          <p className="text-gray-600 mt-1">Manage and view person recognition data</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Person
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Persons</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalPersons}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Recognitions</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{totalRecognitions}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Camera className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Transcriptions</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{totalTranscriptions}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Mic className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Confidence</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {(averageConfidence * 100).toFixed(0)}%
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Personen nach Name oder Eigenschaften suchen..."
            value={searchQuery}
            onChange={(e) => searchPersons(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Persons Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredPersons.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            onSelect={selectPerson}
            onEdit={handleEditPerson}
            onDelete={deletePerson}
          />
        ))}
      </div>

      {filteredPersons.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No persons found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery 
              ? 'Try adjusting your search criteria'
              : 'Person dossiers will appear here as they are recognized in your media'
            }
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Person
            </button>
          )}
        </div>
      )}

      {/* Person Details Modal */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedPerson.currentName}</h2>
                    <p className="text-gray-600">Person Dossier</p>
                  </div>
                </div>
                <button
                  onClick={() => selectPerson(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Statistics */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
                    Statistics
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Appearances:</span>
                      <span className="font-medium">{selectedPerson.statistics.totalAppearances}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Duration:</span>
                      <span className="font-medium">
                        {Math.floor(selectedPerson.statistics.totalDuration / 60)}m {selectedPerson.statistics.totalDuration % 60}s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average Confidence:</span>
                      <span className="font-medium">
                        {(selectedPerson.statistics.averageConfidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">First Seen:</span>
                      <span className="font-medium">
                        {format(selectedPerson.statistics.firstSeen, 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Seen:</span>
                      <span className="font-medium">
                        {format(selectedPerson.statistics.lastSeen, 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Physical Characteristics */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <User className="h-5 w-5 mr-2 text-green-600" />
                    Physical Characteristics
                  </h3>
                  <div className="space-y-3">
                    {selectedPerson.physicalCharacteristics.height && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Height:</span>
                        <span className="font-medium">{selectedPerson.physicalCharacteristics.height}cm</span>
                      </div>
                    )}
                    {selectedPerson.physicalCharacteristics.build && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Build:</span>
                        <span className="font-medium">{selectedPerson.physicalCharacteristics.build}</span>
                      </div>
                    )}
                    {selectedPerson.physicalCharacteristics.hairColor && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Hair Color:</span>
                        <span className="font-medium">{selectedPerson.physicalCharacteristics.hairColor}</span>
                      </div>
                    )}
                    {selectedPerson.physicalCharacteristics.eyeColor && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Eye Color:</span>
                        <span className="font-medium">{selectedPerson.physicalCharacteristics.eyeColor}</span>
                      </div>
                    )}
                    {selectedPerson.physicalCharacteristics.tattoos.length > 0 && (
                      <div>
                        <span className="text-gray-600">Tattoos:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {selectedPerson.physicalCharacteristics.tattoos.map((tattoo, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                              {tattoo}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Voice Profile */}
                {selectedPerson.voiceProfile.languages.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <Volume2 className="h-5 w-5 mr-2 text-purple-600" />
                      Voice Profile
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-gray-600">Languages:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {selectedPerson.voiceProfile.languages.map((language, index) => (
                            <span key={index} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                              {language}
                            </span>
                          ))}
                        </div>
                      </div>
                      {selectedPerson.voiceProfile.accent && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Accent:</span>
                          <span className="font-medium">{selectedPerson.voiceProfile.accent}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Transcriptions */}
                {selectedPerson.transcriptions.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-orange-600" />
                      Recent Transcriptions
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedPerson.transcriptions.slice(-5).map((transcription) => (
                        <div key={transcription.id} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-900 mb-1">"{transcription.text}"</p>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Job: {transcription.jobId}</span>
                            <span>{format(transcription.createdAt, 'MMM dd, HH:mm')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Person Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Add New Person</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Person Name
                  </label>
                  <input
                    type="text"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    placeholder="Personenname eingeben..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePerson}
                disabled={!newPersonName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Person
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Person Modal */}
      {editingPerson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Edit Person</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Person Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setEditingPerson(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}