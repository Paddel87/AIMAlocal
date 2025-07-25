# AIMA - Artificial Intelligence Media Analysis

![Status](https://img.shields.io/badge/Status-Development-orange)
![Implementation](https://img.shields.io/badge/Implementation-35%25-red)
![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![GPU](https://img.shields.io/badge/GPU-Cloud%20Based-green)
![License](https://img.shields.io/badge/License-Open%20Source-brightgreen)

## 🚨 Aktueller Projektstatus

**⚠️ WICHTIGER HINWEIS: Dieses Projekt befindet sich in einer umfassenden Restrukturierung**

- ✅ **35% implementiert** - Grundlegende Frontend/Backend-Infrastruktur
- 🔶 **15% teilweise implementiert** - GPU-Management und Job-System (nur UI)
- ❌ **50% nicht implementiert** - Kern-ML-Pipeline und echte Funktionalität
- 🔄 **Vollständige Neukonzeption erforderlich** - Aktuelle Implementation nicht produktionstauglich

## 📋 Projektübersicht

AIMA ist ein **modulares, API-first ML/LLM-System** für intelligente Medienanalyse mit GPU-basierter Verarbeitung. Das System nutzt ausschließlich **Open-Source-Modelle** und **selbst-gehostete GPU-Instanzen** für:

- 🎥 **Video- und Fotoanalyse** mit KI-gestützter Objekterkennung
- 👤 **Personenerkennung** mit umfangreichem Dossier-System
- 🗣️ **Audio-Transkription** und Sprachanalyse
- 🤖 **LLM-Integration** für kontextuelle Inhaltsanalyse
- ☁️ **Cloud-GPU-Management** (RunPod, Vast.ai, Lambda Labs)

## 🏗️ Architektur-Prinzipien

### Modulare Microservices-Architektur
```
┌─────────────────┬─────────────────┬─────────────────┐
│   Core Services │   ML Services   │ Infrastructure  │
├─────────────────┼─────────────────┼─────────────────┤
│ • API Gateway   │ • Face Recognition│ • GPU Manager   │
│ • Auth Service  │ • CLIP Analysis │ • Storage Mgmt  │
│ • Job Queue     │ • Whisper STT   │ • Monitoring    │
│ • User Mgmt     │ • LLM Engine    │ • Database      │
└─────────────────┴─────────────────┴─────────────────┘
```

### GPU-Provider-Integration
- **RunPod**: Cloud-GPU-Instanzen für ML-Workloads
- **Vast.ai**: Dezentraler GPU-Marktplatz
- **Lambda Labs**: Spezialisierte ML-Hardware
- **Just-in-Time Provisioning**: Automatische GPU-Aktivierung nur bei Bedarf

## 🎯 Kernfunktionen

### 👥 Intelligente Personenerkennung
- **Multi-modale Erkennung**: Gesicht, Körper, Stimme, Kleidung
- **Automatische ID-Generierung**: Temporäre IDs (Person_001, Person_002)
- **Benutzer-editierbare Zuordnungen**: Vollständige Kontrolle über Personen-IDs
- **Umfangreiches Dossier-System**: Medien-Historie, Audio-Transkripte, Verhaltensmuster
- **Job-ID-Nachverfolgung**: Vollständige Rückverfolgbarkeit aller Erkennungen

### 🔄 Batch-Verarbeitung
- **Intelligente Job-Gruppierung**: Kostenoptimierte Batch-Verarbeitung
- **Automatische Ressourcenzuteilung**: Optimale GPU-Effizienz
- **Prioritäten-System**: Dringende vs. Standard-Verarbeitung
- **Echtzeit-Überwachung**: Live-Status und Kostentracking

### 🤖 LLM-Integration
- **Uncensored Models**: Llama 3.1, Mistral, CodeLlama
- **Multi-modale Analyse**: Text, Bild, Video, Audio
- **Kontextuelle Interpretation**: Intelligente Verknüpfung von ML-Erkennungen
- **Narrative Generierung**: Automatische Berichtserstellung

### 🗣️ Audio-Engine
- **Mehrsprachige Transkription**: 100+ Sprachen mit Whisper
- **Sprecher-Identifikation**: Automatische Trennung verschiedener Sprecher
- **Emotionsanalyse**: KI-basierte Stimmungserkennung
- **Zeitstempel-Synchronisation**: Präzise Audio-Text-Zuordnung

## 🛠️ Technologie-Stack

### Backend
- **Node.js/TypeScript** - API-Services
- **PostgreSQL** - Primäre Datenbank
- **Redis** - Caching und Job-Queue
- **Docker** - Containerisierung
- **Prisma** - Database ORM

### Frontend
- **React 18** - UI-Framework
- **TypeScript** - Type Safety
- **Tailwind CSS** - Styling
- **Zustand** - State Management
- **Vite** - Build Tool

### ML/AI Stack
- **PyTorch** - ML-Framework
- **CUDA** - GPU-Acceleration
- **FaceNet/ArcFace** - Gesichtserkennung
- **CLIP** - Multi-modale Analyse
- **Whisper** - Audio-Transkription
- **vLLM** - LLM-Inference

### Infrastructure
- **Docker Compose** - Orchestrierung
- **NGINX** - Reverse Proxy
- **Prometheus/Grafana** - Monitoring
- **MinIO** - Object Storage

## 🚀 Schnellstart (Entwicklung)

### Voraussetzungen
- Node.js 18+
- Docker & Docker Compose
- Git

### Installation
```bash
# Repository klonen
git clone https://github.com/your-org/AIMAS_AIDev.git
cd AIMAS_AIDev

# Dependencies installieren
npm install
cd server && npm install && cd ..

# Umgebungsvariablen konfigurieren
cp .env.example .env
cp server/.env.example server/.env

# Datenbank starten
docker-compose up -d postgres redis

# Backend starten
cd server && npm run dev

# Frontend starten (neues Terminal)
npm run dev
```

### Zugriff
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Dokumentation**: http://localhost:3001/docs

## 📊 Implementierungsstatus

### ✅ Vollständig Implementiert (35%)
- Frontend-Grundstruktur (Dashboard, Navigation, Layout)
- Backend-Infrastruktur (API-Routen, Authentifizierung, WebSocket)
- Entwicklungsumgebung (Docker, Testing, CI/CD)

### 🔶 Teilweise Implementiert (15%)
- GPU-Management (UI vorhanden, keine echten Provider-APIs)
- Job-Management (UI vorhanden, keine Batch-Optimierung)
- Person-Dossiers (UI vorhanden, keine ML-Integration)

### ❌ Nicht Implementiert (50%)
- **Kern-ML-Pipeline**: Keine LLM-Integration
- **Spezialisierte ML-Tools**: FaceNet, CLIP, Whisper fehlen
- **Plugin-Architektur**: Keine modulare Erweiterbarkeit
- **Cloud-Integration**: Keine Dropbox/Mega-Anbindung
- **Audio-Engine**: Keine Whisper-Integration

## 🗺️ Roadmap

### Phase 1: Fundament (4-6 Wochen)
- [ ] Microservices-Architektur
- [ ] ML-Pipeline-Foundation
- [ ] GPU-Ressourcen-Scheduler
- [ ] Daten-Management-System

### Phase 2: ML-Integration (6-8 Wochen)
- [ ] FaceNet/ArcFace Gesichtserkennung
- [ ] CLIP Multi-modale Analyse
- [ ] Whisper Audio-Transkription
- [ ] LLM-Engine (Llama, Mistral)

### Phase 3: GPU-Provider (4-6 Wochen)
- [ ] RunPod API Integration
- [ ] Vast.ai API Integration
- [ ] Just-in-Time GPU Provisioning
- [ ] Cost Optimization

### Phase 4: Erweiterte Features (6-8 Wochen)
- [ ] Cloud-Integration (Dropbox, Mega)
- [ ] Plugin-System
- [ ] Advanced Analytics
- [ ] Timeline Analysis

## 🤝 Beitragen

**⚠️ Hinweis**: Das Projekt befindet sich in einer umfassenden Restrukturierung. Beiträge sind willkommen, aber bitte beachten Sie den aktuellen Entwicklungsstatus.

### Entwicklung
1. Fork des Repositories
2. Feature-Branch erstellen (`git checkout -b feature/amazing-feature`)
3. Änderungen committen (`git commit -m 'Add amazing feature'`)
4. Branch pushen (`git push origin feature/amazing-feature`)
5. Pull Request erstellen

### Code-Qualität
- TypeScript Strict Mode
- ESLint + Prettier
- Unit Tests (Vitest)
- E2E Tests (Playwright)

## 📄 Lizenz

Dieses Projekt steht unter der MIT-Lizenz. Siehe [LICENSE](LICENSE) für Details.

## 🔗 Links

- **Dokumentation**: [Vollständige Restrukturierung](.trae/documents/AIMA_Vollständige_Restrukturierung.md)
- **PRD**: [ML Video Foto Analysesystem](.trae/documents/ML_Video_Foto_Analysesystem_PRD.md)
- **Implementierungsanalyse**: [PRD Umsetzungsanalyse](.trae/documents/AIMA_PRD_Umsetzungsanalyse.md)

## ⚠️ Disclaimer

Dieses System ist für die Analyse von Medieninhalten konzipiert und nutzt uncensored ML/LLM-Modelle. Benutzer sind für die Einhaltung lokaler Gesetze und Vorschriften verantwortlich.

---

**Status**: 🔄 In aktiver Entwicklung | **Letzte Aktualisierung**: Dezember 2024
