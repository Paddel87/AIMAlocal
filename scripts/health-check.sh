#!/bin/bash

# AIMA System Health Check Script
# This script performs comprehensive health checks on all system components

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_DIR}/logs/health-check.log"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=85
ALERT_THRESHOLD_DISK=90
TIMEOUT=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Arrays to store results
declare -a FAILED_SERVICES=()
declare -a WARNING_SERVICES=()
declare -a PASSED_SERVICES=()

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$LOG_FILE"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
    ((WARNING_CHECKS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1" | tee -a "$LOG_FILE"
    ((FAILED_CHECKS++))
}

# Increment total checks
check_start() {
    ((TOTAL_CHECKS++))
}

# Change to project directory
cd "$PROJECT_DIR"

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Start health check
log_info "Starting AIMA System health check at $(date)"
log_info "Project directory: $PROJECT_DIR"

# Determine docker-compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

# Function to check if a service is running
check_service_running() {
    local service_name="$1"
    local container_name="$2"
    
    check_start
    
    if docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
        log_success "$service_name is running"
        PASSED_SERVICES+=("$service_name")
        return 0
    else
        log_error "$service_name is not running"
        FAILED_SERVICES+=("$service_name")
        return 1
    fi
}

# Function to check service health
check_service_health() {
    local service_name="$1"
    local container_name="$2"
    
    check_start
    
    local health_status
    health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "no-health-check")
    
    case "$health_status" in
        "healthy")
            log_success "$service_name health check passed"
            return 0
            ;;
        "unhealthy")
            log_error "$service_name health check failed"
            FAILED_SERVICES+=("$service_name")
            return 1
            ;;
        "starting")
            log_warning "$service_name is still starting"
            WARNING_SERVICES+=("$service_name")
            return 1
            ;;
        "no-health-check")
            log_warning "$service_name has no health check configured"
            WARNING_SERVICES+=("$service_name")
            return 1
            ;;
        *)
            log_warning "$service_name health status unknown: $health_status"
            WARNING_SERVICES+=("$service_name")
            return 1
            ;;
    esac
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local service_name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    check_start
    
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000")
    
    if [ "$response_code" = "$expected_status" ]; then
        log_success "$service_name HTTP endpoint ($url) is responding"
        return 0
    else
        log_error "$service_name HTTP endpoint ($url) returned $response_code (expected $expected_status)"
        FAILED_SERVICES+=("$service_name HTTP")
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    check_start
    
    if $DOCKER_COMPOSE -f docker-compose.production.yml exec -T postgres pg_isready -U aima_user -d aima_db >/dev/null 2>&1; then
        log_success "PostgreSQL database is accepting connections"
        return 0
    else
        log_error "PostgreSQL database is not accepting connections"
        FAILED_SERVICES+=("PostgreSQL")
        return 1
    fi
}

# Function to check Redis connectivity
check_redis() {
    check_start
    
    if $DOCKER_COMPOSE -f docker-compose.production.yml exec -T redis redis-cli -a "${REDIS_PASSWORD:-aima_redis_password}" ping 2>/dev/null | grep -q "PONG"; then
        log_success "Redis is responding to ping"
        return 0
    else
        log_error "Redis is not responding to ping"
        FAILED_SERVICES+=("Redis")
        return 1
    fi
}

# Function to check disk space
check_disk_space() {
    check_start
    
    local disk_usage
    disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -lt "$ALERT_THRESHOLD_DISK" ]; then
        log_success "Disk usage is ${disk_usage}% (threshold: ${ALERT_THRESHOLD_DISK}%)"
        return 0
    elif [ "$disk_usage" -lt 95 ]; then
        log_warning "Disk usage is ${disk_usage}% (threshold: ${ALERT_THRESHOLD_DISK}%)"
        WARNING_SERVICES+=("Disk Space")
        return 1
    else
        log_error "Disk usage is critically high: ${disk_usage}%"
        FAILED_SERVICES+=("Disk Space")
        return 1
    fi
}

