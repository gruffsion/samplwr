export class AudioEffects {
  constructor(audioContext) {
    if (!(audioContext instanceof AudioContext)) {
      throw new Error('Invalid AudioContext provided');
    }

    this.audioContext = audioContext;
    
    this.initNodes();
    this.connectNodes();
    this.setDefaultValues();
  }

  initNodes() {
    this.delayNode = this.audioContext.createDelay();
    this.feedbackNode = this.audioContext.createGain();
    this.wetNode = this.audioContext.createGain();
    this.dryNode = this.audioContext.createGain();
    this.filterNode = this.audioContext.createBiquadFilter();
  }

  connectNodes() {
    this.delayNode.connect(this.feedbackNode);
    this.feedbackNode.connect(this.delayNode); // Feedback loop
    this.delayNode.connect(this.filterNode);
    this.filterNode.connect(this.wetNode);
    this.wetNode.connect(this.audioContext.destination);
    this.dryNode.connect(this.audioContext.destination);
  }

  setDefaultValues() {
    this.setDelayTime(0.5);
    this.setFeedback(0.5);
    this.setWetDry(0.5);
    this.setFilter(2000, 'lowpass');
  }

  setDelayTime(delayTime) {
    if (typeof delayTime !== 'number' || delayTime < 0) {
      throw new Error('Invalid delay time. Must be a non-negative number.');
    }
    this.delayNode.delayTime.value = delayTime;
  }

  setFeedback(amount) {
    if (typeof amount !== 'number' || amount < 0 || amount > 1) {
      throw new Error('Invalid feedback amount. Must be a number between 0 and 1.');
    }
    this.feedbackNode.gain.value = amount;
  }

  setWetDry(wetAmount) {
    if (typeof wetAmount !== 'number' || wetAmount < 0 || wetAmount > 1) {
      throw new Error('Invalid wet amount. Must be a number between 0 and 1.');
    }
    this.wetNode.gain.value = wetAmount;
    this.dryNode.gain.value = 1 - wetAmount;
  }

  setFilter(frequency, type = 'lowpass') {
    if (typeof frequency !== 'number' || frequency <= 0) {
      throw new Error('Invalid frequency. Must be a positive number.');
    }
    if (typeof type !== 'string' || !['lowpass', 'highpass', 'bandpass', 'notch', 'allpass'].includes(type)) {
      throw new Error('Invalid filter type. Must be one of: lowpass, highpass, bandpass, notch, allpass.');
    }
    this.filterNode.frequency.value = frequency;
    this.filterNode.type = type;
  }

  

  // Other methods and properties...
}

