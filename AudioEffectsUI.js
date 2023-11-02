// In AudioEffects.js
export class AudioEffectsUI {
    constructor(audioEffects) {
      this.audioEffects = audioEffects;
      this.setupEventListeners();
    }
  
    setupEventListeners() {
      document.getElementById('delayTime').addEventListener('input', this.updateDelayTime.bind(this));
      document.getElementById('feedback').addEventListener('input', this.updateFeedback.bind(this));
      document.getElementById('filterFrequency').addEventListener('input', this.updateFilterFrequency.bind(this));
      document.getElementById('filterType').addEventListener('change', this.updateFilterType.bind(this));
      document.querySelectorAll('input[type="range"]').forEach(input => {
        // input.addEventListener('input', function() {
        //   document.getElementById(this.id + 'Value').textContent = this.value;
        // });
      });
    }
  
    updateDelayTime(event) {
      const delayTime = parseFloat(event.target.value);
      this.audioEffects.setDelayTime(delayTime);
    }
  
    updateFeedback(event) {
      const feedback = parseFloat(event.target.value);
      this.audioEffects.setFeedback(feedback);
    }
  
  
  
    updateFilterFrequency(event) {
        const slider = document.getElementById('filterFrequency');
        const logValue = parseFloat(slider.value);
        const frequency = Math.pow(10, logValue);
        this.audioEffects.setFilter(frequency);
        this.setSliderFromFilterFrequency(frequency);
      }
    
      setSliderFromFilterFrequency(frequency) {
        const slider = document.getElementById('filterFrequency');
        const logValue = Math.log10(frequency);
        slider.value = logValue;
        // document.getElementById('filterFrequencyValue').textContent = frequency.toFixed(2);
      }
      
  
      updateFilterType(event) {
        const type = event.target.value;
        const frequency = this.audioEffects.filterNode.frequency.value; // Get the current filter frequency
        this.audioEffects.setFilter(frequency, type);
      }
  }
  