# Function to check memory usage
check_memory_usage() {
    check_start
    
    local memory_usage
    memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [ "$memory_usage" -lt "$ALERT_THRESHOLD_MEMORY" ]; then
        log_success "Memory usage is ${memory_usage}% (threshold: ${ALERT_THRESHOLD_MEMORY}%)"
        return 0
    elif [ "$memory_usage" -lt 95 ]; then
        log_warning "Memory usage is ${memory_usage}% (threshold: ${ALERT_THRESHOLD_MEMORY}%)"
        WARNING_SERVICES+=("Memory")
        return 1
    else
        log_error "Memory usage is critically high: ${memory_usage}%"
        FAILED_SERVICES+=("Memory")
        return 1
    fi
}

# Function to check CPU usage
check_cpu_usage() {
    check_start
    
    local cpu_usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
    
    # Convert to integer for comparison
    cpu_usage_int=$(echo "$cpu_usage" | cut -d'.' -f1)
    
    if [ "$cpu_usage_int" -lt "$ALERT_THRESHOLD_CPU" ]; then
        log_success "CPU usage is ${cpu_usage}% (threshold: ${ALERT_THRESHOLD_CPU}%)"
        return 0
    elif [ "$cpu_usage_int" -lt 95 ]; then
        log_warning "CPU usage is ${cpu_usage}% (threshold: ${ALERT_THRESHOLD_CPU}%)"
        WARNING_SERVICES+=("CPU")
        return 1
    else
        log_error "CPU usage is critically high: ${cpu_usage}%"
        FAILED_SERVICES+=("CPU")
        return 1
    fi
}

# Function to check Docker daemon
check_docker() {
    check_start
    
    if docker info >/dev/null 2>&1; then
        log_success "Docker daemon is running"
        return 0
    else
        log_error "Docker daemon is not running"
        FAILED_SERVICES+=("Docker")
        return 1
    fi
}

