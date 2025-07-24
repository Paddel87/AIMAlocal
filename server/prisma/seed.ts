import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data (in development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...');
    await prisma.personAssignmentHistory.deleteMany();
    await prisma.personIdHistory.deleteMany();
    await prisma.personTranscription.deleteMany();
    await prisma.personRecognition.deleteMany();
    await prisma.personDossier.deleteMany();
    await prisma.jobResult.deleteMany();
    await prisma.mediaFile.deleteMany();
    await prisma.batchJob.deleteMany();
    await prisma.job.deleteMany();
    await prisma.gpuInstance.deleteMany();
    await prisma.session.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
    await prisma.mLModel.deleteMany();
    await prisma.storageProvider.deleteMany();
    await prisma.systemConfig.deleteMany();
  }

  // Create system configuration
  console.log('⚙️ Creating system configuration...');
  const systemConfigs = [
    {
      key: 'max_file_size',
      value: { size: 524288000 }, // 500MB
    },
    {
      key: 'max_files_per_user',
      value: { count: 1000 },
    },
    {
      key: 'face_recognition_threshold',
      value: { threshold: 0.8 },
    },
  ];

  for (const config of systemConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: config,
      create: config,
    });
  }

  // Create ML models
  console.log('🤖 Creating ML models...');
  const mlModels = [
    {
      name: 'FaceNet',
      type: 'FACE_RECOGNITION' as const,
      version: '1.0.0',
      provider: 'Local',
      modelPath: '/models/facenet',
      isActive: true,
      metadata: {
        input_size: [160, 160],
        embedding_size: 512,
        threshold: 0.8,
      },
      description: 'FaceNet model for face recognition',
    },
    {
      name: 'Whisper',
      type: 'SPEECH_TO_TEXT' as const,
      version: '1.0.0',
      provider: 'OpenAI',
      modelPath: '/models/whisper',
      isActive: true,
      metadata: {
        model_size: 'base',
        language: 'auto',
      },
      description: 'Whisper model for audio transcription',
    },
  ];

  for (const model of mlModels) {
    await prisma.mLModel.create({
      data: model,
    });
  }

  // Create users
  console.log('👥 Creating users...');
  const adminPassword = await bcrypt.hash('admin123', 12);
  const userPassword = await bcrypt.hash('user123', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@aima.local' },
    update: {},
    create: {
      email: 'admin@aima.local',
      username: 'admin',
      password: adminPassword,
      role: 'ADMINISTRATOR',
    },
  });

  const personalUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      username: 'johndoe',
      password: userPassword,
      role: 'PERSONAL',
    },
  });

  // Create storage providers
  console.log('💾 Creating storage providers...');
  await prisma.storageProvider.create({
    data: {
      name: 'Local Storage',
      type: 'LOCAL',
      config: {
        path: './uploads',
      },
      isActive: true,
      isDefault: true,
    },
  });

  // Create GPU instances
  console.log('🖥️ Creating GPU instances...');
  await prisma.gpuInstance.create({
    data: {
      name: 'Local RTX 4090',
      type: 'RTX 4090',
      provider: 'LOCAL',
      providerId: 'local-001',
      status: 'ONLINE',
      location: 'Local Machine',
      utilization: 0,
      temperature: 45,
      powerUsage: 150,
      memoryTotal: 24576, // 24GB
      memoryUsed: 0,
      costPerHour: 0.5,
      currency: 'EUR',
    },
  });

  console.log('✅ Database seeding completed successfully!');
  console.log('📊 Created:');
  console.log('  - System configurations');
  console.log('  - ML models');
  console.log('  - Users (admin, personal)');
  console.log('  - Storage providers');
  console.log('  - GPU instances');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });