import { AudioEffects } from './audioEffects.js';
import { AudioEffectsUI } from './AudioEffectsUI.js';
import { Sequencer } from './Sequencer.js';

const startTimeSlider = document.getElementById("start-time-slider");
const endTimeSlider = document.getElementById("end-time-slider");
startTimeSlider.addEventListener('input', updateStartAndEndTimes);
endTimeSlider.addEventListener('input', updateStartAndEndTimes);

let selectedPadId = null;
let lastSelectedPadId = null;
let sequencer;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioEffects = new AudioEffects(audioContext);
const audioEffectsUI = new AudioEffectsUI(audioEffects);

const CONSTANTS = {
    LINE_WIDTH: 3,
    STROKE_COLOR: 'rgb(255, 0, 0)',
    FILL_COLOR: 'rgb(255, 255, 255)',
    NUM_OF_PADS: 8,
    SEQUENCER_IS_PLAYING: false
};




class AudioManager {
  constructor() {
    this.audioContext = audioContext;
    this.audioEffects = audioEffects;
    this.gainNodes = [];
    this.padObjects = [];
    this.delayGainNodes = [];
  }
  
  createChannelGainNodeForPad(padId) {
    const gainNode = this.audioContext.createGain(); // Create a gain node
    const delayGainNode = this.audioContext.createGain(); // Create a gain node
    delayGainNode.connect(this.audioEffects.delayNode); // Connect to delay effect
    delayGainNode.gain.value = 0;
    gainNode.connect(this.audioContext.destination); // Connect to speakers
    gainNode.connect(delayGainNode); // Connect to delay effect
    gainNode.id = padId;
    this.gainNodes.push(gainNode);
    delayGainNode.id = padId;
    this.delayGainNodes.push(delayGainNode);
  }

  getPadObject(padId) {
    return this.padObjects.find(obj => obj.id === padId);
  }

  getpadObjects() {
    return this.padObjects;
  }

  async decodeAudio(audioBlob) {
    const arrayBuffer = await audioBlob.arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  async recordAudio(padId) {
    const padObject = {
      id: padId,
      chunks: [],
      mp3File: null,
      mediaRecorder: null,
      visual: null,
      startTime: 0,
      endTime: 0 // Set the endTime to 0 initially
    };

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(audioStream);

      mediaRecorder.ondataavailable = event => padObject.chunks.push(event.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(padObject.chunks, { type: "audio/webm" });
        const audioURL = URL.createObjectURL(blob);
        const audio = new Audio(audioURL);
        audio.preload = "auto";
        console.log(padObject.mediaRecorder.state);

        audio.onerror = function() {
          console.error("Audio error:", audio.error);
        };

        audio.onloadedmetadata = async function() {
          audio.currentTime = Number.MAX_SAFE_INTEGER;
          audio.ontimeupdate = async () => {
            audio.ontimeupdate = null; // Cleanup the event listener
            audio.currentTime = 0;

            if (audio.readyState >= audio.HAVE_METADATA) {
              if (isFinite(audio.duration)) {
                padObject.endTime = audio.duration;

                // Move the await inside this block
                await this.processAudioData(padObject, blob);
              } else {
                console.log("duration is not finite");
              }
            }
          };
        }.bind(this);

        padObject.audioElement = audio;
      };

      padObject.mediaRecorder = mediaRecorder;
      mediaRecorder.start();
    } catch (error) {
      console.error(`Error starting recording for ${padId}:`, error);
    }

    this.padObjects.push(padObject);
    return padObject;
  }