# Function to check log file sizes
check_log_sizes() {
    check_start
    
    local log_dir="${PROJECT_DIR}/logs"
    local max_size_mb=100
    local large_logs=()
    
    if [ -d "$log_dir" ]; then
        while IFS= read -r -d '' file; do
            local size_mb
            size_mb=$(du -m "$file" | cut -f1)
            if [ "$size_mb" -gt "$max_size_mb" ]; then
                large_logs+=("$(basename "$file"): ${size_mb}MB")
            fi
        done < <(find "$log_dir" -name "*.log" -type f -print0)
        
        if [ ${#large_logs[@]} -eq 0 ]; then
            log_success "All log files are within size limits"
            return 0
        else
            log_warning "Large log files found: ${large_logs[*]}"
            WARNING_SERVICES+=("Log Files")
            return 1
        fi
    else
        log_warning "Log directory not found: $log_dir"
        WARNING_SERVICES+=("Log Directory")
        return 1
    fi
}

# Function to check SSL certificate expiry
check_ssl_certificate() {
    check_start
    
    local cert_file="${PROJECT_DIR}/ssl/fullchain.pem"
    
    if [ -f "$cert_file" ]; then
        local expiry_date
        expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
        local expiry_timestamp
        expiry_timestamp=$(date -d "$expiry_date" +%s)
        local current_timestamp
        current_timestamp=$(date +%s)
        local days_until_expiry
        days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [ "$days_until_expiry" -gt 30 ]; then
            log_success "SSL certificate expires in $days_until_expiry days"
            return 0
        elif [ "$days_until_expiry" -gt 7 ]; then
            log_warning "SSL certificate expires in $days_until_expiry days"
            WARNING_SERVICES+=("SSL Certificate")
            return 1
        else
            log_error "SSL certificate expires in $days_until_expiry days (critical)"
            FAILED_SERVICES+=("SSL Certificate")
            return 1
        fi
    else
        log_warning "SSL certificate not found: $cert_file"
        WARNING_SERVICES+=("SSL Certificate")
        return 1
    fi
}

# Function to check backup status
check_backup_status() {
    check_start
    
    local backup_dir="${PROJECT_DIR}/backups"
    local latest_backup
    
    if [ -d "$backup_dir" ]; then
        latest_backup=$(find "$backup_dir" -name "*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
        
        if [ -n "$latest_backup" ]; then
            local backup_age
            backup_age=$(( ($(date +%s) - $(stat -c %Y "$latest_backup")) / 86400 ))
            
            if [ "$backup_age" -le 1 ]; then
                log_success "Latest backup is $backup_age days old"
                return 0
            elif [ "$backup_age" -le 7 ]; then
                log_warning "Latest backup is $backup_age days old"
                WARNING_SERVICES+=("Backup")
                return 1
            else
                log_error "Latest backup is $backup_age days old (too old)"
                FAILED_SERVICES+=("Backup")
                return 1
            fi
        else
            log_error "No backups found in $backup_dir"
            FAILED_SERVICES+=("Backup")
            return 1
        fi
    else
        log_warning "Backup directory not found: $backup_dir"
        WARNING_SERVICES+=("Backup Directory")
        return 1
    fi
}

# Main health check execution
log_info "=== DOCKER SERVICES ==="
check_docker

log_info "=== CONTAINER STATUS ==="
check_service_running "PostgreSQL" "aima_postgres_prod"
check_service_running "Redis" "aima_redis_prod"
check_service_running "Backend" "aima_backend_prod"
check_service_running "Frontend" "aima_frontend_prod"
check_service_running "Nginx" "aima_nginx_prod"
check_service_running "Prometheus" "aima_prometheus"
check_service_running "Grafana" "aima_grafana"
check_service_running "Loki" "aima_loki"

log_info "=== HEALTH CHECKS ==="
check_service_health "PostgreSQL" "aima_postgres_prod"
check_service_health "Redis" "aima_redis_prod"
check_service_health "Backend" "aima_backend_prod"
check_service_health "Frontend" "aima_frontend_prod"
check_service_health "Nginx" "aima_nginx_prod"

log_info "=== DATABASE CONNECTIVITY ==="
check_database
check_redis

log_info "=== HTTP ENDPOINTS ==="
check_http_endpoint "Frontend" "http://localhost/"
check_http_endpoint "Backend API" "http://localhost/api/health"
check_http_endpoint "Prometheus" "http://localhost:9090/-/healthy"
check_http_endpoint "Grafana" "http://localhost:3000/api/health"
check_http_endpoint "Loki" "http://localhost:3100/ready"

log_info "=== SYSTEM RESOURCES ==="
check_disk_space
check_memory_usage
check_cpu_usage

log_info "=== MAINTENANCE CHECKS ==="
check_log_sizes
check_ssl_certificate
check_backup_status

# Summary
log_info "=== HEALTH CHECK SUMMARY ==="
log_info "Total checks: $TOTAL_CHECKS"
log_success "Passed: $PASSED_CHECKS"
log_warning "Warnings: $WARNING_CHECKS"
log_error "Failed: $FAILED_CHECKS"

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
    log_error "Failed services: ${FAILED_SERVICES[*]}"
fi

if [ ${#WARNING_SERVICES[@]} -gt 0 ]; then
    log_warning "Warning services: ${WARNING_SERVICES[*]}"
fi

if [ ${#PASSED_SERVICES[@]} -gt 0 ]; then
    log_success "Healthy services: ${PASSED_SERVICES[*]}"
fi

# Calculate health score
HEALTH_SCORE=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
log_info "Overall health score: ${HEALTH_SCORE}%"

# Determine exit code
if [ "$FAILED_CHECKS" -gt 0 ]; then
    log_error "Health check completed with failures"
    EXIT_CODE=2
elif [ "$WARNING_CHECKS" -gt 0 ]; then
    log_warning "Health check completed with warnings"
    EXIT_CODE=1
else
    log_success "All health checks passed"
    EXIT_CODE=0
fi

# Send alerts if configured
if [ "$EXIT_CODE" -gt 0 ] && [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    local alert_message
    if [ "$EXIT_CODE" -eq 2 ]; then
        alert_message="🚨 AIMA System health check FAILED! Score: ${HEALTH_SCORE}%. Failed: ${FAILED_SERVICES[*]}"
    else
        alert_message="⚠️ AIMA System health check has warnings. Score: ${HEALTH_SCORE}%. Warnings: ${WARNING_SERVICES[*]}"
    fi
    
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"$alert_message\"}" \
        > /dev/null 2>&1 || log_warning "Failed to send alert notification"
fi

log_info "Health check completed at $(date)"

exit $EXIT_CODE