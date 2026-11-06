import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, Plus, Minus, RotateCcw, Volume2, Settings,
  Calendar, Check, ChevronRight, Video, Camera, BarChart2,
  BookOpen, Clock, Activity, Zap, RefreshCw, Layers, Sliders,
  HelpCircle, ChevronDown, ChevronUp, Music, ArrowUp, ArrowDown,
  Square, Download, Upload, Trash2, Award, Flame, Target, Compass,
  Menu, X, Film, CheckCircle2, TrendingUp, Palette, ShieldCheck, Keyboard,
  Cloud, CloudCheck, RefreshCcw, User, Users, Lock, Unlock, KeyRound
} from 'lucide-react';

// ============================================================================
// TYPOGRAPHY INJECTION & FONT STYLES (OPERA GX HIGH-TECH GAMING & AUDIO AESTHETIC)
// ============================================================================
const FONT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700;800&family=Rajdhani:wght@500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');

  .font-gx-display {
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    letter-spacing: -0.02em;
  }

  .font-gx-num {
    font-family: 'Rajdhani', 'JetBrains Mono', monospace;
    font-feature-settings: "tnum" 1, "zero" 1;
    letter-spacing: 0.02em;
  }

  .font-gx-code {
    font-family: 'JetBrains Mono', monospace;
    font-feature-settings: "tnum" 1;
  }

  .font-gx-body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    letter-spacing: -0.01em;
  }
