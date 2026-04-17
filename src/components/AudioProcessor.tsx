import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Upload, Settings2, Activity, Waves, Repeat, Zap, Box, Radio, Monitor, BarChart2, Crosshair, Radar, Layers, SlidersVertical, FolderOpen, Save, Download } from 'lucide-react';

const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const makeDistortionCurve = (amount: number) => {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
};

const generateImpulseResponse = (ctx: BaseAudioContext, duration: number, decay: number) => {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const factor = Math.pow(1 - i / length, decay);
    left[i] = (Math.random() * 2 - 1) * factor;
    right[i] = (Math.random() * 2 - 1) * factor;
  }
  return impulse;
};

const colorTheme = {
  emerald: { text: 'text-emerald-400', border: 'border-emerald-400', bg: 'bg-emerald-400', shadow: 'shadow-[0_0_10px_rgba(52,211,153,0.4)]', glow: 'shadow-[0_0_8px_rgba(52,211,153,0.8)]', bgLight: 'bg-emerald-400/20', borderTop: 'border-t-emerald-500' },
  cyan: { text: 'text-cyan-400', border: 'border-cyan-400', bg: 'bg-cyan-400', shadow: 'shadow-[0_0_10px_rgba(34,211,238,0.4)]', glow: 'shadow-[0_0_8px_rgba(34,211,238,0.8)]', bgLight: 'bg-cyan-400/20', borderTop: 'border-t-cyan-500' },
  orange: { text: 'text-orange-400', border: 'border-orange-400', bg: 'bg-orange-400', shadow: 'shadow-[0_0_10px_rgba(251,146,60,0.4)]', glow: 'shadow-[0_0_8px_rgba(251,146,60,0.8)]', bgLight: 'bg-orange-400/20', borderTop: 'border-t-orange-500' },
  red: { text: 'text-red-400', border: 'border-red-400', bg: 'bg-red-400', shadow: 'shadow-[0_0_10px_rgba(248,113,113,0.4)]', glow: 'shadow-[0_0_8px_rgba(248,113,113,0.8)]', bgLight: 'bg-red-400/20', borderTop: 'border-t-red-500' },
  purple: { text: 'text-purple-400', border: 'border-purple-400', bg: 'bg-purple-400', shadow: 'shadow-[0_0_10px_rgba(168,85,247,0.4)]', glow: 'shadow-[0_0_8px_rgba(168,85,247,0.8)]', bgLight: 'bg-purple-400/20', borderTop: 'border-t-purple-500' },
  yellow: { text: 'text-yellow-400', border: 'border-yellow-400', bg: 'bg-yellow-400', shadow: 'shadow-[0_0_10px_rgba(234,179,8,0.4)]', glow: 'shadow-[0_0_8px_rgba(234,179,8,0.8)]', bgLight: 'bg-yellow-400/20', borderTop: 'border-t-yellow-500' },
  blue: { text: 'text-blue-400', border: 'border-blue-400', bg: 'bg-blue-400', shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.4)]', glow: 'shadow-[0_0_8px_rgba(59,130,246,0.8)]', bgLight: 'bg-blue-400/20', borderTop: 'border-t-blue-500' },
};

type ColorKey = keyof typeof colorTheme;

