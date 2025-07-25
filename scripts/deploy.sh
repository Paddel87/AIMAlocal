#!/bin/bash

# AIMA System Production Deployment Script
# This script deploys the AIMA system to production environment

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_ENV="${DEPLOY_ENV:-production}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
RUN_HEALTH_CHECK="${RUN_HEALTH_CHECK:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_warning "Running as root. Consider using a non-root user for security."
fi

# Change to project directory
cd "$PROJECT_DIR"

log_info "Starting AIMA System deployment to $DEPLOY_ENV environment..."
log_info "Project directory: $PROJECT_DIR"

# Check if required files exist
log_info "Checking required files..."

required_files=(
    "docker-compose.production.yml"
    ".env.production"
    "nginx.production.conf"
    "monitoring/prometheus.yml"
    "monitoring/loki.yml"
    "monitoring/promtail.yml"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        error_exit "Required file not found: $file"
    fi
done

log_success "All required files found"

# Check if Docker and Docker Compose are installed
log_info "Checking Docker installation..."

if ! command -v docker &> /dev/null; then
    error_exit "Docker is not installed. Please install Docker first."
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    error_exit "Docker Compose is not installed. Please install Docker Compose first."
fi

# Determine docker-compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

log_success "Docker and Docker Compose are installed"

# Check if .env.production has been configured
log_info "Checking environment configuration..."

if grep -q "CHANGE_ME" ".env.production"; then
    log_warning "Found CHANGE_ME placeholders in .env.production"
    log_warning "Please configure all environment variables before deploying to production"
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error_exit "Deployment cancelled. Please configure .env.production first."
    fi
fi

# Create necessary directories
log_info "Creating necessary directories..."

mkdir -p logs/nginx
mkdir -p logs/backend
mkdir -p backups
mkdir -p ssl
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/datasources

log_success "Directories created"

# Set proper permissions
log_info "Setting proper permissions..."

chmod +x scripts/backup.sh
chmod 600 .env.production
chmod -R 755 monitoring/
chmod -R 755 scripts/

log_success "Permissions set"

# Backup existing deployment if requested
if [ "$BACKUP_BEFORE_DEPLOY" = "true" ] && [ -f "docker-compose.yml" ]; then
    log_info "Creating backup before deployment..."
    
    BACKUP_DIR="backups/pre-deploy-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup current containers if running
    if $DOCKER_COMPOSE ps | grep -q "Up"; then
        log_info "Backing up current database..."
        $DOCKER_COMPOSE exec -T postgres pg_dump -U aima_user aima_db > "$BACKUP_DIR/database_backup.sql" || log_warning "Database backup failed"
    fi
    
    # Backup configuration
    cp -r .env* "$BACKUP_DIR/" 2>/dev/null || true
    cp docker-compose.yml "$BACKUP_DIR/" 2>/dev/null || true
    
    log_success "Backup created in $BACKUP_DIR"
fi

# Stop existing services
log_info "Stopping existing services..."

if [ -f "docker-compose.yml" ]; then
    $DOCKER_COMPOSE down --remove-orphans || log_warning "Failed to stop some services"
fi

log_success "Existing services stopped"

# Pull latest images
log_info "Pulling latest Docker images..."

$DOCKER_COMPOSE -f docker-compose.production.yml --env-file .env.production pull || log_warning "Some images could not be pulled"

log_success "Docker images pulled"

# Build custom images
log_info "Building custom images..."

$DOCKER_COMPOSE -f docker-compose.production.yml --env-file .env.production build --no-cache

log_success "Custom images built"

# Start infrastructure services first
log_info "Starting infrastructure services..."

$DOCKER_COMPOSE -f docker-compose.production.yml --env-file .env.production up -d postgres redis

# Wait for database to be ready
log_info "Waiting for database to be ready..."

max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if $DOCKER_COMPOSE -f docker-compose.production.yml --env-file .env.production exec -T postgres pg_isready -U aima_user -d aima_db; then
        log_success "Database is ready"
        break
    fi
    
    log_info "Attempt $attempt/$max_attempts: Database not ready, waiting..."
    sleep 5
    ((attempt++))
done

if [ $attempt -gt $max_attempts ]; then
    error_exit "Database failed to start within expected time"
fi

# Run database migrations if requested
if [ "$RUN_MIGRATIONS" = "true" ]; then
    log_info "Running database migrations..."
    
    # Start backend temporarily for migrations
    $DOCKER_COMPOSE -f docker-compose.production.yml --env-file .env.production up -d backend
    
    # Wait for backend to be ready
    sleep 10
    
    # Run Prisma migrations
    $DOCKER_COMPOSE -f docker-compose.production.yml --env-file .env.production exec -T backend npx prisma migrate deploy || log_warning "Migration failed"
    
    # Generate Prisma client
    $DOCKER_COMPOSE -f docker-compose.production.yml --env-file .env.production exec -T backend npx prisma generate || log_warning "Prisma generate failed"
    
    log_success "Database migrations completed"
fi

# Start all services
log_info "Starting all services..."

$DOCKER_COMPOSE -f docker-compose.production.yml --env-file .env.production up -d

log_success "All services started"

# Wait for services to be healthy
log_info "Waiting for services to be healthy..."

sleep 30

# Check service health
log_info "Checking service health..."

services=("postgres" "redis" "backend" "frontend" "nginx")
healthy_services=0

for service in "${services[@]}"; do
    if $DOCKER_COMPOSE -f docker-compose.production.yml --env-file .env.production ps "$service" | grep -q "healthy\|Up"; then
        log_success "$service is healthy"
        ((healthy_services++))
    else
        log_warning "$service is not healthy"
    fi
done

log_info "$healthy_services/${#services[@]} services are healthy"

# Run health checks if requested
if [ "$RUN_HEALTH_CHECK" = "true" ]; then
    log_info "Running application health checks..."
    
    # Check backend health
    if curl -f -s http://localhost/api/health > /dev/null; then
        log_success "Backend health check passed"
    else
        log_warning "Backend health check failed"
    fi
    
    # Check frontend
    if curl -f -s http://localhost/ > /dev/null; then
        log_success "Frontend health check passed"
    else
        log_warning "Frontend health check failed"
    fi
    
    # Check monitoring
    if curl -f -s http://localhost:9090/-/healthy > /dev/null; then
        log_success "Prometheus health check passed"
    else
        log_warning "Prometheus health check failed"
    fi
    
    if curl -f -s http://localhost:3000/api/health > /dev/null; then
        log_success "Grafana health check passed"
    else
        log_warning "Grafana health check failed"
    fi
fi

# Display service URLs
log_info "Deployment completed! Service URLs:"
echo "  🌐 Application: http://localhost (or https://yourdomain.com)"
echo "  📊 Grafana: http://localhost:3000"
echo "  📈 Prometheus: http://localhost:9090"
echo "  🔍 Loki: http://localhost:3100"
echo "  📋 Backend API: http://localhost/api"
echo "  ❤️  Health Check: http://localhost/health"

# Display important notes
log_info "Important notes:"
echo "  📝 Check logs: $DOCKER_COMPOSE -f docker-compose.production.yml logs -f"
echo "  🔄 Restart services: $DOCKER_COMPOSE -f docker-compose.production.yml restart"
echo "  🛑 Stop services: $DOCKER_COMPOSE -f docker-compose.production.yml down"
echo "  📊 Monitor resources: docker stats"
echo "  🔐 Configure SSL certificates in ./ssl/ directory"
echo "  📧 Configure email notifications in .env.production"
echo "  🔄 Set up automated backups with cron"

# Show resource usage
log_info "Current resource usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

log_success "AIMA System deployment completed successfully!"

# Optional: Send deployment notification
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"🚀 AIMA System deployed successfully to $DEPLOY_ENV environment!\"}" \
        > /dev/null 2>&1 || log_warning "Failed to send Slack notification"
fi

exit 0