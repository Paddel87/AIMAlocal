-- AIMA Database Initialization Script
-- This script sets up the initial database structure and data

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('FREE_USER', 'PRO_USER', 'ENTERPRISE', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_type AS ENUM ('FACE_RECOGNITION', 'VOICE_RECOGNITION', 'OBJECT_DETECTION', 'TRANSCRIPTION', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE media_type AS ENUM ('IMAGE', 'VIDEO', 'AUDIO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gpu_provider AS ENUM ('RUNPOD', 'VAST_AI', 'LAMBDA_LABS', 'PAPERSPACE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gpu_status AS ENUM ('STOPPED', 'STARTING', 'RUNNING', 'STOPPING', 'ERROR', 'MAINTENANCE', 'DELETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE storage_provider AS ENUM ('AWS_S3', 'GOOGLE_CLOUD', 'AZURE_BLOB', 'DROPBOX', 'ONEDRIVE', 'LOCAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON "User"(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON "User"("isActive");

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON "Session"("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_token ON "Session"(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON "Session"("expiresAt");

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON "Job"("userId");
CREATE INDEX IF NOT EXISTS idx_jobs_status ON "Job"(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON "Job"(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON "Job"("createdAt");

CREATE INDEX IF NOT EXISTS idx_media_files_user_id ON "MediaFile"("userId");
CREATE INDEX IF NOT EXISTS idx_media_files_type ON "MediaFile"(type);
CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON "MediaFile"("createdAt");

CREATE INDEX IF NOT EXISTS idx_person_dossiers_user_id ON "PersonDossier"("userId");
CREATE INDEX IF NOT EXISTS idx_person_dossiers_active ON "PersonDossier"("isActive");
CREATE INDEX IF NOT EXISTS idx_person_dossiers_name ON "PersonDossier"(name);

CREATE INDEX IF NOT EXISTS idx_person_recognitions_dossier_id ON "PersonRecognition"("personDossierId");
CREATE INDEX IF NOT EXISTS idx_person_recognitions_media_id ON "PersonRecognition"("mediaFileId");
CREATE INDEX IF NOT EXISTS idx_person_recognitions_confidence ON "PersonRecognition"(confidence);

CREATE INDEX IF NOT EXISTS idx_person_transcriptions_dossier_id ON "PersonTranscription"("personDossierId");
CREATE INDEX IF NOT EXISTS idx_person_transcriptions_media_id ON "PersonTranscription"("mediaFileId");
CREATE INDEX IF NOT EXISTS idx_person_transcriptions_text ON "PersonTranscription" USING gin(text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_gpu_instances_user_id ON "GpuInstance"("userId");
CREATE INDEX IF NOT EXISTS idx_gpu_instances_status ON "GpuInstance"(status);
CREATE INDEX IF NOT EXISTS idx_gpu_instances_provider ON "GpuInstance"(provider);

-- Create full-text search indexes
CREATE INDEX IF NOT EXISTS idx_person_dossiers_search ON "PersonDossier" USING gin((name || ' ' || COALESCE(description, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_search ON "Job" USING gin((name || ' ' || COALESCE(description, '')) gin_trgm_ops);

-- Create functions for common operations

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM "Session" WHERE "expiresAt" < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate user storage usage
CREATE OR REPLACE FUNCTION get_user_storage_usage(user_uuid UUID)
RETURNS BIGINT AS $$
DECLARE
    total_size BIGINT;
BEGIN
    SELECT COALESCE(SUM(size), 0) INTO total_size
    FROM "MediaFile"
    WHERE "userId" = user_uuid;
    
    RETURN total_size;
END;
$$ LANGUAGE plpgsql;

-- Function to get user job statistics
CREATE OR REPLACE FUNCTION get_user_job_stats(user_uuid UUID)
RETURNS TABLE(
    total_jobs BIGINT,
    completed_jobs BIGINT,
    failed_jobs BIGINT,
    running_jobs BIGINT,
    pending_jobs BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_jobs,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed_jobs,
        COUNT(*) FILTER (WHERE status = 'RUNNING') as running_jobs,
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending_jobs
    FROM "Job"
    WHERE "userId" = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to relevant tables
DROP TRIGGER IF EXISTS update_user_updated_at ON "User";
CREATE TRIGGER update_user_updated_at
    BEFORE UPDATE ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_updated_at ON "Job";
CREATE TRIGGER update_job_updated_at
    BEFORE UPDATE ON "Job"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_media_file_updated_at ON "MediaFile";
CREATE TRIGGER update_media_file_updated_at
    BEFORE UPDATE ON "MediaFile"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_person_dossier_updated_at ON "PersonDossier";
CREATE TRIGGER update_person_dossier_updated_at
    BEFORE UPDATE ON "PersonDossier"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gpu_instance_updated_at ON "GpuInstance";
CREATE TRIGGER update_gpu_instance_updated_at
    BEFORE UPDATE ON "GpuInstance"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default system configuration
INSERT INTO "SystemConfig" (key, value, description, "isPublic", "createdAt", "updatedAt")
VALUES 
    ('max_file_size', '524288000', 'Maximum file size in bytes (500MB)', false, NOW(), NOW()),
    ('max_files_per_user', '1000', 'Maximum number of files per user', false, NOW(), NOW()),
    ('max_gpu_instances_free', '1', 'Maximum GPU instances for free users', false, NOW(), NOW()),
    ('max_gpu_instances_pro', '3', 'Maximum GPU instances for pro users', false, NOW(), NOW()),
    ('max_gpu_instances_enterprise', '10', 'Maximum GPU instances for enterprise users', false, NOW(), NOW()),
    ('default_job_timeout', '3600', 'Default job timeout in seconds (1 hour)', false, NOW(), NOW()),
    ('max_concurrent_jobs', '5', 'Maximum concurrent jobs per user', false, NOW(), NOW()),
    ('face_recognition_threshold', '0.8', 'Default face recognition confidence threshold', true, NOW(), NOW()),
    ('voice_recognition_threshold', '0.7', 'Default voice recognition confidence threshold', true, NOW(), NOW()),
    ('supported_image_formats', '["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff"]', 'Supported image file formats', true, NOW(), NOW()),
    ('supported_video_formats', '["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv", "m4v"]', 'Supported video file formats', true, NOW(), NOW()),
    ('supported_audio_formats', '["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"]', 'Supported audio file formats', true, NOW(), NOW()),
    ('api_rate_limit_per_minute', '60', 'API rate limit per minute per user', false, NOW(), NOW()),
    ('webhook_timeout', '30', 'Webhook timeout in seconds', false, NOW(), NOW()),
    ('session_duration', '86400', 'Session duration in seconds (24 hours)', false, NOW(), NOW()),
    ('refresh_token_duration', '604800', 'Refresh token duration in seconds (7 days)', false, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Insert default ML models
INSERT INTO "MLModel" (name, type, version, "isActive", config, description, "createdAt", "updatedAt")
VALUES 
    ('FaceNet', 'FACE_RECOGNITION', '1.0.0', true, 
     '{"input_size": [160, 160], "embedding_size": 512, "threshold": 0.8}', 
     'FaceNet model for face recognition and embedding generation', NOW(), NOW()),
    ('OpenAI Whisper', 'TRANSCRIPTION', '1.0.0', true, 
     '{"model_size": "base", "language": "auto", "temperature": 0.0}', 
     'OpenAI Whisper model for audio transcription', NOW(), NOW()),
    ('YOLOv8', 'OBJECT_DETECTION', '1.0.0', true, 
     '{"confidence": 0.5, "iou_threshold": 0.45, "max_detections": 100}', 
     'YOLOv8 model for object detection', NOW(), NOW()),
    ('SpeakerNet', 'VOICE_RECOGNITION', '1.0.0', true, 
     '{"embedding_size": 256, "threshold": 0.7, "window_size": 3.0}', 
     'SpeakerNet model for voice recognition and speaker identification', NOW(), NOW())
ON CONFLICT (name, version) DO NOTHING;

-- Create a default admin user (password: admin123 - CHANGE IN PRODUCTION!)
INSERT INTO "User" (
    id, email, "firstName", "lastName", "passwordHash", role, 
    "isActive", "emailVerified", "createdAt", "updatedAt"
)
VALUES (
    uuid_generate_v4(),
    'admin@aima.local',
    'System',
    'Administrator',
    crypt('admin123', gen_salt('bf')),
    'ADMIN',
    true,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Create scheduled cleanup job (requires pg_cron extension in production)
-- SELECT cron.schedule('cleanup-sessions', '0 2 * * *', 'SELECT cleanup_expired_sessions();');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;

-- Create database statistics view
CREATE OR REPLACE VIEW database_stats AS
SELECT 
    'users' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE "isActive" = true) as active_records
FROM "User"
UNION ALL
SELECT 
    'jobs' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') as active_records
FROM "Job"
UNION ALL
SELECT 
    'media_files' as table_name,
    COUNT(*) as total_records,
    COALESCE(SUM(size), 0) as active_records
FROM "MediaFile"
UNION ALL
SELECT 
    'person_dossiers' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE "isActive" = true) as active_records
FROM "PersonDossier"
UNION ALL
SELECT 
    'gpu_instances' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE status = 'RUNNING') as active_records
FROM "GpuInstance";

-- Log initialization completion
DO $$
BEGIN
    RAISE NOTICE 'AIMA database initialization completed successfully at %', NOW();
END
$$;