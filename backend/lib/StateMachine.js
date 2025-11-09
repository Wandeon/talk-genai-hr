class StateMachine {
  constructor() {
    this.state = 'idle';
    this.callbacks = [];

    // Define valid transitions
    this.transitions = {
      idle: ['start', 'text_message', 'image_upload'],
      listening: ['silence_detected', 'text_message', 'image_upload', 'stop'],
      transcribing: ['transcription_complete', 'stop'],
      thinking: ['llm_complete', 'stop'],
      speaking: ['audio_complete', 'interrupt', 'stop'],
      analyzing_image: ['image_analysis_complete', 'stop']
    };

    // Define next states
    this.nextStates = {
      start: 'listening',
      silence_detected: 'transcribing',
      transcription_complete: 'thinking',
      text_message: 'thinking',
      llm_complete: 'speaking',
      audio_complete: 'listening',
      interrupt: 'listening',
      stop: 'idle',
      image_upload: 'analyzing_image',
      image_analysis_complete: 'listening'
    };
  }

  getState() {
    return this.state;
  }

  transition(event) {
    const validTransitions = this.transitions[this.state];

    if (!validTransitions || !validTransitions.includes(event)) {
      throw new Error(`Invalid transition: ${event} from state ${this.state}`);
    }

    const oldState = this.state;
    this.state = this.nextStates[event];

    // Notify callbacks
    this.callbacks.forEach(cb => cb(oldState, this.state));
  }

  onStateChange(callback) {
    this.callbacks.push(callback);
  }

  reset() {
    this.state = 'idle';
  }
}

module.exports = StateMachine;
