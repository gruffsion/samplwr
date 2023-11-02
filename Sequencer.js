export class Sequencer {
    constructor(audioContext, padObjects) {
        this.padObjects = padObjects;
        this.sequencerIsPlaying= null;
        this.audioManager = audioContext;
      this.boxes = document.querySelectorAll(".box");
      this.playButton = document.querySelector(".play");
      this.stopButton = document.querySelector(".stop");
      this.index = 0;
      this.bpm = 120;
      this.isPlaying = null;
      this.tempoSlider = document.querySelector(".tempo-slider");
      this.swingAmount = 0; // Value between 0 and 1

    }
  
    activateBox(e) {
      e.currentTarget.classList.toggle("active");
    }
  
    repeat() {
        let step = this.index % 8;
        const activeBoxes = document.querySelectorAll(`.b${step}`);
        
        activeBoxes.forEach((bar) => {
          const animationName = bar.classList.contains("active") ? 'playTrackActive' : 'playTrack';
          bar.style.animation = `${animationName} 0.3s alternate ease-in-out 2`;
      
          if (bar.classList.contains("active") && bar.classList.contains("box")) {
            const pad = this.audioManager.padObjects.find(p => bar.classList.contains(p.id));
            if (pad) {
              this.audioManager.playAudio(pad.id);
            }
          }
        });
        
        this.index++;
        this.applySwing();
      }
    
      applySwing() {
        if (this.index % 2 !== 0 && this.swingAmount > 0) {
          // Apply swing on every other beat
          const interval = (30 / this.bpm) * 1000;
          const swingInterval = interval * this.swingAmount;
    
          // Clear the regular interval and set a timeout for the next step
          clearInterval(this.isPlaying);
          this.isPlaying = setTimeout(() => {
            this.repeat();
            this.start(); // Restart the regular interval
          }, swingInterval);
        }
      }
    
      start() {
        const interval = (30 / this.bpm) * 1000;
        if (this.isPlaying) clearInterval(this.isPlaying);
        this.isPlaying = setInterval(() => this.repeat(), interval);
      }
  
    stop() {
      if (this.isPlaying) {
        clearInterval(this.isPlaying);
        this.isPlaying = null;
      }
      this.sequencerIsPlaying = false;
      this.index = 0;
    }
  
    changeTempo(e) {
      const tempoVal = document.querySelector(".tempo-val");
      tempoVal.innerText = e.target.value;
    }
  
    updateTempo(e) {
      // Update the BPM
      this.bpm = e.target.value;
    
      // Clear the interval if it's running
      if (this.isPlaying) {
        clearInterval(this.isPlaying);
        this.isPlaying = null;
      }
    
      // Start the sequencer again if it was playing
      if (this.sequencerIsPlaying) {
        this.start();
      }
    }    
    
  }