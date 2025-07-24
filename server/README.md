# AIMA Server

**AI Media Analysis Server** - A powerful backend service for AI-powered media analysis, face recognition, voice recognition, and GPU instance management.

## 🚀 Features

- **User Management**: Complete authentication system with JWT tokens and role-based access control
- **Media Processing**: Upload, analyze, and manage images, videos, and audio files
- **AI Analysis**: 
  - Face recognition and identification
  - Voice recognition and speaker identification
  - Object detection
  - Audio transcription
- **GPU Management**: Provision and manage GPU instances from multiple cloud providers
- **Person Dossiers**: Create and manage person profiles with face and voice embeddings
- **Job Queue**: Asynchronous processing of ML tasks with real-time progress tracking
- **WebSocket Support**: Real-time notifications and updates
- **Caching**: Redis-based caching for improved performance
- **File Storage**: Support for local and cloud storage providers
- **API Documentation**: Comprehensive REST API with validation

## 🛠 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Authentication**: JWT with bcrypt
- **File Processing**: Sharp (images), FFmpeg (video/audio)
- **Real-time**: Socket.IO
- **Validation**: Zod + express-validator
- **Testing**: Jest
- **Containerization**: Docker

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- PostgreSQL 14+
- Redis 6+
- FFmpeg (for video/audio processing)
- Docker & Docker Compose (optional)

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd server
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/aima_db"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secrets
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"

# Other configurations...
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed the database with sample data
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`

## 🐳 Docker Setup

### Using Docker Compose (Recommended)

```bash
# From the project root
docker-compose up -d
```

This will start:
- PostgreSQL database
- Redis cache
- AIMA server
- Frontend (if configured)
- MinIO (local S3-compatible storage)
- Adminer (database management)
- Redis Commander (Redis management)

### Manual Docker Build

```bash
# Build the image
npm run docker:build

# Run the container
npm run docker:run
```

## 📚 API Documentation

### Base URL
```
http://localhost:3001/api
```

### Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | User registration |
| `POST /api/auth/login` | User login |
| `GET /api/auth/profile` | Get user profile |
| `POST /api/media/upload` | Upload media files |
| `GET /api/media` | List user's media files |
| `POST /api/jobs` | Create analysis job |
| `GET /api/jobs` | List user's jobs |
| `POST /api/persons` | Create person dossier |
| `GET /api/persons` | List person dossiers |
| `POST /api/gpu` | Create GPU instance |
| `GET /api/gpu` | List GPU instances |

### Example Requests

#### Register a new user
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

#### Upload a media file
```bash
curl -X POST http://localhost:3001/api/media/upload \
  -H "Authorization: Bearer <your-token>" \
  -F "file=@/path/to/image.jpg"
```

#### Create a face recognition job
```bash
curl -X POST http://localhost:3001/api/jobs \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Face Recognition Analysis",
    "type": "FACE_RECOGNITION",
    "mediaFileIds": ["media-file-id"],
    "config": {
      "threshold": 0.8
    }
  }'
```

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with sample data
npm run db:studio    # Open Prisma Studio
npm run db:reset     # Reset database (development only)

# Testing
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
npm run type-check   # TypeScript type checking
npm run check        # Run type-check and lint
```

### Project Structure

```
src/
├── config/          # Configuration files
│   ├── database.ts  # Database configuration
│   └── redis.ts     # Redis configuration
├── controllers/     # Route controllers
│   ├── authController.ts
│   ├── jobController.ts
│   ├── mediaController.ts
│   ├── gpuController.ts
│   └── personController.ts
├── middleware/      # Express middleware
│   ├── auth.ts      # Authentication middleware
│   ├── validation.ts # Request validation
│   ├── rateLimiting.ts # Rate limiting
│   └── errorHandler.ts # Error handling
├── routes/          # API routes
│   ├── auth.ts
│   ├── jobs.ts
│   ├── media.ts
│   ├── gpu.ts
│   ├── persons.ts
│   ├── users.ts
│   └── webhooks.ts
├── services/        # Business logic services
│   ├── authService.ts
│   ├── jobService.ts
│   ├── mediaService.ts
│   └── gpuService.ts
├── utils/           # Utility functions
│   ├── logger.ts    # Logging utility
│   ├── validation.ts # Validation schemas
│   └── helpers.ts   # Helper functions
├── types/           # TypeScript type definitions
├── server.ts        # Express server setup
└── index.ts         # Application entry point
```

