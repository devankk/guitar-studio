import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, Plus, Minus, RotateCcw, Volume2, Settings,
  Calendar, Check, ChevronRight, Video, Camera, BarChart2,
  BookOpen, Clock, Activity, Zap, RefreshCw, Layers, Sliders,
  HelpCircle, ChevronDown, ChevronUp, Music, ArrowUp, ArrowDown,
  Square, Download, Upload, Trash2, Award, Flame, Target, Compass,
  Menu, X, Film, CheckCircle2, TrendingUp, Palette, ShieldCheck, Keyboard,
  Cloud, RefreshCcw, User, Users, Lock, Unlock, KeyRound,
  LogOut, ShieldAlert, Timer
} from 'lucide-react';

// ============================================================================
// TYPOGRAPHY INJECTION & FONT STYLES (OPERA GX HIGH-TECH GAMING & AUDIO AESTHETIC)
// ============================================================================
const FONT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700;800&family=Rajdhani:wght@500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');

  :root {
    --app-vh: 100dvh;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    min-height: 100%;
    min-height: 100dvh;
    background-color: #08080C;
    overflow-x: hidden;
  }

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

  /* Fluid typography scaling for extreme viewports */
  .text-fluid-bpm {
    font-size: clamp(3.8rem, 9.5vw, 9.5rem);
    line-height: 0.95;
  }

  .text-fluid-title {
    font-size: clamp(1.15rem, 1.8vw, 1.85rem);
  }

  /* Mobile safe area padding for bottom bar */
  .safe-area-bottom {
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
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
    this.beatTimers = new Set();
    this.pauseTimeRemaining = null;
    this.runToken = 0;
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

      if (this.onBeat && this.audioCtx) {
        const token = this.runToken;
        const delay = Math.max(0, (this.nextNoteTime - this.audioCtx.currentTime) * 1000);
        const timer = setTimeout(() => {
          this.beatTimers.delete(timer);
          if (this.isPlaying && token === this.runToken && this.onBeat) {
            this.onBeat(this.currentBeat + 1, this.currentBeat === 0);
          }
        }, delay);
        this.beatTimers.add(timer);
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
    this.runToken++;
    if (this.pauseTimeRemaining !== null) {
      this.nextNoteTime = this.audioCtx.currentTime + Math.max(0.02, this.pauseTimeRemaining);
      this.pauseTimeRemaining = null;
    } else {
      this.currentBeat = 0;
      this.currentSubdivision = 0;
      this.nextNoteTime = this.audioCtx.currentTime + 0.04;
    }
    this.scheduledEvents = [];

    this.timerId = setInterval(() => {
      if (this.isPlaying) {
        this.scheduler();
      }
    }, this.lookahead);
  }

  pause() {
    if (!this.isPlaying) return;
    this.pauseTimeRemaining = this.audioCtx ? Math.max(0.02, this.nextNoteTime - this.audioCtx.currentTime) : 0.04;
    this.isPlaying = false;
    this.runToken++;
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
    this.scheduledEvents = [];
    this.beatTimers.forEach(clearTimeout);
    this.beatTimers.clear();
  }

  stop() {
    this.isPlaying = false;
    this.runToken++;
    this.pauseTimeRemaining = null;
    this.beatTimers.forEach(clearTimeout);
    this.beatTimers.clear();
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
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('gps_active_tab') || 'daily';
    } catch {
      return 'daily';
    }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(80);
  const [selectedSubdivision, setSelectedSubdivision] = useState(SUBDIVISIONS[0]);
  const [timeSignature, setTimeSignature] = useState(TIME_SIGNATURES[2]);
  const [soundType, setSoundType] = useState('woodblock');
  const [volume, setVolume] = useState(0.85);
  const [activeMetronomeMode, setActiveMetronomeMode] = useState('standard');
  const [isHotkeysModalOpen, setIsHotkeysModalOpen] = useState(false);

  // --------------------------------------------------------------------------
  // MANUAL SESSION PRACTICE STOPWATCH / TIMER STATE
  // --------------------------------------------------------------------------
  const [isManualTimerRunning, setIsManualTimerRunning] = useState(false);
  const [manualPracticeSeconds, setManualPracticeSeconds] = useState(0);
  const [manualTimerStartTime, setManualTimerStartTime] = useState(null);

  // --------------------------------------------------------------------------
  // MANDATORY PROFILE GATEWAY & AUTHENTICATION STATE
  // --------------------------------------------------------------------------
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedLoginUser, setSelectedLoginUser] = useState(null);
  const [loginPinInput, setLoginPinInput] = useState('');
  const [loginErrorMessage, setLoginErrorMessage] = useState('');

  // --------------------------------------------------------------------------
  // MULTI-USER ISOLATION & PIN LOCK SYSTEM
  // --------------------------------------------------------------------------
  const [activeUserId, setActiveUserId] = useState('user1'); // 'user1' (Master Admin) | 'user2' | 'user3'...
  const [userProfiles, setUserProfiles] = useState({
    user1: { name: 'Guitarist 1 (Admin)', pin: '7779', syncKey: 'g1-sync-' + Math.random().toString(36).substring(2, 7), isAdmin: true },
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

  // Admin Profile Creation State (Exclusive to Guitarist 1)
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfilePin, setNewProfilePin] = useState('');
  const [adminActionError, setAdminActionError] = useState('');

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

  // Speed training configuration
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

  // Ratios training configuration
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
    countInTotal: 4,
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
        const merged = {
          ...parsedProfiles,
          user1: {
            ...parsedProfiles.user1,
            pin: parsedProfiles.user1?.pin || '7779',
            name: parsedProfiles.user1?.name || 'Guitarist 1 (Admin)',
            isAdmin: true
          }
        };
        setUserProfiles(merged);
        if (merged[uid]?.syncKey) {
          setSyncKey(merged[uid].syncKey);
          fetchCloudData(merged[uid].syncKey);
        } else {
          const generatedKey = `g_${(merged[uid]?.name || uid).toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.random().toString(36).substring(2, 6)}`;
          const updatedWithKey = {
            ...merged,
            [uid]: { ...merged[uid], syncKey: generatedKey }
          };
          setUserProfiles(updatedWithKey);
          setSyncKey(generatedKey);
          try {
            localStorage.setItem('gps_user_profiles', JSON.stringify(updatedWithKey));
          } catch {}
          fetchCloudData(generatedKey);
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

  // Local storage initialization & Session Persistence (Login Only Once)
  useEffect(() => {
    try {
      const savedProfiles = localStorage.getItem('gps_user_profiles');
      if (savedProfiles) {
        const parsedProfiles = JSON.parse(savedProfiles);
        const merged = {
          ...parsedProfiles,
          user1: {
            ...parsedProfiles.user1,
            pin: parsedProfiles.user1?.pin || '7779',
            name: parsedProfiles.user1?.name || 'Guitarist 1 (Admin)',
            isAdmin: true
          }
        };
        setUserProfiles(merged);
      }

      // Check if user has already authenticated previously
      const savedAuthUser = localStorage.getItem('gps_auth_user');
      const isAuthFlag = localStorage.getItem('gps_is_authenticated');

      if (isAuthFlag === 'true' && savedAuthUser) {
        setActiveUserId(savedAuthUser);
        setIsAuthenticated(true);
        loadUserData(savedAuthUser);
      } else {
        setIsAuthenticated(false);
      }

      // Restore active tab if previously saved
      const savedTab = localStorage.getItem('gps_active_tab');
      if (savedTab && ['daily', 'metronome', 'progress', 'library', 'history', 'mirror'].includes(savedTab)) {
        setActiveTab(savedTab);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  // Persist tab changes so refreshes stay on the active page
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    try {
      localStorage.setItem('gps_active_tab', tabId);
    } catch {}
    if (tabId === 'metronome') setActiveMetronomeMode('standard');
    audioEngine.playUiSound('step');
  };

  // Login authentication handler for the initial lock gateway
  const handleGatewayLogin = (e) => {
    e?.preventDefault();
    if (!selectedLoginUser) {
      setLoginErrorMessage('Please select a guitarist profile to continue.');
      return;
    }

    const prof = userProfiles[selectedLoginUser];
    if (!prof) {
      setLoginErrorMessage('Profile not found.');
      return;
    }

    if (prof.pin && loginPinInput !== prof.pin) {
      setLoginErrorMessage('Access Denied: Incorrect PIN code.');
      audioEngine.playUiSound('step');
      return;
    }

    // Successfully verified! Save persistent session so refresh skips login
    performUserSwitch(selectedLoginUser);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('gps_is_authenticated', 'true');
      localStorage.setItem('gps_auth_user', selectedLoginUser);
    } catch {}

    setLoginErrorMessage('');
    setLoginPinInput('');
    audioEngine.playUiSound('step');
  };

  // Sign out / Lock studio back to gateway (Only time login shows again)
  const handleLockStudio = () => {
    stopAllMetronomes();
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('gps_is_authenticated');
      localStorage.removeItem('gps_auth_user');
    } catch {}
    setSelectedLoginUser(null);
    setLoginPinInput('');
    setLoginErrorMessage('');
    setIsProfileModalOpen(false);
    setIsPinModalOpen(false);
    audioEngine.playUiSound('step');
  };

  // Save current profile metadata whenever changed
  const saveUserProfiles = (updated) => {
    setUserProfiles(updated);
    try {
      localStorage.setItem('gps_user_profiles', JSON.stringify(updated));
    } catch {}
  };

  const requestSwitchUser = (targetId) => {
    if (targetId === activeUserId) {
      setIsProfileModalOpen(false);
      return;
    }

    const targetProfile = userProfiles[targetId];
    if (targetProfile.pin) {
      setTargetSwitchUser(targetId);
      setEnteredPin('');
      setPinError('');
      setIsPinModalOpen(true);
      setIsProfileModalOpen(false);
    } else {
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
        name: newName.trim() || `Guitarist ${activeUserId.replace('user', '')}`
      }
    };
    saveUserProfiles(updated);
  };

  const handleAdminCreateProfile = (e) => {
    e?.preventDefault();
    if (activeUserId !== 'user1') {
      setAdminActionError('Only Guitarist 1 (Master Admin) can create new profiles.');
      return;
    }

    if (!newProfileName.trim()) {
      setAdminActionError('Please enter a guitarist name.');
      return;
    }

    if (!newProfilePin.trim() || newProfilePin.trim().length < 4) {
      setAdminActionError('PIN must be at least 4 digits.');
      return;
    }

    const newId = `user_${Date.now()}`;
    const cleanSyncKey = `g_${newProfileName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.random().toString(36).substring(2, 6)}`;

    const updated = {
      ...userProfiles,
      [newId]: {
        name: newProfileName.trim(),
        pin: newProfilePin.trim(),
        syncKey: cleanSyncKey
      }
    };

    saveUserProfiles(updated);
    setIsAddingProfile(false);
    setNewProfileName('');
    setNewProfilePin('');
    setAdminActionError('');
    audioEngine.playUiSound('step');
  };

  const handleAdminDeleteProfile = (targetId) => {
    if (activeUserId !== 'user1') {
      setAdminActionError('Only Guitarist 1 (Master Admin) can delete profiles.');
      return;
    }

    if (targetId === 'user1') {
      setAdminActionError('Cannot delete Master Admin profile.');
      return;
    }

    const updated = { ...userProfiles };
    delete updated[targetId];

    try {
      localStorage.removeItem(`gps_history_${targetId}`);
      localStorage.removeItem(`gps_exercises_${targetId}`);
      localStorage.removeItem(`gps_practiced_dates_${targetId}`);
      localStorage.removeItem(`gps_gx_theme_${targetId}`);
      localStorage.removeItem(`gps_practice_session_${targetId}`);
    } catch {}

    saveUserProfiles(updated);
    audioEngine.playUiSound('step');
  };

  const syncToCloud = async (overrideData = null) => {
    const activeSyncKey = userProfiles[activeUserId]?.syncKey || syncKey || `g_${activeUserId}`;
    if (!activeSyncKey) {
      setSyncStatus('error');
      return;
    }
    setIsSyncing(true);
    setSyncStatus(null);

    const payload = overrideData || {
      userId: activeUserId,
      profileName: userProfiles[activeUserId]?.name,
      historySessions,
      exercises,
      practicedCalendarDays,
      updatedAt: new Date().toISOString()
    };

    const cleanKey = `wgs_${activeUserId}_${activeSyncKey.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    try {
      const res = await fetch(`https://ntfy.sh/${cleanKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Title': `WGS Sync - ${userProfiles[activeUserId]?.name || activeUserId}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus(null), 3500);
        audioEngine.playUiSound('step');
      } else {
        throw new Error('Sync failed with status ' + res.status);
      }
    } catch (err) {
      console.error('Cloud Sync Upload Error:', err);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchCloudData = async (keyToFetch = null) => {
    const rawKey = keyToFetch || userProfiles[activeUserId]?.syncKey || syncKey || `g_${activeUserId}`;
    if (!rawKey) {
      setSyncStatus('error');
      return;
    }
    setIsSyncing(true);
    setSyncStatus(null);

    const cleanKey = `wgs_${activeUserId}_${rawKey.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    try {
      let fetchedData = null;
      try {
        const ntfyRes = await fetch(`https://ntfy.sh/${cleanKey}/json?poll=1`);
        if (ntfyRes.ok) {
          const lines = (await ntfyRes.text()).trim().split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const parsedLine = JSON.parse(lines[i]);
              if (parsedLine.message) {
                const inner = JSON.parse(parsedLine.message);
                if (inner.historySessions || inner.exercises) {
                  fetchedData = inner;
                  break;
                }
              }
            } catch {}
          }
        }
      } catch {}

      if (!fetchedData) {
        const res = await fetch(`https://api.restful-api.dev/objects`);
        if (res.ok) {
          const list = await res.json();
          const found = Array.isArray(list) ? list.filter(item => item.name === cleanKey).pop() : null;
          if (found && found.data) {
            fetchedData = found.data;
          }
        }
      }

      if (fetchedData) {
        if (Array.isArray(fetchedData.historySessions)) {
          setHistorySessions(fetchedData.historySessions);
          try {
            localStorage.setItem(`gps_history_${activeUserId}`, JSON.stringify(fetchedData.historySessions));
          } catch {}
        }
        if (Array.isArray(fetchedData.exercises)) {
          setExercises(fetchedData.exercises);
          try {
            localStorage.setItem(`gps_exercises_${activeUserId}`, JSON.stringify(fetchedData.exercises));
          } catch {}
        }
        if (Array.isArray(fetchedData.practicedCalendarDays)) {
          setPracticedCalendarDays(fetchedData.practicedCalendarDays);
          try {
            localStorage.setItem(`gps_practiced_dates_${activeUserId}`, JSON.stringify(fetchedData.practicedCalendarDays));
          } catch {}
        }
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus(null), 3500);
        audioEngine.playUiSound('step');
      } else {
        setSyncStatus('not_found');
        setTimeout(() => setSyncStatus(null), 4000);
      }
    } catch (err) {
      console.error('Cloud Sync Fetch Error:', err);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
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

  // Dedicated manual practice stopwatch interval
  useEffect(() => {
    let stopwatchInterval = null;
    if (isManualTimerRunning) {
      stopwatchInterval = setInterval(() => {
        setManualPracticeSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (stopwatchInterval) clearInterval(stopwatchInterval);
    }
    return () => {
      if (stopwatchInterval) clearInterval(stopwatchInterval);
    };
  }, [isManualTimerRunning]);

  // Format seconds to HH:MM:SS or MM:SS helper
  const formatStopwatchTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleToggleManualTimer = () => {
    if (!isManualTimerRunning && manualPracticeSeconds === 0) {
      setManualTimerStartTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    setIsManualTimerRunning(prev => !prev);
    audioEngine.playUiSound('step');
  };

  const handleResetManualTimer = () => {
    setIsManualTimerRunning(false);
    setManualPracticeSeconds(0);
    setManualTimerStartTime(null);
    audioEngine.playUiSound('step');
  };

  const handleFinishManualSession = () => {
    setIsManualTimerRunning(false);
    // If we have at least 15 seconds, map it to minutes and open the log modal
    const elapsedMinutes = Math.max(1, Math.round(manualPracticeSeconds / 60));
    setPracticeSession(prev => ({
      ...prev,
      step1: { ...prev.step1, elapsedSeconds: Math.round(manualPracticeSeconds * 0.3) },
      step2: { ...prev.step2, elapsedSeconds: Math.round(manualPracticeSeconds * 0.4) },
      step3: { ...prev.step3, elapsedSeconds: Math.round(manualPracticeSeconds * 0.2) },
      step4: { ...prev.step4, elapsedSeconds: Math.round(manualPracticeSeconds * 0.1) }
    }));
    setIsLogModalOpen(true);
    audioEngine.playUiSound('step');
  };

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

  // Global Keyboard Shortcuts
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
          handleTabChange('daily');
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

  // Count-ins always use a straight quarter-note pulse. The configured count
  // is the exact number of quarter-note beats, independent of the exercise meter.
  const configureQuarterNoteCountIn = (beatCount) => {
    audioEngine.setTimeSignature({ beats: Math.max(1, Number(beatCount) || 1), noteValue: 4 });
    audioEngine.setSubdivision(SUBDIVISIONS[0]);
  };

  const startSpeedTraining = () => {
    const totalSteps = Math.max(1, Math.ceil((speedConfig.endBpm - speedConfig.startBpm) / speedConfig.bpmIncrement) + 1);
    const hasCountIn = speedConfig.countInEnabled && speedConfig.initialCountIn > 0;
    audioEngine.stop();
    if (hasCountIn) configureQuarterNoteCountIn(speedConfig.initialCountIn);
    else {
      audioEngine.setTimeSignature(speedConfig.timeSignature);
      audioEngine.setSubdivision(selectedSubdivision);
    }
    audioEngine.setBpm(speedConfig.startBpm);
    audioEngine.start();
    setIsPlaying(true);

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
    audioEngine.pause();
    setIsPlaying(false);
    setSpeedProgress(prev => ({ ...prev, isPaused: true }));
  };

  const resumeSpeedTraining = () => {
    audioEngine.setBpm(speedProgress.currentBpm);
    audioEngine.start();
    setIsPlaying(true);
    setSpeedProgress(prev => ({ ...prev, isPaused: false }));
  };

  const stopSpeedTraining = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setSpeedProgress(prev => ({ ...prev, isActive: false, isPaused: false, stage: 'idle' }));
  };

  const startRatiosTraining = () => {
    const hasCountIn = ratiosConfig.countInEnabled && ratiosConfig.initialCountIn > 0;
    audioEngine.stop();
    if (hasCountIn) configureQuarterNoteCountIn(ratiosConfig.initialCountIn);
    else {
      audioEngine.setTimeSignature({ beats: ratiosConfig.numberOfBeats, noteValue: 4 });
      audioEngine.setSubdivision(ratiosConfig.loop1);
    }
    audioEngine.setBpm(ratiosConfig.bpm);
    audioEngine.start();
    setIsPlaying(true);

    setRatiosProgress({
      activeLoop: 1,
      currentSubdivision: ratiosConfig.loop1,
      currentBeat: 1,
      countInRemaining: hasCountIn ? ratiosConfig.initialCountIn : 0,
      countInTotal: hasCountIn ? ratiosConfig.initialCountIn : 0,
      isCountIn: hasCountIn,
      isActive: true,
      isPaused: false
    });
  };

  const pauseRatiosTraining = () => {
    audioEngine.pause();
    setIsPlaying(false);
    setRatiosProgress(prev => ({ ...prev, isPaused: true }));
  };

  const resumeRatiosTraining = () => {
    audioEngine.setBpm(ratiosConfig.bpm);
    audioEngine.setSubdivision(ratiosProgress.currentSubdivision);
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

  useEffect(() => {
    audioEngine.onBeat = (beatNumber, isBarStart) => {
      const currentMode = activeTab === 'daily'
        ? (currentStepOpen === 1 ? step1SubTab : currentStepOpen === 2 ? step2SubTab : step3SubTab)
        : activeMetronomeMode;

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
              audioEngine.setTimeSignature(speedConfig.timeSignature);
              audioEngine.setSubdivision(selectedSubdivision);
              return s;
            }
          }

          const beatsPerBar = speedConfig.timeSignature?.beats || 4;

          if (s.currentBeat < beatsPerBar) {
            s.currentBeat += 1;
          } else {
            s.currentBeat = 1;

            if (s.currentBar < speedConfig.barsPerLoop) {
              s.currentBar += 1;
            } else {
              s.currentBar = 1;

              if (s.currentLoop < speedConfig.loopsBeforeIncrease) {
                s.currentLoop += 1;
              } else {
                s.currentLoop = 1;
                s.completedStages += 1;
                const nextStageBpm = s.currentBpm + speedConfig.bpmIncrement;

                if (s.currentBpm >= speedConfig.endBpm) {
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
                  s.currentBpm = Math.min(speedConfig.endBpm, nextStageBpm);
                  audioEngine.setBpm(s.currentBpm);
                  if (speedConfig.countInEnabled && speedConfig.speedIncreaseCountIn > 0) {
                    s.stage = 'increasing';
                    s.countInRemaining = speedConfig.speedIncreaseCountIn;
                    configureQuarterNoteCountIn(speedConfig.speedIncreaseCountIn);
                  }
                }
              }
            }
          }
          return s;
        });
      }

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
              audioEngine.setTimeSignature({ beats: ratiosConfig.numberOfBeats, noteValue: 4 });
              audioEngine.setSubdivision(ratiosConfig.loop1);
              return r;
            }
          }

          if (r.currentBeat < ratiosConfig.numberOfBeats) {
            r.currentBeat += 1;
          } else {
            if (ratiosConfig.subdivisionRatioEnabled) {
              const nextLoop = r.activeLoop === 1 ? 2 : 1;
              const nextSubdiv = nextLoop === 1 ? ratiosConfig.loop1 : ratiosConfig.loop2;

              if (r.activeLoop === 2 && ratiosConfig.countInEnabled && ratiosConfig.repeatCountIn > 0) {
                r.isCountIn = true;
                r.countInRemaining = ratiosConfig.repeatCountIn;
                r.countInTotal = ratiosConfig.repeatCountIn;
                r.currentBeat = 1;
                r.activeLoop = 1;
                r.currentSubdivision = ratiosConfig.loop1;
                configureQuarterNoteCountIn(ratiosConfig.repeatCountIn);
                return r;
              }

              r.activeLoop = nextLoop;
              r.currentSubdivision = nextSubdiv;
              r.currentBeat = 1;
              audioEngine.setSubdivision(nextSubdiv);
            } else {
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

  // Visualizer loop
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

    // Auto-save & Auto-sync to Cloud
    const updatedExList = [created, ...exercises];
    try {
      localStorage.setItem(`gps_exercises_${activeUserId}`, JSON.stringify(updatedExList));
    } catch {}
    syncToCloud({
      userId: activeUserId,
      profileName: userProfiles[activeUserId]?.name,
      historySessions,
      exercises: updatedExList,
      practicedCalendarDays,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteExercise = (id) => {
    setExercises(prev => {
      const updated = prev.filter(ex => ex.id !== id);
      try {
        localStorage.setItem(`gps_exercises_${activeUserId}`, JSON.stringify(updated));
      } catch {}
      // Auto-sync deletion to Cloud
      syncToCloud({
        userId: activeUserId,
        profileName: userProfiles[activeUserId]?.name,
        historySessions,
        exercises: updated,
        practicedCalendarDays,
        updatedAt: new Date().toISOString()
      });
      return updated;
    });
  };

  const handleDeleteSession = (sessionId) => {
    setHistorySessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      try {
        localStorage.setItem(`gps_history_${activeUserId}`, JSON.stringify(updated));
      } catch {}
      // Auto-sync session deletion to Cloud
      syncToCloud({
        userId: activeUserId,
        profileName: userProfiles[activeUserId]?.name,
        historySessions: updated,
        exercises,
        practicedCalendarDays,
        updatedAt: new Date().toISOString()
      });
      return updated;
    });
  };

  const loadExerciseIntoRoutine = (ex) => {
    const comfortTempo = Math.round(ex.currentBpm * 0.75);
    const edgeTempo = ex.currentBpm;
    const burstTempo = Math.min(320, ex.currentBpm + 15);

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

    handleTabChange('daily');
    setCurrentStepOpen(1);
    updateStepBpm(1, comfortTempo);
  };

  const handleSaveSession = () => {
    const calcMinutes = (sec, planMins) => (sec > 30 ? Math.ceil(sec / 60) : planMins);
    const s1Elapsed = calcMinutes(practiceSession.step1.elapsedSeconds, practiceSession.step1.durationMinutes);
    const s2Elapsed = calcMinutes(practiceSession.step2.elapsedSeconds, practiceSession.step2.durationMinutes);
    const s3Elapsed = calcMinutes(practiceSession.step3.elapsedSeconds, practiceSession.step3.durationMinutes);
    const s4Elapsed = calcMinutes(practiceSession.step4.elapsedSeconds, practiceSession.step4.durationMinutes);
    const totalDuration = s1Elapsed + s2Elapsed + s3Elapsed + s4Elapsed;

    const todayStr = new Date().toISOString().split('T')[0];
    const exerciseName = practiceSession.selectedExerciseName || 'Custom / Free Practice Routine';
    const exerciseCategory = practiceSession.selectedCategory || 'Technique';

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

    // 6. Automatically Broadcast to Cloud for this specific user's sync key
    syncToCloud({
      userId: activeUserId,
      profileName: userProfiles[activeUserId]?.name,
      historySessions: updatedHistory,
      exercises: updatedExercises,
      practicedCalendarDays: updatedCalendar,
      updatedAt: new Date().toISOString()
    });

    setIsLogModalOpen(false);
    handleTabChange('progress');
  };

  const toggleCalendarDate = (dateStr) => {
    setPracticedCalendarDays(prev => {
      const updated = prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr];
      try {
        localStorage.setItem(`gps_practiced_dates_${activeUserId}`, JSON.stringify(updated));
      } catch {}
      // Auto-sync calendar update to cloud
      syncToCloud({
        userId: activeUserId,
        profileName: userProfiles[activeUserId]?.name,
        historySessions,
        exercises,
        practicedCalendarDays: updated,
        updatedAt: new Date().toISOString()
      });
      return updated;
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch {
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

  const renderDotVisualiser = (subdiv = selectedSubdivision, currentBpm = bpm, customBeatsCount = null) => {
    const beatsCount = customBeatsCount || timeSignature.beats || 4;
    const dotsCount = subdiv?.dotsPerBeat || 1;
    return (
      <div className="w-full max-w-4xl mx-auto my-5 select-none px-1">
        <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap" aria-label="Beat subdivision visualizer">
          {Array.from({ length: beatsCount }).map((_, beatIdx) => {
            const beatNumber = beatIdx + 1;
            const activeBeat = isPlaying && activeDotInfo.beatNumber === beatNumber;
            return (
              <div key={beatIdx} className="flex flex-col items-center gap-3 min-w-0">
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-8">
                  {Array.from({ length: dotsCount }).map((__, dotIdx) => {
                    const active = activeBeat && activeDotInfo.activeDotIndex === dotIdx;
                    return <span key={dotIdx} className="block rounded-full transition-all duration-75" style={{ width: dotsCount > 4 ? 8 : 12, height: dotsCount > 4 ? 8 : 12, background: active ? (beatIdx === 0 ? currentTheme.secondary : currentTheme.primary) : '#30303D', transform: active ? 'scale(1.45)' : 'scale(1)', boxShadow: active ? `0 0 14px ${beatIdx === 0 ? currentTheme.secondary : currentTheme.primary}` : 'none' }} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderNumberSetting = (label, value, min, max, step, onChange) => (
    <div className="rounded-xl bg-[#101016] border border-white/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3"><label className="text-xs font-semibold text-[#B8B8C5]">{label}</label><div className="flex items-center gap-2"><button type="button" onClick={() => onChange(Math.max(min, Number(value) - step))} className="w-7 h-7 rounded-lg bg-[#242431] text-white">−</button><span className="min-w-9 text-center font-gx-num font-bold text-white">{value}</span><button type="button" onClick={() => onChange(Math.min(max, Number(value) + step))} className="w-7 h-7 rounded-lg bg-[#242431] text-white">+</button></div></div>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full cursor-pointer" style={{ accentColor: currentTheme.primary }} />
    </div>
  );

  // ==========================================================================
  // RENDER: STEP METRONOME SUITE (Standard, Speed, and Ratios in Steps 1, 2, 3)
  // ==========================================================================
  const renderStepMetronomeSuite = (stepNumber, currentStepBpm, activeSubTab, setActiveSubTab, accentColor) => {
    const stepKey = `step${stepNumber}`;
    const stepSubdiv = practiceSession[stepKey]?.subdivision || SUBDIVISIONS[0];
    const isSettingsOpen = stepNumber === 1 ? step1SettingsOpen : stepNumber === 2 ? step2SettingsOpen : step3SettingsOpen;
    const setSettingsOpen = stepNumber === 1 ? setStep1SettingsOpen : stepNumber === 2 ? setStep2SettingsOpen : setStep3SettingsOpen;

    return (
      <div className="space-y-3 pt-2 w-full">
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

        {activeSubTab === 'standard' && (
          <div className="bg-[#15151D] border border-white/5 rounded-2xl p-3 sm:p-5 lg:p-6 shadow-xl relative overflow-hidden w-full">
            <div
              className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-32 rounded-full pointer-events-none blur-3xl opacity-20"
              style={{ backgroundColor: currentTheme.primary }}
            />

            <div className="flex flex-col items-center justify-center pt-1 pb-1 relative z-10">
              <div className="text-6xl sm:text-8xl lg:text-9xl font-black font-gx-num tracking-tight text-white leading-none">
                {currentStepBpm}
              </div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#92929F] font-bold font-gx-display mt-1">
                Beats Per Minute
              </div>
            </div>

            {renderDotVisualiser(stepSubdiv, currentStepBpm)}

            <div className="flex flex-col items-center justify-center pt-1 sm:pt-2 relative z-10 w-full">
              <div className="flex items-center gap-1.5 sm:gap-2.5 w-full justify-center max-w-md">
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
                    color: '#FFFFFF',
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

              <div className="w-full max-w-md mt-3.5 sm:mt-4 flex items-center gap-3">
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

        {activeSubTab === 'speed' && (
          <div className="bg-[#15151D] border border-white/5 rounded-2xl p-3 sm:p-5 lg:p-6 shadow-xl space-y-3 w-full">
            <div className="flex flex-col items-center justify-center pt-1 pb-1">
              <div className="text-6xl sm:text-8xl lg:text-9xl font-black font-gx-num tracking-tight text-white leading-none">
                {speedProgress.isActive ? speedProgress.currentBpm : speedConfig.startBpm}
              </div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#92929F] font-bold font-gx-display mt-1">
                Beats Per Minute
              </div>
            </div>

            {renderDotVisualiser(
              stepSubdiv,
              speedProgress.isActive ? speedProgress.currentBpm : speedConfig.startBpm,
              speedConfig.timeSignature.beats
            )}

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
          </div>
        )}

        {activeSubTab === 'ratios' && (
          <div className="bg-[#15151D] border border-white/5 rounded-2xl p-3 sm:p-5 lg:p-6 shadow-xl space-y-3 w-full">
            <div className="flex flex-col items-center justify-center pt-1 pb-1">
              <div className="text-6xl sm:text-8xl lg:text-9xl font-black font-gx-num tracking-tight text-white leading-none">
                {ratiosConfig.bpm}
              </div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#92929F] font-bold font-gx-display mt-1">
                Beats Per Minute
              </div>
            </div>

            {renderDotVisualiser(
              ratiosProgress.isActive ? ratiosProgress.currentSubdivision : ratiosConfig.loop1,
              ratiosConfig.bpm,
              ratiosConfig.numberOfBeats
            )}

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

            <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 w-full max-w-md mx-auto">
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
          </div>
        )}
      </div>
    );
  };

  // ==========================================================================
  // MANDATORY ENTRY SCREEN: PROFILE GATEWAY & PIN AUTHENTICATION LOCK
  // ==========================================================================
  if (!isAuthenticated) {
    return (
      <div
        className="w-full min-h-[100dvh] text-[#FFFFFF] flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8 relative overflow-hidden font-gx-body antialiased select-none"
        style={{
          backgroundColor: '#08080C',
          backgroundImage: `
            radial-gradient(circle at 50% 30%, ${currentTheme.glow} 0%, transparent 70%),
            radial-gradient(circle at 80% 80%, ${currentTheme.glowSubtle} 0%, transparent 60%),
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 32px 32px, 32px 32px'
        }}
      >
        <style>{FONT_STYLES}</style>

        {/* Ambient Top Glow Banner */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[550px] sm:w-[700px] h-64 rounded-full pointer-events-none blur-3xl opacity-30"
          style={{ backgroundColor: currentTheme.primary }}
        />

        <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in-95 duration-300">
          {/* Studio Brand Header */}
          <div className="text-center mb-5 sm:mb-7">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-2xl transition-transform hover:scale-105"
              style={{
                backgroundColor: currentTheme.primary,
                boxShadow: `0 0 30px ${currentTheme.glow}`
              }}
            >
              <Music className="w-7 h-7 sm:w-8 sm:h-8 text-white stroke-[2.2]" />
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white font-gx-display uppercase">
              Wannabe Guitarist's Studio
            </h1>
            <p className="text-xs sm:text-sm text-[#92929F] mt-1 font-gx-display flex items-center justify-center gap-1.5 font-semibold">
              <Lock className="w-3.5 h-3.5 text-[#10B981]" />
              Secure Profile Gateway &bull; Opera GX Audio Engine
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-[#15151D]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-7 lg:p-8 shadow-2xl relative overflow-hidden w-full">
            <div className="text-center mb-5">
              <span className="text-[10px] sm:text-xs font-mono font-bold tracking-widest uppercase text-[#92929F] block mb-1">
                STEP 1: SELECT YOUR PROFILE
              </span>
              <p className="text-xs text-[#92929F]">
                Pick your private workspace to load your personal tempos, routines, and video history.
              </p>
            </div>

            {/* Profile Selection Grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {Object.keys(userProfiles).map(uid => {
                const prof = userProfiles[uid];
                const isSelected = selectedLoginUser === uid;
                const isUserAdmin = uid === 'user1';

                return (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => {
                      setSelectedLoginUser(uid);
                      setLoginErrorMessage('');
                      setLoginPinInput('');
                      audioEngine.playUiSound('step');
                    }}
                    className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1B1B25] border-white/40 shadow-xl'
                        : 'bg-[#101016]/90 border-white/5 opacity-80 hover:opacity-100 hover:border-white/15'
                    }`}
                    style={{
                      borderColor: isSelected ? currentTheme.primary : undefined,
                      boxShadow: isSelected ? `0 0 20px ${currentTheme.glowSubtle}` : 'none'
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold text-xs"
                        style={{
                          backgroundColor: isUserAdmin ? currentTheme.accentBg : '#3B82F625',
                          color: isUserAdmin ? currentTheme.primary : '#3B82F6'
                        }}
                      >
                        {isUserAdmin ? 'P1' : 'P2'}
                      </div>
                      {prof.pin ? (
                        <Lock className="w-3.5 h-3.5 text-[#10B981]" title="PIN Secured" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 text-[#92929F]" title="Open Access" />
                      )}
                    </div>

                    <div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider block" style={{ color: isUserAdmin ? currentTheme.primary : '#92929F' }}>
                        {isUserAdmin ? '★ MASTER ADMIN' : 'GUITARIST'}
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-white font-mono truncate">
                        {prof.name}
                      </h3>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Credential PIN Input Form */}
            {selectedLoginUser && (
              <form onSubmit={handleGatewayLogin} className="space-y-4 pt-3 border-t border-white/5 animate-in fade-in duration-200">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase font-mono tracking-wider text-[#92929F]">
                      {userProfiles[selectedLoginUser]?.pin ? 'Enter Access PIN' : 'Passwordless Profile'}
                    </label>
                    <span className="text-[10px] text-[#92929F] font-mono">
                      Target: <strong className="text-white">{userProfiles[selectedLoginUser]?.name}</strong>
                    </span>
                  </div>

                  {userProfiles[selectedLoginUser]?.pin ? (
                    <div className="relative">
                      <input
                        type="password"
                        autoFocus
                        maxLength={6}
                        placeholder="••••"
                        value={loginPinInput}
                        onChange={(e) => setLoginPinInput(e.target.value)}
                        className="w-full bg-[#101016] border border-white/10 rounded-2xl py-3 sm:py-3.5 text-center text-xl sm:text-2xl tracking-[0.4em] font-mono text-white focus:outline-none transition-all shadow-inner"
                        style={{
                          borderColor: loginErrorMessage ? '#EF4444' : currentTheme.borderActive
                        }}
                      />
                      <KeyRound className="w-4 h-4 text-[#92929F] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  ) : (
                    <div className="bg-[#101016] p-3 rounded-2xl border border-white/5 text-center text-xs text-[#10B981] font-mono">
                      ✓ No PIN required for this profile. Click Enter Studio below.
                    </div>
                  )}
                </div>

                {loginErrorMessage && (
                  <div className="bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-xs py-2 px-3 rounded-xl font-mono font-bold text-center flex items-center justify-center gap-1.5 animate-bounce">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>{loginErrorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 sm:py-4 rounded-2xl text-white font-extrabold text-xs sm:text-sm font-gx-display tracking-wider uppercase transition-all active:scale-95 flex items-center justify-center gap-2 shadow-2xl"
                  style={{
                    backgroundColor: currentTheme.primary,
                    boxShadow: `0 0 25px ${currentTheme.glow}`
                  }}
                >
                  <Unlock className="w-4 h-4 stroke-[2.5]" />
                  Enter Guitarist's Studio
                </button>
              </form>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 mt-5">
            <span className="text-[10px] uppercase font-bold text-[#92929F] font-mono mr-1">Theme:</span>
            {Object.values(GX_THEMES).map(t => (
              <button
                key={t.id}
                onClick={() => changeTheme(t.id)}
                className="w-5 h-5 rounded-full transition-transform hover:scale-125"
                style={{
                  backgroundColor: t.primary,
                  boxShadow: currentThemeKey === t.id ? `0 0 10px ${t.primary}` : 'none',
                  border: currentThemeKey === t.id ? '2px solid #FFFFFF' : 'none'
                }}
                title={t.name}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-[100dvh] text-[#FFFFFF] flex flex-col font-gx-body antialiased selection:bg-[#FA1E4E]/30 selection:text-white pb-20 md:pb-6 relative overflow-x-hidden"
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

      {/* Top Header / Sticky Nav */}
      <header className="sticky top-0 z-50 bg-[#101016]/95 backdrop-blur-md border-b border-white/5 px-3 sm:px-6 lg:px-10 py-2 sm:py-3 flex items-center justify-between shadow-2xl w-full">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105"
            style={{
              backgroundColor: currentTheme.primary,
              boxShadow: `0 0 16px ${currentTheme.glow}`
            }}
          >
            <Music className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-base lg:text-lg font-extrabold tracking-tight text-white leading-tight font-gx-display">
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
                onClick={() => handleTabChange(tab.id)}
                className="flex items-center gap-2 px-3 lg:px-4 py-1.5 rounded-lg text-xs lg:text-sm font-semibold font-gx-display transition-all relative overflow-hidden"
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
                <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Profile Switcher, Sync & GX Themes */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Header Practice Stopwatch Widget */}
          <div className="hidden xl:flex items-center gap-2 bg-[#15151D] border border-white/10 px-2.5 py-1 rounded-xl">
            <Timer className={`w-3.5 h-3.5 ${isManualTimerRunning ? 'text-[#10B981] animate-pulse' : 'text-[#92929F]'}`} />
            <span className="font-mono font-bold text-xs text-white tracking-wider">
              {formatStopwatchTime(manualPracticeSeconds)}
            </span>
            <button
              onClick={handleToggleManualTimer}
              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded transition-all"
              style={{
                backgroundColor: isManualTimerRunning ? '#EF4444' : '#10B981',
                color: '#FFFFFF'
              }}
            >
              {isManualTimerRunning ? 'PAUSE' : 'START'}
            </button>
            {manualPracticeSeconds > 0 && !isManualTimerRunning && (
              <button
                onClick={handleFinishManualSession}
                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded text-white"
                style={{ backgroundColor: currentTheme.primary }}
              >
                LOG
              </button>
            )}
          </div>

          {/* User Profile Switcher Button */}
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

          {/* Quick Lock / Sign Out Button */}
          <button
            onClick={handleLockStudio}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#15151D] border border-white/10 hover:border-[#EF4444]/40 hover:text-[#EF4444] text-[#92929F] flex items-center gap-1.5 transition-all text-xs"
            title="Lock Studio (Sign Out)"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px] font-gx-display font-bold">Lock</span>
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
              <span className="hidden lg:inline text-[11px] font-gx-display font-bold">{currentTheme.name}</span>
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
            className="px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border font-gx-num"
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

      {/* Main Content Area: Responsive Fluid Container spanning Full Viewport */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-10 py-3 sm:py-5 relative z-10 flex flex-col">
        {/* MODULE 1: DAILY PRACTICE DASHBOARD */}
        {activeTab === 'daily' && (
          <div className="space-y-3 sm:space-y-5 w-full flex-1">
            {/* MANUAL PRACTICE SESSION STOPWATCH BANNER */}
            <div className="bg-[#15151D] border border-white/5 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3 relative overflow-hidden">
              <div
                className="absolute -top-12 -left-12 w-36 h-36 rounded-full pointer-events-none blur-2xl opacity-15"
                style={{ backgroundColor: currentTheme.primary }}
              />

              <div className="flex items-center gap-3 w-full md:w-auto relative z-10">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: isManualTimerRunning ? '#10B98125' : currentTheme.accentBg,
                    color: isManualTimerRunning ? '#10B981' : currentTheme.primary
                  }}
                >
                  <Timer className={`w-5 h-5 ${isManualTimerRunning ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-[#92929F] tracking-widest font-mono">
                      Manual Practice Session Tracker
                    </span>
                    {isManualTimerRunning && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#10B981]/20 text-[#10B981] animate-pulse">
                        LIVE RECORDING
                      </span>
                    )}
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-wider">
                    {formatStopwatchTime(manualPracticeSeconds)}
                    <span className="text-xs font-normal text-[#92929F] ml-2">
                      ({Math.floor(manualPracticeSeconds / 3600)}h {Math.floor((manualPracticeSeconds % 3600) / 60)}m elapsed)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end relative z-10">
                <button
                  onClick={handleToggleManualTimer}
                  className="flex-1 md:flex-none px-4 py-2 sm:py-2.5 rounded-xl font-bold font-mono text-xs sm:text-sm text-white flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg"
                  style={{
                    backgroundColor: isManualTimerRunning ? '#EF4444' : '#10B981',
                    boxShadow: isManualTimerRunning ? '0 0 15px rgba(239,68,68,0.4)' : '0 0 15px rgba(16,185,129,0.4)'
                  }}
                >
                  {isManualTimerRunning ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      PAUSE SESSION
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      {manualPracticeSeconds > 0 ? 'RESUME SESSION' : 'START SESSION'}
                    </>
                  )}
                </button>

                {manualPracticeSeconds > 0 && (
                  <>
                    <button
                      onClick={handleFinishManualSession}
                      className="flex-1 md:flex-none px-4 py-2 sm:py-2.5 rounded-xl text-white font-bold font-mono text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      style={{
                        backgroundColor: currentTheme.primary,
                        boxShadow: `0 0 15px ${currentTheme.glow}`
                      }}
                      title="Log this session duration to your history"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      END & LOG
                    </button>

                    <button
                      onClick={handleResetManualTimer}
                      className="p-2 sm:p-2.5 rounded-xl bg-[#1B1B25] text-[#92929F] hover:text-white border border-white/5 transition-all"
                      title="Reset stopwatch to zero"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1">
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <Activity className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: currentTheme.primary }} />
                  Daily Practice Routine
                </h2>
                <p className="text-xs sm:text-sm text-[#92929F]">4-Step Mastery Pipeline &bull; Audio engine synchronized</p>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#15151D] border border-white/5 px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm shadow-lg">
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

            <div className="bg-[#15151D] border border-white/5 p-3.5 sm:p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl w-full">
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
                  <div className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                    <span>{practiceSession.selectedExerciseName || 'Custom / Free Routine'}</span>
                    <span
                      className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold"
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

              <div className="flex items-center gap-2 w-full md:w-auto">
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
                  className="bg-[#101016] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none font-mono w-full md:w-auto"
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

            {/* STEP 1 */}
            <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-5 lg:p-6 shadow-xl transition-all w-full">
              <div
                onClick={() => setCurrentStepOpen(currentStepOpen === 1 ? 0 : 1)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#10B981]/15 text-[#10B981] font-mono font-bold text-xs sm:text-sm flex items-center justify-center border border-[#10B981]/30">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white font-mono flex items-center gap-2">
                      Step 1: Comfort Zone Warmup
                      {practiceSession.step1.isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                      )}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-[#92929F]">Play at ~75% of your clean speed. Focus on tension release and synchronization.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-mono font-bold text-[#10B981]">{practiceSession.step1.bpm} BPM</span>
                  {currentStepOpen === 1 ? <ChevronUp className="w-4 h-4 text-[#92929F]" /> : <ChevronDown className="w-4 h-4 text-[#92929F]" />}
                </div>
              </div>

              {currentStepOpen === 1 && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 bg-[#101016] p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#10B981]" />
                      <span className="text-xs text-[#92929F]">Timer:</span>
                      <span className="font-mono font-bold text-sm sm:text-base text-white">
                        {Math.floor(practiceSession.step1.remainingSeconds / 60)}:
                        {String(practiceSession.step1.remainingSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 5, 7, 10, 15].map(mins => (
                        <button
                          key={mins}
                          onClick={() => handleTimerDurationChange('step1', mins)}
                          className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold border ${
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
                        className="px-3 py-1 rounded-lg text-xs sm:text-sm font-bold font-mono text-white ml-1"
                        style={{ backgroundColor: practiceSession.step1.isTimerRunning ? '#EF4444' : '#10B981' }}
                      >
                        {practiceSession.step1.isTimerRunning ? 'Pause' : 'Start Timer'}
                      </button>
                      <button
                        onClick={() => resetTimer('step1')}
                        className="p-1 sm:p-1.5 rounded-lg bg-[#1B1B25] text-[#92929F] hover:text-white"
                        title="Reset Timer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-xs uppercase font-semibold text-[#92929F] mb-1.5 block">Focus Areas</label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {INITIAL_FOCUS_STEP1.map(tag => {
                        const isSelected = practiceSession.step1.focusAreas.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleFocusArea('step1', tag)}
                            className={`px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-all ${
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

                  {renderStepMetronomeSuite(1, practiceSession.step1.bpm, step1SubTab, setStep1SubTab, '#10B981')}
                </div>
              )}
            </div>

            {/* STEP 2 */}
            <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-5 lg:p-6 shadow-xl transition-all w-full">
              <div
                onClick={() => setCurrentStepOpen(currentStepOpen === 2 ? 0 : 2)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#3B82F6]/15 text-[#3B82F6] font-mono font-bold text-xs sm:text-sm flex items-center justify-center border border-[#3B82F6]/30">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white font-mono flex items-center gap-2">
                      Step 2: Edge of Ability
                      {practiceSession.step2.isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-[#3B82F6]" />
                      )}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-[#92929F]">Your true clean maximum limit. Zero tension, exact synchronized pick attack.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-mono font-bold text-[#3B82F6]">{practiceSession.step2.bpm} BPM</span>
                  {currentStepOpen === 2 ? <ChevronUp className="w-4 h-4 text-[#92929F]" /> : <ChevronDown className="w-4 h-4 text-[#92929F]" />}
                </div>
              </div>

              {currentStepOpen === 2 && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 bg-[#101016] p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#3B82F6]" />
                      <span className="text-xs text-[#92929F]">Timer:</span>
                      <span className="font-mono font-bold text-sm sm:text-base text-white">
                        {Math.floor(practiceSession.step2.remainingSeconds / 60)}:
                        {String(practiceSession.step2.remainingSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 5, 7, 10, 15].map(mins => (
                        <button
                          key={mins}
                          onClick={() => handleTimerDurationChange('step2', mins)}
                          className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold border ${
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
                        className="px-3 py-1 rounded-lg text-xs sm:text-sm font-bold font-mono text-white ml-1"
                        style={{ backgroundColor: practiceSession.step2.isTimerRunning ? '#EF4444' : '#3B82F6' }}
                      >
                        {practiceSession.step2.isTimerRunning ? 'Pause' : 'Start Timer'}
                      </button>
                      <button
                        onClick={() => resetTimer('step2')}
                        className="p-1 sm:p-1.5 rounded-lg bg-[#1B1B25] text-[#92929F] hover:text-white"
                        title="Reset Timer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-xs uppercase font-semibold text-[#92929F] mb-1.5 block">Focus Areas</label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {INITIAL_FOCUS_STEP2.map(tag => {
                        const isSelected = practiceSession.step2.focusAreas.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleFocusArea('step2', tag)}
                            className={`px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-all ${
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

                  {renderStepMetronomeSuite(2, practiceSession.step2.bpm, step2SubTab, setStep2SubTab, '#3B82F6')}
                </div>
              )}
            </div>

            {/* STEP 3 */}
            <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-5 lg:p-6 shadow-xl transition-all w-full">
              <div
                onClick={() => setCurrentStepOpen(currentStepOpen === 3 ? 0 : 3)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#EF4444]/15 text-[#EF4444] font-mono font-bold text-xs sm:text-sm flex items-center justify-center border border-[#EF4444]/30">
                    3
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white font-mono flex items-center gap-2">
                      Step 3: Speed Bursts
                      {practiceSession.step3.isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-[#EF4444]" />
                      )}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-[#92929F]">Short explosive sprints (+10 to +20 BPM above edge) for 4 to 8 beats.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-mono font-bold text-[#EF4444]">{practiceSession.step3.bpm} BPM</span>
                  {currentStepOpen === 3 ? <ChevronUp className="w-4 h-4 text-[#92929F]" /> : <ChevronDown className="w-4 h-4 text-[#92929F]" />}
                </div>
              </div>

              {currentStepOpen === 3 && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 bg-[#101016] p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#EF4444]" />
                      <span className="text-xs text-[#92929F]">Timer:</span>
                      <span className="font-mono font-bold text-sm sm:text-base text-white">
                        {Math.floor(practiceSession.step3.remainingSeconds / 60)}:
                        {String(practiceSession.step3.remainingSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 5, 7, 10, 15].map(mins => (
                        <button
                          key={mins}
                          onClick={() => handleTimerDurationChange('step3', mins)}
                          className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold border ${
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
                        className="px-3 py-1 rounded-lg text-xs sm:text-sm font-bold font-mono text-white ml-1"
                        style={{ backgroundColor: practiceSession.step3.isTimerRunning ? '#F59E0B' : '#EF4444' }}
                      >
                        {practiceSession.step3.isTimerRunning ? 'Pause' : 'Start Timer'}
                      </button>
                      <button
                        onClick={() => resetTimer('step3')}
                        className="p-1 sm:p-1.5 rounded-lg bg-[#1B1B25] text-[#92929F] hover:text-white"
                        title="Reset Timer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#101016] p-3 rounded-xl border border-white/5 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#EF4444]" />
                      <span className="text-xs sm:text-sm text-white font-bold font-mono">Quick Speed Burst:</span>
                      {isBurstActive && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#EF4444]/20 text-[#EF4444] animate-pulse">
                          BURST ACTIVE ({burstCountRemaining} beats left)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerSpeedBurst(8)}
                        className="px-3 py-1.5 rounded-xl bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#EF4444] text-xs sm:text-sm font-mono font-bold hover:bg-[#EF4444]/30 active:scale-95 transition-all"
                      >
                        ⚡ 8-Beat Sprint
                      </button>
                      <button
                        onClick={() => triggerSpeedBurst(16)}
                        className="px-3 py-1.5 rounded-xl bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#EF4444] text-xs sm:text-sm font-mono font-bold hover:bg-[#EF4444]/30 active:scale-95 transition-all"
                      >
                        ⚡ 16-Beat Sprint
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-xs uppercase font-semibold text-[#92929F] mb-1.5 block">Focus Areas</label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {INITIAL_FOCUS_STEP3.map(tag => {
                        const isSelected = practiceSession.step3.focusAreas.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleFocusArea('step3', tag)}
                            className={`px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-all ${
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

                  {renderStepMetronomeSuite(3, practiceSession.step3.bpm, step3SubTab, setStep3SubTab, '#EF4444')}
                </div>
              )}
            </div>

            {/* STEP 4 */}
            <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-5 lg:p-6 shadow-xl transition-all w-full">
              <div
                onClick={() => setCurrentStepOpen(currentStepOpen === 4 ? 0 : 4)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#A855F7]/15 text-[#A855F7] font-mono font-bold text-xs sm:text-sm flex items-center justify-center border border-[#A855F7]/30">
                    4
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white font-mono flex items-center gap-2">
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 bg-[#101016] p-3 sm:p-4 rounded-xl border border-white/5 text-center">
                    <div>
                      <span className="text-[9px] sm:text-[10px] uppercase text-[#92929F]">Step 1 Comfort</span>
                      <div className="text-sm sm:text-base font-bold font-mono text-[#10B981]">{practiceSession.step1.bpm} BPM</div>
                    </div>
                    <div>
                      <span className="text-[9px] sm:text-[10px] uppercase text-[#92929F]">Step 2 Edge</span>
                      <div className="text-sm sm:text-base font-bold font-mono text-[#3B82F6]">{practiceSession.step2.bpm} BPM</div>
                    </div>
                    <div>
                      <span className="text-[9px] sm:text-[10px] uppercase text-[#92929F]">Step 3 Burst</span>
                      <div className="text-sm sm:text-base font-bold font-mono text-[#EF4444]">{practiceSession.step3.bpm} BPM</div>
                    </div>
                    <div>
                      <span className="text-[9px] sm:text-[10px] uppercase text-[#92929F]">Exercise</span>
                      <div className="text-xs sm:text-sm font-bold font-mono truncate" style={{ color: currentTheme.primary }}>
                        {practiceSession.selectedExerciseName || 'Routine'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsLogModalOpen(true)}
                      className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 font-mono"
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

        {/* MODULE 2: METRONOME TAB */}
        {activeTab === 'metronome' && (
          <div className="space-y-4 sm:space-y-6 w-full flex-1">
            <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <Clock className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: currentTheme.primary }} />
                  Master Studio Metronome
                </h2>
                <p className="text-xs sm:text-sm text-[#92929F]">Zero-drift Web Audio lookahead engine &bull; Dynamic subdivision visualizer</p>
              </div>

              <div className="flex items-center gap-1 bg-[#15151D] p-1 rounded-xl border border-white/5">
                {[
                  { id: 'standard', label: '♩ Metronome' },
                  { id: 'speed', label: '⚡ Speed Training' },
                  { id: 'ratios', label: '➗ Ratios Training' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (activeMetronomeMode !== m.id) {
                        stopAllMetronomes();
                        setActiveMetronomeMode(m.id);
                      }
                      audioEngine.playUiSound('step');
                    }}
                    className="px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all"
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

            {/* Standard Metronome */}
            {activeMetronomeMode === 'standard' && (
              <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-2xl relative overflow-hidden w-full">
                <div
                  className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 sm:w-[600px] h-48 rounded-full pointer-events-none blur-3xl opacity-20"
                  style={{ backgroundColor: currentTheme.primary }}
                />

                <div className="flex flex-col items-center justify-center pt-1 pb-1 relative z-10">
                  <div className="text-fluid-bpm font-black font-gx-num tracking-tight text-white mb-0.5 sm:mb-1 select-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
                    {bpm}
                  </div>
                  <div className="text-[10px] sm:text-xs uppercase tracking-widest text-[#92929F] font-bold font-gx-display mb-1">
                    Beats Per Minute
                  </div>
                </div>

                {renderDotVisualiser(selectedSubdivision, bpm)}

                <div className="flex flex-col items-center justify-center pt-2 sm:pt-4 relative z-10 w-full">
                  <div className="flex items-center gap-1.5 sm:gap-3 w-full max-w-lg justify-center">
                    <button
                      onClick={() => { const val = Math.max(30, bpm - 5); setBpm(val); audioEngine.setBpm(val); audioEngine.playUiSound('step'); }}
                      className="flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#1B1B25] border border-white/5 text-xs sm:text-sm font-bold font-gx-num text-white hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                    >
                      -5
                    </button>
                    <button
                      onClick={() => { const val = Math.max(30, bpm - 1); setBpm(val); audioEngine.setBpm(val); audioEngine.playUiSound('step'); }}
                      className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#1B1B25] border border-white/5 text-xs sm:text-sm font-bold font-gx-num text-white flex items-center justify-center hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => togglePlay(bpm, selectedSubdivision)}
                      className="flex-[2] sm:flex-none px-5 sm:px-10 py-2.5 sm:py-3.5 rounded-2xl text-xs sm:text-sm lg:text-base font-extrabold font-gx-display flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95"
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
                      className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#1B1B25] border border-white/5 text-xs sm:text-sm font-bold font-gx-num text-white flex items-center justify-center hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => { const val = Math.min(320, bpm + 5); setBpm(val); audioEngine.setBpm(val); audioEngine.playUiSound('step'); }}
                      className="flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#1B1B25] border border-white/5 text-xs sm:text-sm font-bold font-gx-num text-white hover:bg-[#252533] hover:border-white/10 active:scale-95 transition-all"
                    >
                      +5
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 flex-wrap">
                    {[60, 80, 100, 120, 140, 160].map(preset => (
                      <button
                        key={preset}
                        onClick={() => {
                          setBpm(preset);
                          audioEngine.setBpm(preset);
                          audioEngine.playUiSound('step');
                        }}
                        className={`px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-gx-num font-bold border transition-all ${
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

                  <div className="w-full max-w-xl mt-4 sm:mt-6 space-y-3 sm:space-y-4">
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
                          className="w-20 sm:w-24 h-1.5 bg-[#1B1B25] rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-white/5 relative z-10 w-full">
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

            {/* Speed Training */}
            {activeMetronomeMode === 'speed' && (
              <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-2xl space-y-5 w-full">
                {!speedProgress.isActive ? <>
                  <div className="text-center"><h3 className="text-lg font-bold text-white font-gx-display">Speed Training Setup</h3><p className="text-xs text-[#92929F] mt-1">Build speed gradually while keeping every note clean.</p></div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{TIME_SIGNATURES.map(ts => <button key={ts.id} onClick={() => setSpeedConfig(p => ({...p, timeSignature:ts}))} className="py-2 rounded-xl border text-sm font-bold" style={{background: speedConfig.timeSignature.id===ts.id?currentTheme.accentBg:'#101016',borderColor:speedConfig.timeSignature.id===ts.id?currentTheme.primary:'rgba(255,255,255,.07)',color:speedConfig.timeSignature.id===ts.id?currentTheme.primary:'#92929F'}}>{ts.label}</button>)}</div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {renderNumberSetting('Start BPM',speedConfig.startBpm,30,320,1,v=>setSpeedConfig(p=>({...p,startBpm:Math.min(v,p.endBpm)})))}
                    {renderNumberSetting('End BPM',speedConfig.endBpm,30,320,1,v=>setSpeedConfig(p=>({...p,endBpm:Math.max(v,p.startBpm)})))}
                    {renderNumberSetting('BPM Increment',speedConfig.bpmIncrement,1,20,1,v=>setSpeedConfig(p=>({...p,bpmIncrement:v})))}
                    {renderNumberSetting('Bars / Loop',speedConfig.barsPerLoop,1,32,1,v=>setSpeedConfig(p=>({...p,barsPerLoop:v})))}
                    {renderNumberSetting('Loops before increase',speedConfig.loopsBeforeIncrease,1,16,1,v=>setSpeedConfig(p=>({...p,loopsBeforeIncrease:v})))}
                  </div>
                  <div className="rounded-xl bg-[#101016] border border-white/5 p-3 space-y-3"><label className="flex items-center justify-between text-sm text-white font-semibold">Count In <button type="button" onClick={()=>setSpeedConfig(p=>({...p,countInEnabled:!p.countInEnabled}))} className="px-4 py-1.5 rounded-full text-xs font-bold" style={{background:speedConfig.countInEnabled?currentTheme.primary:'#30303D',color:'#fff'}}>{speedConfig.countInEnabled?'ON':'OFF'}</button></label>{speedConfig.countInEnabled&&<div className="grid sm:grid-cols-2 gap-3">{renderNumberSetting('Initial Count In',speedConfig.initialCountIn,0,16,1,v=>setSpeedConfig(p=>({...p,initialCountIn:v})))}{renderNumberSetting('Speed ↑ Count In',speedConfig.speedIncreaseCountIn,0,16,1,v=>setSpeedConfig(p=>({...p,speedIncreaseCountIn:v})))}</div>}</div>
                  <button onClick={startSpeedTraining} className="w-full py-4 rounded-xl text-white font-extrabold tracking-wide" style={{background:currentTheme.primary,boxShadow:`0 0 18px ${currentTheme.glow}`}}>▶ START TRAINING</button>
                </> : <>
                  <div className="text-center space-y-1"><div className="text-xs uppercase tracking-[.2em] font-bold" style={{color:currentTheme.primary}}>{speedProgress.stage==='countin'||speedProgress.stage==='increasing'?`↻ COUNT IN · ${speedProgress.countInRemaining}`:`LOOP ${speedProgress.currentLoop}/${speedConfig.loopsBeforeIncrease} · BAR ${speedProgress.currentBar}/${speedConfig.barsPerLoop}`}</div><div className="text-fluid-bpm font-black font-gx-num text-white" style={{color:currentTheme.primary}}>{speedProgress.currentBpm}</div><div className="text-[10px] uppercase tracking-widest text-[#92929F]">Beats per minute</div></div>
                  {renderDotVisualiser(
                    speedProgress.stage === 'countin' || speedProgress.stage === 'increasing' ? SUBDIVISIONS[0] : selectedSubdivision,
                    speedProgress.currentBpm,
                    speedProgress.stage === 'countin' ? speedConfig.initialCountIn : speedProgress.stage === 'increasing' ? speedConfig.speedIncreaseCountIn : speedConfig.timeSignature.beats
                  )}
                  <div className="flex items-center justify-between text-xs text-[#92929F]"><span>Target <b className="text-white">{speedConfig.endBpm} BPM</b></span><span>Stage {speedProgress.completedStages+1}/{speedProgress.totalStages}</span></div>
                  <div className="flex gap-2"><button onClick={speedProgress.isPaused?resumeSpeedTraining:pauseSpeedTraining} className="flex-1 py-3 rounded-xl text-white font-bold" style={{background:speedProgress.isPaused?'#159B69':'#3269C8'}}>{speedProgress.isPaused?'▶ RESUME':'Ⅱ PAUSE'}</button><button onClick={stopSpeedTraining} className="w-14 rounded-xl text-white bg-[#9F2636]">■</button></div>
                </>}
              </div>
            )}

            {/* Ratios Training */}
            {activeMetronomeMode === 'ratios' && (
              <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-2xl space-y-5 w-full">
                {!ratiosProgress.isActive ? <>
                  <div className="text-center"><h3 className="text-lg font-bold text-white font-gx-display">Ratios Training Setup</h3><p className="text-xs text-[#92929F] mt-1">Alternate rhythmic subdivisions without losing the pulse.</p></div>
                  <div className="grid sm:grid-cols-2 gap-3">{renderNumberSetting('BPM',ratiosConfig.bpm,30,320,1,v=>setRatiosConfig(p=>({...p,bpm:v})))}{renderNumberSetting('# of Beats',ratiosConfig.numberOfBeats,1,16,1,v=>setRatiosConfig(p=>({...p,numberOfBeats:v})))}</div>
                  <div className="rounded-xl bg-[#101016] border border-white/5 p-3 space-y-3"><label className="flex items-center justify-between text-sm text-white font-semibold">Count In <button type="button" onClick={()=>setRatiosConfig(p=>({...p,countInEnabled:!p.countInEnabled}))} className="px-4 py-1.5 rounded-full text-xs font-bold" style={{background:ratiosConfig.countInEnabled?currentTheme.primary:'#30303D',color:'#fff'}}>{ratiosConfig.countInEnabled?'ON':'OFF'}</button></label>{ratiosConfig.countInEnabled&&<div className="grid sm:grid-cols-2 gap-3">{renderNumberSetting('Initial Count In',ratiosConfig.initialCountIn,0,16,1,v=>setRatiosConfig(p=>({...p,initialCountIn:v})))}{renderNumberSetting('Repeat Count In',ratiosConfig.repeatCountIn,0,16,1,v=>setRatiosConfig(p=>({...p,repeatCountIn:v})))}</div>}</div>
                  <div className="rounded-xl bg-[#101016] border border-white/5 p-3 space-y-3"><label className="flex items-center justify-between text-sm text-white font-semibold">Subdivision Ratio <button type="button" onClick={()=>setRatiosConfig(p=>({...p,subdivisionRatioEnabled:!p.subdivisionRatioEnabled}))} className="px-4 py-1.5 rounded-full text-xs font-bold" style={{background:ratiosConfig.subdivisionRatioEnabled?currentTheme.primary:'#30303D',color:'#fff'}}>{ratiosConfig.subdivisionRatioEnabled?'ON':'OFF'}</button></label>{ratiosConfig.subdivisionRatioEnabled&&<div className="grid sm:grid-cols-2 gap-3">{[['Loop 1','loop1'],['Loop 2','loop2']].map(([label,key])=><label key={key} className="text-xs text-[#92929F] space-y-2">{label}<select value={ratiosConfig[key].id} onChange={e=>setRatiosConfig(p=>({...p,[key]:SUBDIVISIONS.find(x=>x.id===e.target.value)||p[key]}))} className="w-full p-3 rounded-lg bg-[#20202B] text-white border border-white/10">{SUBDIVISIONS.filter(x=>x.id!=='quarter').map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}</div>}</div>
                  <button onClick={startRatiosTraining} className="w-full py-4 rounded-xl text-white font-extrabold tracking-wide" style={{background:currentTheme.primary,boxShadow:`0 0 18px ${currentTheme.glow}`}}>▶ START TRAINING</button>
                </> : <>
                  <div className="text-center space-y-1"><div className="text-xs uppercase tracking-[.2em] font-bold" style={{color:currentTheme.primary}}>{ratiosProgress.isCountIn?`↻ COUNT IN ${ratiosProgress.countInRemaining}`:`BEAT ${ratiosProgress.currentBeat}/${ratiosConfig.numberOfBeats} · LOOP ${ratiosProgress.activeLoop}`}</div><div className="text-fluid-bpm font-black font-gx-num" style={{color:currentTheme.primary}}>{ratiosConfig.bpm}</div><div className="text-[10px] uppercase tracking-widest text-[#92929F]">{ratiosProgress.currentSubdivision.name}</div></div>
                  {renderDotVisualiser(
                    ratiosProgress.isCountIn ? SUBDIVISIONS[0] : ratiosProgress.currentSubdivision,
                    ratiosConfig.bpm,
                    ratiosProgress.isCountIn ? ratiosProgress.countInTotal : ratiosConfig.numberOfBeats
                  )}
                  <div className="flex gap-2"><button onClick={ratiosProgress.isPaused?resumeRatiosTraining:pauseRatiosTraining} className="flex-1 py-3 rounded-xl text-white font-bold" style={{background:ratiosProgress.isPaused?'#159B69':'#3269C8'}}>{ratiosProgress.isPaused?'▶ RESUME':'Ⅱ PAUSE'}</button><button onClick={stopRatiosTraining} className="w-14 rounded-xl text-white bg-[#9F2636]">■</button></div>
                </>}
              </div>
            )}
          </div>
        )}

        {/* MODULE 3: MY PROGRESS */}
        {activeTab === 'progress' && (
          <div className="space-y-4 sm:space-y-6 w-full flex-1">
            <div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                <BarChart2 className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: currentTheme.primary }} />
                My Guitar Progress & Analytics
              </h2>
              <p className="text-xs sm:text-sm text-[#92929F]">Velocity tracking, speed benchmarks & technique distribution.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 w-full">
              <div className="bg-[#15151D] border border-white/5 p-4 lg:p-5 rounded-2xl shadow-lg">
                <span className="text-[10px] sm:text-xs text-[#92929F] uppercase font-semibold">Total Practice Time</span>
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono text-white mt-1">
                  {historySessions.reduce((acc, s) => acc + (s.totalDurationMinutes || 0), 0)} <span className="text-xs text-[#92929F]">mins</span>
                </div>
                <div className="text-[10px] text-[#10B981] mt-0.5">Logged across {historySessions.length} routines</div>
              </div>

              <div className="bg-[#15151D] border border-white/5 p-4 lg:p-5 rounded-2xl shadow-lg">
                <span className="text-[10px] sm:text-xs text-[#92929F] uppercase font-semibold">Peak Clean Edge</span>
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono mt-1" style={{ color: currentTheme.primary }}>
                  {Math.max(...historySessions.map(s => s.edgeBpm || 0), 110)} <span className="text-xs text-[#92929F]">BPM</span>
                </div>
                <div className="text-[10px] text-[#92929F] mt-0.5">Highest verified clean tempo</div>
              </div>

              <div className="bg-[#15151D] border border-white/5 p-4 lg:p-5 rounded-2xl shadow-lg">
                <span className="text-[10px] sm:text-xs text-[#92929F] uppercase font-semibold">Active Streak</span>
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono text-[#F59E0B] mt-1 flex items-center gap-1">
                  <Flame className="w-5 h-5 lg:w-6 lg:h-6" />
                  {practicedCalendarDays.length} <span className="text-xs text-[#92929F]">Days</span>
                </div>
                <div className="text-[10px] text-[#92929F] mt-0.5">Consistent training days</div>
              </div>

              <div className="bg-[#15151D] border border-white/5 p-4 lg:p-5 rounded-2xl shadow-lg">
                <span className="text-[10px] sm:text-xs text-[#92929F] uppercase font-semibold">Exercises in Armory</span>
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono text-[#3B82F6] mt-1">
                  {exercises.length} <span className="text-xs text-[#92929F]">Active</span>
                </div>
                <div className="text-[10px] text-[#92929F] mt-0.5">Ready for daily cycles</div>
              </div>
            </div>

            <div className="bg-[#15151D] border border-white/5 p-4 sm:p-6 rounded-2xl shadow-xl space-y-3 w-full">
              <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white font-mono flex items-center gap-2">
                <Target className="w-4 h-4 lg:w-5 lg:h-5" style={{ color: currentTheme.primary }} />
                Target BPM Completion Gauges
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
                {exercises.map(ex => {
                  const range = (ex.targetBpm - ex.startBpm) || 1;
                  const current = (ex.currentBpm - ex.startBpm);
                  const pct = Math.min(100, Math.max(0, Math.round((current / range) * 100)));

                  return (
                    <div
                      key={ex.id}
                      onClick={() => setInspectedExerciseProgress(ex)}
                      className="bg-[#101016] border border-white/5 hover:border-white/15 p-3 sm:p-4 rounded-xl transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-white group-hover:text-white transition-colors truncate max-w-[180px]">
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
            <div className="bg-[#15151D] border border-white/5 p-4 sm:p-6 rounded-2xl shadow-xl w-full">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white font-mono flex items-center gap-2">
                    <Calendar className="w-4 h-4 lg:w-5 lg:h-5" style={{ color: currentTheme.primary }} />
                    Practice Consistency Calendar
                  </h3>
                  <span className="text-xs text-[#92929F] font-mono">Click any date to toggle completion status</span>
                </div>

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
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 text-center text-xs sm:text-sm font-mono w-full">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="text-[#92929F] py-1 font-bold text-[10px] sm:text-xs uppercase">{d}</div>
                    ))}

                    {Array.from({ length: firstDayIndex }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-9 sm:h-11 rounded-xl" />
                    ))}

                    {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
                      const isPracticed = practicedCalendarDays.includes(dateStr);

                      return (
                        <button
                          key={dateStr}
                          onClick={() => toggleCalendarDate(dateStr)}
                          className={`h-9 sm:h-11 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm transition-all ${
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

        {/* MODULE 4: EXERCISE LIBRARY */}
        {activeTab === 'library' && (
          <div className="space-y-4 sm:space-y-6 w-full flex-1">
            <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <BookOpen className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: currentTheme.primary }} />
                  Exercise Armory
                </h2>
                <p className="text-xs sm:text-sm text-[#92929F]">Manage and deploy your technical practice catalogue.</p>
              </div>

              <button
                onClick={() => setIsAddExerciseModalOpen(true)}
                className="px-4 py-2 sm:py-2.5 rounded-xl text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95 font-mono"
                style={{
                  backgroundColor: currentTheme.primary,
                  boxShadow: `0 0 15px ${currentTheme.glow}`
                }}
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                ADD NEW EXERCISE
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 w-full">
              {exercises.map(ex => (
                <div
                  key={ex.id}
                  className="bg-[#15151D] border border-white/5 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-white font-mono">{ex.name}</h4>
                      <span
                        className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full border font-mono font-bold mt-1 inline-block"
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
                      <div className="text-xs sm:text-sm font-bold text-white">{ex.startBpm} BPM</div>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#92929F] uppercase">Current</span>
                      <div className="text-xs sm:text-sm font-bold" style={{ color: currentTheme.primary }}>{ex.currentBpm} BPM</div>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#92929F] uppercase">Target</span>
                      <div className="text-xs sm:text-sm font-bold text-[#3B82F6]">{ex.targetBpm} BPM</div>
                    </div>
                  </div>

                  <button
                    onClick={() => loadExerciseIntoRoutine(ex)}
                    className="w-full py-2 sm:py-2.5 rounded-xl text-white font-bold text-xs sm:text-sm transition-all active:scale-95 font-mono flex items-center justify-center gap-1.5"
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

        {/* MODULE 5: PRACTICE HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4 sm:space-y-6 w-full flex-1">
            <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <Calendar className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: currentTheme.primary }} />
                  Practice History & Logs
                </h2>
                <p className="text-xs sm:text-sm text-[#92929F]">Daily summed practice hours, session details & tempo gains.</p>
              </div>

              <button
                onClick={exportHistoryJson}
                className="px-3.5 py-1.5 rounded-xl bg-[#15151D] border border-white/10 hover:border-white/20 text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 font-mono"
              >
                <Download className="w-3.5 h-3.5" />
                BACKUP JSON
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#15151D] p-2.5 sm:p-3 rounded-2xl border border-white/5 w-full">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by focus tag, note, or date..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="w-full bg-[#101016] border border-white/10 rounded-xl px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder-[#92929F] focus:outline-none"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto font-mono">
                <span className="text-[10px] sm:text-xs text-[#92929F] uppercase font-semibold">Sort:</span>
                <select
                  value={historySortOrder}
                  onChange={(e) => setHistorySortOrder(e.target.value)}
                  className="bg-[#101016] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm text-white focus:outline-none"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="fastest">Fastest Edge BPM</option>
                  <option value="longest">Longest Duration</option>
                </select>
              </div>
            </div>

            {/* Filtered & Grouped by Date Sessions List with Daily Sum Totals */}
            {(() => {
              const filtered = historySessions.filter(s => {
                if (!historySearchTerm.trim()) return true;
                const term = historySearchTerm.toLowerCase();
                const allFocus = [...(s.step1Focus || []), ...(s.step2Focus || []), ...(s.step3Focus || []), ...(s.step4Focus || [])].join(' ').toLowerCase();
                const notes = (s.notes || '').toLowerCase();
                const date = (s.date || '').toLowerCase();
                const exName = (s.exerciseName || '').toLowerCase();
                return allFocus.includes(term) || notes.includes(term) || date.includes(term) || exName.includes(term);
              });

              if (filtered.length === 0) {
                return (
                  <div className="bg-[#15151D] border border-white/5 rounded-2xl p-8 text-center w-full">
                    <BookOpen className="w-8 h-8 text-[#92929F] mx-auto mb-2 opacity-50" />
                    <h4 className="text-sm sm:text-base font-bold text-white mb-1 font-mono">No Practice Sessions Match</h4>
                    <p className="text-xs sm:text-sm text-[#92929F]">Try adjusting your search keywords or clear the filter.</p>
                  </div>
                );
              }

              // Group sessions strictly by date
              const groupedByDate = filtered.reduce((acc, session) => {
                const dateKey = session.date || 'Unspecified Date';
                if (!acc[dateKey]) {
                  acc[dateKey] = [];
                }
                acc[dateKey].push(session);
                return acc;
              }, {});

              // Sort the date groups according to selected sort order
              const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
                if (historySortOrder === 'oldest') return a.localeCompare(b);
                if (historySortOrder === 'fastest') {
                  const maxA = Math.max(...groupedByDate[a].map(s => s.edgeBpm || 0));
                  const maxB = Math.max(...groupedByDate[b].map(s => s.edgeBpm || 0));
                  return maxB - maxA;
                }
                if (historySortOrder === 'longest') {
                  const totalA = groupedByDate[a].reduce((sum, s) => sum + (s.totalDurationMinutes || 0), 0);
                  const totalB = groupedByDate[b].reduce((sum, s) => sum + (s.totalDurationMinutes || 0), 0);
                  return totalB - totalA;
                }
                // default 'newest'
                return b.localeCompare(a);
              });

              const formatTotalTime = (totalMins) => {
                const hours = Math.floor(totalMins / 60);
                const mins = totalMins % 60;
                if (hours > 0) {
                  return `${hours}h ${mins}m`;
                }
                return `${mins}m`;
              };

              return (
                <div className="space-y-6 w-full">
                  {sortedDates.map(dateKey => {
                    const daySessions = groupedByDate[dateKey];
                    const totalDayMinutes = daySessions.reduce((sum, s) => sum + (Number(s.totalDurationMinutes) || 0), 0);
                    const formattedDayTime = formatTotalTime(totalDayMinutes);

                    return (
                      <div key={dateKey} className="space-y-3 bg-[#101016]/80 p-3 sm:p-5 rounded-3xl border border-white/5">
                        {/* Daily Aggregated Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: currentTheme.accentBg, color: currentTheme.primary }}
                            >
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-bold text-white font-mono tracking-tight">
                                  {dateKey}
                                </h3>
                                <span className="text-[10px] font-mono text-[#92929F] px-2 py-0.5 rounded-full bg-[#15151D] border border-white/5">
                                  {daySessions.length} {daySessions.length === 1 ? 'session' : 'sessions'}
                                </span>
                              </div>
                              <span className="text-[11px] text-[#92929F] font-mono">Daily cumulative practice summary</span>
                            </div>
                          </div>

                          {/* Summed Total Time Badge prominently placed next to the date */}
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="text-xs uppercase font-mono font-bold text-[#92929F]">Total Day Time:</span>
                            <div
                              className="px-3 py-1 rounded-xl text-xs sm:text-sm font-mono font-black border flex items-center gap-1.5 shadow-lg"
                              style={{
                                backgroundColor: currentTheme.accentBg,
                                borderColor: currentTheme.borderActive,
                                color: currentTheme.primary,
                                boxShadow: `0 0 12px ${currentTheme.glowSubtle}`
                              }}
                            >
                              <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>{formattedDayTime}</span>
                              <span className="text-[10px] font-normal opacity-80">({totalDayMinutes} mins total)</span>
                            </div>
                          </div>
                        </div>

                        {/* Individual Sessions on that Date */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {daySessions.map(session => (
                            <div
                              key={session.id}
                              onClick={() => setInspectedSession(session)}
                              className="bg-[#15151D] border border-white/5 hover:border-white/20 rounded-2xl p-4 shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-2.5">
                                  <div className="truncate max-w-[200px] sm:max-w-xs">
                                    <span className="text-xs sm:text-sm font-bold text-white group-hover:text-white transition-colors font-mono truncate block">
                                      {session.exerciseName || 'Custom / Free Routine'}
                                    </span>
                                    {session.category && (
                                      <span className="text-[9px] font-mono font-bold text-[#92929F] uppercase tracking-wider block">
                                        {session.category}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full border border-[#10B981]/20 whitespace-nowrap">
                                      {session.totalDurationMinutes} mins
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

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#101016] p-2.5 rounded-xl border border-white/5 mb-2.5 text-center">
                                  <div>
                                    <span className="text-[9px] text-[#92929F] uppercase font-semibold">Comfort</span>
                                    <div className="text-xs font-bold font-mono text-[#10B981]">{session.comfortBpm} BPM</div>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-[#92929F] uppercase font-semibold">Clean Edge</span>
                                    <div className="text-xs font-bold font-mono text-[#3B82F6]">{session.edgeBpm} BPM</div>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-[#92929F] uppercase font-semibold">Speed Bursts</span>
                                    <div className="text-xs font-bold font-mono text-[#EF4444]">{session.burstBpm} BPM</div>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-[#92929F] uppercase font-semibold">Next Target</span>
                                    <div className="text-xs font-bold font-mono" style={{ color: currentTheme.primary }}>{session.targetBpm} BPM</div>
                                  </div>
                                </div>
                              </div>

                              {session.notes && (
                                <p className="text-[11px] text-[#92929F] italic line-clamp-1">&ldquo;{session.notes}&rdquo;</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* MODULE 6: MIRROR STUDIO */}
        {activeTab === 'mirror' && (
          <div className="space-y-4 sm:space-y-6 w-full flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <Camera className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: currentTheme.primary }} />
                  Mirror Studio HUD
                </h2>
                <p className="text-xs sm:text-sm text-[#92929F]">Visual posture inspection & MediaRecorder video technique review.</p>
              </div>

              <div className="flex items-center gap-2 bg-[#15151D] px-3.5 py-1.5 rounded-xl border border-white/5 text-xs sm:text-sm">
                <span className="text-[#92929F]">Target Exercise:</span>
                <span className="font-bold font-mono truncate max-w-[200px] sm:max-w-xs" style={{ color: currentTheme.primary }}>
                  {practiceSession.selectedExerciseName || 'Custom Routine'}
                </span>
              </div>
            </div>

            <div className="bg-[#15151D] border border-white/5 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl w-full">
              <div className="relative aspect-video max-w-4xl mx-auto bg-[#08080C] border border-white/10 rounded-2xl overflow-hidden flex items-center justify-center mb-4 sm:mb-5">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${!isCameraActive && 'hidden'}`}
                />

                {!isCameraActive && (
                  <div className="text-center p-4 sm:p-6">
                    <Camera className="w-10 h-10 sm:w-14 sm:h-14 text-[#92929F] mx-auto mb-2 sm:mb-3 opacity-60" />
                    <h4 className="text-xs sm:text-base font-bold text-white mb-1 font-mono">Camera Feed Inactive</h4>
                    <p className="text-[11px] sm:text-xs text-[#92929F] max-w-sm mb-3 sm:mb-4">
                      Inspect pick slanting, thumb anchors, and shoulder relaxation in real time.
                    </p>
                    <button
                      onClick={startCamera}
                      className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-white font-extrabold text-xs sm:text-sm shadow hover:brightness-110 active:scale-95 font-mono"
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
                      className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-[#EF4444] text-white font-bold text-xs sm:text-sm flex items-center gap-2 hover:brightness-110 active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.35)] font-mono"
                    >
                      <Video className="w-4 h-4" />
                      RECORD TAKE
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-[#EF4444] text-white font-bold text-xs sm:text-sm flex items-center gap-2 animate-pulse active:scale-95 font-mono"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      STOP & ATTACH TO LOG
                    </button>
                  )}

                  <button
                    onClick={stopCamera}
                    className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#1B1B25] border border-white/10 text-xs sm:text-sm font-semibold text-white hover:bg-[#252533] active:scale-95"
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0E0E14]/95 backdrop-blur-lg border-t border-white/10 px-2 py-2 safe-area-bottom flex items-center justify-around w-full">
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
              onClick={() => handleTabChange(item.id)}
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#15151D] border border-white/10 rounded-2xl p-4 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto pb-20 md:pb-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#92929F] tracking-widest font-mono block">
                  Exercise Progression History
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white font-mono flex items-center gap-2">
                  {inspectedExerciseProgress.name}
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full border font-mono font-bold"
                    style={{
                      backgroundColor: currentTheme.accentBg,
                      borderColor: currentTheme.borderActive,
                      color: currentTheme.primary
                    }}
                  >
                    {inspectedExerciseProgress.category}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setInspectedExerciseProgress(null)}
                className="text-[#92929F] hover:text-white text-lg p-1"
              >
                &times;
              </button>
            </div>

            {/* KPI Benchmarks */}
            <div className="grid grid-cols-4 gap-2 bg-[#101016] p-3 rounded-xl font-mono text-center text-xs border border-white/5">
              <div>
                <span className="text-[10px] text-[#92929F] uppercase block">Start</span>
                <div className="font-bold text-white sm:text-sm">{inspectedExerciseProgress.startBpm} BPM</div>
              </div>
              <div>
                <span className="text-[10px] text-[#92929F] uppercase block">Current Edge</span>
                <div className="font-bold sm:text-sm" style={{ color: currentTheme.primary }}>
                  {inspectedExerciseProgress.currentBpm} BPM
                </div>
              </div>
              <div>
                <span className="text-[10px] text-[#92929F] uppercase block">Goal</span>
                <div className="font-bold sm:text-sm text-[#3B82F6]">{inspectedExerciseProgress.targetBpm} BPM</div>
              </div>
              <div>
                <span className="text-[10px] text-[#92929F] uppercase block">Burst Record</span>
                <div className="font-bold sm:text-sm text-[#EF4444]">
                  {inspectedExerciseProgress.bestBurstBpm || inspectedExerciseProgress.currentBpm + 15} BPM
                </div>
              </div>
            </div>

            {/* Progress Bar Towards Goal */}
            {(() => {
              const range = (inspectedExerciseProgress.targetBpm - inspectedExerciseProgress.startBpm) || 1;
              const current = (inspectedExerciseProgress.currentBpm - inspectedExerciseProgress.startBpm);
              const pct = Math.min(100, Math.max(0, Math.round((current / range) * 100)));
              return (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#92929F]">Overall Goal Completion</span>
                    <span className="font-bold text-white">{pct}%</span>
                  </div>
                  <div className="w-full bg-[#101016] h-2.5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: currentTheme.primary }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Exercise-Specific Practice History Logs */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-white font-mono flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" style={{ color: currentTheme.primary }} />
                  Logged Sessions for this Exercise
                </span>
                <span className="text-[11px] font-mono text-[#92929F]">
                  {historySessions.filter(s =>
                    s.exerciseId === inspectedExerciseProgress.id ||
                    (s.exerciseName && s.exerciseName.toLowerCase() === inspectedExerciseProgress.name.toLowerCase())
                  ).length} Total Sessions
                </span>
              </div>

              {(() => {
                const exerciseLogs = historySessions.filter(s =>
                  s.exerciseId === inspectedExerciseProgress.id ||
                  (s.exerciseName && s.exerciseName.toLowerCase() === inspectedExerciseProgress.name.toLowerCase())
                ).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

                if (exerciseLogs.length === 0) {
                  return (
                    <div className="bg-[#101016] border border-white/5 rounded-xl p-5 text-center font-mono">
                      <p className="text-xs text-[#92929F] mb-1">No practice sessions logged specifically for this exercise yet.</p>
                      <p className="text-[11px] text-[#92929F]">Click below to load it into your daily routine and log your first milestone!</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {exerciseLogs.map(log => (
                      <div
                        key={log.id}
                        className="bg-[#101016] border border-white/5 hover:border-white/15 rounded-xl p-3 transition-all font-mono text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                          <span className="font-bold text-white">{log.date}</span>
                          <span className="text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full text-[10px] border border-[#10B981]/20">
                            {log.totalDurationMinutes} mins duration
                          </span>
                        </div>

                        {/* Tempo milestones for this session */}
                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] bg-[#15151D] p-2 rounded-lg">
                          <div>
                            <span className="text-[#92929F] block">Comfort</span>
                            <span className="font-bold text-[#10B981]">{log.comfortBpm} BPM</span>
                          </div>
                          <div>
                            <span className="text-[#92929F] block">Edge</span>
                            <span className="font-bold text-[#3B82F6]">{log.edgeBpm} BPM</span>
                          </div>
                          <div>
                            <span className="text-[#92929F] block">Burst</span>
                            <span className="font-bold text-[#EF4444]">{log.burstBpm} BPM</span>
                          </div>
                          <div>
                            <span className="text-[#92929F] block">Next Goal</span>
                            <span className="font-bold" style={{ color: currentTheme.primary }}>{log.targetBpm} BPM</span>
                          </div>
                        </div>

                        {/* Focus tags if available */}
                        {((log.step1Focus?.length || 0) + (log.step2Focus?.length || 0) + (log.step3Focus?.length || 0)) > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[9px] text-[#92929F] uppercase">Focus:</span>
                            {[...(log.step1Focus || []), ...(log.step2Focus || []), ...(log.step3Focus || [])].slice(0, 4).map((f, i) => (
                              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1B1B25] text-[#92929F] border border-white/5">
                                {f}
                              </span>
                            ))}
                          </div>
                        )}

                        {log.notes && (
                          <p className="text-[11px] text-[#92929F] italic line-clamp-2">
                            &ldquo;{log.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => setInspectedExerciseProgress(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1B1B25] text-xs font-bold text-[#92929F] hover:text-white"
              >
                Close
              </button>
              <button
                onClick={() => {
                  loadExerciseIntoRoutine(inspectedExerciseProgress);
                  setInspectedExerciseProgress(null);
                }}
                className="flex-[2] py-2.5 rounded-xl text-white font-bold text-xs font-mono flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                style={{
                  backgroundColor: currentTheme.primary,
                  boxShadow: `0 0 15px ${currentTheme.glow}`
                }}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                PRACTICE THIS EXERCISE NOW
              </button>
            </div>
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

      {/* LOG PRACTICE SESSION MODAL */}
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {Object.keys(userProfiles).map(uid => {
                const isSelected = activeUserId === uid;
                const prof = userProfiles[uid];
                const isUserAdmin = uid === 'user1';

                return (
                  <div
                    key={uid}
                    className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#1B1B25] border-white/20 shadow-lg'
                        : 'bg-[#101016] border-white/5 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono font-bold uppercase" style={{ color: isUserAdmin ? currentTheme.primary : '#92929F' }}>
                          {isUserAdmin ? '★ ADMIN' : 'USER'}
                        </span>
                        <div className="flex items-center gap-1">
                          {prof.pin ? (
                            <Lock className="w-3 h-3 text-[#10B981]" title="PIN Protected" />
                          ) : (
                            <Unlock className="w-3 h-3 text-[#92929F]" title="No PIN Set" />
                          )}
                          {activeUserId === 'user1' && !isUserAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdminDeleteProfile(uid);
                              }}
                              className="text-[#92929F] hover:text-[#EF4444] transition-colors p-0.5"
                              title="Delete Profile (Admin Only)"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white font-mono truncate">{prof.name}</h4>
                    </div>

                    <button
                      onClick={() => requestSwitchUser(uid)}
                      className="mt-2.5 w-full py-1 rounded-lg text-[11px] font-bold font-mono transition-all"
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

            {activeUserId === 'user1' && (
              <div className="bg-[#101016] p-3 rounded-xl border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono">
                    <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                    Master Admin Controls
                  </div>
                  <button
                    onClick={() => {
                      setIsAddingProfile(!isAddingProfile);
                      setAdminActionError('');
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1"
                    style={{
                      backgroundColor: isAddingProfile ? '#1B1B25' : currentTheme.primary,
                      color: '#FFFFFF'
                    }}
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    {isAddingProfile ? 'Cancel' : 'Add Profile'}
                  </button>
                </div>

                {isAddingProfile && (
                  <form onSubmit={handleAdminCreateProfile} className="space-y-2 pt-2 border-t border-white/5 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-[#92929F] block mb-1">New Member Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Guitarist 3 / Dave"
                          value={newProfileName}
                          onChange={(e) => setNewProfileName(e.target.value)}
                          className="w-full bg-[#1B1B25] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-[#92929F] block mb-1">Initial 4-Digit PIN</label>
                        <input
                          type="password"
                          required
                          maxLength={6}
                          placeholder="••••"
                          value={newProfilePin}
                          onChange={(e) => setNewProfilePin(e.target.value)}
                          className="w-full bg-[#1B1B25] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono tracking-widest text-center"
                        />
                      </div>
                    </div>

                    {adminActionError && (
                      <div className="text-[11px] text-[#EF4444] font-bold text-center">{adminActionError}</div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-1.5 rounded-lg text-white text-xs font-bold font-mono transition-all active:scale-95 shadow-md"
                      style={{ backgroundColor: currentTheme.primary }}
                    >
                      Authorize & Create Profile
                    </button>
                  </form>
                )}
              </div>
            )}

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

      {/* PIN ENTRY MODAL */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#15151D] border-2 border-white/20 rounded-2xl p-6 max-xs w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95">
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

      {/* CLOUD DEVICE SYNC MODAL */}
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
              Use this Sync Key to connect <strong>{userProfiles[activeUserId]?.name}</strong> between your PC and phone. Both devices will share the exact same practice logs, tempos, and calendar!
            </p>

            <div className="bg-[#101016] p-3 rounded-xl border border-white/10 space-y-2">
              <span className="text-[10px] text-[#92929F] uppercase font-bold block">
                {userProfiles[activeUserId]?.name}'s Sync Key
              </span>
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="e.g. shred-master-77"
                  value={userProfiles[activeUserId]?.syncKey || ''}
                  onChange={(e) => {
                    const keyVal = e.target.value.toLowerCase().replace(/\s+/g, '-');
                    const updated = {
                      ...userProfiles,
                      [activeUserId]: { ...userProfiles[activeUserId], syncKey: keyVal }
                    };
                    saveUserProfiles(updated);
                  }}
                  className="bg-[#1B1B25] border border-white/10 rounded-lg px-2.5 py-1.5 font-mono font-bold text-xs text-white focus:outline-none w-full"
                />
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(userProfiles[activeUserId]?.syncKey || '');
                    audioEngine.playUiSound('step');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#1B1B25] text-xs font-bold text-[#92929F] hover:text-white border border-white/5 whitespace-nowrap"
                >
                  Copy Key
                </button>
              </div>
            </div>

            {syncStatus === 'synced' && (
              <div className="bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] px-3 py-2 rounded-xl text-xs font-mono font-bold text-center animate-in fade-in">
                ✓ Cloud Synchronized Successfully!
              </div>
            )}
            {syncStatus === 'not_found' && (
              <div className="bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] px-3 py-2 rounded-xl text-xs font-mono font-bold text-center animate-in fade-in">
                ⚠ No cloud data found for this key yet. Click "Upload to Cloud" on your PC first!
              </div>
            )}
            {syncStatus === 'error' && (
              <div className="bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] px-3 py-2 rounded-xl text-xs font-mono font-bold text-center animate-in fade-in">
                ✕ Network error syncing. Please check your internet connection.
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => syncToCloud()}
                disabled={isSyncing}
                className="flex-1 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {isSyncing ? 'Uploading...' : 'Upload to Cloud'}
              </button>

              <button
                onClick={() => fetchCloudData()}
                disabled={isSyncing}
                className="flex-1 py-2.5 rounded-xl bg-[#1B1B25] border border-white/10 hover:border-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Fetching...' : 'Download to Phone'}
              </button>
            </div>

            <div className="pt-2 border-t border-white/5 text-[11px] text-[#92929F]">
              <strong className="text-white">How to connect PC $\leftrightarrow$ Phone in 3 steps:</strong>
              <ol className="list-decimal list-inside space-y-1 mt-1 text-[10px] sm:text-[11px]">
                <li>On your <strong>PC</strong>: Click <strong>Sync</strong> $\rightarrow$ click <strong>Upload to Cloud</strong>.</li>
                <li>Copy or type the exact same <strong>Sync Key</strong> on your phone.</li>
                <li>On your <strong>Phone</strong>: Tap <strong>Download to Phone</strong>.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