`;

// ============================================================================
// SHARED HIGH-PRECISION WEB AUDIO SCHEDULING ENGINE
// ============================================================================
class WebAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.bpm = 80;
    this.timeSignature = { beats: 4, noteValue: 4 };
    this.subdivision = { id: 'quarter', name: 'Quarter Notes', dotsPerBeat: 1 };
    this.soundType = 'woodblock';
    this.volume = 0.85;
    this.lookahead = 25.0; // ms
    this.scheduleAheadTime = 0.12; // sec
    this.currentBeat = 0;
    this.currentSubdivision = 0;
    this.nextNoteTime = 0.0;
    this.timerId = null;
    this.scheduledEvents = [];
    this.onBeat = null;
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playUiSound(type = 'step') {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const t = this.audioCtx.currentTime;
      if (type === 'step') {
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.03);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.03);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.035);
      } else if (type === 'timeover') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, t); // C5
        osc.frequency.setValueAtTime(659.25, t + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, t + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, t + 0.3); // C6
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.65);
      }
    } catch {
      // Audio playback fallback
    }
  }

  setBpm(newBpm) {
    this.bpm = Math.max(30, Math.min(320, Number(newBpm) || 80));
  }

  setSubdivision(subdiv) {
    if (subdiv && subdiv.dotsPerBeat) {
      this.subdivision = subdiv;
    }
  }

  setTimeSignature(ts) {
    if (ts && ts.beats) {
      this.timeSignature = ts;
      this.currentBeat = 0;
      this.currentSubdivision = 0;
    }
  }

  setSoundType(st) {
    this.soundType = st;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPerSubdivision = secondsPerBeat / this.subdivision.dotsPerBeat;

    this.nextNoteTime += secondsPerSubdivision;
    this.currentSubdivision++;

    if (this.currentSubdivision >= this.subdivision.dotsPerBeat) {
      this.currentSubdivision = 0;
      this.currentBeat = (this.currentBeat + 1) % this.timeSignature.beats;

      if (this.onBeat) {
        this.onBeat(this.currentBeat + 1, this.currentBeat === 0);
      }
    }
  }

  scheduleNote(beatNumber, subdivisionIndex, time) {
    const isDownbeat = (beatNumber === 0 && subdivisionIndex === 0);
    const isBeatStart = (subdivisionIndex === 0);

    this.scheduledEvents.push({
      time,
      beatNumber: beatNumber + 1,
      subdivisionIndex,
      isDownbeat,
      isBeatStart,
      dotsPerBeat: this.subdivision.dotsPerBeat
    });

    if (this.scheduledEvents.length > 80) {
      this.scheduledEvents.shift();
    }

    try {
      const osc = this.audioCtx.createOscillator();
      const noteGain = this.audioCtx.createGain();

      let freq = 800;
      let decay = 0.04;

      if (this.soundType === 'woodblock') {
        freq = isDownbeat ? 1250 : isBeatStart ? 900 : 700;
        osc.type = 'sine';
        decay = 0.04;
      } else if (this.soundType === 'beep') {
        freq = isDownbeat ? 1760 : isBeatStart ? 880 : 440;
        osc.type = 'triangle';
        decay = 0.055;
      } else if (this.soundType === 'rimshot') {
        freq = isDownbeat ? 420 : isBeatStart ? 310 : 220;
        osc.type = 'square';
        decay = 0.035;
      } else {
        // Mechanical click
        freq = isDownbeat ? 1400 : isBeatStart ? 850 : 520;
        osc.type = 'sine';
        decay = 0.03;
      }

      osc.frequency.setValueAtTime(freq, time);

      const baseGain = isDownbeat ? 1.0 : isBeatStart ? 0.75 : 0.45;
      noteGain.gain.setValueAtTime(0.0001, time);
      noteGain.gain.linearRampToValueAtTime(baseGain * this.volume, time + 0.002);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

      osc.connect(noteGain);
      if (this.masterGain) {
        noteGain.connect(this.masterGain);
      } else {
        noteGain.connect(this.audioCtx.destination);
      }

      osc.start(time);
      osc.stop(time + decay + 0.01);
    } catch {
      // AudioContext interrupted fallback
    }
  }

  scheduler() {
    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.currentSubdivision, this.nextNoteTime);
      this.nextNote();
    }
  }

  start() {
    this.initAudio();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentBeat = 0;
    this.currentSubdivision = 0;
    this.nextNoteTime = this.audioCtx.currentTime + 0.04;
    this.scheduledEvents = [];

    this.timerId = setInterval(() => {
      if (this.isPlaying) {
        this.scheduler();
      }
    }, this.lookahead);
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.scheduledEvents = [];
    this.currentBeat = 0;
    this.currentSubdivision = 0;
  }
}

const audioEngine = new WebAudioEngine();

// ============================================================================
// MUSIC DATA CONSTANTS
// ============================================================================
const SUBDIVISIONS = [
  { id: 'quarter', name: 'Quarter Notes', dotsPerBeat: 1 },
  { id: 'eighth', name: 'Eighth Notes', dotsPerBeat: 2 },
  { id: 'triplet', name: 'Eighth Triplets', dotsPerBeat: 3 },
  { id: 'sixteenth', name: 'Sixteenth Notes', dotsPerBeat: 4 },
  { id: 'sextuplet', name: 'Sextuplets', dotsPerBeat: 6 },
  { id: 'thirtysecond', name: 'Thirty-Second Notes', dotsPerBeat: 8 },
];

const TIME_SIGNATURES = [
  { id: '2/4', beats: 2, noteValue: 4, label: '2/4' },
  { id: '3/4', beats: 3, noteValue: 4, label: '3/4' },
  { id: '4/4', beats: 4, noteValue: 4, label: '4/4' },
  { id: '5/4', beats: 5, noteValue: 4, label: '5/4' },
  { id: '6/4', beats: 6, noteValue: 4, label: '6/4' },
  { id: '7/4', beats: 7, noteValue: 4, label: '7/4' },
];

const INITIAL_FOCUS_STEP1 = [
  'Synchronization', 'Pick Slanting', 'Wrist Movement', 'Relaxation',
  'Right Hand Isolation', 'Left Hand Isolation', 'Feel', 'Timing', 'Note Clarity', 'Muting'
];

const INITIAL_FOCUS_STEP2 = [
  'Note Clarity', 'Pick Slanting', 'String Crossing', 'Hand Synchronization',
  'Position Shifts', 'Economy of Motion'
];

const INITIAL_FOCUS_STEP3 = [
  'Burst Cleanliness', 'Explosive Attack', 'Single String Focus',
  'Tension Release', 'Fret Hand Accuracy'
];

const INITIAL_FOCUS_STEP4 = [
  'Camera Demeanor', 'Tone Consistency', 'Fretboard Posture', 'Micro-Timing'
];

// ============================================================================
// OPERA GX GAMING THEME PRESETS
// ============================================================================
const GX_THEMES = {
  crimson: {
    id: 'crimson',
    name: 'GX Crimson',
    primary: '#FA1E4E',
    secondary: '#FF477E',
    surface: '#15151D',
    elevated: '#1B1B25',
    glow: 'rgba(250, 30, 78, 0.45)',
    glowSubtle: 'rgba(250, 30, 78, 0.15)',
    borderActive: 'rgba(250, 30, 78, 0.65)',
    accentBg: 'rgba(250, 30, 78, 0.12)',
    tag: '#FA1E4E'
  },
  violet: {
    id: 'violet',
    name: 'Cyberpunk Violet',
    primary: '#A855F7',
    secondary: '#06B6D4',
    surface: '#15151D',
    elevated: '#1B1B25',
    glow: 'rgba(168, 85, 247, 0.45)',
    glowSubtle: 'rgba(168, 85, 247, 0.15)',
    borderActive: 'rgba(168, 85, 247, 0.65)',
    accentBg: 'rgba(168, 85, 247, 0.12)',
    tag: '#A855F7'
  },
  toxic: {
    id: 'toxic',
    name: 'GX Toxic Green',
    primary: '#10B981',
    secondary: '#22C55E',
    surface: '#15151D',
    elevated: '#1B1B25',
    glow: 'rgba(16, 185, 129, 0.45)',
    glowSubtle: 'rgba(16, 185, 129, 0.15)',
    borderActive: 'rgba(16, 185, 129, 0.65)',
    accentBg: 'rgba(16, 185, 129, 0.12)',
    tag: '#10B981'
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic Neon',
    primary: '#00F0FF',
    secondary: '#3B82F6',
    surface: '#15151D',
    elevated: '#1B1B25',
    glow: 'rgba(0, 240, 255, 0.45)',
    glowSubtle: 'rgba(0, 240, 255, 0.15)',
    borderActive: 'rgba(0, 240, 255, 0.65)',
    accentBg: 'rgba(0, 240, 255, 0.12)',
    tag: '#00F0FF'
  },
  gold: {
    id: 'gold',
    name: 'Obsidian Gold',
    primary: '#E5A93C',
    secondary: '#F59E0B',
    surface: '#15151D',
    elevated: '#1B1B25',
    glow: 'rgba(229, 169, 60, 0.45)',
    glowSubtle: 'rgba(229, 169, 60, 0.15)',
    borderActive: 'rgba(229, 169, 60, 0.65)',
    accentBg: 'rgba(229, 169, 60, 0.12)',
    tag: '#E5A93C'
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('daily');
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(80);
  const [selectedSubdivision, setSelectedSubdivision] = useState(SUBDIVISIONS[0]);
  const [timeSignature, setTimeSignature] = useState(TIME_SIGNATURES[2]);
  const [soundType, setSoundType] = useState('woodblock');
  const [volume, setVolume] = useState(0.85);
  const [activeMetronomeMode, setActiveMetronomeMode] = useState('standard');
  const [isHotkeysModalOpen, setIsHotkeysModalOpen] = useState(false);

  // --------------------------------------------------------------------------
  // MULTI-USER ISOLATION & PIN LOCK SYSTEM
  // --------------------------------------------------------------------------
  const [activeUserId, setActiveUserId] = useState('user1'); // 'user1' | 'user2'
  const [userProfiles, setUserProfiles] = useState({
    user1: { name: 'Guitarist 1', pin: '7779', syncKey: 'g1-sync-' + Math.random().toString(36).substring(2, 7) },
    user2: { name: 'Guitarist 2', pin: '1111', syncKey: 'g2-sync-' + Math.random().toString(36).substring(2, 7) }
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [targetSwitchUser, setTargetSwitchUser] = useState(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [currentPinVerify, setCurrentPinVerify] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');

  // Cloud Sync State (Connects PC & Phone seamlessly per user)
  const [syncKey, setSyncKey] = useState('');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // 'synced' | 'error' | null

  // GX Cyber Theme State
  const [currentThemeKey, setCurrentThemeKey] = useState('crimson');
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const currentTheme = GX_THEMES[currentThemeKey] || GX_THEMES.crimson;

  // Dot Visualizer state
  const [activeDotInfo, setActiveDotInfo] = useState({
    dotsPerBeat: 1,
    activeDotIndex: -1,
    isDownbeat: false,
    isBeatStart: false,
    beatNumber: 1
  });

  // Step Accordion open states
  const [currentStepOpen, setCurrentStepOpen] = useState(1);

  // Practice Session State (Shared across all 4 steps with actual elapsed tracking)
  const [practiceSession, setPracticeSession] = useState({
    selectedExerciseId: 'ex-2',
    selectedExerciseName: 'Paul Gilbert 6-Note Alternate Picking',
    selectedCategory: 'Alternate Picking',
    step1: {
      bpm: 75,
      durationMinutes: 5,
      remainingSeconds: 300,
      elapsedSeconds: 0,
      isTimerRunning: false,
      isCompleted: false,
      focusAreas: ['Synchronization', 'Relaxation'],
      subdivision: SUBDIVISIONS[0]
    },
    step2: {
      bpm: 110,
      durationMinutes: 5,
      remainingSeconds: 300,
      elapsedSeconds: 0,
      isTimerRunning: false,
      isCompleted: false,
      focusAreas: ['Note Clarity'],
      subdivision: SUBDIVISIONS[0]
    },
    step3: {
      bpm: 125,
      durationMinutes: 4,
      remainingSeconds: 240,
      elapsedSeconds: 0,
      isTimerRunning: false,
      isCompleted: false,
      focusAreas: ['Burst Cleanliness'],
      subdivision: SUBDIVISIONS[3]
    },
    step4: {
      bpm: 110,
      durationMinutes: 3,
      remainingSeconds: 180,
      elapsedSeconds: 0,
      isTimerRunning: false,
      isCompleted: false,
      focusAreas: ['Tone Consistency'],
      notes: '',
      hasRecording: false,
      recordedVideoBlobUrl: null
    }
  });

  const [customTagInput, setCustomTagInput] = useState('');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [timeUpStep, setTimeUpStep] = useState(null);

  // Speed Burst helper
  const [isBurstActive, setIsBurstActive] = useState(false);
  const [burstCountRemaining, setBurstCountRemaining] = useState(0);

  // Step sub-tab navigation
  const [step1SubTab, setStep1SubTab] = useState('standard');
  const [step2SubTab, setStep2SubTab] = useState('standard');
  const [step3SubTab, setStep3SubTab] = useState('standard');

  // Collapsible settings drawer for embedded step metronomes
  const [step1SettingsOpen, setStep1SettingsOpen] = useState(false);
  const [step2SettingsOpen, setStep2SettingsOpen] = useState(false);
  const [step3SettingsOpen, setStep3SettingsOpen] = useState(false);

  // Speed training configuration (Screenshot 1 replica)
  const [speedConfig, setSpeedConfig] = useState({
    timeSignature: TIME_SIGNATURES[2],
    startBpm: 80,
    endBpm: 100,
    bpmIncrement: 5,
    barsPerLoop: 4,
    loopsBeforeIncrease: 2,
    countInEnabled: true,
    initialCountIn: 4,
    speedIncreaseCountIn: 4
  });

  const [speedProgress, setSpeedProgress] = useState({
    currentBpm: 80,
    currentBar: 1,
    currentLoop: 1,
    currentBeat: 1,
    barsRemainingInStage: 4,
    loopsRemainingInStage: 2,
    countInRemaining: 4,
    stage: 'idle',
    isActive: false,
    isPaused: false,
    completedStages: 0,
    totalStages: 5
  });

  const [speedSummary, setSpeedSummary] = useState(null);

  // Ratios training configuration (Screenshot 2 replica)
  const [ratiosConfig, setRatiosConfig] = useState({
    bpm: 80,
    numberOfBeats: 4,
    initialCountIn: 4,
    repeatCountIn: 4,
    countInEnabled: true,
    subdivisionRatioEnabled: true,
    loop1: SUBDIVISIONS[1],
    loop2: SUBDIVISIONS[3]
  });

  const [ratiosProgress, setRatiosProgress] = useState({
    activeLoop: 1,
    currentSubdivision: SUBDIVISIONS[1],
    currentBeat: 1,
    countInRemaining: 4,
    isCountIn: false,
    isActive: false,
    isPaused: false
  });

  // Calendar dates marked as practiced
  const [practicedCalendarDays, setPracticedCalendarDays] = useState(['2026-11-01', '2026-11-03', '2026-11-04']);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date(2026, 10, 1));

  // Exercise Library
  const [exercises, setExercises] = useState([
    { id: 'ex-1', name: 'Chromatic Warmup (1-2-3-4)', category: 'Chromatic', startBpm: 70, currentBpm: 110, targetBpm: 150, lastPracticed: '2026-11-04', sessionsCount: 4, bestBurstBpm: 125 },
    { id: 'ex-2', name: 'Paul Gilbert 6-Note Alternate Picking', category: 'Alternate Picking', startBpm: 80, currentBpm: 125, targetBpm: 160, lastPracticed: '2026-11-04', sessionsCount: 6, bestBurstBpm: 140 },
    { id: 'ex-3', name: 'Spider Walk String Skipping', category: 'Spider Exercises', startBpm: 60, currentBpm: 95, targetBpm: 130, lastPracticed: '2026-11-02', sessionsCount: 3, bestBurstBpm: 110 },
    { id: 'ex-4', name: 'Pentatonic 3-Notes Sequence', category: 'Pentatonic Sequences', startBpm: 80, currentBpm: 115, targetBpm: 145, lastPracticed: '2026-10-30', sessionsCount: 2, bestBurstBpm: 130 },
  ]);

  // Exercise Library Management Modal & Form State
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [newExerciseData, setNewExerciseData] = useState({
    name: '',
    category: 'Alternate Picking',
    startBpm: 70,
    currentBpm: 90,
    targetBpm: 140
  });

  // Practice History Sessions
  const [historySessions, setHistorySessions] = useState([
    {
      id: 'session-demo-1',
      date: '2026-11-04',
      exerciseName: 'Paul Gilbert 6-Note Alternate Picking',
      category: 'Alternate Picking',
      totalDurationMinutes: 17,
      step1Elapsed: 5,
      step2Elapsed: 5,
      step3Elapsed: 4,
      step4Elapsed: 3,
      comfortBpm: 75,
      edgeBpm: 110,
      burstBpm: 125,
      targetBpm: 130,
      notes: 'Clean alternate picking upstrokes. Minimal forearm strain.',
      step1Focus: ['Relaxation', 'Synchronization'],
      step2Focus: ['Note Clarity'],
      step3Focus: ['Burst Cleanliness'],
      step4Focus: ['Tone Consistency'],
      completedSteps: 4,
      videoUrl: null
    },
    {
      id: 'session-demo-2',
      date: '2026-11-03',
      exerciseName: 'Spider Walk String Skipping',
      category: 'Spider Exercises',
      totalDurationMinutes: 16,
      step1Elapsed: 5,
      step2Elapsed: 5,
      step3Elapsed: 3,
      step4Elapsed: 3,
      comfortBpm: 72,
      edgeBpm: 105,
      burstBpm: 120,
      targetBpm: 125,
      notes: 'Outside string changes felt synchronized. Worked on pick slant.',
      step1Focus: ['Pick Slanting', 'Relaxation'],
      step2Focus: ['String Crossing'],
      step3Focus: ['Tension Release'],
      step4Focus: ['Micro-Timing'],
      completedSteps: 4,
      videoUrl: null
    },
    {
      id: 'session-demo-3',
      date: '2026-11-01',
      exerciseName: 'Chromatic Warmup (1-2-3-4)',
      category: 'Chromatic',
      totalDurationMinutes: 14,
      step1Elapsed: 4,
      step2Elapsed: 4,
      step3Elapsed: 3,
      step4Elapsed: 3,
      comfortBpm: 70,
      edgeBpm: 100,
      burstBpm: 115,
      targetBpm: 120,
      notes: 'Initial benchmark routine. Solid thumb anchor.',
      step1Focus: ['Relaxation', 'Timing'],
      step2Focus: ['Hand Synchronization'],
      step3Focus: ['Burst Cleanliness'],
      step4Focus: ['Fretboard Posture'],
      completedSteps: 4,
      videoUrl: null
    }
  ]);

  // Selected session to inspect in modal
  const [inspectedSession, setInspectedSession] = useState(null);

  // Selected exercise to inspect sessions history in My Progress
  const [inspectedExerciseProgress, setInspectedExerciseProgress] = useState(null);

  // History search & filter state
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historySortOrder, setHistorySortOrder] = useState('newest');

  // Step 4 Session Log Form
  const [logFormData, setLogFormData] = useState({
    targetBpm: 120,
    pointsOfFocusTomorrow: 'Work on outside picking consistency.',
    additionalNotes: 'Felt very relaxed at high tempo. Clean thumb anchor.'
  });

  // Tap tempo state
  const tapTimesRef = useRef([]);

  // Video recording state for Mirror Studio
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Load User Data based on Active User ID (Absolute Data Isolation)
  const loadUserData = (uid) => {
    try {
      const savedProfiles = localStorage.getItem('gps_user_profiles');
      if (savedProfiles) {
        const parsedProfiles = JSON.parse(savedProfiles);
        // Ensure default PINs are preserved if not set
        const merged = {
          user1: {
            ...parsedProfiles.user1,
            pin: parsedProfiles.user1?.pin || '7779',
            name: parsedProfiles.user1?.name || 'Guitarist 1'
          },
          user2: {
            ...parsedProfiles.user2,
            pin: parsedProfiles.user2?.pin || '1111',
            name: parsedProfiles.user2?.name || 'Guitarist 2'
          }
        };
        setUserProfiles(merged);
        if (merged[uid]?.syncKey) {
          setSyncKey(merged[uid].syncKey);
          fetchCloudData(merged[uid].syncKey);
        }
      }

      const savedTheme = localStorage.getItem(`gps_gx_theme_${uid}`);
      if (savedTheme && GX_THEMES[savedTheme]) setCurrentThemeKey(savedTheme);

      const savedSession = localStorage.getItem(`gps_practice_session_${uid}`);
      if (savedSession) setPracticeSession(JSON.parse(savedSession));

      const savedHistory = localStorage.getItem(`gps_history_${uid}`);
      if (savedHistory) setHistorySessions(JSON.parse(savedHistory));
      else setHistorySessions([]);

      const savedExercises = localStorage.getItem(`gps_exercises_${uid}`);
      if (savedExercises) setExercises(JSON.parse(savedExercises));
      else {
        // Default starting exercises for a fresh profile
        setExercises([
          { id: 'ex-1', name: 'Chromatic Warmup (1-2-3-4)', category: 'Chromatic', startBpm: 70, currentBpm: 100, targetBpm: 140, lastPracticed: '2026-11-04', sessionsCount: 1, bestBurstBpm: 115 },
          { id: 'ex-2', name: 'Paul Gilbert 6-Note Picking', category: 'Alternate Picking', startBpm: 80, currentBpm: 110, targetBpm: 160, lastPracticed: '2026-11-04', sessionsCount: 1, bestBurstBpm: 125 }
        ]);
      }

      const savedCal = localStorage.getItem(`gps_practiced_dates_${uid}`);
      if (savedCal) setPracticedCalendarDays(JSON.parse(savedCal));
      else setPracticedCalendarDays([]);
    } catch {
      // LocalStorage access fallback
    }
  };

  // Local storage initialization
  useEffect(() => {
    try {
      const savedLastUser = localStorage.getItem('gps_active_user') || 'user1';
      setActiveUserId(savedLastUser);
      loadUserData(savedLastUser);
    } catch {}
  }, []);

  // Save current profile metadata whenever changed
  const saveUserProfiles = (updated) => {
    setUserProfiles(updated);
    try {
      localStorage.setItem('gps_user_profiles', JSON.stringify(updated));
    } catch {}
  };

  // Profile Switching with PIN Verification
  const requestSwitchUser = (targetId) => {
    if (targetId === activeUserId) {
      setIsProfileModalOpen(false);
      return;
    }

    const targetProfile = userProfiles[targetId];
    if (targetProfile.pin) {
      // Target profile is protected by a PIN!
      setTargetSwitchUser(targetId);
      setEnteredPin('');
      setPinError('');
      setIsPinModalOpen(true);
      setIsProfileModalOpen(false);
    } else {
      // No PIN set, switch directly
      performUserSwitch(targetId);
      setIsProfileModalOpen(false);
    }
  };

  const performUserSwitch = (targetId) => {
    stopAllMetronomes();
    setActiveUserId(targetId);
    try {
      localStorage.setItem('gps_active_user', targetId);
    } catch {}
    loadUserData(targetId);
    audioEngine.playUiSound('step');
  };

  const handleVerifyPin = (e) => {
    e?.preventDefault();
    if (userProfiles[targetSwitchUser]?.pin === enteredPin) {
      performUserSwitch(targetSwitchUser);
      setIsPinModalOpen(false);
      setEnteredPin('');
      setPinError('');
    } else {
      setPinError('Incorrect PIN code. Access denied.');
      audioEngine.playUiSound('step');
    }
  };

  const handleSetProfilePin = (e) => {
    e?.preventDefault();
    setPinChangeError('');
    const activeProf = userProfiles[activeUserId];

    // Require current PIN verification before allowing change
    if (activeProf.pin && currentPinVerify !== activeProf.pin) {
      setPinChangeError('Current PIN is incorrect. Verification failed.');
      audioEngine.playUiSound('step');
      return;
    }

    if (!newPinInput.trim() || newPinInput.trim().length < 4) {
      setPinChangeError('New PIN must be at least 4 digits.');
      audioEngine.playUiSound('step');
      return;
    }

    const updated = {
      ...userProfiles,
      [activeUserId]: {
        ...userProfiles[activeUserId],
        pin: newPinInput.trim()
      }
    };
    saveUserProfiles(updated);
    setIsSettingPin(false);
    setCurrentPinVerify('');
    setNewPinInput('');
    setPinChangeError('');
    audioEngine.playUiSound('step');
  };

  const handleUpdateProfileName = (newName) => {
    const updated = {
      ...userProfiles,
      [activeUserId]: {
        ...userProfiles[activeUserId],
        name: newName.trim() || `Guitarist ${activeUserId === 'user1' ? '1' : '2'}`
      }
    };
    saveUserProfiles(updated);
  };

  // CLOUD SYNC ENGINE (Synchronizes PC & Phone per isolated user)
  const syncToCloud = async (overrideData = null) => {
    const activeSyncKey = userProfiles[activeUserId]?.syncKey || syncKey;
    if (!activeSyncKey) return;
    setIsSyncing(true);
    const payload = overrideData || {
      userId: activeUserId,
      profileName: userProfiles[activeUserId]?.name,
      historySessions,
      exercises,
      practicedCalendarDays,
      updatedAt: new Date().toISOString()
    };

    try {
      // Unique isolated key per user
      const res = await fetch(`https://kvdb.io/AnCkW8L3xWbS2F45xeqYw5/${activeSyncKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus(null), 3000);
      }
    } catch {
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchCloudData = async (keyToFetch = syncKey) => {
    const activeSyncKey = keyToFetch || userProfiles[activeUserId]?.syncKey;
    if (!activeSyncKey) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`https://kvdb.io/AnCkW8L3xWbS2F45xeqYw5/${activeSyncKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data.historySessions) {
          setHistorySessions(data.historySessions);
          localStorage.setItem(`gps_history_${activeUserId}`, JSON.stringify(data.historySessions));
        }
        if (data.exercises) {
          setExercises(data.exercises);
          localStorage.setItem(`gps_exercises_${activeUserId}`, JSON.stringify(data.exercises));
        }
        if (data.practicedCalendarDays) {
          setPracticedCalendarDays(data.practicedCalendarDays);
          localStorage.setItem(`gps_practiced_dates_${activeUserId}`, JSON.stringify(data.practicedCalendarDays));
        }
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus(null), 3000);
      }
    } catch {
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectSyncKey = (newKey) => {
    const clean = newKey.trim().toLowerCase();
    if (!clean) return;
    setSyncKey(clean);
    const updated = {
      ...userProfiles,
      [activeUserId]: {
        ...userProfiles[activeUserId],
        syncKey: clean
      }
    };
    saveUserProfiles(updated);
    fetchCloudData(clean);
    setIsSyncModalOpen(false);
  };

  const changeTheme = (key) => {
    if (GX_THEMES[key]) {
      setCurrentThemeKey(key);
      try {
        localStorage.setItem(`gps_gx_theme_${activeUserId}`, key);
      } catch {}
    }
  };

  const handleSoundTypeChange = (newType) => {
    setSoundType(newType);
    audioEngine.setSoundType(newType);
  };

  // Step Countdown Timers Heartbeat with Time's Up trigger & Elapsed Tracker
  useEffect(() => {
    const timer = setInterval(() => {
      setPracticeSession(prev => {
        let changed = false;
        let finishedStep = null;
        const next = { ...prev };

        ['step1', 'step2', 'step3', 'step4'].forEach(stepKey => {
          if (next[stepKey].isTimerRunning) {
            changed = true;
            next[stepKey] = {
              ...next[stepKey],
              elapsedSeconds: (next[stepKey].elapsedSeconds || 0) + 1
            };

            if (next[stepKey].remainingSeconds > 0) {
              next[stepKey].remainingSeconds -= 1;
            } else {
              next[stepKey] = {
                ...next[stepKey],
                isTimerRunning: false,
                isCompleted: true
              };
              finishedStep = stepKey;
            }
          }
        });

        if (finishedStep) {
          stopAllMetronomes();
          audioEngine.playUiSound('timeover');
          const stepNames = {
            step1: 'Step 1: Comfort Zone Warmup',
            step2: 'Step 2: Edge of Ability',
            step3: 'Step 3: Speed Bursts',
            step4: 'Step 4: Gamify & Log Progress'
          };
          setTimeUpStep(stepNames[finishedStep] || finishedStep.toUpperCase());
        }

        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Recording stopwatch
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(sec => sec + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingSeconds(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  // Global Keyboard Shortcuts (Space: Play/Pause, Up/Down: BPM change)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          stopAllMetronomes();
        } else {
          startCurrentContextMetronome();
        }
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        const delta = e.shiftKey ? 5 : 1;
        adjustActiveBpm(delta);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        const delta = e.shiftKey ? 5 : 1;
        adjustActiveBpm(-delta);
      } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code) || ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const stepNum = parseInt(e.key, 10);
        if (stepNum >= 1 && stepNum <= 4) {
          setActiveTab('daily');
          setCurrentStepOpen(stepNum);
          audioEngine.playUiSound('step');
        }
      } else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setIsHotkeysModalOpen(prev => !prev);
        audioEngine.playUiSound('step');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, bpm, selectedSubdivision, activeTab, currentStepOpen, practiceSession, activeMetronomeMode]);

  const stopAllMetronomes = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setIsBurstActive(false);
    setBurstCountRemaining(0);
    setSpeedProgress(prev => ({ ...prev, isActive: false, isPaused: false, stage: 'idle' }));
    setRatiosProgress(prev => ({ ...prev, isActive: false, isPaused: false, isCountIn: false }));
  };

  const startCurrentContextMetronome = () => {
    if (activeTab === 'daily') {
      let targetBpm = practiceSession.step1.bpm;
      let targetSubdiv = practiceSession.step1.subdivision;
      if (currentStepOpen === 2) {
        targetBpm = practiceSession.step2.bpm;
        targetSubdiv = practiceSession.step2.subdivision;
      } else if (currentStepOpen === 3) {
        targetBpm = practiceSession.step3.bpm;
        targetSubdiv = practiceSession.step3.subdivision;
      }
      audioEngine.setTimeSignature(timeSignature);
      togglePlay(targetBpm, targetSubdiv);
    } else {
      if (activeMetronomeMode === 'standard') {
        togglePlay(bpm, selectedSubdivision);
      } else if (activeMetronomeMode === 'speed') {
        startSpeedTraining();
      } else if (activeMetronomeMode === 'ratios') {
        startRatiosTraining();
      }
    }
  };

  const adjustActiveBpm = (delta) => {
    if (activeTab === 'daily') {
      if (currentStepOpen === 1) updateStepBpm(1, practiceSession.step1.bpm + delta);
      else if (currentStepOpen === 2) updateStepBpm(2, practiceSession.step2.bpm + delta);
      else if (currentStepOpen === 3) updateStepBpm(3, practiceSession.step3.bpm + delta);
    } else if (activeMetronomeMode === 'standard') {
      const newBpm = Math.max(30, Math.min(320, bpm + delta));
      setBpm(newBpm);
      audioEngine.setBpm(newBpm);
    } else if (activeMetronomeMode === 'ratios') {
      const newBpm = Math.max(30, Math.min(320, ratiosConfig.bpm + delta));
      setRatiosConfig(prev => ({ ...prev, bpm: newBpm }));
      if (ratiosProgress.isActive) audioEngine.setBpm(newBpm);
    }
  };

  // Speed Training Controller Logic
  const startSpeedTraining = () => {
    const totalSteps = Math.floor((speedConfig.endBpm - speedConfig.startBpm) / speedConfig.bpmIncrement) + 1;
    audioEngine.stop();
    audioEngine.setTimeSignature(speedConfig.timeSignature);
    audioEngine.setSubdivision(selectedSubdivision);
    audioEngine.setBpm(speedConfig.startBpm);
    audioEngine.start();
    setIsPlaying(true);

    const hasCountIn = speedConfig.countInEnabled && speedConfig.initialCountIn > 0;
    setSpeedProgress({
      currentBpm: speedConfig.startBpm,
      currentBar: 1,
      currentLoop: 1,
      currentBeat: 1,
      barsRemainingInStage: speedConfig.barsPerLoop,
      loopsRemainingInStage: speedConfig.loopsBeforeIncrease,
      countInRemaining: hasCountIn ? speedConfig.initialCountIn : 0,
      stage: hasCountIn ? 'countin' : 'playing',
      isActive: true,
      isPaused: false,
      completedStages: 0,
      totalStages: totalSteps
    });
  };

  const pauseSpeedTraining = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setSpeedProgress(prev => ({ ...prev, isPaused: true }));
  };

  const resumeSpeedTraining = () => {
    audioEngine.setBpm(speedProgress.currentBpm);
    audioEngine.setTimeSignature(speedConfig.timeSignature);
    audioEngine.start();
    setIsPlaying(true);
    setSpeedProgress(prev => ({ ...prev, isPaused: false }));
  };

  const stopSpeedTraining = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setSpeedProgress(prev => ({ ...prev, isActive: false, isPaused: false, stage: 'idle' }));
  };

  // Ratios Training Controller Logic
  const startRatiosTraining = () => {
    audioEngine.stop();
    const ts = { beats: ratiosConfig.numberOfBeats, noteValue: 4 };
    audioEngine.setTimeSignature(ts);
    audioEngine.setBpm(ratiosConfig.bpm);
    audioEngine.setSubdivision(ratiosConfig.loop1);
    audioEngine.start();
    setIsPlaying(true);

    const hasCountIn = ratiosConfig.countInEnabled && ratiosConfig.initialCountIn > 0;
    setRatiosProgress({
      activeLoop: 1,
      currentSubdivision: ratiosConfig.loop1,
      currentBeat: 1,
      countInRemaining: hasCountIn ? ratiosConfig.initialCountIn : 0,
      isCountIn: hasCountIn,
      isActive: true,
      isPaused: false
    });
  };

  const pauseRatiosTraining = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setRatiosProgress(prev => ({ ...prev, isPaused: true }));
  };

  const resumeRatiosTraining = () => {
    audioEngine.setBpm(ratiosConfig.bpm);
    audioEngine.setSubdivision(ratiosProgress.currentSubdivision);
    audioEngine.setTimeSignature({ beats: ratiosConfig.numberOfBeats, noteValue: 4 });
    audioEngine.start();
    setIsPlaying(true);
    setRatiosProgress(prev => ({ ...prev, isPaused: false }));
  };

  const stopRatiosTraining = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setRatiosProgress(prev => ({
      ...prev,
      isActive: false,
      isPaused: false,
      isCountIn: false,
      currentBeat: 1,
      activeLoop: 1,
      currentSubdivision: ratiosConfig.loop1
    }));
  };

  // Audio Engine Beat Scheduler Callback
  useEffect(() => {
    audioEngine.onBeat = (beatNumber, isBarStart) => {
      // Determine currently active training mode across both Metronome tab and Step tabs
      const currentMode = activeTab === 'daily'
        ? (currentStepOpen === 1 ? step1SubTab : currentStepOpen === 2 ? step2SubTab : step3SubTab)
        : activeMetronomeMode;

      // Speed Training Engine Synchronization
      if (currentMode === 'speed' && speedProgress.isActive && !speedProgress.isPaused) {
        setSpeedProgress(prev => {
          const s = { ...prev };

          if (s.stage === 'countin' || s.stage === 'increasing') {
            if (s.countInRemaining > 1) {
              s.countInRemaining -= 1;
              return s;
            } else {
              s.countInRemaining = 0;
              s.stage = 'playing';
              s.currentBeat = 1;
              s.currentBar = 1;
              s.currentLoop = 1;
              return s;
            }
          }

          const beatsPerBar = speedConfig.timeSignature?.beats || 4;

          if (s.currentBeat < beatsPerBar) {
            s.currentBeat += 1;
          } else {
            // Completed a full bar
            s.currentBeat = 1;

            if (s.currentBar < speedConfig.barsPerLoop) {
              s.currentBar += 1;
            } else {
              // Completed all bars in the current loop
              s.currentBar = 1;

              if (s.currentLoop < speedConfig.loopsBeforeIncrease) {
                s.currentLoop += 1;
              } else {
                // Completed all loops in the current stage: Advance BPM
                s.currentLoop = 1;
                s.completedStages += 1;
                const nextStageBpm = s.currentBpm + speedConfig.bpmIncrement;

                if (s.currentBpm >= speedConfig.endBpm || nextStageBpm > speedConfig.endBpm) {
                  if (s.currentBpm < speedConfig.endBpm) {
                    s.currentBpm = speedConfig.endBpm;
                    audioEngine.setBpm(speedConfig.endBpm);
                    return s;
                  }
                  s.stage = 'finished';
                  s.isActive = false;
                  audioEngine.stop();
                  setIsPlaying(false);
                  setSpeedSummary({
                    startBpm: speedConfig.startBpm,
                    endBpm: speedConfig.endBpm,
                    completedStages: s.completedStages,
                    timeSignature: speedConfig.timeSignature.label
                  });
                  return s;
                } else {
                  s.currentBpm = nextStageBpm;
                  audioEngine.setBpm(nextStageBpm);
                  if (speedConfig.countInEnabled && speedConfig.speedIncreaseCountIn > 0) {
                    s.stage = 'increasing';
                    s.countInRemaining = speedConfig.speedIncreaseCountIn;
                  }
                }
              }
            }
          }
          return s;
        });
      }

      // Ratios Training Engine Synchronization
      if (currentMode === 'ratios' && ratiosProgress.isActive && !ratiosProgress.isPaused) {
        setRatiosProgress(prev => {
          const r = { ...prev };

          if (r.isCountIn) {
            if (r.countInRemaining > 1) {
              r.countInRemaining -= 1;
              return r;
            } else {
              r.countInRemaining = 0;
              r.isCountIn = false;
              r.currentBeat = 1;
              r.activeLoop = 1;
              r.currentSubdivision = ratiosConfig.loop1;
              audioEngine.setSubdivision(ratiosConfig.loop1);
              return r;
            }
          }

          // Advance beat within loop
          if (r.currentBeat < ratiosConfig.numberOfBeats) {
            r.currentBeat += 1;
          } else {
            // Completed configured number of beats for current loop
            if (ratiosConfig.subdivisionRatioEnabled) {
              const nextLoop = r.activeLoop === 1 ? 2 : 1;
              const nextSubdiv = nextLoop === 1 ? ratiosConfig.loop1 : ratiosConfig.loop2;

              // Check if repeat count in is enabled between cycle completions (after loop 2 finishes)
              if (r.activeLoop === 2 && ratiosConfig.countInEnabled && ratiosConfig.repeatCountIn > 0) {
                r.isCountIn = true;
                r.countInRemaining = ratiosConfig.repeatCountIn;
                r.currentBeat = 1;
                r.activeLoop = 1;
                r.currentSubdivision = ratiosConfig.loop1;
                audioEngine.setSubdivision(ratiosConfig.loop1);
                return r;
              }

              r.activeLoop = nextLoop;
              r.currentSubdivision = nextSubdiv;
              r.currentBeat = 1;
              audioEngine.setSubdivision(nextSubdiv);
            } else {
              // Single loop mode: stay locked on loop 1
              r.activeLoop = 1;
              r.currentSubdivision = ratiosConfig.loop1;
              r.currentBeat = 1;
              audioEngine.setSubdivision(ratiosConfig.loop1);
            }
          }

          return r;
        });
      }
    };

    return () => {
      audioEngine.onBeat = null;
    };
  }, [
    activeTab, currentStepOpen, step1SubTab, step2SubTab, step3SubTab,
    activeMetronomeMode, speedConfig, speedProgress.isActive, speedProgress.isPaused,
    ratiosConfig, ratiosProgress.isActive, ratiosProgress.isPaused
  ]);

  // Sync visualizer loop (High precision requestAnimationFrame)
  useEffect(() => {
    let animId;
    const checkScheduledNotes = () => {
      if (audioEngine.audioCtx) {
        const currentTime = audioEngine.audioCtx.currentTime;
        const events = audioEngine.scheduledEvents;

        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].time <= currentTime) {
            setActiveDotInfo({
              dotsPerBeat: events[i].dotsPerBeat,
              activeDotIndex: events[i].subdivisionIndex,
              isDownbeat: events[i].isDownbeat,
              isBeatStart: events[i].isBeatStart,
              beatNumber: events[i].beatNumber
            });
            break;
          }
        }
      }
      animId = requestAnimationFrame(checkScheduledNotes);
    };

    animId = requestAnimationFrame(checkScheduledNotes);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Standard Metronome Play/Pause toggle
  const togglePlay = (targetBpm = bpm, targetSubdiv = selectedSubdivision) => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      setIsBurstActive(false);
    } else {
      setBpm(targetBpm);
      setSelectedSubdivision(targetSubdiv);
      audioEngine.setBpm(targetBpm);
      audioEngine.setSubdivision(targetSubdiv);
      audioEngine.setTimeSignature(timeSignature);
      audioEngine.start();
      setIsPlaying(true);
    }
  };

  // Speed burst pulse helper
  const triggerSpeedBurst = (beatsCount) => {
    audioEngine.stop();
    audioEngine.setBpm(practiceSession.step3.bpm);
    audioEngine.setSubdivision(practiceSession.step3.subdivision);
    audioEngine.start();
    setIsPlaying(true);
    setIsBurstActive(true);
    setBurstCountRemaining(beatsCount);

    const secondsPerQuarterBeat = 60.0 / practiceSession.step3.bpm;
    const totalDurationMs = secondsPerQuarterBeat * beatsCount * 1000;

    setTimeout(() => {
      audioEngine.stop();
      setIsPlaying(false);
      setIsBurstActive(false);
      setBurstCountRemaining(0);
    }, totalDurationMs);
  };

  // Tap tempo calculation
  const handleTapTempo = () => {
    const now = performance.now();
    const times = tapTimesRef.current;
    if (times.length > 0 && now - times[times.length - 1] > 2000) {
      times.length = 0;
    }
    times.push(now);
    if (times.length > 4) times.shift();

    if (times.length >= 2) {
      const intervals = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      const clamped = Math.max(30, Math.min(320, calculatedBpm));
      setBpm(clamped);
      audioEngine.setBpm(clamped);
    }
  };

  // Timer controls
  const toggleTimer = (stepKey) => {
    setPracticeSession(prev => ({
      ...prev,
      [stepKey]: {
        ...prev[stepKey],
        isTimerRunning: !prev[stepKey].isTimerRunning
      }
    }));
  };

  const resetTimer = (stepKey) => {
    setPracticeSession(prev => ({
      ...prev,
      [stepKey]: {
        ...prev[stepKey],
        isTimerRunning: false,
        remainingSeconds: prev[stepKey].durationMinutes * 60,
        elapsedSeconds: 0
      }
    }));
  };

  const handleTimerDurationChange = (stepKey, mins) => {
    setPracticeSession(prev => ({
      ...prev,
      [stepKey]: {
        ...prev[stepKey],
        durationMinutes: mins,
        remainingSeconds: mins * 60,
        elapsedSeconds: 0,
        isTimerRunning: false
      }
    }));
  };

  // Focus Area Tag Toggle
  const toggleFocusArea = (stepKey, tag) => {
    setPracticeSession(prev => {
      const currentTags = prev[stepKey].focusAreas;
      const exists = currentTags.includes(tag);
      const updated = exists ? currentTags.filter(t => t !== tag) : [...currentTags, tag];
      return {
        ...prev,
        [stepKey]: {
          ...prev[stepKey],
          focusAreas: updated
        }
      };
    });
  };

  const addCustomFocusTag = (stepKey) => {
    if (!customTagInput.trim()) return;
    const tag = customTagInput.trim();
    setPracticeSession(prev => ({
      ...prev,
      [stepKey]: {
        ...prev[stepKey],
        focusAreas: [...new Set([...prev[stepKey].focusAreas, tag])]
      }
    }));
    setCustomTagInput('');
  };

  // Step BPM updates
  const updateStepBpm = (stepNum, newBpm) => {
    const clamped = Math.max(30, Math.min(320, newBpm));
    const stepKey = `step${stepNum}`;
    setPracticeSession(prev => ({
      ...prev,
      [stepKey]: { ...prev[stepKey], bpm: clamped }
    }));
    if (isPlaying) {
      audioEngine.setBpm(clamped);
    }
  };

  // Exercise Library Handlers
  const handleCreateExercise = (e) => {
    e?.preventDefault();
    if (!newExerciseData.name.trim()) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const created = {
      id: `ex-${Date.now()}`,
      name: newExerciseData.name.trim(),
      category: newExerciseData.category || 'Alternate Picking',
      startBpm: Math.max(30, Math.min(320, Number(newExerciseData.startBpm) || 60)),
      currentBpm: Math.max(30, Math.min(320, Number(newExerciseData.currentBpm) || 80)),
      targetBpm: Math.max(30, Math.min(320, Number(newExerciseData.targetBpm) || 120)),
      lastPracticed: todayStr,
      sessionsCount: 0,
      bestBurstBpm: Math.max(30, Math.min(320, (Number(newExerciseData.currentBpm) || 80) + 15))
    };

    setExercises(prev => [created, ...prev]);
    setIsAddExerciseModalOpen(false);
    setNewExerciseData({
      name: '',
      category: 'Alternate Picking',
      startBpm: 70,
      currentBpm: 90,
      targetBpm: 140
    });
  };

  const handleDeleteExercise = (id) => {
    setExercises(prev => {
      const updated = prev.filter(ex => ex.id !== id);
      try {
        localStorage.setItem(`gps_exercises_${activeUserId}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Delete a specific session
  const handleDeleteSession = (sessionId) => {
    setHistorySessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      try {
        localStorage.setItem(`gps_history_${activeUserId}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // ONE-CLICK EXERCISE LOADER: Automatically wires an exercise from library into daily practice
  const loadExerciseIntoRoutine = (ex) => {
    const comfortTempo = Math.round(ex.currentBpm * 0.75);
    const edgeTempo = ex.currentBpm;
    const burstTempo = Math.min(320, ex.currentBpm + 15);

    // Map category to smart default focus tags
    let defaultStep1Focus = ['Relaxation', 'Synchronization'];
    let defaultStep2Focus = ['Note Clarity'];
    if (ex.category === 'Sweep Picking') {
      defaultStep1Focus = ['Muting', 'Wrist Movement'];
      defaultStep2Focus = ['String Crossing', 'Hand Synchronization'];
    } else if (ex.category === 'Legato') {
      defaultStep1Focus = ['Left Hand Isolation', 'Relaxation'];
      defaultStep2Focus = ['Economy of Motion', 'Tone Consistency'];
    }

    setPracticeSession(prev => ({
      ...prev,
      selectedExerciseId: ex.id,
      selectedExerciseName: ex.name,
      selectedCategory: ex.category,
      step1: {
        ...prev.step1,
        bpm: comfortTempo,
        remainingSeconds: prev.step1.durationMinutes * 60,
        isCompleted: false,
        focusAreas: defaultStep1Focus
      },
      step2: {
        ...prev.step2,
        bpm: edgeTempo,
        remainingSeconds: prev.step2.durationMinutes * 60,
        isCompleted: false,
        focusAreas: defaultStep2Focus
      },
      step3: {
        ...prev.step3,
        bpm: burstTempo,
        remainingSeconds: prev.step3.durationMinutes * 60,
        isCompleted: false
      },
      step4: {
        ...prev.step4,
        bpm: edgeTempo,
        isCompleted: false
      }
    }));

    setLogFormData(prev => ({
      ...prev,
      targetBpm: Math.min(320, ex.currentBpm + 5)
    }));

    setActiveTab('daily');
    setCurrentStepOpen(1);
    updateStepBpm(1, comfortTempo);
  };

  // DEEP UNIFIED SESSION LOGGING (Interconnects History, Library, Calendar, & Progress)
  const handleSaveSession = () => {
    // Calculate actual elapsed minutes (or fallback to planned duration)
    const calcMinutes = (sec, planMins) => (sec > 30 ? Math.ceil(sec / 60) : planMins);
    const s1Elapsed = calcMinutes(practiceSession.step1.elapsedSeconds, practiceSession.step1.durationMinutes);
    const s2Elapsed = calcMinutes(practiceSession.step2.elapsedSeconds, practiceSession.step2.durationMinutes);
    const s3Elapsed = calcMinutes(practiceSession.step3.elapsedSeconds, practiceSession.step3.durationMinutes);
    const s4Elapsed = calcMinutes(practiceSession.step4.elapsedSeconds, practiceSession.step4.durationMinutes);
    const totalDuration = s1Elapsed + s2Elapsed + s3Elapsed + s4Elapsed;

    const todayStr = new Date().toISOString().split('T')[0];
    const exerciseName = practiceSession.selectedExerciseName || 'Custom / Free Practice Routine';
    const exerciseCategory = practiceSession.selectedCategory || 'Technique';

    // 1. Build Comprehensive History Session
    const newSession = {
      id: `session-${Date.now()}`,
      userId: activeUserId,
      date: todayStr,
      exerciseId: practiceSession.selectedExerciseId,
      exerciseName,
      category: exerciseCategory,
      totalDurationMinutes: totalDuration,
      step1Elapsed: s1Elapsed,
      step2Elapsed: s2Elapsed,
      step3Elapsed: s3Elapsed,
      step4Elapsed: s4Elapsed,
      comfortBpm: practiceSession.step1.bpm,
      edgeBpm: practiceSession.step2.bpm,
      burstBpm: practiceSession.step3.bpm,
      targetBpm: Number(logFormData.targetBpm) || (practiceSession.step2.bpm + 5),
      notes: `${logFormData.pointsOfFocusTomorrow} | ${logFormData.additionalNotes}`,
      step1Focus: practiceSession.step1.focusAreas,
      step2Focus: practiceSession.step2.focusAreas,
      step3Focus: practiceSession.step3.focusAreas,
      step4Focus: practiceSession.step4.focusAreas,
      completedSteps: 4,
      videoUrl: practiceSession.step4.recordedVideoBlobUrl || recordedVideoUrl || null
    };

    setHistorySessions(prev => [newSession, ...prev]);

    // 2. Automatically Update Exercise in Library for this user
    let updatedExercises = exercises;
    if (practiceSession.selectedExerciseId && practiceSession.selectedExerciseId !== 'custom') {
      updatedExercises = exercises.map(ex => {
        if (ex.id === practiceSession.selectedExerciseId) {
          return {
            ...ex,
            currentBpm: Math.max(ex.currentBpm, practiceSession.step2.bpm),
            bestBurstBpm: Math.max(ex.bestBurstBpm || 0, practiceSession.step3.bpm),
            sessionsCount: (ex.sessionsCount || 0) + 1,
            lastPracticed: todayStr
          };
        }
        return ex;
      });
      setExercises(updatedExercises);
      try {
        localStorage.setItem(`gps_exercises_${activeUserId}`, JSON.stringify(updatedExercises));
      } catch {}
    }

    // 3. Automatically Update Consistency Calendar for this user
    let updatedCalendar = practicedCalendarDays;
    if (!practicedCalendarDays.includes(todayStr)) {
      updatedCalendar = [...practicedCalendarDays, todayStr];
      setPracticedCalendarDays(updatedCalendar);
      try {
        localStorage.setItem(`gps_practiced_dates_${activeUserId}`, JSON.stringify(updatedCalendar));
      } catch {}
    }

    // 4. Mark all steps as complete in active session state
    setPracticeSession(prev => ({
      ...prev,
      step1: { ...prev.step1, isCompleted: true, elapsedSeconds: 0 },
      step2: { ...prev.step2, isCompleted: true, elapsedSeconds: 0 },
      step3: { ...prev.step3, isCompleted: true, elapsedSeconds: 0 },
      step4: { ...prev.step4, isCompleted: true, elapsedSeconds: 0 }
    }));

    // 5. Save History to user-specific localStorage permanently
    const updatedHistory = [newSession, ...historySessions];
    try {
      localStorage.setItem(`gps_history_${activeUserId}`, JSON.stringify(updatedHistory));
    } catch {}

    // 6. Broadcast to Cloud for this specific user's sync key
    syncToCloud({
      userId: activeUserId,
      profileName: userProfiles[activeUserId]?.name,
      historySessions: updatedHistory,
      exercises: updatedExercises,
      practicedCalendarDays: updatedCalendar,
      updatedAt: new Date().toISOString()
    });

    setIsLogModalOpen(false);
    setActiveTab('progress');
  };

  // Calendar toggle for retroactive logging
  const toggleCalendarDate = (dateStr) => {
    setPracticedCalendarDays(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  // Video recording controls for Mirror Studio
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch {
      // Graceful fallback for simulator
      setIsCameraActive(true);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsRecording(false);
  };

  const startRecording = () => {
    if (!videoRef.current?.srcObject) return;
    recordedChunksRef.current = [];
    try {
      const stream = videoRef.current.srcObject;
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        // Link to Step 4 session state immediately
        setPracticeSession(prev => ({
          ...prev,
          step4: { ...prev.step4, hasRecording: true, recordedVideoBlobUrl: url }
        }));
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch {
      // Fallback
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Export / Import History
  const exportHistoryJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      historySessions,
      exercises,
      practicedCalendarDays
    }, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `wannabe_guitarist_backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
  };

  // ==========================================================================
  // RENDER: PURE DOT-BASED RHYTHMIC VISUALISER (Exact card per beat)
  // ==========================================================================
  const renderDotVisualiser = (subdiv = selectedSubdivision, currentBpm = bpm, customBeatsCount = null) => {
    const beatsCount = customBeatsCount || timeSignature.beats || 4;
    const dotsCount = subdiv?.dotsPerBeat || 1;

    return (
      <div className="w-full max-w-2xl mx-auto my-3 sm:my-4 select-none">
        <div className="grid gap-1.5 sm:gap-2.5" style={{ gridTemplateColumns: `repeat(${beatsCount}, minmax(0, 1fr))` }}>
          {Array.from({ length: beatsCount }).map((_, beatIdx) => {
            const beatNumber = beatIdx + 1;
            const isCurrentBeat = isPlaying && activeDotInfo.beatNumber === beatNumber;
            const isDownbeat = beatIdx === 0;

            return (
              <div
                key={beatIdx}
                className="flex flex-col items-center justify-between py-2 sm:py-3 px-1 rounded-xl sm:rounded-2xl transition-all duration-75 relative overflow-hidden backdrop-blur-sm"
                style={{
                  backgroundColor: isCurrentBeat ? '#1A1A24' : '#12121A',
                  border: isCurrentBeat
                    ? `1px solid ${isDownbeat ? currentTheme.secondary : currentTheme.primary}`
                    : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: isCurrentBeat
                    ? `0 0 16px ${isDownbeat ? currentTheme.secondary : currentTheme.primary}40, inset 0 0 12px ${currentTheme.glowSubtle}`
                    : 'none'
                }}
              >
                {/* Subtle top indicator bar on active beat */}
                {isCurrentBeat && (
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px] transition-all"
                    style={{ backgroundColor: isDownbeat ? currentTheme.secondary : currentTheme.primary }}
                  />
                )}

                <div
                  className="text-[10px] sm:text-xs font-semibold tracking-wider font-gx-code uppercase mb-1.5 transition-colors"
                  style={{ color: isCurrentBeat ? currentTheme.primary : '#92929F' }}
                >
                  Beat {beatNumber}
                </div>

                <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap min-h-[22px] sm:min-h-[28px] px-0.5">
                  {Array.from({ length: dotsCount }).map((_, dotIdx) => {
                    const isDotActive = isCurrentBeat && activeDotInfo.activeDotIndex === dotIdx;

                    return (
                      <div
                        key={dotIdx}
                        className={`rounded-full transition-all duration-75 ${
                          dotsCount > 4 ? 'w-2 h-2 sm:w-2.5 sm:h-2.5' : 'w-2.5 h-2.5 sm:w-3.5 sm:h-3.5'
                        }`}
                        style={{
                          backgroundColor: isDotActive
                            ? (isDownbeat ? currentTheme.secondary : currentTheme.primary)
                            : '#272736',
                          boxShadow: isDotActive
                            ? `0 0 14px ${isDownbeat ? currentTheme.secondary : currentTheme.primary}, 0 0 4px #FFFFFF`
                            : 'none',
                          transform: isDotActive ? 'scale(1.3)' : 'scale(1)'
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ==========================================================================
  // RENDER: STEP METRONOME SUITE (Standard, Speed, and Ratios in Steps 1, 2, 3)
  // ==========================================================================
  const renderStepMetronomeSuite = (stepNumber, currentStepBpm, activeSubTab, setActiveSubTab, accentColor) => {
    const stepKey = `step${stepNumber}`;
    const stepSubdiv = practiceSession[stepKey]?.subdivision || SUBDIVISIONS[0];
    const isSettingsOpen = stepNumber === 1 ? step1SettingsOpen : stepNumber === 2 ? step2SettingsOpen : step3SettingsOpen;
    const setSettingsOpen = stepNumber === 1 ? setStep1SettingsOpen : stepNumber === 2 ? setStep2SettingsOpen : setStep3SettingsOpen;

    return (
      <div className="space-y-3 pt-2">
        {/* Mode Selector Strip */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[#101016] p-1 rounded-xl border border-white/5">
            {['standard', 'speed', 'ratios'].map(mode => (
              <button
                key={mode}
                onClick={() => setActiveSubTab(mode)}
                className="px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all"
                style={{
                  backgroundColor: activeSubTab === mode ? '#1B1B25' : 'transparent',
                  color: activeSubTab === mode ? currentTheme.primary : '#92929F',
                  boxShadow: activeSubTab === mode ? `0 0 10px ${currentTheme.glowSubtle}` : 'none'
                }}
              >
                {mode === 'standard' ? 'Standard' : mode === 'speed' ? 'Speed' : 'Ratios'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSettingsOpen(!isSettingsOpen)}
            className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-[#92929F] hover:text-white bg-[#101016] px-2.5 py-1.5 rounded-lg border border-white/5 ml-auto hover:border-white/10 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
            <span className="hidden xs:inline">Options</span>
            {isSettingsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 1. STANDARD METRONOME (CLEAN & EFFICIENT) */}
        {activeSubTab === 'standard' && (
          <div className="bg-[#15151D] border border-white/5 rounded-2xl p-3.5 sm:p-5 shadow-xl relative overflow-hidden">
            {/* Ambient subtle glow */}
            <div
              className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full pointer-events-none blur-3xl opacity-20"
              style={{ backgroundColor: currentTheme.primary }}
            />

            {/* Prominent BPM Display */}
            <div className="flex flex-col items-center justify-center pt-1 pb-1 relative z-10">
              <div className="text-6xl sm:text-8xl font-black font-gx-num tracking-tight text-white leading-none">
                {currentStepBpm}
              </div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#92929F] font-bold font-gx-display mt-1">
                Beats Per Minute
              </div>
            </div>

            {/* Pure Dot-Based Visualizer (Directly Below BPM) */}
            {renderDotVisualiser(stepSubdiv, currentStepBpm)}

            {/* Essential Controls Row - Touch Ergonomic */}
            <div className="flex flex-col items-center justify-center pt-1 sm:pt-2 relative z-10">
              <div className="flex items-center gap-1.5 sm:gap-2.5 w-full justify-center max-w-sm">
                <button
                  onClick={() => updateStepBpm(stepNumber, currentStepBpm - 5)}
                  className="flex-1 sm:flex-none px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl bg-[#1B1B25] border border-white/5 text-xs font-bold font-gx-num text-white hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                >
                  -5
                </button>
                <button
                  onClick={() => updateStepBpm(stepNumber, currentStepBpm - 1)}
                  className="w-9 h-9 rounded-xl bg-[#1B1B25] border border-white/5 text-xs font-bold font-gx-num text-white flex items-center justify-center hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                >
                  -1
                </button>
                <button
                  onClick={() => togglePlay(currentStepBpm, stepSubdiv)}
                  className="flex-[2] sm:flex-none px-4 sm:px-8 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-extrabold font-gx-display flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95"
                  style={{
                    backgroundColor: isPlaying ? '#EF4444' : currentTheme.primary,
                    color: isPlaying ? '#FFFFFF' : '#FFFFFF',
                    boxShadow: isPlaying
                      ? '0 0 20px rgba(239, 68, 68, 0.45)'
                      : `0 0 20px ${currentTheme.glow}`
                  }}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  {isPlaying ? 'STOP' : 'START'}
                </button>
                <button
                  onClick={() => updateStepBpm(stepNumber, currentStepBpm + 1)}
                  className="w-9 h-9 rounded-xl bg-[#1B1B25] border border-white/5 text-xs font-bold font-gx-num text-white flex items-center justify-center hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                >
                  +1
                </button>
                <button
                  onClick={() => updateStepBpm(stepNumber, currentStepBpm + 5)}
                  className="flex-1 sm:flex-none px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl bg-[#1B1B25] border border-white/5 text-xs font-bold font-gx-num text-white hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                >
                  +5
                </button>
              </div>

              {/* Slider */}
              <div className="w-full max-w-sm mt-3.5 sm:mt-4 flex items-center gap-3">
                <input
                  type="range"
                  min="30"
                  max="300"
                  value={currentStepBpm}
                  onChange={(e) => updateStepBpm(stepNumber, Number(e.target.value))}
                  style={{ accentColor: currentTheme.primary }}
                  className="w-full bg-[#1B1B25] h-2 sm:h-1.5 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Click-to-Expand Settings */}
            {isSettingsOpen && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5 animate-in fade-in duration-200">
                <div>
                  <label className="text-[10px] uppercase font-semibold text-[#92929F] mb-1.5 block">Subdivision</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {SUBDIVISIONS.map(s => {
                      const isSel = stepSubdiv.id === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setPracticeSession(prev => ({
                              ...prev,
                              [stepKey]: { ...prev[stepKey], subdivision: s }
                            }));
                            if (isPlaying) audioEngine.setSubdivision(s);
                          }}
                          className="px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold border transition-all truncate text-left sm:text-center"
                          style={{
                            backgroundColor: isSel ? currentTheme.accentBg : '#1B1B25',
                            borderColor: isSel ? currentTheme.primary : 'rgba(255,255,255,0.05)',
                            color: isSel ? currentTheme.primary : '#92929F'
                          }}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-semibold text-[#92929F] mb-1.5 block">Time Signature</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TIME_SIGNATURES.map(ts => {
                      const isSel = timeSignature.id === ts.id;
                      return (
                        <button
                          key={ts.id}
                          onClick={() => {
                            setTimeSignature(ts);
                            audioEngine.setTimeSignature(ts);
                          }}
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
                          style={{
                            backgroundColor: isSel ? currentTheme.accentBg : '#1B1B25',
                            borderColor: isSel ? currentTheme.primary : 'rgba(255,255,255,0.05)',
                            color: isSel ? currentTheme.primary : '#92929F'
                          }}
                        >
                          {ts.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. SPEED TRAINING (CLEAN & EFFICIENT) */}
        {activeSubTab === 'speed' && (
          <div className="bg-[#15151D] border border-white/5 rounded-2xl p-3.5 sm:p-5 shadow-xl space-y-3">
            {/* Prominent BPM Display */}
            <div className="flex flex-col items-center justify-center pt-1 pb-1">
              <div className="text-6xl sm:text-8xl font-black font-gx-num tracking-tight text-white leading-none">
                {speedProgress.isActive ? speedProgress.currentBpm : speedConfig.startBpm}
              </div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#92929F] font-bold font-gx-display mt-1">
                Beats Per Minute
              </div>
            </div>

            {/* Pure Dot Visualizer */}
            {renderDotVisualiser(
              stepSubdiv,
              speedProgress.isActive ? speedProgress.currentBpm : speedConfig.startBpm,
              speedConfig.timeSignature.beats
            )}

            {/* Live Status HUD */}
            <div className="bg-[#101016] p-2.5 sm:p-3 rounded-xl border border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="text-[#92929F] flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                <span>Target: <strong className="text-white font-mono">{speedConfig.endBpm}</strong></span>
                &bull;
                <span>Bar: <strong className="font-mono" style={{ color: currentTheme.primary }}>{speedProgress.currentBar}/{speedConfig.barsPerLoop}</strong></span>
                &bull;
                <span>Loop: <strong className="font-mono" style={{ color: currentTheme.primary }}>{speedProgress.currentLoop}/{speedConfig.loopsBeforeIncrease}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border font-mono"
                  style={{
                    backgroundColor: speedProgress.stage === 'playing' ? 'rgba(16,185,129,0.15)' : currentTheme.accentBg,
                    borderColor: speedProgress.stage === 'playing' ? '#10B981' : currentTheme.primary,
                    color: speedProgress.stage === 'playing' ? '#10B981' : currentTheme.primary
                  }}
                >
                  {speedProgress.stage}
                </span>
                {speedProgress.countInRemaining > 0 && (
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold" style={{ color: currentTheme.primary }}>
                    C-In: {speedProgress.countInRemaining}
                  </span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 py-1 flex-wrap">
              {!speedProgress.isActive ? (
                <button
                  onClick={startSpeedTraining}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-2xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  style={{
                    backgroundColor: currentTheme.primary,
                    boxShadow: `0 0 15px ${currentTheme.glow}`
                  }}
                >
                  <Play className="w-4 h-4 fill-current" />
                  START
                </button>
              ) : speedProgress.isPaused ? (
                <button
                  onClick={resumeSpeedTraining}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-2xl bg-[#10B981] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 hover:brightness-110 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  RESUME
                </button>
              ) : (
                <button
                  onClick={pauseSpeedTraining}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-2xl bg-[#3B82F6] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-95"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  PAUSE
                </button>
              )}

              {speedProgress.isActive && (
                <button
                  onClick={stopSpeedTraining}
                  className="px-3.5 py-2.5 rounded-2xl bg-[#EF4444] text-white font-bold text-xs flex items-center gap-1 hover:brightness-110 active:scale-95"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  STOP
                </button>
              )}

              <button
                onClick={startSpeedTraining}
                className="px-3.5 py-2.5 rounded-2xl bg-[#1B1B25] border border-white/5 text-white font-semibold text-xs flex items-center gap-1 hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                RESET
              </button>
            </div>

            {/* Click-to-Expand Settings Drawer */}
            {isSettingsOpen && (
              <div className="pt-3 border-t border-white/5 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-semibold text-[#92929F]">Speed Configuration</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#92929F] uppercase font-semibold">Count In:</span>
                    <button
                      onClick={() => setSpeedConfig(prev => ({ ...prev, countInEnabled: !prev.countInEnabled }))}
                      className="px-2 py-0.5 rounded text-[10px] font-bold transition-all"
                      style={{
                        backgroundColor: speedConfig.countInEnabled ? currentTheme.primary : '#1B1B25',
                        color: speedConfig.countInEnabled ? '#FFFFFF' : '#92929F'
                      }}
                    >
                      {speedConfig.countInEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Start BPM', key: 'startBpm', min: 40, max: 260 },
                    { label: 'End BPM', key: 'endBpm', min: 50, max: 300 },
                    { label: 'Increment', key: 'bpmIncrement', min: 1, max: 20 },
                    { label: 'Bars / Loop', key: 'barsPerLoop', min: 1, max: 16 },
                    { label: 'Loops / Inc', key: 'loopsBeforeIncrease', min: 1, max: 8 },
                    { label: 'Init Count In', key: 'initialCountIn', min: 1, max: 8 },
                    { label: 'Inc Count In', key: 'speedIncreaseCountIn', min: 1, max: 8 },
                  ].map(item => (
                    <div key={item.key} className="bg-[#101016] p-2 rounded-lg border border-white/5">
                      <div className="flex items-center justify-between text-[10px] text-[#92929F] mb-1">
                        <span className="truncate pr-1">{item.label}</span>
                        <span className="font-mono font-bold" style={{ color: currentTheme.primary }}>{speedConfig[item.key]}</span>
                      </div>
                      <input
                        type="range"
                        min={item.min}
                        max={item.max}
                        value={speedConfig[item.key]}
                        onChange={(e) => setSpeedConfig({ ...speedConfig, [item.key]: Number(e.target.value) })}
                        style={{ accentColor: currentTheme.primary }}
                        className="w-full h-1.5 bg-[#1B1B25] rounded cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. RATIOS TRAINING (CLEAN & EFFICIENT) */}
        {activeSubTab === 'ratios' && (
          <div className="bg-[#15151D] border border-white/5 rounded-2xl p-3.5 sm:p-5 shadow-xl space-y-3">
            {/* Prominent BPM Display */}
            <div className="flex flex-col items-center justify-center pt-1 pb-1">
              <div className="text-6xl sm:text-8xl font-black font-gx-num tracking-tight text-white leading-none">
                {ratiosConfig.bpm}
              </div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#92929F] font-bold font-gx-display mt-1">
                Beats Per Minute
              </div>
            </div>

            {/* Pure Dot Visualizer */}
            {renderDotVisualiser(
              ratiosProgress.isActive ? ratiosProgress.currentSubdivision : ratiosConfig.loop1,
              ratiosConfig.bpm,
              ratiosConfig.numberOfBeats
            )}

            {/* Live Cycle HUD */}
            <div className="bg-[#101016] p-2.5 sm:p-3 rounded-xl border border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div>
                <div className="font-mono text-white flex items-center gap-1.5 font-bold text-[11px] sm:text-xs">
                  Loop {ratiosProgress.activeLoop}:
                  <span className="truncate max-w-[140px] sm:max-w-none" style={{ color: currentTheme.primary }}>
                    {ratiosProgress.currentSubdivision.name}
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-[#92929F]">
                  Beat {ratiosProgress.currentBeat} of {ratiosConfig.numberOfBeats}
                </div>
              </div>

              {ratiosProgress.isCountIn && (
                <div
                  className="px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold animate-pulse"
                  style={{
                    backgroundColor: currentTheme.accentBg,
                    borderColor: currentTheme.primary,
                    color: currentTheme.primary
                  }}
                >
                  Count-In: {ratiosProgress.countInRemaining}
                </div>
              )}
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 w-full max-w-sm mx-auto">
              <button
                onClick={() => {
                  const next = Math.max(30, ratiosConfig.bpm - 5);
                  setRatiosConfig(prev => ({ ...prev, bpm: next }));
                  if (ratiosProgress.isActive) audioEngine.setBpm(next);
                }}
                className="flex-1 sm:flex-none px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl bg-[#1B1B25] border border-white/5 text-xs font-bold text-white hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
              >
                -5
              </button>
              <button
                onClick={() => {
                  const next = Math.max(30, ratiosConfig.bpm - 1);
                  setRatiosConfig(prev => ({ ...prev, bpm: next }));
                  if (ratiosProgress.isActive) audioEngine.setBpm(next);
                }}
                className="w-9 h-9 rounded-xl bg-[#1B1B25] border border-white/5 text-xs font-bold text-white flex items-center justify-center hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
              >
                -1
              </button>

              {!ratiosProgress.isActive ? (
                <button
                  onClick={startRatiosTraining}
                  className="flex-[2] sm:flex-none px-4 sm:px-6 py-2.5 rounded-2xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  style={{
                    backgroundColor: currentTheme.primary,
                    boxShadow: `0 0 15px ${currentTheme.glow}`
                  }}
                >
                  <Play className="w-4 h-4 fill-current" />
                  START
                </button>
              ) : ratiosProgress.isPaused ? (
                <button
                  onClick={resumeRatiosTraining}
                  className="flex-[2] sm:flex-none px-4 sm:px-6 py-2.5 rounded-2xl bg-[#10B981] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  RESUME
                </button>
              ) : (
                <button
                  onClick={pauseRatiosTraining}
                  className="flex-[2] sm:flex-none px-4 sm:px-6 py-2.5 rounded-2xl bg-[#3B82F6] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-95"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  PAUSE
                </button>
              )}

              {ratiosProgress.isActive && (
                <button
                  onClick={stopRatiosTraining}
                  className="px-3 py-2.5 rounded-2xl bg-[#EF4444] text-white font-bold text-xs flex items-center gap-1 hover:brightness-110 active:scale-95"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              )}

              <button
                onClick={() => {
                  const next = Math.min(320, ratiosConfig.bpm + 1);
                  setRatiosConfig(prev => ({ ...prev, bpm: next }));
                  if (ratiosProgress.isActive) audioEngine.setBpm(next);
                }}
                className="w-9 h-9 rounded-xl bg-[#1B1B25] border border-white/5 text-xs font-bold text-white flex items-center justify-center hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
              >
                +1
              </button>
              <button
                onClick={() => {
                  const next = Math.min(320, ratiosConfig.bpm + 5);
                  setRatiosConfig(prev => ({ ...prev, bpm: next }));
                  if (ratiosProgress.isActive) audioEngine.setBpm(next);
                }}
                className="flex-1 sm:flex-none px-2 sm:px-3 py-2 sm:py-1.5 rounded-xl bg-[#1B1B25] border border-white/5 text-xs font-bold text-white hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
              >
                +5
              </button>
            </div>

            {/* Click-to-Expand Settings Drawer */}
            {isSettingsOpen && (
              <div className="pt-3 border-t border-white/5 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#92929F] uppercase font-semibold">Ratio:</span>
                    <button
                      onClick={() => setRatiosConfig(prev => ({ ...prev, subdivisionRatioEnabled: !prev.subdivisionRatioEnabled }))}
                      className="px-2 py-0.5 rounded text-[10px] font-bold transition-all"
                      style={{
                        backgroundColor: ratiosConfig.subdivisionRatioEnabled ? currentTheme.primary : '#1B1B25',
                        color: ratiosConfig.subdivisionRatioEnabled ? '#FFFFFF' : '#92929F'
                      }}
                    >
                      {ratiosConfig.subdivisionRatioEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#92929F] uppercase font-semibold">Beats/Loop:</span>
                    <span className="font-mono font-bold" style={{ color: currentTheme.primary }}>{ratiosConfig.numberOfBeats}</span>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={ratiosConfig.numberOfBeats}
                      onChange={(e) => setRatiosConfig({ ...ratiosConfig, numberOfBeats: Number(e.target.value) })}
                      style={{ accentColor: currentTheme.primary }}
                      className="w-16 sm:w-20 h-1.5 bg-[#1B1B25] rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-[#101016] p-2.5 rounded-lg border border-white/5">
                    <label className="text-[10px] font-semibold text-[#92929F] uppercase block mb-1">Loop 1</label>
                    <select
                      value={ratiosConfig.loop1.id}
                      onChange={(e) => {
                        const found = SUBDIVISIONS.find(s => s.id === e.target.value) || SUBDIVISIONS[1];
                        setRatiosConfig({ ...ratiosConfig, loop1: found });
                        if (ratiosProgress.isActive && ratiosProgress.activeLoop === 1) {
                          audioEngine.setSubdivision(found);
                        }
                      }}
                      className="w-full bg-[#1B1B25] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      {SUBDIVISIONS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.dotsPerBeat})</option>)}
                    </select>
                  </div>

                  <div className="bg-[#101016] p-2.5 rounded-lg border border-white/5">
                    <label className="text-[10px] font-semibold text-[#92929F] uppercase block mb-1">Loop 2</label>
                    <select
                      disabled={!ratiosConfig.subdivisionRatioEnabled}
                      value={ratiosConfig.loop2.id}
                      onChange={(e) => {
                        const found = SUBDIVISIONS.find(s => s.id === e.target.value) || SUBDIVISIONS[3];
                        setRatiosConfig({ ...ratiosConfig, loop2: found });
                        if (ratiosProgress.isActive && ratiosProgress.activeLoop === 2) {
                          audioEngine.setSubdivision(found);
                        }
                      }}
                      className="w-full bg-[#1B1B25] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-40"
                    >
                      {SUBDIVISIONS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.dotsPerBeat})</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen text-[#FFFFFF] flex flex-col font-gx-body antialiased selection:bg-[#FA1E4E]/30 selection:text-white pb-24 md:pb-8 relative overflow-x-hidden"
      style={{
        backgroundColor: '#08080C',
        backgroundImage: `
          radial-gradient(circle at 50% 0%, ${currentTheme.glowSubtle} 0%, transparent 60%),
          radial-gradient(circle at 100% 100%, ${currentTheme.glowSubtle} 0%, transparent 50%),
          linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100% 100%, 32px 32px, 32px 32px'
      }}
    >
      <style>{FONT_STYLES}</style>

      {/* Top Header / Sticky Nav - Opera GX Styled */}
      <header className="sticky top-0 z-50 bg-[#101016]/90 backdrop-blur-md border-b border-white/5 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105"
            style={{
              backgroundColor: currentTheme.primary,
              boxShadow: `0 0 16px ${currentTheme.glow}`
            }}
          >
            <Music className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-base font-extrabold tracking-tight text-white leading-tight font-gx-display">
                WANNABE GUITARIST'S STUDIO
              </h1>
              <span
                className="text-[8px] font-gx-code uppercase px-1.5 py-0.2 rounded border font-bold hidden sm:inline-block"
                style={{
                  color: currentTheme.primary,
                  borderColor: currentTheme.borderActive,
                  backgroundColor: currentTheme.accentBg
                }}
              >
                GX V2.5
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#92929F] font-semibold hidden xs:block font-gx-display">
              Precision Audio &bull; Opera GX Gaming Control Panel
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#15151D] p-1 rounded-xl border border-white/5">
          {[
            { id: 'daily', label: 'Daily Practice', icon: Activity },
            { id: 'metronome', label: 'Metronome', icon: Clock },
            { id: 'progress', label: 'My Progress', icon: BarChart2 },
            { id: 'library', label: 'Exercise Library', icon: BookOpen },
            { id: 'history', label: 'Practice History', icon: Calendar },
            { id: 'mirror', label: 'Mirror Studio', icon: Camera },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'metronome') setActiveMetronomeMode('standard');
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold font-gx-display transition-all relative overflow-hidden"
                style={{
                  backgroundColor: isActive ? '#1B1B25' : 'transparent',
                  color: isActive ? currentTheme.primary : '#92929F',
                  boxShadow: isActive ? `0 0 12px ${currentTheme.glowSubtle}` : 'none'
                }}
              >
                {isActive && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                    style={{ backgroundColor: currentTheme.primary }}
                  />
                )}
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Theme Picker, Profile Switcher & Global Fast Metronome Pill */}
        <div className="flex items-center gap-2">
          {/* User Profile Switcher Button with Lock Status */}
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#15151D] border border-white/10 hover:border-white/20 text-white flex items-center gap-1.5 transition-all text-xs"
            title="Switch User Profile / Lock Studio"
          >
            <div
              className="w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[10px]"
              style={{
                backgroundColor: activeUserId === 'user1' ? currentTheme.accentBg : '#3B82F625',
                color: activeUserId === 'user1' ? currentTheme.primary : '#3B82F6'
              }}
            >
              {activeUserId === 'user1' ? 'P1' : 'P2'}
            </div>
            <span className="hidden sm:inline font-mono font-bold text-xs truncate max-w-[90px]">
              {userProfiles[activeUserId]?.name}
            </span>
            {userProfiles[activeUserId]?.pin ? (
              <Lock className="w-3 h-3 text-[#10B981]" />
            ) : (
              <Unlock className="w-3 h-3 text-[#92929F]" />
            )}
          </button>

          {/* Cloud Sync Button */}
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#15151D] border border-white/10 hover:border-white/20 text-[#92929F] hover:text-white flex items-center gap-1.5 transition-all text-xs"
            title="Cloud Sync (Connect Phone & PC)"
          >
            <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce text-[#3B82F6]' : syncStatus === 'synced' ? 'text-[#10B981]' : ''}`} />
            <span className="hidden sm:inline text-[11px] font-gx-display font-bold">
              {isSyncing ? 'Syncing...' : syncStatus === 'synced' ? 'Synced' : 'Sync'}
            </span>
          </button>

          {/* GX Theme Selector Popover Button */}
          <div className="relative">
            <button
              onClick={() => setIsThemePickerOpen(!isThemePickerOpen)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#15151D] border border-white/10 hover:border-white/20 text-[#92929F] hover:text-white flex items-center gap-1.5 transition-all text-xs"
              title="Change Neon Accent Theme"
            >
              <span
                className="w-3 h-3 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: currentTheme.primary,
                  boxShadow: `0 0 8px ${currentTheme.primary}`
                }}
              />
              <span className="hidden sm:inline text-[11px] font-gx-display font-bold">{currentTheme.name}</span>
              <Palette className="w-3 h-3 ml-0.5" />
            </button>

            {isThemePickerOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#15151D] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 backdrop-blur-md">
                <div className="text-[10px] uppercase font-bold tracking-wider text-[#92929F] px-2 py-1 border-b border-white/5 mb-1 font-gx-display">
                  Gaming Neon Theme
                </div>
                {Object.values(GX_THEMES).map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      changeTheme(t.id);
                      setIsThemePickerOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left hover:bg-[#1B1B25] transition-all font-gx-display"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: t.primary,
                          boxShadow: `0 0 8px ${t.glow}`
                        }}
                      />
                      <span className={currentThemeKey === t.id ? 'text-white font-bold' : 'text-[#92929F]'}>
                        {t.name}
                      </span>
                    </div>
                    {currentThemeKey === t.id && (
                      <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => togglePlay(bpm, selectedSubdivision)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border font-gx-num"
            style={{
              backgroundColor: isPlaying ? '#EF4444' : '#15151D',
              color: isPlaying ? '#FFFFFF' : currentTheme.primary,
              borderColor: isPlaying ? '#EF4444' : currentTheme.borderActive,
              boxShadow: isPlaying ? '0 0 12px rgba(239, 68, 68, 0.45)' : `0 0 10px ${currentTheme.glowSubtle}`
            }}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span className="font-gx-num text-xs sm:text-sm">{bpm} BPM</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 relative z-10">
        {/* ============================================================== */}
        {/* MODULE 1: DAILY PRACTICE DASHBOARD */}
        {/* ============================================================== */}
        {activeTab === 'daily' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 pb-1">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <Activity className="w-5 h-5" style={{ color: currentTheme.primary }} />
                  Daily Practice Routine
                </h2>
                <p className="text-xs sm:text-sm text-[#92929F]">4-Step Mastery Pipeline &bull; Audio engine synchronized</p>
              </div>

              {/* Progress Summary Pill */}
              <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#15151D] border border-white/5 px-3.5 py-1.5 sm:py-2 rounded-xl text-xs shadow-lg">
                <span className="text-[#92929F]">Progress:</span>
                <span className="font-bold font-mono" style={{ color: currentTheme.primary }}>
                  {[
                    practiceSession.step1.isCompleted,
                    practiceSession.step2.isCompleted,
                    practiceSession.step3.isCompleted,
                    practiceSession.step4.isCompleted
                  ].filter(Boolean).length} / 4 COMPLETED
                </span>
              </div>
            </div>

            {/* Exercise Selector & Quick Benchmark Loader */}
            <div className="bg-[#15151D] border border-white/5 p-3.5 sm:p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: currentTheme.accentBg, color: currentTheme.primary }}
                >
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-[#92929F] tracking-wider font-mono">
                    Target Exercise
                  </div>
                  <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <span>{practiceSession.selectedExerciseName || 'Custom / Free Routine'}</span>
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full border font-mono font-bold"
                      style={{
                        backgroundColor: currentTheme.accentBg,
                        borderColor: currentTheme.borderActive,
                        color: currentTheme.primary
                      }}
                    >
                      {practiceSession.selectedCategory || 'Technique'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={practiceSession.selectedExerciseId || 'custom'}
                  onChange={(e) => {
                    const found = exercises.find(ex => ex.id === e.target.value);
                    if (found) {
                      loadExerciseIntoRoutine(found);
                    } else {
                      setPracticeSession(prev => ({
                        ...prev,
                        selectedExerciseId: 'custom',
                        selectedExerciseName: 'Custom / Free Practice Routine',
                        selectedCategory: 'Free Practice'
                      }));
                    }
                  }}
                  className="bg-[#101016] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                >
                  <option value="custom">Select from Exercise Library...</option>
                  {exercises.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} (Current: {ex.currentBpm} BPM &bull; Target: {ex.targetBpm} BPM)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* STEP 1: COMFORT ZONE WARMUP */}
            <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-xl transition-all">
              <div
                onClick={() => setCurrentStepOpen(currentStepOpen === 1 ? 0 : 1)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-[#10B981]/15 text-[#10B981] font-mono font-bold text-xs flex items-center justify-center border border-[#10B981]/30">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                      Step 1: Comfort Zone Warmup
                      {practiceSession.step1.isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                      )}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-[#92929F]">Play at ~75% of your clean speed. Focus on tension release and synchronization.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#10B981]">{practiceSession.step1.bpm} BPM</span>
                  {currentStepOpen === 1 ? <ChevronUp className="w-4 h-4 text-[#92929F]" /> : <ChevronDown className="w-4 h-4 text-[#92929F]" />}
                </div>
              </div>

              {currentStepOpen === 1 && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                  {/* Timer Controls */}
                  <div className="flex items-center justify-between flex-wrap gap-2 bg-[#101016] p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#10B981]" />
                      <span className="text-xs text-[#92929F]">Timer:</span>
                      <span className="font-mono font-bold text-sm text-white">
                        {Math.floor(practiceSession.step1.remainingSeconds / 60)}:
                        {String(practiceSession.step1.remainingSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 5, 7, 10, 15].map(mins => (
                        <button
                          key={mins}
                          onClick={() => handleTimerDurationChange('step1', mins)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${
                            practiceSession.step1.durationMinutes === mins
                              ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                              : 'bg-[#1B1B25] border-white/5 text-[#92929F] hover:text-white'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}

                      <button
                        onClick={() => toggleTimer('step1')}
                        className="px-3 py-1 rounded-lg text-xs font-bold font-mono text-white ml-1"
                        style={{ backgroundColor: practiceSession.step1.isTimerRunning ? '#EF4444' : '#10B981' }}
                      >
                        {practiceSession.step1.isTimerRunning ? 'Pause' : 'Start Timer'}
                      </button>
                      <button
                        onClick={() => resetTimer('step1')}
                        className="p-1 rounded-lg bg-[#1B1B25] text-[#92929F] hover:text-white"
                        title="Reset Timer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Focus Areas */}
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-[#92929F] mb-1.5 block">Focus Areas</label>
                    <div className="flex flex-wrap gap-1.5">
                      {INITIAL_FOCUS_STEP1.map(tag => {
                        const isSelected = practiceSession.step1.focusAreas.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleFocusArea('step1', tag)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                              isSelected
                                ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981]'
                                : 'bg-[#101016] border-white/5 text-[#92929F] hover:text-white'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Embedded Step Metronome Suite */}
                  {renderStepMetronomeSuite(1, practiceSession.step1.bpm, step1SubTab, setStep1SubTab, '#10B981')}
                </div>
              )}
            </div>

            {/* STEP 2: EDGE OF ABILITY */}
            <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-xl transition-all">
              <div
                onClick={() => setCurrentStepOpen(currentStepOpen === 2 ? 0 : 2)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-[#3B82F6]/15 text-[#3B82F6] font-mono font-bold text-xs flex items-center justify-center border border-[#3B82F6]/30">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                      Step 2: Edge of Ability
                      {practiceSession.step2.isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-[#3B82F6]" />
                      )}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-[#92929F]">Your true clean maximum limit. Zero tension, exact synchronized pick attack.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#3B82F6]">{practiceSession.step2.bpm} BPM</span>
                  {currentStepOpen === 2 ? <ChevronUp className="w-4 h-4 text-[#92929F]" /> : <ChevronDown className="w-4 h-4 text-[#92929F]" />}
                </div>
              </div>

              {currentStepOpen === 2 && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                  {/* Timer Controls */}
                  <div className="flex items-center justify-between flex-wrap gap-2 bg-[#101016] p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#3B82F6]" />
                      <span className="text-xs text-[#92929F]">Timer:</span>
                      <span className="font-mono font-bold text-sm text-white">
                        {Math.floor(practiceSession.step2.remainingSeconds / 60)}:
                        {String(practiceSession.step2.remainingSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 5, 7, 10, 15].map(mins => (
                        <button
                          key={mins}
                          onClick={() => handleTimerDurationChange('step2', mins)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${
                            practiceSession.step2.durationMinutes === mins
                              ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-[#3B82F6]'
                              : 'bg-[#1B1B25] border-white/5 text-[#92929F] hover:text-white'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}

                      <button
                        onClick={() => toggleTimer('step2')}
                        className="px-3 py-1 rounded-lg text-xs font-bold font-mono text-white ml-1"
                        style={{ backgroundColor: practiceSession.step2.isTimerRunning ? '#EF4444' : '#3B82F6' }}
                      >
                        {practiceSession.step2.isTimerRunning ? 'Pause' : 'Start Timer'}
                      </button>
                      <button
                        onClick={() => resetTimer('step2')}
                        className="p-1 rounded-lg bg-[#1B1B25] text-[#92929F] hover:text-white"
                        title="Reset Timer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Focus Areas */}
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-[#92929F] mb-1.5 block">Focus Areas</label>
                    <div className="flex flex-wrap gap-1.5">
                      {INITIAL_FOCUS_STEP2.map(tag => {
                        const isSelected = practiceSession.step2.focusAreas.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleFocusArea('step2', tag)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                              isSelected
                                ? 'bg-[#3B82F6]/15 border-[#3B82F6] text-[#3B82F6]'
                                : 'bg-[#101016] border-white/5 text-[#92929F] hover:text-white'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Embedded Step Metronome Suite */}
                  {renderStepMetronomeSuite(2, practiceSession.step2.bpm, step2SubTab, setStep2SubTab, '#3B82F6')}
                </div>
              )}
            </div>

            {/* STEP 3: SPEED BURSTS */}
            <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-xl transition-all">
              <div
                onClick={() => setCurrentStepOpen(currentStepOpen === 3 ? 0 : 3)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-[#EF4444]/15 text-[#EF4444] font-mono font-bold text-xs flex items-center justify-center border border-[#EF4444]/30">
                    3
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                      Step 3: Speed Bursts
                      {practiceSession.step3.isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-[#EF4444]" />
                      )}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-[#92929F]">Short explosive sprints (+10 to +20 BPM above edge) for 4 to 8 beats.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#EF4444]">{practiceSession.step3.bpm} BPM</span>
                  {currentStepOpen === 3 ? <ChevronUp className="w-4 h-4 text-[#92929F]" /> : <ChevronDown className="w-4 h-4 text-[#92929F]" />}
                </div>
              </div>

              {currentStepOpen === 3 && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                  {/* Timer Controls */}
                  <div className="flex items-center justify-between flex-wrap gap-2 bg-[#101016] p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#EF4444]" />
                      <span className="text-xs text-[#92929F]">Timer:</span>
                      <span className="font-mono font-bold text-sm text-white">
                        {Math.floor(practiceSession.step3.remainingSeconds / 60)}:
                        {String(practiceSession.step3.remainingSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 5, 7, 10, 15].map(mins => (
                        <button
                          key={mins}
                          onClick={() => handleTimerDurationChange('step3', mins)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${
                            practiceSession.step3.durationMinutes === mins
                              ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]'
                              : 'bg-[#1B1B25] border-white/5 text-[#92929F] hover:text-white'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}

                      <button
                        onClick={() => toggleTimer('step3')}
                        className="px-3 py-1 rounded-lg text-xs font-bold font-mono text-white ml-1"
                        style={{ backgroundColor: practiceSession.step3.isTimerRunning ? '#F59E0B' : '#EF4444' }}
                      >
                        {practiceSession.step3.isTimerRunning ? 'Pause' : 'Start Timer'}
                      </button>
                      <button
                        onClick={() => resetTimer('step3')}
                        className="p-1 rounded-lg bg-[#1B1B25] text-[#92929F] hover:text-white"
                        title="Reset Timer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Burst Trigger Bar */}
                  <div className="bg-[#101016] p-3 rounded-xl border border-white/5 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#EF4444]" />
                      <span className="text-xs text-white font-bold font-mono">Quick Speed Burst:</span>
                      {isBurstActive && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#EF4444]/20 text-[#EF4444] animate-pulse">
                          BURST ACTIVE ({burstCountRemaining} beats left)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerSpeedBurst(8)}
                        className="px-3 py-1.5 rounded-xl bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#EF4444] text-xs font-mono font-bold hover:bg-[#EF4444]/30 active:scale-95 transition-all"
                      >
                        ⚡ 8-Beat Sprint
                      </button>
                      <button
                        onClick={() => triggerSpeedBurst(16)}
                        className="px-3 py-1.5 rounded-xl bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#EF4444] text-xs font-mono font-bold hover:bg-[#EF4444]/30 active:scale-95 transition-all"
                      >
                        ⚡ 16-Beat Sprint
                      </button>
                    </div>
                  </div>

                  {/* Focus Areas */}
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-[#92929F] mb-1.5 block">Focus Areas</label>
                    <div className="flex flex-wrap gap-1.5">
                      {INITIAL_FOCUS_STEP3.map(tag => {
                        const isSelected = practiceSession.step3.focusAreas.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleFocusArea('step3', tag)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                              isSelected
                                ? 'bg-[#EF4444]/15 border-[#EF4444] text-[#EF4444]'
                                : 'bg-[#101016] border-white/5 text-[#92929F] hover:text-white'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Embedded Step Metronome Suite */}
                  {renderStepMetronomeSuite(3, practiceSession.step3.bpm, step3SubTab, setStep3SubTab, '#EF4444')}
                </div>
              )}
            </div>

            {/* STEP 4: GAMIFY & LOG PROGRESS */}
            <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-xl transition-all">
              <div
                onClick={() => setCurrentStepOpen(currentStepOpen === 4 ? 0 : 4)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-[#A855F7]/15 text-[#A855F7] font-mono font-bold text-xs flex items-center justify-center border border-[#A855F7]/30">
                    4
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                      Step 4: Gamify & Log Progress
                      {practiceSession.step4.isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-[#A855F7]" />
                      )}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-[#92929F]">Record today's benchmark tempos, log session stats, and review technique.</p>
                  </div>
                </div>
                {currentStepOpen === 4 ? <ChevronUp className="w-4 h-4 text-[#92929F]" /> : <ChevronDown className="w-4 h-4 text-[#92929F]" />}
              </div>

              {currentStepOpen === 4 && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#101016] p-3 rounded-xl border border-white/5 text-center">
                    <div>
                      <span className="text-[9px] uppercase text-[#92929F]">Step 1 Comfort</span>
                      <div className="text-sm font-bold font-mono text-[#10B981]">{practiceSession.step1.bpm} BPM</div>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-[#92929F]">Step 2 Edge</span>
                      <div className="text-sm font-bold font-mono text-[#3B82F6]">{practiceSession.step2.bpm} BPM</div>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-[#92929F]">Step 3 Burst</span>
                      <div className="text-sm font-bold font-mono text-[#EF4444]">{practiceSession.step3.bpm} BPM</div>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-[#92929F]">Exercise</span>
                      <div className="text-xs font-bold font-mono truncate" style={{ color: currentTheme.primary }}>
                        {practiceSession.selectedExerciseName || 'Routine'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsLogModalOpen(true)}
                      className="px-5 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-2 transition-all active:scale-95 font-mono"
                      style={{
                        backgroundColor: currentTheme.primary,
                        boxShadow: `0 0 15px ${currentTheme.glow}`
                      }}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      COMPLETE & LOG SESSION
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODULE 2: METRONOME TAB */}
        {/* ============================================================== */}
        {activeTab === 'metronome' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <Clock className="w-5 h-5" style={{ color: currentTheme.primary }} />
                  Master Studio Metronome
                </h2>
                <p className="text-xs sm:text-sm text-[#92929F]">Zero-drift Web Audio lookahead engine &bull; Dynamic subdivision visualizer</p>
              </div>

              {/* Mode Selector */}
              <div className="flex items-center gap-1 bg-[#15151D] p-1 rounded-xl border border-white/5">
                {[
                  { id: 'standard', label: 'Standard' },
                  { id: 'speed', label: 'Speed Training' },
                  { id: 'ratios', label: 'Ratios Training' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setActiveMetronomeMode(m.id);
                      audioEngine.playUiSound('step');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: activeMetronomeMode === m.id ? '#1B1B25' : 'transparent',
                      color: activeMetronomeMode === m.id ? currentTheme.primary : '#92929F',
                      boxShadow: activeMetronomeMode === m.id ? `0 0 10px ${currentTheme.glowSubtle}` : 'none'
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* A. Standard Mode */}
            {activeMetronomeMode === 'standard' && (
              <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
                {/* Radial Cyber Ambient Glow */}
                <div
                  className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full pointer-events-none blur-3xl opacity-20"
                  style={{ backgroundColor: currentTheme.primary }}
                />

                {/* 1. Large BPM Display */}
                <div className="flex flex-col items-center justify-center pt-1 pb-1 relative z-10">
                  <div className="text-7xl sm:text-9xl font-black font-gx-num tracking-tight text-white mb-0.5 sm:mb-1 leading-none select-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
                    {bpm}
                  </div>
                  <div className="text-[10px] sm:text-xs uppercase tracking-widest text-[#92929F] font-bold font-gx-display mb-1">
                    Beats Per Minute
                  </div>
                </div>

                {/* 2. Pure Dot-Based Visualizer (Directly Below BPM) */}
                {renderDotVisualiser(selectedSubdivision, bpm)}

                {/* 3. Settings & Interactives (Below Visualizer) */}
                <div className="flex flex-col items-center justify-center pt-2 sm:pt-4 relative z-10">
                  {/* Steppers & Start/Stop */}
                  <div className="flex items-center gap-1.5 sm:gap-3 w-full max-w-sm justify-center">
                    <button
                      onClick={() => { const val = Math.max(30, bpm - 5); setBpm(val); audioEngine.setBpm(val); audioEngine.playUiSound('step'); }}
                      className="flex-1 sm:flex-none px-2 sm:px-3.5 py-2 rounded-xl bg-[#1B1B25] border border-white/5 text-xs sm:text-sm font-bold font-gx-num text-white hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                    >
                      -5
                    </button>
                    <button
                      onClick={() => { const val = Math.max(30, bpm - 1); setBpm(val); audioEngine.setBpm(val); audioEngine.playUiSound('step'); }}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1B1B25] border border-white/5 text-xs sm:text-sm font-bold font-gx-num text-white flex items-center justify-center hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => togglePlay(bpm, selectedSubdivision)}
                      className="flex-[2] sm:flex-none px-4 sm:px-8 py-2.5 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-extrabold font-gx-display flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95"
                      style={{
                        backgroundColor: isPlaying ? '#EF4444' : currentTheme.primary,
                        color: '#FFFFFF',
                        boxShadow: isPlaying ? '0 0 20px rgba(239, 68, 68, 0.45)' : `0 0 20px ${currentTheme.glow}`
                      }}
                    >
                      {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
                      {isPlaying ? 'STOP' : 'START'}
                    </button>
                    <button
                      onClick={() => { const val = Math.min(320, bpm + 1); setBpm(val); audioEngine.setBpm(val); audioEngine.playUiSound('step'); }}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1B1B25] border border-white/5 text-xs sm:text-sm font-bold font-gx-num text-white flex items-center justify-center hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => { const val = Math.min(320, bpm + 5); setBpm(val); audioEngine.setBpm(val); audioEngine.playUiSound('step'); }}
                      className="flex-1 sm:flex-none px-2 sm:px-3.5 py-2 rounded-xl bg-[#1B1B25] border border-white/5 text-xs sm:text-sm font-bold font-gx-num text-white hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                    >
                      +5
                    </button>
                  </div>

                  {/* QUICK BPM PRESET DIAL */}
                  <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
                    {[60, 80, 100, 120, 140, 160].map(preset => (
                      <button
                        key={preset}
                        onClick={() => {
                          setBpm(preset);
                          audioEngine.setBpm(preset);
                          audioEngine.playUiSound('step');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-gx-num font-bold border transition-all ${
                          bpm === preset
                            ? 'text-white border-transparent'
                            : 'bg-[#101016] text-[#92929F] border-white/5 hover:border-white/15'
                        }`}
                        style={{
                          backgroundColor: bpm === preset ? currentTheme.primary : undefined,
                          boxShadow: bpm === preset ? `0 0 10px ${currentTheme.glow}` : 'none'
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Slider, Tap Tempo, Sound Engine Profile & Volume */}
                  <div className="w-full max-w-md mt-4 sm:mt-5 space-y-3 sm:space-y-4">
                    <input
                      type="range"
                      min="30"
                      max="300"
                      value={bpm}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBpm(val);
                        audioEngine.setBpm(val);
                      }}
                      style={{ accentColor: currentTheme.primary }}
                      className="w-full bg-[#1B1B25] h-2 rounded-lg cursor-pointer"
                    />

                    <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                      <button
                        onClick={handleTapTempo}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#1B1B25] border border-white/10 text-xs font-bold font-gx-display hover:bg-[#252533] active:scale-95 transition-all"
                        style={{ color: currentTheme.primary }}
                      >
                        TAP TEMPO
                      </button>

                      {/* Sound Type Selector Dropdown */}
                      <div className="flex items-center gap-1 bg-[#101016] px-2.5 py-1 rounded-xl border border-white/5">
                        <span className="text-[10px] text-[#92929F] font-semibold uppercase hidden sm:inline font-gx-display">Click:</span>
                        <select
                          value={soundType}
                          onChange={(e) => handleSoundTypeChange(e.target.value)}
                          className="bg-transparent text-xs font-gx-display font-bold text-white focus:outline-none cursor-pointer"
                          style={{ color: currentTheme.primary }}
                        >
                          <option value="woodblock" className="bg-[#15151D]">Woodblock</option>
                          <option value="beep" className="bg-[#15151D]">Cyber Beep</option>
                          <option value="rimshot" className="bg-[#15151D]">Tight Rimshot</option>
                          <option value="mechanical" className="bg-[#15151D]">Mechanical</option>
                        </select>
                      </div>

                      {/* Volume */}
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-[#92929F]" />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={volume}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setVolume(val);
                            audioEngine.setVolume(val);
                          }}
                          style={{ accentColor: currentTheme.primary }}
                          className="w-16 sm:w-20 h-1.5 bg-[#1B1B25] rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subdivisions & Time Signature Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-white/5 relative z-10">
                  <div>
                    <label className="text-[10px] sm:text-xs uppercase font-semibold text-[#92929F] mb-2 block font-gx-display">Rhythmic Subdivision</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                      {SUBDIVISIONS.map(s => {
                        const isSel = selectedSubdivision.id === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedSubdivision(s);
                              audioEngine.setSubdivision(s);
                              audioEngine.playUiSound('step');
                            }}
                            className="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold font-gx-display border transition-all truncate text-left sm:text-center"
                            style={{
                              backgroundColor: isSel ? currentTheme.accentBg : '#101016',
                              borderColor: isSel ? currentTheme.primary : 'rgba(255,255,255,0.05)',
                              color: isSel ? currentTheme.primary : '#92929F',
                              boxShadow: isSel ? `0 0 10px ${currentTheme.glowSubtle}` : 'none'
                            }}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-xs uppercase font-semibold text-[#92929F] mb-2 block font-gx-display">Time Signature</label>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {TIME_SIGNATURES.map(ts => {
                        const isSel = timeSignature.id === ts.id;
                        return (
                          <button
                            key={ts.id}
                            onClick={() => {
                              setTimeSignature(ts);
                              audioEngine.setTimeSignature(ts);
                              audioEngine.playUiSound('step');
                            }}
                            className="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold font-gx-num border transition-all"
                            style={{
                              backgroundColor: isSel ? currentTheme.accentBg : '#101016',
                              borderColor: isSel ? currentTheme.primary : 'rgba(255,255,255,0.05)',
                              color: isSel ? currentTheme.primary : '#92929F',
                              boxShadow: isSel ? `0 0 10px ${currentTheme.glowSubtle}` : 'none'
                            }}
                          >
                            {ts.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* B. Speed Training Mode */}
            {activeMetronomeMode === 'speed' && (
              <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4">
                <div className="flex flex-col items-center justify-center pt-1 pb-1">
                  <div className="text-7xl sm:text-9xl font-black font-gx-num tracking-tight text-white leading-none">
                    {speedProgress.isActive ? speedProgress.currentBpm : speedConfig.startBpm}
                  </div>
                  <div className="text-[10px] sm:text-xs uppercase tracking-widest text-[#92929F] font-bold font-gx-display mt-1">
                    Beats Per Minute
                  </div>
                </div>

                {renderDotVisualiser(
                  selectedSubdivision,
                  speedProgress.isActive ? speedProgress.currentBpm : speedConfig.startBpm,
                  speedConfig.timeSignature.beats
                )}

                {/* HUD Panel */}
                <div className="bg-[#101016] p-3 rounded-xl border border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="text-[#92929F] flex items-center gap-2 font-gx-num">
                    <span>Target: <strong className="text-white font-bold">{speedConfig.endBpm}</strong></span>
                    &bull;
                    <span>Bar: <strong style={{ color: currentTheme.primary }}>{speedProgress.currentBar}/{speedConfig.barsPerLoop}</strong></span>
                    &bull;
                    <span>Loop: <strong style={{ color: currentTheme.primary }}>{speedProgress.currentLoop}/{speedConfig.loopsBeforeIncrease}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border font-gx-code"
                      style={{
                        backgroundColor: speedProgress.stage === 'playing' ? 'rgba(16,185,129,0.15)' : currentTheme.accentBg,
                        borderColor: speedProgress.stage === 'playing' ? '#10B981' : currentTheme.primary,
                        color: speedProgress.stage === 'playing' ? '#10B981' : currentTheme.primary
                      }}
                    >
                      {speedProgress.stage}
                    </span>
                    {speedProgress.countInRemaining > 0 && (
                      <span className="text-[11px] font-mono font-bold" style={{ color: currentTheme.primary }}>
                        C-In: {speedProgress.countInRemaining}
                      </span>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-2 py-1 flex-wrap">
                  {!speedProgress.isActive ? (
                    <button
                      onClick={startSpeedTraining}
                      className="px-6 py-2.5 rounded-2xl text-white font-extrabold text-xs flex items-center gap-1.5 transition-all active:scale-95 font-gx-display"
                      style={{
                        backgroundColor: currentTheme.primary,
                        boxShadow: `0 0 15px ${currentTheme.glow}`
                      }}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      START SPEED TRAINING
                    </button>
                  ) : speedProgress.isPaused ? (
                    <button
                      onClick={resumeSpeedTraining}
                      className="px-6 py-2.5 rounded-2xl bg-[#10B981] text-white font-extrabold text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 font-gx-display"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      RESUME
                    </button>
                  ) : (
                    <button
                      onClick={pauseSpeedTraining}
                      className="px-6 py-2.5 rounded-2xl bg-[#3B82F6] text-white font-extrabold text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 font-gx-display"
                    >
                      <Pause className="w-4 h-4 fill-current" />
                      PAUSE
                    </button>
                  )}

                  {speedProgress.isActive && (
                    <button
                      onClick={stopSpeedTraining}
                      className="px-4 py-2.5 rounded-2xl bg-[#EF4444] text-white font-bold text-xs flex items-center gap-1 hover:brightness-110 active:scale-95 font-gx-display"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      STOP
                    </button>
                  )}

                  <button
                    onClick={startSpeedTraining}
                    className="px-4 py-2.5 rounded-2xl bg-[#1B1B25] border border-white/5 text-white font-semibold text-xs flex items-center gap-1 hover:bg-[#252533] active:scale-95 font-gx-display"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    RESTART
                  </button>
                </div>

                {/* Speed Training Configuration Controls */}
                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/5">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white font-gx-display">Speed Training Parameters</h3>
                      <p className="text-[11px] sm:text-xs text-[#92929F]">Configure automated tempo increases and loop repetitions.</p>
                    </div>

                    <div className="flex items-center gap-2 bg-[#101016] px-3 py-1.5 rounded-xl border border-white/5">
                      <span className="text-[10px] sm:text-xs font-semibold text-[#92929F] uppercase">Count In:</span>
                      <button
                        onClick={() => setSpeedConfig(prev => ({ ...prev, countInEnabled: !prev.countInEnabled }))}
                        className="px-2.5 py-0.5 rounded text-xs font-bold transition-all"
                        style={{
                          backgroundColor: speedConfig.countInEnabled ? currentTheme.primary : '#1B1B25',
                          color: speedConfig.countInEnabled ? '#FFFFFF' : '#92929F'
                        }}
                      >
                        {speedConfig.countInEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-xs uppercase font-semibold text-[#92929F] mb-1.5 block">Time Signature</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {TIME_SIGNATURES.map(ts => {
                        const isSel = speedConfig.timeSignature.id === ts.id;
                        return (
                          <button
                            key={ts.id}
                            onClick={() => {
                              setSpeedConfig({ ...speedConfig, timeSignature: ts });
                              if (!speedProgress.isActive) audioEngine.setTimeSignature(ts);
                            }}
                            className="px-3 py-1 rounded-full text-xs font-bold border transition-all font-mono"
                            style={{
                              backgroundColor: isSel ? currentTheme.primary : '#101016',
                              color: isSel ? '#FFFFFF' : '#92929F',
                              borderColor: isSel ? currentTheme.primary : 'rgba(255,255,255,0.08)',
                              boxShadow: isSel ? `0 0 10px ${currentTheme.glow}` : 'none'
                            }}
                          >
                            {ts.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {[
                      { label: 'Start BPM', key: 'startBpm', min: 40, max: 260 },
                      { label: 'End BPM', key: 'endBpm', min: 50, max: 300 },
                      { label: 'BPM Increment', key: 'bpmIncrement', min: 1, max: 20 },
                      { label: 'Bars / Loop', key: 'barsPerLoop', min: 1, max: 16 },
                      { label: 'Loops / Increase', key: 'loopsBeforeIncrease', min: 1, max: 8 },
                      { label: 'Initial Count-In', key: 'initialCountIn', min: 1, max: 8 },
                      { label: 'Speed Inc Count-In', key: 'speedIncreaseCountIn', min: 1, max: 8 },
                    ].map(item => (
                      <div key={item.key} className="bg-[#101016] p-2.5 sm:p-3 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-semibold text-[#92929F] truncate pr-1">{item.label}</span>
                          <span className="font-mono text-xs font-bold" style={{ color: currentTheme.primary }}>
                            {speedConfig[item.key]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSpeedConfig({ ...speedConfig, [item.key]: Math.max(item.min, speedConfig[item.key] - 1) })}
                            className="w-7 h-7 rounded-lg bg-[#1B1B25] border border-white/5 text-xs font-bold text-white flex items-center justify-center hover:bg-[#252533] active:scale-95"
                          >
                            -
                          </button>
                          <input
                            type="range"
                            min={item.min}
                            max={item.max}
                            value={speedConfig[item.key]}
                            onChange={(e) => setSpeedConfig({ ...speedConfig, [item.key]: Number(e.target.value) })}
                            style={{ accentColor: currentTheme.primary }}
                            className="flex-1 h-1.5 bg-[#1B1B25] rounded cursor-pointer"
                          />
                          <button
                            onClick={() => setSpeedConfig({ ...speedConfig, [item.key]: Math.min(item.max, speedConfig[item.key] + 1) })}
                            className="w-7 h-7 rounded-lg bg-[#1B1B25] border border-white/5 text-xs font-bold text-white flex items-center justify-center hover:bg-[#252533] active:scale-95"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* C. Ratios Training Mode */}
            {activeMetronomeMode === 'ratios' && (
              <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4">
                <div className="flex flex-col items-center justify-center pt-1 pb-1">
                  <div className="text-7xl sm:text-9xl font-black font-gx-num tracking-tight text-white leading-none">
                    {ratiosConfig.bpm}
                  </div>
                  <div className="text-[10px] sm:text-xs uppercase tracking-widest text-[#92929F] font-bold font-gx-display mt-1">
                    Beats Per Minute
                  </div>
                </div>

                {renderDotVisualiser(
                  ratiosProgress.isActive ? ratiosProgress.currentSubdivision : ratiosConfig.loop1,
                  ratiosConfig.bpm,
                  ratiosConfig.numberOfBeats
                )}

                {/* Status HUD */}
                <div className="bg-[#101016] p-3 rounded-xl border border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div>
                    <div className="font-gx-display text-white flex items-center gap-1.5 font-bold text-xs">
                      Loop {ratiosProgress.activeLoop}:
                      <span style={{ color: currentTheme.primary }}>
                        {ratiosProgress.currentSubdivision.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#92929F] font-gx-num">
                      Beat {ratiosProgress.currentBeat} of {ratiosConfig.numberOfBeats}
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-2 py-1">
                  {!ratiosProgress.isActive ? (
                    <button
                      onClick={startRatiosTraining}
                      className="px-6 py-2.5 rounded-2xl text-white font-extrabold text-xs flex items-center gap-1.5 transition-all active:scale-95 font-gx-display"
                      style={{
                        backgroundColor: currentTheme.primary,
                        boxShadow: `0 0 15px ${currentTheme.glow}`
                      }}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      START RATIOS TRAINING
                    </button>
                  ) : (
                    <button
                      onClick={stopRatiosTraining}
                      className="px-6 py-2.5 rounded-2xl bg-[#EF4444] text-white font-extrabold text-xs flex items-center gap-1.5 active:scale-95 font-gx-display"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      STOP
                    </button>
                  )}
                </div>

                {/* Ratios Training Configuration Controls */}
                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/5">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white font-gx-display">Ratios Configuration</h3>
                      <p className="text-[11px] sm:text-xs text-[#92929F]">Switch subdivisions between loops to master rhythmic polyrhythms.</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-[#101016] px-2.5 py-1 rounded-xl border border-white/5">
                        <span className="text-[10px] font-semibold text-[#92929F] uppercase">Count In:</span>
                        <button
                          onClick={() => setRatiosConfig(prev => ({ ...prev, countInEnabled: !prev.countInEnabled }))}
                          className="px-2 py-0.5 rounded text-[11px] font-bold"
                          style={{
                            backgroundColor: ratiosConfig.countInEnabled ? currentTheme.primary : '#1B1B25',
                            color: ratiosConfig.countInEnabled ? '#FFFFFF' : '#92929F'
                          }}
                        >
                          {ratiosConfig.countInEnabled ? 'ON' : 'OFF'}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 bg-[#101016] px-2.5 py-1 rounded-xl border border-white/5">
                        <span className="text-[10px] font-semibold text-[#92929F] uppercase">Ratio:</span>
                        <button
                          onClick={() => setRatiosConfig(prev => ({ ...prev, subdivisionRatioEnabled: !prev.subdivisionRatioEnabled }))}
                          className="px-2 py-0.5 rounded text-[11px] font-bold"
                          style={{
                            backgroundColor: ratiosConfig.subdivisionRatioEnabled ? currentTheme.primary : '#1B1B25',
                            color: ratiosConfig.subdivisionRatioEnabled ? '#FFFFFF' : '#92929F'
                          }}
                        >
                          {ratiosConfig.subdivisionRatioEnabled ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { label: 'BPM', key: 'bpm', min: 40, max: 260 },
                      { label: 'Beats / Loop', key: 'numberOfBeats', min: 1, max: 12 },
                      { label: 'Init Count-In', key: 'initialCountIn', min: 1, max: 8 },
                      { label: 'Repeat Count-In', key: 'repeatCountIn', min: 1, max: 8 },
                    ].map(item => (
                      <div key={item.key} className="bg-[#101016] p-2.5 sm:p-3 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] sm:text-xs font-semibold text-[#92929F] truncate pr-1">{item.label}</span>
                          <span className="font-mono text-xs font-bold" style={{ color: currentTheme.primary }}>
                            {ratiosConfig[item.key]}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={item.min}
                          max={item.max}
                          value={ratiosConfig[item.key]}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setRatiosConfig({ ...ratiosConfig, [item.key]: val });
                            if (item.key === 'bpm' && ratiosProgress.isActive) audioEngine.setBpm(val);
                          }}
                          style={{ accentColor: currentTheme.primary }}
                          className="w-full h-1.5 bg-[#1B1B25] rounded cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-[#101016] p-3 rounded-xl border border-white/5">
                      <label className="text-[10px] font-semibold text-[#92929F] uppercase block mb-1.5">Loop 1 Subdivision</label>
                      <select
                        value={ratiosConfig.loop1.id}
                        onChange={(e) => {
                          const found = SUBDIVISIONS.find(s => s.id === e.target.value) || SUBDIVISIONS[1];
                          setRatiosConfig({ ...ratiosConfig, loop1: found });
                          if (ratiosProgress.isActive && ratiosProgress.activeLoop === 1) {
                            audioEngine.setSubdivision(found);
                          }
                        }}
                        className="w-full bg-[#1B1B25] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white"
                      >
                        {SUBDIVISIONS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.dotsPerBeat})</option>)}
                      </select>
                    </div>

                    <div className="bg-[#101016] p-3 rounded-xl border border-white/5">
                      <label className="text-[10px] font-semibold text-[#92929F] uppercase block mb-1.5">Loop 2 Subdivision</label>
                      <select
                        disabled={!ratiosConfig.subdivisionRatioEnabled}
                        value={ratiosConfig.loop2.id}
                        onChange={(e) => {
                          const found = SUBDIVISIONS.find(s => s.id === e.target.value) || SUBDIVISIONS[3];
                          setRatiosConfig({ ...ratiosConfig, loop2: found });
                          if (ratiosProgress.isActive && ratiosProgress.activeLoop === 2) {
                            audioEngine.setSubdivision(found);
                          }
                        }}
                        className="w-full bg-[#1B1B25] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white disabled:opacity-40"
                      >
                        {SUBDIVISIONS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.dotsPerBeat})</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* MODULE 3: MY PROGRESS & INSIGHTS */}
        {/* ============================================================== */}
        {activeTab === 'progress' && (
          <div className="space-y-4 sm:space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                <BarChart2 className="w-5 h-5" style={{ color: currentTheme.primary }} />
                My Guitar Progress & Analytics
              </h2>
              <p className="text-xs sm:text-sm text-[#92929F]">Velocity tracking, speed benchmarks & technique distribution.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[#15151D] border border-white/5 p-4 rounded-2xl shadow-lg">
                <span className="text-[10px] text-[#92929F] uppercase font-semibold">Total Practice Time</span>
                <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
                  {historySessions.reduce((acc, s) => acc + (s.totalDurationMinutes || 0), 0)} <span className="text-xs text-[#92929F]">mins</span>
                </div>
                <div className="text-[10px] text-[#10B981] mt-0.5">Logged across {historySessions.length} routines</div>
              </div>

              <div className="bg-[#15151D] border border-white/5 p-4 rounded-2xl shadow-lg">
                <span className="text-[10px] text-[#92929F] uppercase font-semibold">Peak Clean Edge</span>
                <div className="text-xl sm:text-2xl font-bold font-mono mt-1" style={{ color: currentTheme.primary }}>
                  {Math.max(...historySessions.map(s => s.edgeBpm || 0), 110)} <span className="text-xs text-[#92929F]">BPM</span>
                </div>
                <div className="text-[10px] text-[#92929F] mt-0.5">Highest verified clean tempo</div>
              </div>

              <div className="bg-[#15151D] border border-white/5 p-4 rounded-2xl shadow-lg">
                <span className="text-[10px] text-[#92929F] uppercase font-semibold">Active Streak</span>
                <div className="text-xl sm:text-2xl font-bold font-mono text-[#F59E0B] mt-1 flex items-center gap-1">
                  <Flame className="w-5 h-5" />
                  {practicedCalendarDays.length} <span className="text-xs text-[#92929F]">Days</span>
                </div>
                <div className="text-[10px] text-[#92929F] mt-0.5">Consistent training days</div>
              </div>

              <div className="bg-[#15151D] border border-white/5 p-4 rounded-2xl shadow-lg">
                <span className="text-[10px] text-[#92929F] uppercase font-semibold">Exercises in Armory</span>
                <div className="text-xl sm:text-2xl font-bold font-mono text-[#3B82F6] mt-1">
                  {exercises.length} <span className="text-xs text-[#92929F]">Active</span>
                </div>
                <div className="text-[10px] text-[#92929F] mt-0.5">Ready for daily cycles</div>
              </div>
            </div>

            {/* Target BPM Gauges */}
            <div className="bg-[#15151D] border border-white/5 p-4 sm:p-6 rounded-2xl shadow-xl space-y-3">
              <h3 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                <Target className="w-4 h-4" style={{ color: currentTheme.primary }} />
                Target BPM Completion Gauges
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {exercises.map(ex => {
                  const range = (ex.targetBpm - ex.startBpm) || 1;
                  const current = (ex.currentBpm - ex.startBpm);
                  const pct = Math.min(100, Math.max(0, Math.round((current / range) * 100)));

                  return (
                    <div
                      key={ex.id}
                      onClick={() => setInspectedExerciseProgress(ex)}
                      className="bg-[#101016] border border-white/5 hover:border-white/15 p-3 rounded-xl transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-white group-hover:text-white transition-colors truncate max-w-[200px]">
                          {ex.name}
                        </span>
                        <span className="font-mono font-bold" style={{ color: currentTheme.primary }}>{pct}%</span>
                      </div>
                      <div className="w-full bg-[#1B1B25] h-2 rounded-full overflow-hidden mb-1.5">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: currentTheme.primary }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#92929F]">
                        <span>Start: {ex.startBpm} BPM</span>
                        <span className="text-white font-bold">Now: {ex.currentBpm} BPM</span>
                        <span>Goal: {ex.targetBpm} BPM</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Practice Calendar */}
            <div className="bg-[#15151D] border border-white/5 p-4 sm:p-6 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                    <Calendar className="w-4 h-4" style={{ color: currentTheme.primary }} />
                    Practice Consistency Calendar
                  </h3>
                  <span className="text-xs text-[#92929F] font-mono">Click any date to toggle completion status</span>
                </div>

                {/* Month Navigator Header */}
                <div className="flex items-center gap-2 bg-[#101016] px-2.5 py-1.5 rounded-xl border border-white/5">
                  <button
                    onClick={() => setCurrentCalendarMonth(new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() - 1, 1))}
                    className="px-2 py-0.5 rounded-lg bg-[#1B1B25] text-xs font-bold text-white hover:bg-[#252533] transition-colors"
                  >
                    &larr; Prev
                  </button>
                  <span className="text-xs font-mono font-bold text-white px-2">
                    {currentCalendarMonth.toLocaleString('default', { month: 'short', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setCurrentCalendarMonth(new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 1))}
                    className="px-2 py-0.5 rounded-lg bg-[#1B1B25] text-xs font-bold text-white hover:bg-[#252533] transition-colors"
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>

              {(() => {
                const year = currentCalendarMonth.getFullYear();
                const month = currentCalendarMonth.getMonth();
                const firstDayIndex = new Date(year, month, 1).getDay();
                const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
                const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

                return (
                  <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-mono">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="text-[#92929F] py-1 font-bold text-[10px] uppercase">{d}</div>
                    ))}

                    {/* Empty padding slots before 1st of month */}
                    {Array.from({ length: firstDayIndex }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-9 rounded-xl" />
                    ))}

                    {/* Real month days */}
                    {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
                      const isPracticed = practicedCalendarDays.includes(dateStr);

                      return (
                        <button
                          key={dateStr}
                          onClick={() => toggleCalendarDate(dateStr)}
                          className={`h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                            isPracticed
                              ? 'text-white border'
                              : 'bg-[#101016] text-[#92929F] border border-white/5 hover:border-white/10'
                          }`}
                          style={{
                            backgroundColor: isPracticed ? currentTheme.primary : undefined,
                            borderColor: isPracticed ? currentTheme.borderActive : undefined,
                            boxShadow: isPracticed ? `0 0 10px ${currentTheme.glowSubtle}` : 'none'
                          }}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODULE 4: EXERCISE LIBRARY */}
        {/* ============================================================== */}
        {activeTab === 'library' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <BookOpen className="w-5 h-5" style={{ color: currentTheme.primary }} />
                  Exercise Armory
                </h2>
                <p className="text-xs sm:text-sm text-[#92929F]">Manage and deploy your technical practice catalogue.</p>
              </div>

              <button
                onClick={() => setIsAddExerciseModalOpen(true)}
                className="px-4 py-2 rounded-xl text-white font-extrabold text-xs flex items-center gap-1.5 transition-all active:scale-95 font-mono"
                style={{
                  backgroundColor: currentTheme.primary,
                  boxShadow: `0 0 15px ${currentTheme.glow}`
                }}
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                ADD NEW EXERCISE
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {exercises.map(ex => (
                <div
                  key={ex.id}
                  className="bg-[#15151D] border border-white/5 p-4 rounded-2xl shadow-xl flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white font-mono">{ex.name}</h4>
                      <span
                        className="text-[9px] px-2 py-0.5 rounded-full border font-mono font-bold mt-1 inline-block"
                        style={{
                          backgroundColor: currentTheme.accentBg,
                          borderColor: currentTheme.borderActive,
                          color: currentTheme.primary
                        }}
                      >
                        {ex.category}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteExercise(ex.id)}
                      className="p-1.5 rounded-lg bg-[#1B1B25] text-[#92929F] hover:text-[#EF4444] transition-colors"
                      title="Delete exercise"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-[#101016] p-2.5 rounded-xl border border-white/5 text-center font-mono">
                    <div>
                      <span className="text-[9px] text-[#92929F] uppercase">Start</span>
                      <div className="text-xs font-bold text-white">{ex.startBpm} BPM</div>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#92929F] uppercase">Current</span>
                      <div className="text-xs font-bold" style={{ color: currentTheme.primary }}>{ex.currentBpm} BPM</div>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#92929F] uppercase">Target</span>
                      <div className="text-xs font-bold text-[#3B82F6]">{ex.targetBpm} BPM</div>
                    </div>
                  </div>

                  <button
                    onClick={() => loadExerciseIntoRoutine(ex)}
                    className="w-full py-2 rounded-xl text-white font-bold text-xs transition-all active:scale-95 font-mono flex items-center justify-center gap-1.5"
                    style={{
                      backgroundColor: currentTheme.accentBg,
                      border: `1px solid ${currentTheme.borderActive}`,
                      color: currentTheme.primary
                    }}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    LOAD INTO DAILY PRACTICE
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODULE 5: PRACTICE HISTORY */}
        {/* ============================================================== */}
        {activeTab === 'history' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <Calendar className="w-5 h-5" style={{ color: currentTheme.primary }} />
                  Practice History & Logs
                </h2>
                <p className="text-xs sm:text-sm text-[#92929F]">Step-by-step logs, verified tempo gains & technique notes.</p>
              </div>

              <button
                onClick={exportHistoryJson}
                className="px-3.5 py-1.5 rounded-xl bg-[#15151D] border border-white/10 hover:border-white/20 text-xs font-bold text-white flex items-center gap-1.5 font-mono"
              >
                <Download className="w-3.5 h-3.5" />
                BACKUP JSON
              </button>
            </div>

            {/* Comparison with Previous Session Banner (Guaranteed Date-Sorted) */}
            {(() => {
              const chronologicalSessions = [...historySessions].sort(
                (a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || '').localeCompare(a.id || '')
              );

              if (chronologicalSessions.length < 2) return null;

              const latest = chronologicalSessions[0];
              const prev = chronologicalSessions[1];
              const edgeDelta = (latest.edgeBpm || 0) - (prev.edgeBpm || 0);
              const burstDelta = (latest.burstBpm || 0) - (prev.burstBpm || 0);
              const durationDelta = (latest.totalDurationMinutes || 0) - (prev.totalDurationMinutes || 0);

              return (
                <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor: currentTheme.accentBg,
                        color: currentTheme.primary
                      }}
                    >
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white font-mono">Latest vs Previous Session Delta</h4>
                      <p className="text-[11px] text-[#92929F] font-mono">
                        {latest.date} vs {prev.date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-6 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[#92929F] uppercase block">Edge Delta</span>
                      <span className={`font-bold ${edgeDelta >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {edgeDelta >= 0 ? '+' : ''}{edgeDelta} BPM
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#92929F] uppercase block">Burst Delta</span>
                      <span className={`font-bold ${burstDelta >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {burstDelta >= 0 ? '+' : ''}{burstDelta} BPM
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#92929F] uppercase block">Duration Delta</span>
                      <span className="font-bold" style={{ color: currentTheme.primary }}>
                        {durationDelta >= 0 ? '+' : ''}{durationDelta} mins
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#15151D] p-2.5 sm:p-3 rounded-2xl border border-white/5">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by focus tag, note, or date..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="w-full bg-[#101016] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#92929F] focus:outline-none"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto font-mono">
                <span className="text-[10px] sm:text-xs text-[#92929F] uppercase font-semibold">Sort:</span>
                <select
                  value={historySortOrder}
                  onChange={(e) => setHistorySortOrder(e.target.value)}
                  className="bg-[#101016] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="fastest">Fastest Edge BPM</option>
                  <option value="longest">Longest Duration</option>
                </select>
              </div>
            </div>

            {/* Filtered & Sorted Sessions List */}
            {(() => {
              const filtered = historySessions.filter(s => {
                if (!historySearchTerm.trim()) return true;
                const term = historySearchTerm.toLowerCase();
                const allFocus = [...(s.step1Focus || []), ...(s.step2Focus || []), ...(s.step3Focus || []), ...(s.step4Focus || [])].join(' ').toLowerCase();
                const notes = (s.notes || '').toLowerCase();
                const date = (s.date || '').toLowerCase();
                return allFocus.includes(term) || notes.includes(term) || date.includes(term);
              });

              const sorted = [...filtered].sort((a, b) => {
                if (historySortOrder === 'newest') return (b.date || '').localeCompare(a.date || '');
                if (historySortOrder === 'oldest') return (a.date || '').localeCompare(b.date || '');
                if (historySortOrder === 'fastest') return (b.edgeBpm || 0) - (a.edgeBpm || 0);
                if (historySortOrder === 'longest') return (b.totalDurationMinutes || 0) - (a.totalDurationMinutes || 0);
                return 0;
              });

              if (sorted.length === 0) {
                return (
                  <div className="bg-[#15151D] border border-white/5 rounded-2xl p-8 text-center">
                    <BookOpen className="w-8 h-8 text-[#92929F] mx-auto mb-2 opacity-50" />
                    <h4 className="text-sm font-bold text-white mb-1 font-mono">No Practice Sessions Match</h4>
                    <p className="text-xs text-[#92929F]">Try adjusting your search keywords or clear the filter.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3 sm:space-y-4">
                  {sorted.map(session => (
                    <div
                      key={session.id}
                      onClick={() => setInspectedSession(session)}
                      className="bg-[#15151D] border border-white/5 hover:border-white/20 rounded-2xl p-4 sm:p-5 shadow-lg transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5 sm:pb-3 mb-2.5 sm:mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" style={{ color: currentTheme.primary }} />
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-white group-hover:text-white transition-colors font-mono">
                              {session.date}
                            </span>
                            {session.exerciseName && (
                              <span className="text-[10px] text-[#92929F] block truncate max-w-[200px] sm:max-w-xs font-normal">
                                {session.exerciseName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] sm:text-xs font-mono font-bold text-[#10B981] bg-[#10B981]/10 px-2 sm:px-2.5 py-0.5 rounded-full border border-[#10B981]/20">
                            {session.totalDurationMinutes} Mins Total
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            title="Delete this practice session"
                            className="p-1.5 rounded-lg bg-[#1B1B25] text-[#92929F] hover:text-[#EF4444] hover:bg-[#EF4444]/10 border border-white/5 transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-[#92929F] group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* 4 Metrics Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-[#101016] p-2.5 sm:p-3 rounded-xl border border-white/5 mb-2.5 sm:mb-3">
                        <div>
                          <span className="text-[9px] sm:text-[10px] text-[#92929F] uppercase font-semibold">Comfort</span>
                          <div className="text-xs sm:text-sm font-bold font-mono text-[#10B981]">{session.comfortBpm} BPM</div>
                        </div>
                        <div>
                          <span className="text-[9px] sm:text-[10px] text-[#92929F] uppercase font-semibold">Clean Edge</span>
                          <div className="text-xs sm:text-sm font-bold font-mono text-[#3B82F6]">{session.edgeBpm} BPM</div>
                        </div>
                        <div>
                          <span className="text-[9px] sm:text-[10px] text-[#92929F] uppercase font-semibold">Speed Bursts</span>
                          <div className="text-xs sm:text-sm font-bold font-mono text-[#EF4444]">{session.burstBpm} BPM</div>
                        </div>
                        <div>
                          <span className="text-[9px] sm:text-[10px] text-[#92929F] uppercase font-semibold">Next Target</span>
                          <div className="text-xs sm:text-sm font-bold font-mono" style={{ color: currentTheme.primary }}>{session.targetBpm} BPM</div>
                        </div>
                      </div>

                      <p className="text-[11px] sm:text-xs text-[#92929F] italic line-clamp-1">&ldquo;{session.notes}&rdquo;</p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ============================================================== */}
        {/* MODULE 6: MIRROR STUDIO */}
        {/* ============================================================== */}
        {activeTab === 'mirror' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <Camera className="w-5 h-5" style={{ color: currentTheme.primary }} />
                  Mirror Studio HUD
                </h2>
                <p className="text-xs sm:text-sm text-[#92929F]">Visual posture inspection & MediaRecorder video technique review.</p>
              </div>

              <div className="flex items-center gap-2 bg-[#15151D] px-3.5 py-1.5 rounded-xl border border-white/5 text-xs">
                <span className="text-[#92929F]">Target Exercise:</span>
                <span className="font-bold font-mono truncate max-w-[200px]" style={{ color: currentTheme.primary }}>
                  {practiceSession.selectedExerciseName || 'Custom Routine'}
                </span>
              </div>
            </div>

            <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-6 shadow-xl">
              <div className="relative aspect-video max-w-2xl mx-auto bg-[#08080C] border border-white/10 rounded-xl overflow-hidden flex items-center justify-center mb-4 sm:mb-5">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${!isCameraActive && 'hidden'}`}
                />

                {!isCameraActive && (
                  <div className="text-center p-4 sm:p-6">
                    <Camera className="w-10 h-10 sm:w-12 sm:h-12 text-[#92929F] mx-auto mb-2 sm:mb-3 opacity-60" />
                    <h4 className="text-xs sm:text-sm font-bold text-white mb-1 font-mono">Camera Feed Inactive</h4>
                    <p className="text-[11px] sm:text-xs text-[#92929F] max-w-xs mb-3 sm:mb-4">
                      Inspect pick slanting, thumb anchors, and shoulder relaxation in real time.
                    </p>
                    <button
                      onClick={startCamera}
                      className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-white font-extrabold text-xs shadow hover:brightness-110 active:scale-95 font-mono"
                      style={{
                        backgroundColor: currentTheme.primary,
                        boxShadow: `0 0 15px ${currentTheme.glow}`
                      }}
                    >
                      Start Camera Preview
                    </button>
                  </div>
                )}

                {isRecording && (
                  <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 sm:gap-2 bg-[#EF4444]/90 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold text-white animate-pulse font-mono">
                    <div className="w-2 h-2 rounded-full bg-white" />
                    REC ({Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')})
                  </div>
                )}
              </div>

              {isCameraActive && (
                <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-[#EF4444] text-white font-bold text-xs flex items-center gap-2 hover:brightness-110 active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.35)] font-mono"
                    >
                      <Video className="w-4 h-4" />
                      RECORD TAKE
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-[#EF4444] text-white font-bold text-xs flex items-center gap-2 animate-pulse active:scale-95 font-mono"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      STOP & ATTACH TO LOG
                    </button>
                  )}

                  <button
                    onClick={stopCamera}
                    className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#1B1B25] border border-white/10 text-xs font-semibold text-white hover:bg-[#252533] active:scale-95"
                  >
                    Close Camera
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0E0E14]/95 backdrop-blur-lg border-t border-white/10 px-2 py-2 flex items-center justify-around">
        {[
          { id: 'daily', label: 'Daily', icon: Activity },
          { id: 'metronome', label: 'Metro', icon: Clock },
          { id: 'progress', label: 'Progress', icon: BarChart2 },
          { id: 'library', label: 'Armory', icon: BookOpen },
          { id: 'history', label: 'Logs', icon: Calendar },
          { id: 'mirror', label: 'Mirror', icon: Camera },
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                audioEngine.playUiSound('step');
              }}
              className="flex flex-col items-center justify-center p-1 rounded-xl transition-all"
              style={{ color: isActive ? currentTheme.primary : '#92929F' }}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[9px] font-mono font-bold">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* KEYBOARD SHORTCUTS MODAL */}
      {isHotkeysModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#15151D] border border-white/10 rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5" style={{ color: currentTheme.primary }} />
                <h3 className="text-base font-bold text-white font-mono">Gaming Control Map</h3>
              </div>
              <button onClick={() => setIsHotkeysModalOpen(false)} className="text-[#92929F] hover:text-white">
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between bg-[#101016] p-2.5 rounded-xl border border-white/5">
                <span className="text-[#92929F]">Play / Stop Metronome</span>
                <span className="bg-[#1B1B25] px-2 py-0.5 rounded text-white font-bold border border-white/10">SPACE</span>
              </div>
              <div className="flex items-center justify-between bg-[#101016] p-2.5 rounded-xl border border-white/5">
                <span className="text-[#92929F]">Tempo Adjust (&plusmn;1 BPM)</span>
                <span className="bg-[#1B1B25] px-2 py-0.5 rounded text-white font-bold border border-white/10">&uarr; / &darr;</span>
              </div>
              <div className="flex items-center justify-between bg-[#101016] p-2.5 rounded-xl border border-white/5">
                <span className="text-[#92929F]">Fast Step (&plusmn;5 BPM)</span>
                <span className="bg-[#1B1B25] px-2 py-0.5 rounded text-white font-bold border border-white/10">SHIFT + &uarr; / &darr;</span>
              </div>
              <div className="flex items-center justify-between bg-[#101016] p-2.5 rounded-xl border border-white/5">
                <span className="text-[#92929F]">Jump to Step 1&ndash;4</span>
                <span className="bg-[#1B1B25] px-2 py-0.5 rounded text-white font-bold border border-white/10">1 / 2 / 3 / 4</span>
              </div>
              <div className="flex items-center justify-between bg-[#101016] p-2.5 rounded-xl border border-white/5">
                <span className="text-[#92929F]">Open Hotkey Map</span>
                <span className="bg-[#1B1B25] px-2 py-0.5 rounded text-white font-bold border border-white/10">?</span>
              </div>
            </div>

            <button
              onClick={() => setIsHotkeysModalOpen(false)}
              className="w-full py-2 rounded-xl text-white font-bold text-xs font-mono"
              style={{ backgroundColor: currentTheme.primary }}
            >
              GOT IT
            </button>
          </div>
        </div>
      )}

      {/* Time's Up Dialogue Modal */}
      {timeUpStep && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="bg-[#15151D] border-2 rounded-2xl p-6 sm:p-7 max-w-md w-full text-center shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden"
            style={{
              borderColor: currentTheme.primary,
              boxShadow: `0 0 40px ${currentTheme.glow}`
            }}
          >
            {/* Ambient background glow */}
            <div
              className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full pointer-events-none blur-3xl opacity-30"
              style={{ backgroundColor: currentTheme.primary }}
            />

            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border relative z-10 animate-bounce"
              style={{
                backgroundColor: currentTheme.accentBg,
                borderColor: currentTheme.borderActive,
                color: currentTheme.primary,
                boxShadow: `0 0 20px ${currentTheme.glow}`
              }}
            >
              <Clock className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="inline-block px-3 py-1 rounded-full text-[10px] font-gx-code font-bold uppercase tracking-widest border mb-2 relative z-10"
              style={{
                backgroundColor: currentTheme.accentBg,
                borderColor: currentTheme.borderActive,
                color: currentTheme.primary
              }}
            >
              METRONOMES PAUSED
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 font-gx-display uppercase tracking-tight relative z-10">
              TIME OVER!
            </h3>

            <p className="text-xs sm:text-sm text-[#92929F] mb-6 leading-relaxed relative z-10">
              Your practice duration for <strong className="text-white block mt-1 font-gx-display text-sm sm:text-base font-bold" style={{ color: currentTheme.primary }}>{timeUpStep}</strong> has concluded. All audio metronome channels have been halted.
            </p>

            <button
              onClick={() => {
                setTimeUpStep(null);
                audioEngine.playUiSound('step');
              }}
              className="w-full py-3 rounded-xl text-white font-extrabold text-xs sm:text-sm transition-all active:scale-95 font-gx-display uppercase tracking-wider relative z-10"
              style={{
                backgroundColor: currentTheme.primary,
                boxShadow: `0 0 20px ${currentTheme.glow}`
              }}
            >
              ACKNOWLEDGE & CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* EXERCISE DRILL-DOWN MODAL */}
      {inspectedExerciseProgress && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#15151D] border border-white/10 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto pb-28 md:pb-6">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h3 className="text-base font-bold text-white font-mono">{inspectedExerciseProgress.name}</h3>
              <button onClick={() => setInspectedExerciseProgress(null)} className="text-[#92929F] hover:text-white">
                &times;
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 bg-[#101016] p-3 rounded-xl font-mono text-center text-xs">
              <div>
                <span className="text-[#92929F]">Start</span>
                <div className="font-bold text-white">{inspectedExerciseProgress.startBpm} BPM</div>
              </div>
              <div>
                <span className="text-[#92929F]">Current</span>
                <div className="font-bold" style={{ color: currentTheme.primary }}>{inspectedExerciseProgress.currentBpm} BPM</div>
              </div>
              <div>
                <span className="text-[#92929F]">Goal</span>
                <div className="font-bold text-[#3B82F6]">{inspectedExerciseProgress.targetBpm} BPM</div>
              </div>
            </div>
            <button
              onClick={() => {
                loadExerciseIntoRoutine(inspectedExerciseProgress);
                setInspectedExerciseProgress(null);
              }}
              className="w-full py-2 rounded-xl text-white font-bold text-xs font-mono"
              style={{ backgroundColor: currentTheme.primary }}
            >
              PRACTICE THIS EXERCISE NOW
            </button>
          </div>
        </div>
      )}

      {/* ADD EXERCISE MODAL */}
      {isAddExerciseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#15151D] border border-white/10 rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto pb-28 md:pb-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" style={{ color: currentTheme.primary }} />
                <h3 className="text-base sm:text-lg font-bold text-white font-mono">Add Exercise to Armory</h3>
              </div>
              <button
                onClick={() => setIsAddExerciseModalOpen(false)}
                className="text-[#92929F] hover:text-white text-lg p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateExercise} className="space-y-3.5">
              <div>
                <label className="text-[11px] sm:text-xs text-[#92929F] uppercase font-semibold block mb-1">
                  Exercise Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Economy Picking Sweep Arpeggios"
                  value={newExerciseData.name}
                  onChange={(e) => setNewExerciseData({ ...newExerciseData, name: e.target.value })}
                  className="w-full bg-[#101016] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#92929F] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs text-[#92929F] uppercase font-semibold block mb-1">
                  Category / Technique
                </label>
                <select
                  value={newExerciseData.category}
                  onChange={(e) => setNewExerciseData({ ...newExerciseData, category: e.target.value })}
                  className="w-full bg-[#101016] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="Alternate Picking">Alternate Picking</option>
                  <option value="Economy Picking">Economy Picking</option>
                  <option value="Legato">Legato</option>
                  <option value="Sweep Picking">Sweep Picking</option>
                  <option value="Tapping">Tapping</option>
                  <option value="Chromatic">Chromatic</option>
                  <option value="Spider Exercises">Spider Exercises</option>
                  <option value="Pentatonic Sequences">Pentatonic Sequences</option>
                  <option value="Rhythm & Chords">Rhythm & Chords</option>
                  <option value="String Skipping">String Skipping</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-[#92929F] uppercase font-semibold block mb-1">Start BPM</label>
                  <input
                    type="number"
                    min="30"
                    max="300"
                    value={newExerciseData.startBpm}
                    onChange={(e) => setNewExerciseData({ ...newExerciseData, startBpm: Number(e.target.value) })}
                    className="w-full bg-[#101016] border border-white/10 text-center font-mono rounded-xl py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#92929F] uppercase font-semibold block mb-1">Current BPM</label>
                  <input
                    type="number"
                    min="30"
                    max="300"
                    value={newExerciseData.currentBpm}
                    onChange={(e) => setNewExerciseData({ ...newExerciseData, currentBpm: Number(e.target.value) })}
                    style={{ color: currentTheme.primary }}
                    className="w-full bg-[#101016] border border-white/10 text-center font-mono rounded-xl py-1.5 text-xs font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#92929F] uppercase font-semibold block mb-1">Target BPM</label>
                  <input
                    type="number"
                    min="30"
                    max="320"
                    value={newExerciseData.targetBpm}
                    onChange={(e) => setNewExerciseData({ ...newExerciseData, targetBpm: Number(e.target.value) })}
                    className="w-full bg-[#101016] border border-white/10 text-center font-mono rounded-xl py-1.5 text-xs text-[#3B82F6] font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsAddExerciseModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#92929F] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-white font-extrabold text-xs transition-all active:scale-95 font-mono"
                  style={{
                    backgroundColor: currentTheme.primary,
                    boxShadow: `0 0 12px ${currentTheme.glow}`
                  }}
                >
                  Save Exercise
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 4 EXCLUSIVE: LOG PRACTICE SESSION MODAL */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#15151D] border border-white/10 rounded-2xl p-4 sm:p-6 max-w-lg w-full shadow-2xl space-y-3 sm:space-y-4 max-h-[85vh] overflow-y-auto pb-28 md:pb-6">
            <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-white/5">
              <h3 className="text-base sm:text-lg font-bold text-white font-mono">Log Today's Practice Session</h3>
              <button onClick={() => setIsLogModalOpen(false)} className="text-[#92929F] hover:text-white text-lg p-1">
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] sm:text-xs text-[#92929F] uppercase font-semibold">Target BPM for Next Session</label>
                <input
                  type="number"
                  value={logFormData.targetBpm}
                  onChange={(e) => setLogFormData({ ...logFormData, targetBpm: Number(e.target.value) })}
                  className="w-full bg-[#101016] border border-white/10 rounded-xl px-3 py-2 text-xs text-white mt-1 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs text-[#92929F] uppercase font-semibold">Key Points of Focus for Tomorrow</label>
                <input
                  type="text"
                  value={logFormData.pointsOfFocusTomorrow}
                  onChange={(e) => setLogFormData({ ...logFormData, pointsOfFocusTomorrow: e.target.value })}
                  className="w-full bg-[#101016] border border-white/10 rounded-xl px-3 py-2 text-xs text-white mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] sm:text-xs text-[#92929F] uppercase font-semibold">Additional Notes</label>
                <textarea
                  rows="3"
                  value={logFormData.additionalNotes}
                  onChange={(e) => setLogFormData({ ...logFormData, additionalNotes: e.target.value })}
                  className="w-full bg-[#101016] border border-white/10 rounded-xl px-3 py-2 text-xs text-white mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-white/5">
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold text-[#92929F] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSession}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-white font-bold text-xs transition-all active:scale-95 font-mono"
                style={{
                  backgroundColor: currentTheme.primary,
                  boxShadow: `0 0 15px ${currentTheme.glow}`
                }}
              >
                Save & Add to History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="hidden md:block border-t border-white/5 py-4 px-6 text-center text-[11px] text-[#92929F] font-gx-display">
        Wannabe Guitarist's Studio &bull; Isolated Multi-User &bull; Space: Play/Pause &bull; &uarr;/&darr;: Tempo
      </footer>

      {/* MULTI-USER PROFILES & PIN SECURITY MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#15151D] border border-white/10 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-white" />
                <h3 className="text-base sm:text-lg font-bold text-white font-gx-display">Guitarist Profile Studio</h3>
              </div>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-[#92929F] hover:text-white text-lg p-1">
                &times;
              </button>
            </div>

            <p className="text-xs text-[#92929F] leading-relaxed">
              Two separate guitarists can use this app with 100% isolated history, library, and cloud sync. Lock your profile with a PIN so nobody else can mess up your progress!
            </p>

            {/* Profile Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {['user1', 'user2'].map(uid => {
                const isSelected = activeUserId === uid;
                const prof = userProfiles[uid];
                return (
                  <div
                    key={uid}
                    className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1B1B25] border-white/20 shadow-lg'
                        : 'bg-[#101016] border-white/5 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono font-bold text-[#92929F] uppercase">
                          {uid === 'user1' ? 'Slot 1' : 'Slot 2'}
                        </span>
                        {prof.pin ? (
                          <Lock className="w-3 h-3 text-[#10B981]" title="PIN Protected" />
                        ) : (
                          <Unlock className="w-3 h-3 text-[#92929F]" title="No PIN Set" />
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white font-mono truncate">{prof.name}</h4>
                    </div>

                    <button
                      onClick={() => requestSwitchUser(uid)}
                      className="mt-3 w-full py-1.5 rounded-lg text-xs font-bold font-mono transition-all"
                      style={{
                        backgroundColor: isSelected ? currentTheme.primary : '#1B1B25',
                        color: '#FFFFFF'
                      }}
                    >
                      {isSelected ? 'ACTIVE' : 'SWITCH'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Manage Active Profile Settings */}
            <div className="bg-[#101016] p-3 rounded-xl border border-white/5 space-y-3">
              <span className="text-[10px] uppercase font-bold text-[#92929F] block">
                Manage {userProfiles[activeUserId]?.name}
              </span>

              <div>
                <label className="text-[11px] text-[#92929F] block mb-1">Guitarist Display Name</label>
                <input
                  type="text"
                  value={userProfiles[activeUserId]?.name || ''}
                  onChange={(e) => handleUpdateProfileName(e.target.value)}
                  className="w-full bg-[#1B1B25] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              {/* PIN Code Setup */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">PIN Protection</span>
                  <span className="text-[10px] text-[#92929F]">
                    {userProfiles[activeUserId]?.pin ? 'Protected by personal PIN' : 'Unprotected'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setIsSettingPin(!isSettingPin);
                    setCurrentPinVerify('');
                    setNewPinInput('');
                    setPinChangeError('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#1B1B25] border border-white/10 text-xs font-bold text-white hover:border-white/20"
                >
                  {isSettingPin ? 'Cancel' : 'Change My PIN'}
                </button>
              </div>

              {isSettingPin && (
                <form onSubmit={handleSetProfilePin} className="pt-2 space-y-2.5 border-t border-white/5 animate-in fade-in duration-150">
                  <div className="text-[11px] text-[#92929F]">
                    Enter your current PIN to authenticate changes for <strong>{userProfiles[activeUserId]?.name}</strong>:
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#92929F] block mb-1">Current PIN</label>
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="••••"
                      value={currentPinVerify}
                      onChange={(e) => setCurrentPinVerify(e.target.value)}
                      className="w-full bg-[#1B1B25] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono text-center tracking-widest"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#92929F] block mb-1">New 4–6 Digit PIN</label>
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="••••"
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value)}
                      className="w-full bg-[#1B1B25] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono text-center tracking-widest"
                      required
                    />
                  </div>

                  {pinChangeError && (
                    <div className="text-[11px] text-[#EF4444] font-bold text-center">{pinChangeError}</div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingPin(false);
                        setCurrentPinVerify('');
                        setNewPinInput('');
                        setPinChangeError('');
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-[#1B1B25] text-xs font-semibold text-[#92929F] hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-1.5 rounded-lg text-white text-xs font-bold font-mono transition-all active:scale-95"
                      style={{ backgroundColor: currentTheme.primary }}
                    >
                      Update My PIN
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PIN ENTRY MODAL (Prevents unauthorized profile switching) */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#15151D] border-2 border-white/20 rounded-2xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: currentTheme.accentBg, color: currentTheme.primary }}
            >
              <KeyRound className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white font-gx-display">Profile Locked</h3>
              <p className="text-xs text-[#92929F] mt-1">
                Enter PIN for <strong>{userProfiles[targetSwitchUser]?.name}</strong>
              </p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-3">
              <input
                type="password"
                maxLength={6}
                autoFocus
                placeholder="••••"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                className="w-full bg-[#101016] border border-white/10 rounded-xl py-2 text-center text-lg tracking-widest text-white focus:outline-none font-mono"
              />

              {pinError && (
                <div className="text-[11px] text-[#EF4444] font-bold">{pinError}</div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-[#1B1B25] text-xs font-bold text-[#92929F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-white text-xs font-bold font-mono"
                  style={{ backgroundColor: currentTheme.primary }}
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOUD DEVICE SYNC MODAL (Connect Phone & PC per User) */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#15151D] border border-white/10 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-[#3B82F6]" />
                <h3 className="text-base sm:text-lg font-bold text-white font-gx-display">
                  Live Cloud Sync ({userProfiles[activeUserId]?.name})
                </h3>
              </div>
              <button onClick={() => setIsSyncModalOpen(false)} className="text-[#92929F] hover:text-white text-lg p-1">
                &times;
              </button>
            </div>

            <p className="text-xs text-[#92929F] leading-relaxed">
              This Sync Key connects <strong>{userProfiles[activeUserId]?.name}</strong> between your PC and phone. The second user has their own separate key and won't affect your sessions!
            </p>

            <div className="bg-[#101016] p-3 rounded-xl border border-white/10">
              <span className="text-[10px] text-[#92929F] uppercase font-bold block mb-1">
                {userProfiles[activeUserId]?.name}'s Sync Key
              </span>
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={userProfiles[activeUserId]?.syncKey || ''}
                  onChange={(e) => {
                    const keyVal = e.target.value.toLowerCase();
                    const updated = {
                      ...userProfiles,
                      [activeUserId]: { ...userProfiles[activeUserId], syncKey: keyVal }
                    };
                    saveUserProfiles(updated);
                  }}
                  className="bg-transparent font-mono font-bold text-sm text-white focus:outline-none w-full"
                />
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(userProfiles[activeUserId]?.syncKey || '');
                    audioEngine.playUiSound('step');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#1B1B25] text-[11px] font-bold text-[#92929F] hover:text-white border border-white/5"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => syncToCloud()}
                disabled={isSyncing}
                className="flex-1 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload PC Data to Cloud
              </button>

              <button
                onClick={() => fetchCloudData()}
                disabled={isSyncing}
                className="flex-1 py-2.5 rounded-xl bg-[#1B1B25] border border-white/10 hover:border-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Fetch on Phone
              </button>
            </div>

            <div className="pt-2 border-t border-white/5 text-[11px] text-[#92929F]">
              <strong className="text-white">To sync this user on your phone:</strong>
              <ol className="list-decimal list-inside space-y-1 mt-1 text-[10px] sm:text-[11px]">
                <li>Copy the Sync Key above on your PC.</li>
                <li>On your phone, switch to this user's profile and tap <strong>Sync</strong>.</li>
                <li>Paste this exact key and tap <strong>Fetch on Phone</strong>.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