  playAudio(padId) {
    const padObject = this.getPadObject(padId);
    if (!padObject.audioBuffer) {
      console.error("Audio not loaded for the selected pad.");
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = padObject.audioBuffer;
    source.connect(this.getGainNodeForPad(padId)); // Connect to the gain node
    source.start(0, padObject.startTime, padObject.endTime - padObject.startTime);
    source.onended = () => {
      source.disconnect();
    };
  }

  async processAudioData(padObject, blob) {
    const base64String = await this._convertBlobToBase64(blob);
    padObject.mp3File = base64String;

    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    padObject.audioBuffer = audioBuffer;

    const bytes = this._base64ToUint8Array(base64String);
    const decodedData = await this.audioContext.decodeAudioData(bytes.buffer);
    padObject.visual = this.computeVisualizationPoints(decodedData, padObject.id);
    drawWaveform(padObject.visual);
    setSliderstoDefault();
    updateOverlay();
    padObject.chunks = [];
    toggleSlidersActive();
  }

  computeVisualizationPoints(decodedData, id) {
    const padId = id;
    if (!decodedData) {
      throw new Error("No decoded data provided");
    }

    // Get the audio duration and log it
    const audioDuration = decodedData.duration;

    // Update the endTime of the corresponding padObject
    const targetPadObject = audioManager.getPadObject(padId);
    if (targetPadObject) {
      targetPadObject.endTime = audioDuration;
    }

    const channelData = decodedData.getChannelData(0);
    const { width: WIDTH, height: HEIGHT } = canvas;
    const sliceWidth = WIDTH / channelData.length;
    const points = [];

    for (let i = 0; i < channelData.length; i++) {
      const x = i * sliceWidth;
      const y = (1 + channelData[i]) * HEIGHT / 2;
      points.push({ x, y });
    }

    return {
      canvasContext,
      points,
      WIDTH,
      HEIGHT
    };
  }

  getGainNodeForPad(padId) {
    return this.gainNodes.find(node => node.id === padId);
  }

  setGainValue(sliderValue, padId) {
    const gain = sliderValue / 100;
    const gainNode = this.getGainNodeForPad(padId);
    gainNode.gain.value = sliderValue;
  }

  getDelayNodeGainValue(padId) {
    return this.delayGainNodes.find(node => node.id === padId);
  }

  setDelayNodeGainValue(sliderValue, padId) {
    const delayGainNode = this.getDelayNodeGainValue(padId);
    delayGainNode.gain.value = sliderValue;
  }


  _convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  _base64ToUint8Array(base64String) {
    const binaryString = atob(base64String.split(',')[1]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}

const audioManager = new AudioManager(audioContext, audioEffects);



function selectPad(padId){
  selectedPadId = padId;
  const padObject = audioManager.getPadObject(padId);
   // Check if we're currently recording; if so, stop recording
   if (padObject && padObject.mediaRecorder && padObject.mediaRecorder.state === "recording") {
    console.log("Currently recording into pad", padId);
    return;
  }

  if (!padObject) {
    console.error("No pad selected.");
    return;
  }
 
  //  Visual updates for waveform and sliders when sequencer is playing, but don't play audio
    
    if (selectedPadId !== lastSelectedPadId && padObject.audioElement && isFinite(padObject.audioElement.duration)) {
      const totalDuration = padObject.audioElement.duration;
      const playButton = getButtonForPad(padId, "play");
      playButton.classList.add('selected-pad');
      // Set slider values based on padObject startTime and endTime
      startTimeSlider.value = (padObject.startTime / totalDuration) * 100;
      endTimeSlider.value = (padObject.endTime / totalDuration) * 100;
      console.log("slider values updated" + endTimeSlider.value);
      displayPadWaveform(padId);
      displayPadGainValue(padId);
      displayPadDelayValue(padId);

      // remove selected class from previous selected pad 
      if (lastSelectedPadId !== null && lastSelectedPadId !== selectedPadId) {
        const lastSelectedPlayButton = getButtonForPad(lastSelectedPadId, "play");
        lastSelectedPlayButton.classList.remove('selected-pad');
      }
    }

    lastSelectedPadId = padId; // Update lastSelectedPadId


    audioManager.playAudio(padId);

    console.log(selectedPadId);
    toggleSlidersActive();
  }

async function toggleRecording(padId) {
  selectedPadId=padId;
  const padObject = audioManager.getPadObject(padId);
  const recordButton = getButtonForPad(padId, "record");
  const deleteButton = getButtonForPad(padId, "delete");
  const playButton = getButtonForPad(padId, "play");

  // Remove previous pad object, if exists
  if (padObject) {
    const index = audioManager.padObjects.findIndex(obj => obj.id === padId);
    if (index > -1) {
        audioManager.padObjects.splice(index, 1);
        selectedPadId = padId;
        // clearCanvas()
    }
}
  
  if (padObject && padObject.mediaRecorder.state === "recording") {
      // Stop the current recording
      padObject.mediaRecorder.stop();
      padObject.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      recordButton.innerText = "Recordio";
      recordButton.classList.remove('recording');
      playButton.classList.remove('recording');
      playButton.classList.add('selected-pad');
      deleteButton.classList.add('delete-avaliable');
      updateVisualsAfterRecording(padId);
  } else {
   
      // Start a new recording
      try {
        playButton.classList.add('recording');
          const newPadObject = await audioManager.recordAudio(padId);
          audioManager.padObjects.push(newPadObject);
          recordButton.innerText = "Stopio";

          
      } catch (error) {
          console.error(`Error starting recording for ${padId}:`, error);
      }
  }
  //remove selected class from previous selected pad
  if (lastSelectedPadId !== null && lastSelectedPadId !== selectedPadId) {
    const lastSelectedPlayButton = getButtonForPad(lastSelectedPadId, "play");
    lastSelectedPlayButton.classList.remove('selected-pad');
  }
  lastSelectedPadId = padId; // Update lastSelectedPadId
 
}

function deleteRecording(padId) {
  const padObject = audioManager.getPadObject(padId);
  
  // Release resources and delete audio file
  if (padObject.audioElement) {
      padObject.audioElement.src = '';
      padObject.audioElement = null;
  }

  if (padObject.mp3File) {
      // Assuming mp3File is a URL created using URL.createObjectURL
      padObject.audioBuffer = null;
  }
  getButtonForPad(padId, "play").classList.remove('recorded');
  getButtonForPad(padId, "delete").classList.remove('delete-avaliable');
  setSliderstoDefault();
  clearCanvas();
  updateOverlay();
  audioManager.getGainNodeForPad(padId).gain.value = 1; 
  displayPadGainValue(padId);
  displayPadDelayValue(padId);
}


function getButtonForPad(padId, type) {
  return document.getElementById(`${padId}-${type}-button`);
}


function createPad(padId, gridContainer) {
  const pad = {
    id: padId,
    label: `Pad ${padId.split('-')[1]}`,
    audioKey: `audio-${padId.split('-')[1]}`
  };
  const gridItem = document.createElement("div");
  const playButton = document.createElement("button");
  const recordButton = document.createElement("button");
  const deleteButton = document.createElement("button");

  gridItem.id = pad.id;
  playButton.id = `${pad.id}-play-button`;
  recordButton.id = `${pad.id}-record-button`;
  deleteButton.id = `${pad.id}-delete-button`;

  gridItem.classList.add("grid-item");
  playButton.classList.add("play-button");
  recordButton.classList.add("record-button");
  deleteButton.classList.add("delete-button");

  recordButton.innerText = "Recordio";
  deleteButton.innerText = "X";

  gridItem.appendChild(playButton);
  gridItem.appendChild(recordButton);
  gridItem.appendChild(deleteButton);

  playButton.addEventListener('click', () => CONSTANTS.SEQUENCER_IS_PLAYING ? displayPadWaveform(padId) : selectPad(pad.id));
  recordButton.addEventListener('click', () => toggleRecording(pad.id));
  deleteButton.addEventListener('click', () => deleteRecording(pad.id));

  audioManager.createChannelGainNodeForPad(padId)

  if (gridContainer) {
    gridContainer.appendChild(gridItem);
    createSequencerForPad(pad, padId.split('-')[1]);
  } else {
    console.error('Could not find grid container element');
  }
}

function displayPadWaveform(padId){
  const padObject = audioManager.getPadObject(padId);
  const totalDuration = padObject.audioElement.duration;
      // Set slider values based on padObject startTime and endTime
      startTimeSlider.value = (padObject.startTime / totalDuration) * 100;
      endTimeSlider.value = (padObject.endTime / totalDuration) * 100;
      updateStartAndEndTimes();
      updateOverlay();
      drawWaveform(padObject.visual);
}

function createGridItems() {
  return new Promise((resolve, reject) => {
  const gridContainer = document.querySelector('.grid-container');
  if (!gridContainer) {
    console.error('Could not find grid container element');
    return;
  }
  for (let i = 0; i < CONSTANTS.NUM_OF_PADS; i++) {
    const padId = `pad-${i}`;
    createPad(padId, gridContainer);
  }
  resolve();
});
}


function updateStartAndEndTimes() {
  if (!selectedPadId) {
    console.error("No pad selected.");
    return;
  }
  const padObject = audioManager.getPadObject(selectedPadId);

  if (!padObject || !padObject.mp3File) {
    console.error("No audio loaded for the selected pad.");
    return;
  }
  if (padObject.audioElement && isFinite(padObject.audioElement.duration)) {
    // Calculate the times based on percentages
    const totalDuration = padObject.audioElement.duration;
    padObject.startTime = (parseFloat(startTimeSlider.value) / 100) * totalDuration;
    padObject.endTime = (parseFloat(endTimeSlider.value) / 100) * totalDuration;

    // Ensure start time doesn't exceed end time
    if (padObject.startTime > padObject.endTime) {
      padObject.startTime = padObject.endTime;
      startTimeSlider.value = (padObject.startTime / totalDuration) * 100;
    }
  } else {
    console.log(padObject.endTime)
    console.error("Audio metadata not loaded yet.");
  }
}

const gainSlider = document.getElementById("gain-slider");
gainSlider.addEventListener("input", () => {
  const padId = selectedPadId;
  const sliderValue = gainSlider.value;
   audioManager.setGainValue(sliderValue, padId)
});

function displayPadGainValue(padId){
  const gainValue = audioManager.getGainNodeForPad(padId).gain.value;
  gainSlider.value = gainValue;
} 


const delaySlider = document.getElementById("delay-send-slider");
delaySlider.addEventListener("input", () => {
  const padId = selectedPadId;
  const sliderValue = delaySlider.value;
   audioManager.setDelayNodeGainValue(sliderValue, padId)
});


function displayPadDelayValue(padId){
  const delayValue = audioManager.getDelayNodeGainValue(padId).gain.value;
  delaySlider.value = delayValue;
} 




//visual elements

const canvas = document.getElementById("waveform-canvas");
const canvasContext = canvas.getContext("2d");

// Get the parent container's dimensions
const container = document.getElementById("canvas-elements");
const containerWidth = container.clientWidth;
const containerHeight = container.clientHeight;

// Set the canvas size based on the container's dimensions
canvas.width = containerWidth;
canvas.height = containerHeight;

function toggleSlidersActive() {
  const sliders = document.getElementById('audio-range-sliders');
  if (sliders.classList.contains('active') && selectedPadId == null) {
    sliders.classList.remove('active');
  } else {
    sliders.classList.add('active');
  }
}

function drawWaveform({ canvasContext, points }) {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.lineWidth = CONSTANTS.LINE_WIDTH;
  canvasContext.strokeStyle = CONSTANTS.STROKE_COLOR;
  canvasContext.beginPath();

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const x = (i / (points.length - 1)) * canvas.width; // Scale x-coordinate based on canvas width
    const y = point.y; // Use the original y-coordinate

    if (i === 0) {
      canvasContext.moveTo(x, y);
    } else {
      canvasContext.lineTo(x, y);
    }
  }

  canvasContext.stroke();
}


function updateVisualsAfterRecording(padId) {
  const recordButton = document.getElementById(`${padId}-record-button`);
  const playButton = document.getElementById(`${padId}-play-button`);
  if (recordButton) {
    recordButton.innerText = "Recordio";
    recordButton.classList.remove('recording');
    playButton.classList.add('recorded');
  }
}

function clearCanvas() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
}

function setSliderstoDefault() {
  startTimeSlider.value=0;
  endTimeSlider.value=100;
  toggleSlidersActive();  
}

function updateOverlay() {
  const leftOverlay = document.getElementById('left-overlay');
  const rightOverlay = document.getElementById('right-overlay');
  const startPercentage = parseFloat(startTimeSlider.value);
  const endPercentage = parseFloat(endTimeSlider.value);
  const canvasWidth = canvas.width; // Get the canvas width

  // Calculate the left and right positions and widths based on the canvas width
  const startPixel = (startPercentage / 100) * canvasWidth;
  const endPixel = (endPercentage / 100) * canvasWidth;
  const rightOverlayWidth = canvasWidth - endPixel;

  // Update the styles of the overlays  q
  leftOverlay.style.width = startPixel + 'px';
  rightOverlay.style.left = endPixel + 'px';
  rightOverlay.style.width = rightOverlayWidth + 'px';
}


//Step Sequencer

let sequencerRowNumber = 1;
function createSequencerForPad(pad) {
  // Create the parent container for the sequencer
  const sequencerContainer = document.querySelector('.patterns');

  // Create and append the <h1> with pad name
  const padNameElement = document.createElement('span');
  padNameElement.textContent = `Pad ${sequencerRowNumber}`;
  sequencerRowNumber++;
  sequencerContainer.appendChild(padNameElement);

  // Create and append the 8 steps
  for (let i = 0; i < 8; i++) {
    const step = document.createElement('div');
    step.className = `box ${pad.id} b${i}`;
    const stepNumber = document.createElement('span');
    stepNumber.className = 'mobile-num';
    stepNumber.textContent = i + 1; // +1 to make it 1-based
    step.appendChild(stepNumber);
    sequencerContainer.appendChild(step);
  }
sequencer = new Sequencer(audioManager, audioManager.padObjects);
sequencer.id = pad.id;
}

//page initialization

createGridItems();

// Attach slider events for the start and end time sliders to update the overlay:
document.getElementById('start-time-slider').addEventListener('input', updateOverlay);
document.getElementById('end-time-slider').addEventListener('input', updateOverlay);


sequencer.boxes.forEach((box) => {
  box.addEventListener("click", sequencer.activateBox);
  box.addEventListener("animationend", function () {
    this.style.animation = "";
  });
});

sequencer.playButton.addEventListener("click", function () {
  sequencer.start();
  // sequencer.updateBtn();
});

sequencer.stopButton.addEventListener("click", function () {
  sequencer.stop();
  // sequencer.updateBtn();
});


// Tempo Slider
sequencer.tempoSlider.addEventListener("input", (e) => {
  sequencer.changeTempo(e);
});

sequencer.tempoSlider.addEventListener("change", (e) => {
  sequencer.updateTempo(e);
});

document.addEventListener('DOMContentLoaded', (event) => {
  document.getElementById('toggle-delay-effects').addEventListener('click', function() {
    const elements = document.getElementById('delay-effect-controls');
    elements.classList.toggle('display-delay');
    console.log('clicked');
  });
});

updateOverlay();