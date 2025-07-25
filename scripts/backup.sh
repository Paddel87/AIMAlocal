#!/bin/bash

# AIMA System Backup Script
# This script creates backups of the PostgreSQL database and important files

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=30
COMPRESSION_LEVEL=6

# Database configuration from environment variables
DB_HOST="postgres"
DB_PORT="5432"
DB_NAME="${POSTGRES_DB:-aima_db}"
DB_USER="${POSTGRES_USER:-aima_user}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${BACKUP_DIR}/backup.log"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Check if required environment variables are set
if [ -z "$DB_PASSWORD" ]; then
    error_exit "POSTGRES_PASSWORD environment variable is not set"
fi

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}/database"
mkdir -p "${BACKUP_DIR}/uploads"
mkdir -p "${BACKUP_DIR}/logs"

log "Starting backup process..."

# Set PostgreSQL password for non-interactive use
export PGPASSWORD="$DB_PASSWORD"

# Database backup
log "Creating database backup..."
DB_BACKUP_FILE="${BACKUP_DIR}/database/aima_db_${DATE}.sql"

if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --verbose --clean --if-exists --create --format=plain \
    --file="$DB_BACKUP_FILE"; then
    log "Database backup created successfully: $DB_BACKUP_FILE"
else
    error_exit "Failed to create database backup"
fi

# Compress database backup
log "Compressing database backup..."
if gzip -"$COMPRESSION_LEVEL" "$DB_BACKUP_FILE"; then
    log "Database backup compressed successfully: ${DB_BACKUP_FILE}.gz"
else
    error_exit "Failed to compress database backup"
fi

# Database schema-only backup (for quick restore testing)
log "Creating schema-only backup..."
SCHEMA_BACKUP_FILE="${BACKUP_DIR}/database/aima_schema_${DATE}.sql"

if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema-only --verbose --clean --if-exists --create \
    --file="$SCHEMA_BACKUP_FILE"; then
    log "Schema backup created successfully: $SCHEMA_BACKUP_FILE"
    gzip -"$COMPRESSION_LEVEL" "$SCHEMA_BACKUP_FILE"
else
    log "WARNING: Failed to create schema backup (non-critical)"
fi

# Uploads backup (if directory exists and is not empty)
if [ -d "/app/uploads" ] && [ "$(ls -A /app/uploads 2>/dev/null)" ]; then
    log "Creating uploads backup..."
    UPLOADS_BACKUP_FILE="${BACKUP_DIR}/uploads/uploads_${DATE}.tar.gz"
    
    if tar -czf "$UPLOADS_BACKUP_FILE" -C "/app" uploads/; then
        log "Uploads backup created successfully: $UPLOADS_BACKUP_FILE"
    else
        log "WARNING: Failed to create uploads backup (non-critical)"
    fi
else
    log "No uploads directory found or directory is empty, skipping uploads backup"
fi

# Application logs backup
if [ -d "/app/logs" ] && [ "$(ls -A /app/logs 2>/dev/null)" ]; then
    log "Creating logs backup..."
    LOGS_BACKUP_FILE="${BACKUP_DIR}/logs/logs_${DATE}.tar.gz"
    
    if tar -czf "$LOGS_BACKUP_FILE" -C "/app" logs/; then
        log "Logs backup created successfully: $LOGS_BACKUP_FILE"
    else
        log "WARNING: Failed to create logs backup (non-critical)"
    fi
else
    log "No logs directory found or directory is empty, skipping logs backup"
fi

# Configuration backup
log "Creating configuration backup..."
CONFIG_BACKUP_FILE="${BACKUP_DIR}/config_${DATE}.tar.gz"

# Create a temporary directory for config files
TEMP_CONFIG_DIR="/tmp/config_backup_${DATE}"
mkdir -p "$TEMP_CONFIG_DIR"

# Copy important configuration files
cp -r /app/prisma "$TEMP_CONFIG_DIR/" 2>/dev/null || log "WARNING: Could not backup prisma directory"
echo "Backup created on: $(date)" > "$TEMP_CONFIG_DIR/backup_info.txt"
echo "Database: $DB_NAME" >> "$TEMP_CONFIG_DIR/backup_info.txt"
echo "Host: $(hostname)" >> "$TEMP_CONFIG_DIR/backup_info.txt"

if tar -czf "$CONFIG_BACKUP_FILE" -C "$TEMP_CONFIG_DIR" .; then
    log "Configuration backup created successfully: $CONFIG_BACKUP_FILE"
else
    log "WARNING: Failed to create configuration backup (non-critical)"
fi

# Cleanup temporary directory
rm -rf "$TEMP_CONFIG_DIR"

# Create backup manifest
log "Creating backup manifest..."
MANIFEST_FILE="${BACKUP_DIR}/manifest_${DATE}.txt"

{
    echo "AIMA System Backup Manifest"
    echo "Created: $(date)"
    echo "Backup Date: $DATE"
    echo "Database: $DB_NAME"
    echo "Host: $(hostname)"
    echo ""
    echo "Files in this backup:"
    find "$BACKUP_DIR" -name "*${DATE}*" -type f -exec ls -lh {} \; | while read -r line; do
        echo "  $line"
    done
    echo ""
    echo "Total backup size:"
    du -sh "$BACKUP_DIR" | cut -f1
} > "$MANIFEST_FILE"

log "Backup manifest created: $MANIFEST_FILE"

# Cleanup old backups
log "Cleaning up old backups (older than $RETENTION_DAYS days)..."

# Find and remove old backup files
find "${BACKUP_DIR}/database" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "${BACKUP_DIR}/uploads" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "${BACKUP_DIR}/logs" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "${BACKUP_DIR}" -name "config_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "${BACKUP_DIR}" -name "manifest_*.txt" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# Clean up old log entries (keep last 1000 lines)
if [ -f "${BACKUP_DIR}/backup.log" ]; then
    tail -n 1000 "${BACKUP_DIR}/backup.log" > "${BACKUP_DIR}/backup.log.tmp"
    mv "${BACKUP_DIR}/backup.log.tmp" "${BACKUP_DIR}/backup.log"
fi

log "Old backups cleaned up successfully"

# Verify backup integrity
log "Verifying backup integrity..."

# Test database backup
if [ -f "${DB_BACKUP_FILE}.gz" ]; then
    if gzip -t "${DB_BACKUP_FILE}.gz"; then
        log "Database backup integrity verified"
    else
        error_exit "Database backup integrity check failed"
    fi
fi

# Calculate and log backup statistics
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*${DATE}*" -type f | wc -l)

log "Backup completed successfully!"
log "Total backup size: $BACKUP_SIZE"
log "Files created: $BACKUP_COUNT"
log "Backup location: $BACKUP_DIR"

# Optional: Send notification (uncomment and configure as needed)
# if command -v curl >/dev/null 2>&1; then
#     curl -X POST "$WEBHOOK_URL" \
#         -H "Content-Type: application/json" \
#         -d "{\"text\":\"AIMA backup completed successfully. Size: $BACKUP_SIZE, Files: $BACKUP_COUNT\"}"
# fi

log "Backup process finished"

# Unset password for security
unset PGPASSWORD

exit 0