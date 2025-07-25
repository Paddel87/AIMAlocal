import { spawn } from 'child_process';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  confidence: number;
  processingTime: number;
  wordCount: number;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface AudioFeatures {
  duration: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
  format: string;
}

class AudioTranscriptionService {
  private whisperModelPath: string;
  private tempDir: string;
  private isInitialized = false;

  constructor() {
    this.whisperModelPath = process.env.WHISPER_MODEL_PATH || 'base';
    this.tempDir = path.join(__dirname, '../../temp/audio');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Check if Whisper is available
      await this.checkWhisperAvailability();
      
      this.isInitialized = true;
      logger.info('Audio transcription service initialized');
    } catch (error) {
      logger.error('Failed to initialize audio transcription service:', error);
      throw error;
    }
  }

  private async checkWhisperAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const whisper = spawn('whisper', ['--help']);
      
      whisper.on('error', () => {
        logger.warn('Whisper CLI not found, using fallback transcription');
        resolve(false);
      });
      
      whisper.on('close', (code) => {
        if (code === 0) {
          logger.info('Whisper CLI available');
          resolve(true);
        } else {
          logger.warn('Whisper CLI not working properly');
          resolve(false);
        }
      });
    });
  }

  async extractAudioFeatures(audioPath: string): Promise<AudioFeatures> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          logger.error('Failed to extract audio features:', err);
          reject(new Error(`Audio feature extraction failed: ${err.message}`));
          return;
        }

        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        
        if (!audioStream) {
          reject(new Error('No audio stream found in file'));
          return;
        }

        const features: AudioFeatures = {
          duration: parseFloat(audioStream.duration || '0'),
          sampleRate: parseInt(String(audioStream.sample_rate || '0')),
          channels: audioStream.channels || 0,
          bitrate: parseInt(audioStream.bit_rate || '0'),
          format: audioStream.codec_name || 'unknown'
        };

        resolve(features);
      });
    });
  }

  async convertToWav(inputPath: string): Promise<string> {
    const outputPath = path.join(this.tempDir, `${Date.now()}_converted.wav`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('wav')
        .audioFrequency(16000) // Whisper prefers 16kHz
        .audioChannels(1) // Mono
        .on('end', () => {
          logger.info(`Audio converted to WAV: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Audio conversion failed:', err);
          reject(new Error(`Audio conversion failed: ${err instanceof Error ? err.message : 'Unknown error'}`));
        })
        .save(outputPath);
    });
  }

  async transcribeWithWhisper(audioPath: string, language?: string): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Convert audio to WAV format if needed
      const wavPath = await this.convertToWav(audioPath);
      
      // Prepare Whisper command
      const args = [
        wavPath,
        '--model', this.whisperModelPath,
        '--output_format', 'json',
        '--output_dir', this.tempDir
      ];
      
      if (language) {
        args.push('--language', language);
      }

      const result = await this.runWhisperCommand(args);
      
      // Clean up temporary files
      await fs.unlink(wavPath).catch(() => {});
      
      const processingTime = Date.now() - startTime;
      
      return {
        ...result,
        processingTime
      };
    } catch (error) {
      logger.error('Whisper transcription failed:', error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async runWhisperCommand(args: string[]): Promise<Omit<TranscriptionResult, 'processingTime'>> {
    return new Promise((resolve, reject) => {
      const whisper = spawn('whisper', args);
      let stdout = '';
      let stderr = '';

      whisper.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      whisper.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      whisper.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`Whisper process failed: ${stderr}`));
          return;
        }

        try {
          // Find the JSON output file
          const files = await fs.readdir(this.tempDir);
          const jsonFile = files.find(f => f.endsWith('.json'));
          
          if (!jsonFile) {
            reject(new Error('Whisper output file not found'));
            return;
          }

          const jsonPath = path.join(this.tempDir, jsonFile);
          const jsonContent = await fs.readFile(jsonPath, 'utf-8');
          const whisperResult = JSON.parse(jsonContent);

          // Parse Whisper output
          const segments: TranscriptionSegment[] = whisperResult.segments?.map((seg: any) => ({
            start: seg.start,
            end: seg.end,
            text: seg.text.trim(),
            confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : 0.8
          })) || [];

          const fullText = segments.map(s => s.text).join(' ');
          const avgConfidence = segments.length > 0 
            ? segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length 
            : 0.8;

          // Clean up JSON file
          await fs.unlink(jsonPath).catch(() => {});

          resolve({
            text: fullText,
            segments,
            language: whisperResult.language || 'unknown',
            confidence: avgConfidence,
            wordCount: fullText.split(/\s+/).filter(word => word.length > 0).length
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse Whisper output: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`));
        }
      });

      whisper.on('error', (error) => {
        reject(new Error(`Whisper process error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      });
    });
  }

  async transcribeFallback(audioPath: string): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    try {
      // Fallback transcription using basic audio analysis
      const features = await this.extractAudioFeatures(audioPath);
      
      // This is a placeholder - in a real implementation, you might use
      // alternative transcription services or libraries
      const mockTranscription = {
        text: '[Audio transcription not available - Whisper not installed]',
        segments: [{
          start: 0,
          end: features.duration,
          text: '[Audio transcription not available - Whisper not installed]',
          confidence: 0.1
        }],
        language: 'unknown',
        confidence: 0.1,
        processingTime: Date.now() - startTime,
        wordCount: 8
      };

      logger.warn('Using fallback transcription - Whisper not available');
      return mockTranscription;
    } catch (error) {
      logger.error('Fallback transcription failed:', error);
      throw new Error(`Fallback transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async transcribeAudio(audioPath: string, language?: string): Promise<TranscriptionResult> {
    try {
      // Try Whisper first, fallback if not available
      const hasWhisper = await this.checkWhisperAvailability();
      
      if (hasWhisper) {
        return await this.transcribeWithWhisper(audioPath, language);
      } else {
        return await this.transcribeFallback(audioPath);
      }
    } catch (error) {
      logger.error('Audio transcription failed:', error);
      // Try fallback if Whisper fails
      return await this.transcribeFallback(audioPath);
    }
  }

  async extractAudioFromVideo(videoPath: string): Promise<string> {
    const audioPath = path.join(this.tempDir, `${Date.now()}_extracted.wav`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .on('end', () => {
          logger.info(`Audio extracted from video: ${audioPath}`);
          resolve(audioPath);
        })
        .on('error', (err) => {
          logger.error('Audio extraction failed:', err);
          reject(new Error(`Audio extraction failed: ${err.message}`));
        })
        .save(audioPath);
    });
  }

  async transcribeVideo(videoPath: string, language?: string): Promise<TranscriptionResult> {
    try {
      // Extract audio from video
      const audioPath = await this.extractAudioFromVideo(videoPath);
      
      // Transcribe the extracted audio
      const result = await this.transcribeAudio(audioPath, language);
      
      // Clean up extracted audio file
      await fs.unlink(audioPath).catch(() => {});
      
      return result;
    } catch (error) {
      logger.error('Video transcription failed:', error);
      throw new Error(`Video transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async detectLanguage(audioPath: string): Promise<string> {
    try {
      // Use Whisper's language detection
      const result = await this.transcribeAudio(audioPath);
      return result.language;
    } catch (error) {
      logger.error('Language detection failed:', error);
      return 'unknown';
    }
  }

  async batchTranscribe(audioPaths: string[], language?: string): Promise<TranscriptionResult[]> {
    const results: TranscriptionResult[] = [];
    
    for (const audioPath of audioPaths) {
      try {
        const result = await this.transcribeAudio(audioPath, language);
        results.push(result);
        logger.info(`Transcribed: ${audioPath}`);
      } catch (error) {
        logger.error(`Failed to transcribe ${audioPath}:`, error);
        // Add error result
        results.push({
          text: '[Transcription failed]',
          segments: [],
          language: 'unknown',
          confidence: 0,
          processingTime: 0,
          wordCount: 0
        });
      }
    }
    
    return results;
  }
}

export const audioTranscriptionService = new AudioTranscriptionService();
export default audioTranscriptionService;