function audioBufferToWav(buffer: AudioBuffer) {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length * numChannels * 2;
  const bufferWav = new ArrayBuffer(44 + length);
  const view = new DataView(bufferWav);
  
  const sampleRate = buffer.sampleRate;
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);
  
  let offset = 44;
  if (numChannels === 2) {
    const channel0 = buffer.getChannelData(0);
    const channel1 = buffer.getChannelData(1);
    for (let i = 0; i < buffer.length; i++) {
      let s0 = Math.max(-1, Math.min(1, channel0[i]));
      view.setInt16(offset, s0 < 0 ? s0 * 0x8000 : s0 * 0x7FFF, true);
      offset += 2;
      let s1 = Math.max(-1, Math.min(1, channel1[i]));
      view.setInt16(offset, s1 < 0 ? s1 * 0x8000 : s1 * 0x7FFF, true);
      offset += 2;
    }
  } else {
    const channel0 = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      let s0 = Math.max(-1, Math.min(1, channel0[i]));
      view.setInt16(offset, s0 < 0 ? s0 * 0x8000 : s0 * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return new Blob([view], { type: 'audio/wav' });
}

const HardwareVerticalSlider = ({ label, value, min, max, step, onChange, onManualChange }: any) => {
  const [localVal, setLocalVal] = useState(value.toString());
  
  useEffect(() => {
    setLocalVal(value.toString());
  }, [value]);

  const handleBlur = () => {
    let parsed = parseFloat(localVal);
    if (isNaN(parsed)) parsed = 0;
    parsed = Math.max(parseFloat(min), Math.min(parseFloat(max), parsed));
    setLocalVal(parsed.toString());
    onManualChange(parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-3 w-full">
      <input
        type="text"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="font-mono text-[9px] text-[#8b92a5] h-5 w-7 sm:w-9 bg-black/40 border border-gray-700/50 rounded text-center focus:outline-none focus:border-blue-500 focus:text-blue-400 transition-colors"
      />
      <div className="relative h-32 w-6 flex justify-center">
        <input 
          type="range" min={min} max={max} step={step} value={value} onChange={onChange}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-cyan-400 transition-all -rotate-90"
          style={{ transformOrigin: 'center' }}
        />
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/20 pointer-events-none -translate-y-1/2" />
      </div>
      <span className="font-mono text-[9px] uppercase tracking-widest text-[#8b92a5]">{label}</span>
    </div>
  );
};

const HardwareSlider = ({ label, value, min, max, step, onChange, unit = "" }: any) => (
  <div className="space-y-1">
    <div className="flex justify-between items-end">
      <span className="font-mono text-[10px] uppercase tracking-widest text-hardware-muted">{label}</span>
      <span className="font-mono text-xs text-hardware-text">{value}{unit}</span>
    </div>
    <input 
      type="range" min={min} max={max} step={step} value={value} onChange={onChange}
      className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-hardware-muted hover:accent-white transition-all"
    />
  </div>
);

const HardwareToggle = ({ label, enabled, onToggle, color = 'red' }: { label: string, enabled: boolean, onToggle: () => void, color?: ColorKey }) => {
  const theme = colorTheme[color];
  return (
    <button 
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all ${
        enabled 
          ? `${theme.bgLight} ${theme.border} ${theme.text} ${theme.shadow}` 
          : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${enabled ? `${theme.bg} ${theme.glow}` : 'bg-gray-600'}`} />
      <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
    </button>
  );
};

export default function AudioProcessor() {
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  
  // Visualizer State
  const [visualizerMode, setVisualizerMode] = useState<'waveform' | 'spectrum' | 'xy' | 'radial' | 'waterfall'>('waveform');

  // Transport State
  const [speed, setSpeed] = useState(1);

  // EQ State
  const [eqEnabled, setEqEnabled] = useState(false);
  const [eqBands, setEqBands] = useState<number[]>(new Array(10).fill(0));

  // Tremolo State
  const [tremoloEnabled, setTremoloEnabled] = useState(false);
  const [tremoloRate, setTremoloRate] = useState(5);
  const [tremoloDepth, setTremoloDepth] = useState(0.8);
  
  // Distortion State
  const [distEnabled, setDistEnabled] = useState(false);
  const [distAmount, setDistAmount] = useState(50);
  
  // Filter State
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [filterFreq, setFilterFreq] = useState(2000);
  
  // Delay State
  const [delayEnabled, setDelayEnabled] = useState(false);
  const [delayTime, setDelayTime] = useState(0.3);
  const [delayFeedback, setDelayFeedback] = useState(0.4);

  // Reverb State
  const [reverbEnabled, setReverbEnabled] = useState(false);
  const [reverbTime, setReverbTime] = useState(2.0);
  const [reverbMix, setReverbMix] = useState(0.5);

  // Refs for Audio Nodes
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const eqWetRef = useRef<GainNode | null>(null);
  const eqDryRef = useRef<GainNode | null>(null);

  const tremoloGainRef = useRef<GainNode | null>(null);
  const tremoloModRef = useRef<GainNode | null>(null);
  const tremoloOscRef = useRef<OscillatorNode | null>(null);

  const distNodeRef = useRef<WaveShaperNode | null>(null);
  const distWetRef = useRef<GainNode | null>(null);
  const distDryRef = useRef<GainNode | null>(null);

  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  
  const delayNodeRef = useRef<DelayNode | null>(null);
  const feedbackNodeRef = useRef<GainNode | null>(null);
  const delayWetRef = useRef<GainNode | null>(null);

  const convolverRef = useRef<ConvolverNode | null>(null);
  const reverbWetRef = useRef<GainNode | null>(null);
  const reverbDryRef = useRef<GainNode | null>(null);
  
  // Refs for visualizer
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserLeftRef = useRef<AnalyserNode | null>(null);
  const analyserRightRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const startTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsInputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const exportSettings = () => {
    const settings = {
      visualizerMode, speed, eqEnabled, eqBands,
      tremoloEnabled, tremoloRate, tremoloDepth,
      distEnabled, distAmount, filterEnabled, filterFreq,
      delayEnabled, delayTime, delayFeedback,
      reverbEnabled, reverbTime, reverbMix
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audio-rack-preset.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const settings = JSON.parse(event.target?.result as string);
        if (settings.visualizerMode !== undefined) setVisualizerMode(settings.visualizerMode);
        if (settings.speed !== undefined) setSpeed(settings.speed);
        if (settings.eqEnabled !== undefined) setEqEnabled(settings.eqEnabled);
        if (settings.eqBands !== undefined) setEqBands(settings.eqBands);
        if (settings.tremoloEnabled !== undefined) setTremoloEnabled(settings.tremoloEnabled);
        if (settings.tremoloRate !== undefined) setTremoloRate(settings.tremoloRate);
        if (settings.tremoloDepth !== undefined) setTremoloDepth(settings.tremoloDepth);
        if (settings.distEnabled !== undefined) setDistEnabled(settings.distEnabled);
        if (settings.distAmount !== undefined) setDistAmount(settings.distAmount);
        if (settings.filterEnabled !== undefined) setFilterEnabled(settings.filterEnabled);
        if (settings.filterFreq !== undefined) setFilterFreq(settings.filterFreq);
        if (settings.delayEnabled !== undefined) setDelayEnabled(settings.delayEnabled);
        if (settings.delayTime !== undefined) setDelayTime(settings.delayTime);
        if (settings.delayFeedback !== undefined) setDelayFeedback(settings.delayFeedback);
        if (settings.reverbEnabled !== undefined) setReverbEnabled(settings.reverbEnabled);
        if (settings.reverbTime !== undefined) setReverbTime(settings.reverbTime);
        if (settings.reverbMix !== undefined) setReverbMix(settings.reverbMix);
      } catch (err) {
        console.error("Invalid settings file", err);
      }
    };
    reader.readAsText(file);
    if(settingsInputRef.current) settingsInputRef.current.value = '';
  };

  useEffect(() => {
    let animFrame: number;
    const updateProgress = () => {
      if (isPlaying && audioCtx && buffer) {
        const playedTime = audioCtx.currentTime - startTimeRef.current;
        const totalTime = buffer.duration / (speed || 1);
        if (playedTime >= totalTime) {
          setProgress(100);
        } else {
          setProgress((playedTime / totalTime) * 100);
          animFrame = requestAnimationFrame(updateProgress);
        }
      }
    };
    if (isPlaying) {
      animFrame = requestAnimationFrame(updateProgress);
    }
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, audioCtx, buffer, speed]);

  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioCtx(ctx);
    return () => { ctx.close(); };
  }, []);

  // Visualizer Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const width = canvas.width;
      const height = canvas.height;

      // Conditional background fill based on mode
      const isWaterfall = visualizerMode === 'waterfall';
      
      if (!isWaterfall) {
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, width, height);
      }

      if (isPlaying) {
        if (visualizerMode === 'waterfall' && analyserRef.current) {
          const analyser = analyserRef.current;
          
          // Shift canvas down by 2 pixels to create scrolling effect
          ctx.drawImage(canvas, 0, 0, width, height - 2, 0, 2, width, height - 2);
          
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);
          
          // Draw new frequency data line at the top
          const effectiveBins = Math.floor(bufferLength * 0.8); // Drop the highest generally-empty frequencies
          for(let i = 0; i < width; i++) {
            const dataIndex = Math.floor((i / width) * effectiveBins);
            const val = dataArray[dataIndex] || 0;
            
            // Map value (0-255) to a heatmap color: Black -> Blue -> Purple -> Red -> Yellow -> White
            const hue = 240 - ((val / 255) * 240); 
            const lightness = val > 8 ? (val / 255) * 60 + 10 : 0; // Create stark cutoff for completely quiet spots
            
            ctx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
            ctx.fillRect(i, 0, 1, 2);
          }
        } else if (visualizerMode === 'radial' && analyserRef.current) {
          const analyser = analyserRef.current;
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);

          const centerX = width / 2;
          const centerY = height / 2;
          const baseRadius = Math.min(width, height) * 0.15;
          const maxRadius = Math.min(width, height) * 0.45;

          ctx.beginPath();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#22d3ee';
          ctx.fillStyle = 'rgba(34, 211, 238, 0.1)';

          const effectiveLength = Math.floor(bufferLength * 0.65);
          
          // Draw right half
          for(let i = 0; i <= effectiveLength; i++) {
             const val = dataArray[i] / 255;
             const radius = baseRadius + val * (maxRadius - baseRadius);
             const angle = (i / effectiveLength) * Math.PI - Math.PI / 2;
             const x = centerX + Math.cos(angle) * radius;
             const y = centerY + Math.sin(angle) * radius;
             if(i===0) ctx.moveTo(x,y);
             else ctx.lineTo(x,y);
          }
          // Draw left half symmetrically
          for(let i = effectiveLength; i >= 0; i--) {
             const val = dataArray[i] / 255;
             const radius = baseRadius + val * (maxRadius - baseRadius);
             const angle = -((i / effectiveLength) * Math.PI) - Math.PI / 2;
             const x = centerX + Math.cos(angle) * radius;
             const y = centerY + Math.sin(angle) * radius;
             ctx.lineTo(x,y);
          }
          
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        } else if ((visualizerMode === 'waveform' || visualizerMode === 'spectrum') && analyserRef.current) {
          const analyser = analyserRef.current;
          
          ctx.strokeStyle = '#22d3ee'; // cyan-400
          ctx.fillStyle = '#22d3ee';

          if (visualizerMode === 'waveform') {
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#22d3ee';
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(dataArray);

            ctx.lineWidth = 2;
            ctx.beginPath();

            const sliceWidth = (width * 1.0) / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              const v = dataArray[i] / 128.0;
              const y = (v * height) / 2;

              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
              x += sliceWidth;
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset
            
          } else if (visualizerMode === 'spectrum') {
            ctx.shadowBlur = 0;
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);

            const barWidth = (width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              const barHeight = (dataArray[i] / 255) * height;
              ctx.fillRect(x, height - barHeight, barWidth, barHeight);
              x += barWidth + 1;
            }
          }
        } else if (visualizerMode === 'xy' && analyserLeftRef.current && analyserRightRef.current) {
          const analyserL = analyserLeftRef.current;
          const analyserR = analyserRightRef.current;
          
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#22d3ee';
          ctx.strokeStyle = '#22d3ee';
          
          const bufferLength = analyserL.frequencyBinCount;
          
          const dataArrayL = new Uint8Array(bufferLength);
          const dataArrayR = new Uint8Array(bufferLength);
          
          analyserL.getByteTimeDomainData(dataArrayL);
          analyserR.getByteTimeDomainData(dataArrayR);

          ctx.lineWidth = 2;
          ctx.beginPath();
          
          // Confine drawing area so that it naturally fits the screen height
          const size = Math.min(width, height) - 20; // 20px padding
          const offsetX = width / 2;
          const offsetY = height / 2;

          for (let i = 0; i < bufferLength; i++) {
            const valL = dataArrayL[i] / 255.0; // 0.0 -> 1.0
            const valR = dataArrayR[i] / 255.0; // 0.0 -> 1.0
            
            const x = offsetX + (valL - 0.5) * size;
            const y = offsetY + (valR - 0.5) * size * -1; // Invert logic for graphical Y

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else {
        // Draw flat line or dot when not playing
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#374151'; // gray-700
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        
        if (visualizerMode === 'xy') {
          // Draw dot in center
          ctx.arc(width / 2, height / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (visualizerMode === 'radial') {
          // Draw small inner circle
          ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.15, 0, Math.PI * 2);
          ctx.stroke();
        } else if (visualizerMode !== 'waterfall') {
          // Draw flat line
          ctx.moveTo(0, height / 2);
          ctx.lineTo(width, height / 2);
          ctx.stroke();
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, visualizerMode]);

  useEffect(() => {
    if (analyserRef.current) {
      if (visualizerMode === 'spectrum' || visualizerMode === 'radial') {
        analyserRef.current.fftSize = 256;
      } else if (visualizerMode === 'waterfall') {
        analyserRef.current.fftSize = 1024;
      } else {
        analyserRef.current.fftSize = 2048;
      }
    }
    if (analyserLeftRef.current) {
      analyserLeftRef.current.fftSize = 2048;
    }
    if (analyserRightRef.current) {
      analyserRightRef.current.fftSize = 2048;
    }
  }, [visualizerMode]);

  // Sync state to audio nodes
  useEffect(() => { if (sourceRef.current) sourceRef.current.playbackRate.value = speed; }, [speed]);
  
  useEffect(() => {
    if (eqWetRef.current && eqDryRef.current) {
      eqWetRef.current.gain.value = eqEnabled ? 1 : 0;
      eqDryRef.current.gain.value = eqEnabled ? 0 : 1;
    }
  }, [eqEnabled]);

  useEffect(() => {
    if (eqNodesRef.current.length > 0) {
      eqNodesRef.current.forEach((node, idx) => {
        if (node) node.gain.value = eqBands[idx];
      });
    }
  }, [eqBands]);

  useEffect(() => {
    if (tremoloGainRef.current && tremoloModRef.current && tremoloOscRef.current) {
      if (tremoloEnabled) {
        tremoloGainRef.current.gain.value = 1 - (tremoloDepth / 2);
        tremoloModRef.current.gain.value = tremoloDepth / 2;
      } else {
        tremoloGainRef.current.gain.value = 1;
        tremoloModRef.current.gain.value = 0;
      }
      tremoloOscRef.current.frequency.value = tremoloRate;
    }
  }, [tremoloEnabled, tremoloDepth, tremoloRate]);

  useEffect(() => {
    if (distNodeRef.current && distWetRef.current && distDryRef.current) {
      distNodeRef.current.curve = makeDistortionCurve(distAmount);
      distWetRef.current.gain.value = distEnabled ? 1 : 0;
      distDryRef.current.gain.value = distEnabled ? 0 : 1;
    }
  }, [distEnabled, distAmount]);

  useEffect(() => {
    if (filterNodeRef.current) {
      filterNodeRef.current.frequency.value = filterEnabled ? filterFreq : 24000;
    }
  }, [filterEnabled, filterFreq]);

  useEffect(() => {
    if (delayNodeRef.current && feedbackNodeRef.current && delayWetRef.current) {
      delayNodeRef.current.delayTime.value = delayTime;
      feedbackNodeRef.current.gain.value = delayFeedback;
      delayWetRef.current.gain.value = delayEnabled ? 0.5 : 0;
    }
  }, [delayEnabled, delayTime, delayFeedback]);

  useEffect(() => {
    if (reverbWetRef.current && reverbDryRef.current) {
      reverbWetRef.current.gain.value = reverbEnabled ? reverbMix : 0;
      reverbDryRef.current.gain.value = reverbEnabled ? 1 - reverbMix : 1;
    }
  }, [reverbEnabled, reverbMix]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !audioCtx) return;
    
    setFileName(file.name);
    if (isPlaying) pauseAudio();
    
    pauseTimeRef.current = 0;
    setBuffer(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setBuffer(decodedBuffer);
    } catch (err) {
      console.error("Error decoding audio data", err);
      alert("Failed to decode audio file.");
    }
  };

  const buildAudioGraph = (ctx: BaseAudioContext, inputBuffer: AudioBuffer) => {
    const source = ctx.createBufferSource();
    source.buffer = inputBuffer;
    source.playbackRate.value = speed;

    // -1. EQ Module
    const eqLocalNodes = EQ_FREQUENCIES.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.41;
      filter.gain.value = eqBands[i];
      return filter;
    });
    const eqWet = ctx.createGain();
    const eqDry = ctx.createGain();
    const eqMix = ctx.createGain();
    
    eqWet.gain.value = eqEnabled ? 1 : 0;
    eqDry.gain.value = eqEnabled ? 0 : 1;

    if (eqLocalNodes.length > 0) {
      for (let i = 0; i < eqLocalNodes.length - 1; i++) {
        eqLocalNodes[i].connect(eqLocalNodes[i+1]);
      }
      source.connect(eqLocalNodes[0]);
      eqLocalNodes[eqLocalNodes.length - 1].connect(eqWet);
    } else {
      source.connect(eqWet);
    }
    
    source.connect(eqDry);
    
    eqWet.connect(eqMix);
    eqDry.connect(eqMix);

    // 0. Tremolo Module
    const tremoloGain = ctx.createGain();
    const tremoloOsc = ctx.createOscillator();
    const tremoloMod = ctx.createGain();
    tremoloOsc.type = 'sine';
    tremoloOsc.frequency.value = tremoloRate;
    tremoloGain.gain.value = tremoloEnabled ? 1 - (tremoloDepth / 2) : 1;
    tremoloMod.gain.value = tremoloEnabled ? tremoloDepth / 2 : 0;
    tremoloOsc.connect(tremoloMod);
    tremoloMod.connect(tremoloGain.gain);
    tremoloOsc.start(0);

    eqMix.connect(tremoloGain);

    // 1. Distortion Module
    const distNode = ctx.createWaveShaper();
    distNode.curve = makeDistortionCurve(distAmount);
    distNode.oversample = '4x';
    const distWet = ctx.createGain();
    const distDry = ctx.createGain();
    distWet.gain.value = distEnabled ? 1 : 0;
    distDry.gain.value = distEnabled ? 0 : 1;
    const distMix = ctx.createGain();

    tremoloGain.connect(distNode);
    distNode.connect(distWet);
    tremoloGain.connect(distDry);
    distWet.connect(distMix);
    distDry.connect(distMix);

    // 2. Filter Module
    const filterNode = ctx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = filterEnabled ? filterFreq : 24000;
    
    distMix.connect(filterNode);

    // 3. Delay Module
    const delayNode = ctx.createDelay(5.0);
    delayNode.delayTime.value = delayTime;
    const feedbackNode = ctx.createGain();
    feedbackNode.gain.value = delayFeedback;
    const delayWet = ctx.createGain();
    delayWet.gain.value = delayEnabled ? 0.5 : 0;
    const delayDry = ctx.createGain();
    delayDry.gain.value = 1;
    const delayMix = ctx.createGain();

    filterNode.connect(delayNode);
    delayNode.connect(feedbackNode);
    feedbackNode.connect(delayNode);
    
    delayNode.connect(delayWet);
    filterNode.connect(delayDry);
    
    delayWet.connect(delayMix);
    delayDry.connect(delayMix);

    // 4. Reverb Module
    const convolver = ctx.createConvolver();
    convolver.buffer = generateImpulseResponse(ctx, reverbTime, 2.0);
    const reverbWet = ctx.createGain();
    const reverbDry = ctx.createGain();
    reverbWet.gain.value = reverbEnabled ? reverbMix : 0;
    reverbDry.gain.value = reverbEnabled ? 1 - reverbMix : 1;
    const reverbMixNode = ctx.createGain();

    delayMix.connect(convolver);
    delayMix.connect(reverbDry);
    convolver.connect(reverbWet);
    reverbWet.connect(reverbMixNode);
    reverbDry.connect(reverbMixNode);

    return {
      source,
      outputNode: reverbMixNode,
      
      tremoloOsc,

      eqLocalNodes, eqWet, eqDry,
      tremoloGain, tremoloMod,
      distNode, distWet, distDry,
      filterNode,
      delayNode, feedbackNode, delayWet,
      convolver, reverbWet, reverbDry
    };
  };

  const playAudio = async () => {
    if (!buffer || !audioCtx) return alert('Upload an audio file first!');
    if (isPlaying) return;

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    const graph = buildAudioGraph(audioCtx, buffer);

    // 5. Visualizer Analyser Node (Standard Mixdown)
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = (visualizerMode === 'spectrum' || visualizerMode === 'radial') ? 256 : (visualizerMode === 'waterfall' ? 1024 : 2048);
    
    // 6. X-Y Oscilloscope Splitter
    const splitter = audioCtx.createChannelSplitter(2);
    const analyserL = audioCtx.createAnalyser();
    const analyserR = audioCtx.createAnalyser();
    analyserL.fftSize = 2048;
    analyserR.fftSize = 2048;

    // Connect standard analyser
    graph.outputNode.connect(analyser); 
    
    // Connect X-Y Scope analyser
    graph.outputNode.connect(splitter);
    splitter.connect(analyserL, 0); // Left channel (X axis)
    try {
      splitter.connect(analyserR, 1); // Right channel (Y axis)
    } catch (e) {
      splitter.connect(analyserR, 0); // Gracefully fallback to monotonic if format causes error
    }

    // Output to speakers
    analyser.connect(audioCtx.destination);

    // Save refs
    sourceRef.current = graph.source;
    
    eqNodesRef.current = graph.eqLocalNodes;
    eqWetRef.current = graph.eqWet;
    eqDryRef.current = graph.eqDry;

    tremoloGainRef.current = graph.tremoloGain;
    tremoloModRef.current = graph.tremoloMod;
    tremoloOscRef.current = graph.tremoloOsc;

    distNodeRef.current = graph.distNode;
    distWetRef.current = graph.distWet;
    distDryRef.current = graph.distDry;
    
    filterNodeRef.current = graph.filterNode;
    
    delayNodeRef.current = graph.delayNode;
    feedbackNodeRef.current = graph.feedbackNode;
    delayWetRef.current = graph.delayWet;

    convolverRef.current = graph.convolver;
    reverbWetRef.current = graph.reverbWet;
    reverbDryRef.current = graph.reverbDry;
    
    analyserRef.current = analyser;
    analyserLeftRef.current = analyserL;
    analyserRightRef.current = analyserR;

    graph.source.onended = () => {
      setIsPlaying(false);
      pauseTimeRef.current = 0;
      setProgress(0);
      try { graph.tremoloOsc.stop(); } catch(e) {}
    };

    startTimeRef.current = audioCtx.currentTime - pauseTimeRef.current;
    graph.source.start(0, pauseTimeRef.current);
    setIsPlaying(true);
  };

  const exportProcessedAudio = async () => {
    if (!buffer) return alert('Upload an audio file first!');
    setIsExporting(true);

    try {
      // Calculate total duration (adding tail length for reverb and delay)
      const tailLength = (delayEnabled ? Math.max(0, delayTime * 4) : 0) + (reverbEnabled ? reverbTime : 0);
      const totalDuration = (buffer.duration / (speed || 1)) + tailLength;
      
      const offlineCtx = new OfflineAudioContext(2, totalDuration * buffer.sampleRate, buffer.sampleRate);
      
      const graph = buildAudioGraph(offlineCtx, buffer);
      graph.outputNode.connect(offlineCtx.destination);
      
      graph.source.start(0);
      const renderedBuffer = await offlineCtx.startRendering();
      
      const wavBlob = audioBufferToWav(renderedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `processed-${fileName || "audio"}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Error exporting audio.");
    } finally {
      setIsExporting(false);
    }
  };

  const pauseAudio = () => {
    if (!isPlaying || !sourceRef.current || !audioCtx) return;
    sourceRef.current.stop();
    try { tremoloOscRef.current?.stop(); } catch(e) {}
    pauseTimeRef.current = audioCtx.currentTime - startTimeRef.current;
    setIsPlaying(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto bg-[#111215] rounded-xl shadow-2xl overflow-hidden border border-gray-800 p-6 space-y-6">
      
      {/* Top Control Bar */}
      <div className="flex justify-between items-center bg-[#181a1f] p-3 px-4 rounded-lg border border-gray-800">
        <div className="flex items-center gap-3">
          <Settings2 className="w-5 h-5 text-gray-500" />
          <h1 className="font-mono text-sm tracking-widest uppercase text-gray-300">Effects Rack</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => settingsInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 text-gray-300"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-wider hidden sm:inline">Import</span>
          </button>
          <input type="file" ref={settingsInputRef} onChange={importSettings} accept=".json" className="hidden" />
          <button 
            onClick={exportSettings}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 text-gray-300"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-wider hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Master Visualizer Rack */}
      <div className="bg-[#181a1f] border border-gray-800 border-t-2 border-t-cyan-500 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <h2 className="font-mono text-xs tracking-widest uppercase text-hardware-muted">Master Visualizer</h2>
          </div>
          <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
            <button 
              onClick={() => setVisualizerMode('waveform')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-mono tracking-wider uppercase transition-colors border ${
                visualizerMode === 'waveform' 
                  ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                  : 'bg-black/20 text-gray-500 border-gray-700/50 hover:text-gray-300'
              }`}
            >
              <Activity className="w-3 h-3" /> Waveform
            </button>
            <button 
              onClick={() => setVisualizerMode('spectrum')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-mono tracking-wider uppercase transition-colors border ${
                visualizerMode === 'spectrum' 
                  ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                  : 'bg-black/20 text-gray-500 border-gray-700/50 hover:text-gray-300'
              }`}
            >
              <BarChart2 className="w-3 h-3" /> Spectrum
            </button>
            <button 
              onClick={() => setVisualizerMode('xy')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-mono tracking-wider uppercase transition-colors border ${
                visualizerMode === 'xy' 
                  ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                  : 'bg-black/20 text-gray-500 border-gray-700/50 hover:text-gray-300'
              }`}
            >
              <Crosshair className="w-3 h-3" /> XY Scope
            </button>
            <button 
              onClick={() => setVisualizerMode('radial')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-mono tracking-wider uppercase transition-colors border ${
                visualizerMode === 'radial' 
                  ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                  : 'bg-black/20 text-gray-500 border-gray-700/50 hover:text-gray-300'
              }`}
            >
              <Radar className="w-3 h-3" /> Radial
            </button>
            <button 
              onClick={() => setVisualizerMode('waterfall')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-mono tracking-wider uppercase transition-colors border ${
                visualizerMode === 'waterfall' 
                  ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                  : 'bg-black/20 text-gray-500 border-gray-700/50 hover:text-gray-300'
              }`}
            >
              <Layers className="w-3 h-3" /> Waterfall
            </button>
          </div>
        </div>
        
        <div className="w-full h-64 md:h-80 lg:h-96 bg-[#0a0a0c] rounded border border-gray-800/80 overflow-hidden relative shadow-inner">
          <canvas 
            ref={canvasRef} 
            className="w-full h-full block"
          />
          {/* Subtle oscilloscope grid background */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]" />
        </div>
      </div>

      {/* Header & Transport */}
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Source Module */}
        <div className="flex-1 bg-[#181a1f] border border-gray-800 border-t-2 border-t-gray-600 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-4 h-4 text-hardware-muted" />
            <h2 className="font-mono text-xs tracking-widest uppercase text-hardware-muted">Source Audio</h2>
          </div>
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-24 border border-dashed border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-gray-500 hover:bg-white/5 transition-colors bg-black/20"
          >
            <span className="font-mono text-xs text-hardware-muted text-center break-all">
              {fileName || "Click to Load Audio File"}
            </span>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
        </div>

        {/* Transport Module */}
        <div className="flex-1 bg-[#181a1f] border border-gray-800 border-t-2 border-t-red-500 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-hardware-muted" />
              <h2 className="font-mono text-xs tracking-widest uppercase text-hardware-muted">Transport</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-gray-600'}`} />
              <span className="font-mono text-[10px] uppercase tracking-widest text-hardware-muted">
                {isPlaying ? 'Playing' : 'Stopped'}
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex justify-between font-mono text-[10px] text-gray-500 uppercase">
                <span>Progress</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 transition-all duration-300 ease-out" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>

            <HardwareSlider 
              label="Playback Speed" value={speed} min="0.25" max="2" step="0.05" unit="x"
              onChange={(e: any) => setSpeed(parseFloat(e.target.value))} 
            />
            
            <div className="flex gap-2 sm:gap-4">
              <button 
                onClick={playAudio} disabled={!buffer || isPlaying}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-700 text-white"
              >
                <Play className="w-4 h-4" />
                <span className="font-mono text-[10px] uppercase tracking-wider hidden sm:inline">Play</span>
              </button>
              <button 
                onClick={pauseAudio} disabled={!isPlaying}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-700 text-white"
              >
                <Pause className="w-4 h-4" />
                <span className="font-mono text-[10px] uppercase tracking-wider hidden sm:inline">Pause</span>
              </button>
              <button 
                onClick={exportProcessedAudio} disabled={!buffer || isExporting}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-700 text-cyan-400"
              >
                <Download className="w-4 h-4" />
                <span className="font-mono text-[10px] uppercase tracking-wider hidden sm:inline">{isExporting ? 'Wait' : 'Export'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Effects Rack */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Graphic EQ Module */}
        <div className={`col-span-1 md:col-span-2 lg:col-span-3 bg-[#181a1f] border border-gray-800 border-t-2 ${colorTheme.blue.borderTop} rounded-lg p-5 space-y-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersVertical className="w-4 h-4 text-blue-500" />
              <h2 className="font-mono text-xs tracking-widest uppercase text-[#8b92a5]">10-Band Graphic EQ</h2>
            </div>
            <HardwareToggle label="Bypass" enabled={eqEnabled} onToggle={() => setEqEnabled(!eqEnabled)} color="blue" />
          </div>
          <div className={`grid grid-cols-10 gap-1 w-full transition-opacity py-4 ${!eqEnabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            {EQ_FREQUENCIES.map((freq, idx) => (
              <HardwareVerticalSlider 
                key={freq}
                label={freq >= 1000 ? `${freq/1000}k` : `${freq}`} 
                value={eqBands[idx]} 
                min="-15" max="15" step="0.5"
                onChange={(e: any) => {
                  const newBands = [...eqBands];
                  newBands[idx] = parseFloat(e.target.value);
                  setEqBands(newBands);
                }} 
                onManualChange={(val: number) => {
                  const newBands = [...eqBands];
                  newBands[idx] = val;
                  setEqBands(newBands);
                }}
              />
            ))}
          </div>
        </div>

        {/* Tremolo Module */}
        <div className={`bg-[#181a1f] border border-gray-800 border-t-2 ${colorTheme.yellow.borderTop} rounded-lg p-5 space-y-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-yellow-500" />
              <h2 className="font-mono text-xs tracking-widest uppercase text-hardware-muted">Tremolo</h2>
            </div>
            <HardwareToggle label="Bypass" enabled={tremoloEnabled} onToggle={() => setTremoloEnabled(!tremoloEnabled)} color="yellow" />
          </div>
          <div className={`space-y-6 transition-opacity ${!tremoloEnabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <HardwareSlider 
              label="Rate" value={tremoloRate} min="0.1" max="20" step="0.1" unit=" Hz"
              onChange={(e: any) => setTremoloRate(parseFloat(e.target.value))} 
            />
            <HardwareSlider 
              label="Depth" value={tremoloDepth} min="0" max="1" step="0.01" 
              onChange={(e: any) => setTremoloDepth(parseFloat(e.target.value))} 
            />
          </div>
        </div>

        {/* Distortion Module */}
        <div className={`bg-[#181a1f] border border-gray-800 border-t-2 ${colorTheme.orange.borderTop} rounded-lg p-5 space-y-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500" />
              <h2 className="font-mono text-xs tracking-widest uppercase text-hardware-muted">Overdrive</h2>
            </div>
            <HardwareToggle label="Bypass" enabled={distEnabled} onToggle={() => setDistEnabled(!distEnabled)} color="orange" />
          </div>
          <div className={`space-y-6 transition-opacity ${!distEnabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <HardwareSlider 
              label="Drive Amount" value={distAmount} min="0" max="100" step="1" 
              onChange={(e: any) => setDistAmount(parseFloat(e.target.value))} 
            />
          </div>
        </div>

        {/* Filter Module */}
        <div className={`bg-[#181a1f] border border-gray-800 border-t-2 ${colorTheme.emerald.borderTop} rounded-lg p-5 space-y-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves className="w-4 h-4 text-emerald-500" />
              <h2 className="font-mono text-xs tracking-widest uppercase text-hardware-muted">Lowpass Filter</h2>
            </div>
            <HardwareToggle label="Bypass" enabled={filterEnabled} onToggle={() => setFilterEnabled(!filterEnabled)} color="emerald" />
          </div>
          <div className={`space-y-6 transition-opacity ${!filterEnabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <HardwareSlider 
              label="Cutoff Freq" value={filterFreq} min="20" max="20000" step="10" unit=" Hz"
              onChange={(e: any) => setFilterFreq(parseFloat(e.target.value))} 
            />
          </div>
        </div>

        {/* Delay Module */}
        <div className={`bg-[#181a1f] border border-gray-800 border-t-2 ${colorTheme.cyan.borderTop} rounded-lg p-5 space-y-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-cyan-500" />
              <h2 className="font-mono text-xs tracking-widest uppercase text-hardware-muted">Analog Delay</h2>
            </div>
            <HardwareToggle label="Bypass" enabled={delayEnabled} onToggle={() => setDelayEnabled(!delayEnabled)} color="cyan" />
          </div>
          <div className={`space-y-6 transition-opacity ${!delayEnabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <HardwareSlider 
              label="Time" value={delayTime} min="0.01" max="2.0" step="0.01" unit=" s"
              onChange={(e: any) => setDelayTime(parseFloat(e.target.value))} 
            />
            <HardwareSlider 
              label="Feedback" value={delayFeedback} min="0" max="0.9" step="0.01" 
              onChange={(e: any) => setDelayFeedback(parseFloat(e.target.value))} 
            />
          </div>
        </div>

        {/* Reverb Module */}
        <div className={`bg-[#181a1f] border border-gray-800 border-t-2 ${colorTheme.purple.borderTop} rounded-lg p-5 space-y-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-purple-500" />
              <h2 className="font-mono text-xs tracking-widest uppercase text-hardware-muted">Room Reverb</h2>
            </div>
            <HardwareToggle label="Bypass" enabled={reverbEnabled} onToggle={() => setReverbEnabled(!reverbEnabled)} color="purple" />
          </div>
          <div className={`space-y-6 transition-opacity ${!reverbEnabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <HardwareSlider 
              label="Decay Time" value={reverbTime} min="0.1" max="5.0" step="0.1" unit=" s"
              onChange={(e: any) => setReverbTime(parseFloat(e.target.value))} 
            />
            <HardwareSlider 
              label="Mix" value={reverbMix} min="0" max="1" step="0.01" 
              onChange={(e: any) => setReverbMix(parseFloat(e.target.value))} 
            />
          </div>
        </div>

      </div>
    </div>
  );
}
