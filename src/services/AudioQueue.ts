import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export enum AudioPriority {
    SYSTEM = 1,
    SEGMENT_RESULT = 2,
    SEGMENT_APPROACH = 3,
    FRIEND_NEARBY = 4,
    LOW = 5,
  }

interface QueueItem {
  message: string;
  priority: AudioPriority;
  id: string;
}

class AudioQueueService {
  private queue: QueueItem[] = [];
  private isSpeaking: boolean = false;
  private currentPriority: AudioPriority | null = null;

  constructor() {
    // Configure audio session for ducking
    this.setupAudioSession();
  }

  private async setupAudioSession() {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
        interruptionModeIOS: 2,         // Changed: 2 = Duck others
        interruptionModeAndroid: 1,     // 1 = Duck others on Android
      });
      console.log('Audio session configured for ducking');
    } catch (error) {
      console.error('Failed to setup audio session:', error);
    }
  }

  /**
 * Add a message to the queue
 */
public announce(message: string, priority: AudioPriority) {
    const id = `${Date.now()}-${Math.random()}`;
    const item: QueueItem = { message, priority, id };
  
    console.log(`📢 Queuing: "${message}" (Priority ${priority})`);
  
    // If higher priority than current, interrupt
    if (this.isSpeaking && this.currentPriority !== null) {
      if (priority < this.currentPriority) {
        // Higher priority (lower number) - interrupt current
        console.log(`⚠️ Interrupting for higher priority`);
        Speech.stop();
        this.isSpeaking = false;
        this.currentPriority = null;
        this.queue = [item]; // Clear queue, insert at front
        // Don't call processQueue here - it will be called after speech stops
        return;
      }
    }
  
    // Insert into queue based on priority
    this.insertByPriority(item);
    console.log(`📋 Queue length: ${this.queue.length}`);
  
    // Start processing if not already speaking
    if (!this.isSpeaking) {
      console.log(`▶️ Starting queue processing`);
      this.processQueue();
    }
  }

  /**
   * Insert item into queue maintaining priority order
   */
  private insertByPriority(item: QueueItem) {
    const insertIndex = this.queue.findIndex(
      (queuedItem) => queuedItem.priority > item.priority
    );

    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }
  }

  /**
 * Process the next item in queue
 */
private async processQueue() {
    if (this.queue.length === 0) {
      console.log(`✅ Queue complete`);
      this.isSpeaking = false;
      this.currentPriority = null;
      return;
    }
  
    const item = this.queue.shift()!;
    console.log(`🔊 Speaking: "${item.message}" (Priority ${item.priority})`);
    this.isSpeaking = true;
    this.currentPriority = item.priority;
  
    try {
      await this.speak(item.message);
      console.log(`✔️ Finished: "${item.message}"`);
    } catch (error) {
      console.error('Speech error:', error);
    }
  
    // Move to next item
    this.isSpeaking = false;
    this.currentPriority = null;
    
    console.log(`⏭️ Moving to next item. Remaining: ${this.queue.length}`);
    this.processQueue();
  }

  /**
 * Speak a message using TTS
 */
private speak(message: string): Promise<void> {
    return new Promise((resolve) => {
      Speech.speak(message, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.95,
        onDone: () => {
          console.log(`✔️ Speech completed naturally`);
          resolve();
        },
        onStopped: () => {
          console.log(`⏹️ Speech stopped (interrupted)`);
          resolve();
        },
        onError: (error) => {
          console.log(`❌ Speech error:`, error);
          resolve();
        },
      });
    });
  }

  /**
   * Clear all queued announcements
   */
  public clearQueue() {
    this.queue = [];
    if (this.isSpeaking) {
      Speech.stop();
      this.isSpeaking = false;
      this.currentPriority = null;
    }
  }

  /**
   * Get current queue length (for debugging)
   */
  public getQueueLength(): number {
    return this.queue.length;
  }


  /**
 * Batch add multiple messages to queue before processing
 */
public batchAnnounce(items: Array<{ message: string; priority: AudioPriority }>) {
    console.log(`📦 Batch queuing ${items.length} messages`);
    
    // Add all items to queue without processing
    items.forEach(({ message, priority }) => {
      const id = `${Date.now()}-${Math.random()}`;
      const item: QueueItem = { message, priority, id };
      this.insertByPriority(item);
      console.log(`📢 Queued: "${message}" (Priority ${priority})`);
    });
    
    console.log(`📋 Total queue length: ${this.queue.length}`);
    
    // Now start processing if not already speaking
    if (!this.isSpeaking) {
      console.log(`▶️ Starting queue processing`);
      this.processQueue();
    }
  }
}

// Export singleton instance
export const audioQueue = new AudioQueueService();