### Adding New Features

1. **Create Controller**: Add business logic in `src/controllers/`
2. **Define Routes**: Add API endpoints in `src/routes/`
3. **Add Middleware**: Create reusable middleware in `src/middleware/`
4. **Update Database**: Add Prisma schema changes and run migrations
5. **Add Tests**: Write tests for new functionality
6. **Update Documentation**: Update this README and API docs

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

```
tests/
├── unit/            # Unit tests
├── integration/     # Integration tests
├── e2e/            # End-to-end tests
└── fixtures/       # Test data and fixtures
```

### Writing Tests

```typescript
import request from 'supertest';
import app from '../src/server';

describe('Auth Controller', () => {
  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('test@example.com');
  });
});
```

## 🚀 Deployment

### Environment Variables

Ensure all required environment variables are set:

```bash
# Production environment
NODE_ENV=production
PORT=3001

# Database (use connection pooling in production)
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20"

# Redis (use Redis Cluster in production)
REDIS_URL="redis://redis-host:6379"

# Security (use strong secrets)
JWT_SECRET="your-production-jwt-secret"
JWT_REFRESH_SECRET="your-production-refresh-secret"

# File storage (use cloud storage in production)
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
AWS_S3_BUCKET="your-s3-bucket"
```

### Production Build

```bash
# Install dependencies
npm ci --only=production

# Build the application
npm run build

# Run database migrations
npm run db:migrate:prod

# Start the server
npm run start:prod
```

### Docker Production

```bash
# Build production image
docker build -t aima-server:latest .

# Run with environment file
docker run -d \
  --name aima-server \
  --env-file .env.production \
  -p 3001:3001 \
  aima-server:latest
```

### Health Checks

The server provides health check endpoints:

- `GET /health` - Basic health check
- `GET /api/health` - Detailed health status

## 🔒 Security

### Security Features

- **Authentication**: JWT tokens with refresh mechanism
- **Authorization**: Role-based access control (RBAC)
- **Rate Limiting**: API rate limiting per user/IP
- **Input Validation**: Request validation with Zod
- **SQL Injection Protection**: Prisma ORM with parameterized queries
- **XSS Protection**: Helmet.js security headers
- **CORS**: Configurable CORS policies
- **File Upload Security**: File type and size validation
- **Password Security**: bcrypt hashing with salt rounds

### Security Best Practices

1. **Environment Variables**: Never commit secrets to version control
2. **HTTPS**: Always use HTTPS in production
3. **Database**: Use connection pooling and read replicas
4. **Redis**: Use Redis AUTH and SSL/TLS
5. **File Storage**: Scan uploaded files for malware
6. **Monitoring**: Implement logging and monitoring
7. **Updates**: Keep dependencies updated

## 📊 Monitoring

### Logging

The application uses Winston for structured logging:

```typescript
import { logger } from './utils/logger';

logger.info('User registered', { userId, email });
logger.error('Database error', { error: error.message });
logger.warn('Rate limit exceeded', { ip, userId });
```

### Metrics

Health check endpoint provides system metrics:

```json
{
  "status": "healthy",
  "uptime": 3600,
  "memory": {
    "used": 150.5,
    "total": 512.0
  },
  "services": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write tests for new features
- Update documentation
- Use conventional commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.aima.local](https://docs.aima.local)
- **Issues**: [GitHub Issues](https://github.com/aima/server/issues)
- **Email**: support@aima.local
- **Discord**: [AIMA Community](https://discord.gg/aima)

## 🗺 Roadmap

- [ ] GraphQL API support
- [ ] Kubernetes deployment manifests
- [ ] Advanced ML model management
- [ ] Multi-tenant architecture
- [ ] Real-time collaboration features
- [ ] Advanced analytics dashboard
- [ ] Mobile SDK
- [ ] Plugin system for custom ML models

---

**Made with ❤️ by the AIMA Team**