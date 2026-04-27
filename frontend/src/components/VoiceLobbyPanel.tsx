import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Users, Radio, PhoneOff, X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { CollabMember, CollabProvider } from '../services/collabService';
import BorderGlow from './BorderGlow';
import DotField from './DotField';

interface VoiceLobbyPanelProps {
  isOpen: boolean;
  members: CollabMember[];
  selfPeerId: string;
  provider: CollabProvider | null;
  canUseVoice: boolean;
  onClose?: () => void;
}

const VoiceLobbyPanel: React.FC<VoiceLobbyPanelProps> = ({
  isOpen,
  members,
  selfPeerId,
  provider,
  canUseVoice,
  onClose,
}) => {
  const { isDark } = useTheme();

  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localInVoice, setLocalInVoice] = useState(false);
  const [localMuted, setLocalMuted] = useState(false);
  const [localDeafened, setLocalDeafened] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const inVoiceRef = useRef(false);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);

  const selfMember = useMemo(
    () => members.find((m) => m.peerId === selfPeerId) || null,
    [members, selfPeerId],
  );

  const voiceMembers = useMemo(
    () => members.filter((m) => Boolean(m.voice?.inVoice)),
    [members],
  );

  const stopAudioMonitoring = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    speakingRef.current = false;
    provider?.setSpeaking(false);
  }, [provider]);

  const startAudioMonitoring = useCallback((stream: MediaStream) => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.75;

    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const centered = (data[i] - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length);

      const shouldSpeak = inVoiceRef.current && !mutedRef.current && !deafenedRef.current && rms > 0.035;
      if (shouldSpeak !== speakingRef.current) {
        speakingRef.current = shouldSpeak;
        provider?.setSpeaking(shouldSpeak);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [provider]);

  const handleJoinVoice = useCallback(async () => {
    if (!provider || !canUseVoice || isJoining) return;

    setError(null);
    setIsJoining(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      provider.joinVoiceLobby();
      provider.setVoiceState({ muted: false, deafened: false });

      setLocalInVoice(true);
      setLocalMuted(false);
      setLocalDeafened(false);
      inVoiceRef.current = true;
      mutedRef.current = false;
      deafenedRef.current = false;

      startAudioMonitoring(stream);
    } catch (e) {
      setError('Microphone access denied or unavailable.');
    } finally {
      setIsJoining(false);
    }
  }, [provider, canUseVoice, isJoining, startAudioMonitoring]);

  const handleLeaveVoice = useCallback(() => {
    provider?.setSpeaking(false);
    provider?.leaveVoiceLobby();

    setLocalInVoice(false);
    setLocalMuted(false);
    setLocalDeafened(false);
    inVoiceRef.current = false;
    mutedRef.current = false;
    deafenedRef.current = false;

    stopAudioMonitoring();
  }, [provider, stopAudioMonitoring]);

  const handleToggleMute = useCallback(() => {
    if (!provider || !localInVoice) return;
    const nextMuted = !localMuted;

    setLocalMuted(nextMuted);
    mutedRef.current = nextMuted;

    if (nextMuted) {
      provider.setSpeaking(false);
      speakingRef.current = false;
    }

    provider.setVoiceState({ muted: nextMuted, deafened: localDeafened });
  }, [provider, localInVoice, localMuted, localDeafened]);

  const handleToggleDeafen = useCallback(() => {
    if (!provider || !localInVoice) return;
    const nextDeafened = !localDeafened;

    setLocalDeafened(nextDeafened);
    deafenedRef.current = nextDeafened;

    if (nextDeafened) {
      provider.setSpeaking(false);
      speakingRef.current = false;
    }

    provider.setVoiceState({ muted: localMuted, deafened: nextDeafened });
  }, [provider, localInVoice, localMuted, localDeafened]);

  useEffect(() => {
    const voice = selfMember?.voice;
    if (!voice) return;

    setLocalInVoice(Boolean(voice.inVoice));
    setLocalMuted(Boolean(voice.muted));
    setLocalDeafened(Boolean(voice.deafened));

    inVoiceRef.current = Boolean(voice.inVoice);
    mutedRef.current = Boolean(voice.muted);
    deafenedRef.current = Boolean(voice.deafened);

    if (!voice.inVoice && streamRef.current) {
      stopAudioMonitoring();
    }
  }, [selfMember, stopAudioMonitoring]);

  useEffect(() => {
    return () => {
      stopAudioMonitoring();
    };
  }, [stopAudioMonitoring]);

  if (!isOpen) return null;

  const panelBg = isDark ? 'bg-[#1E1E2A]' : 'bg-[#F0F2F6]';
  const borderColor = isDark ? 'border-slate-700/50' : 'border-slate-300/50';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <BorderGlow
      backgroundColor={isDark ? '#1E1E2A' : '#F0F2F6'}
      colors={['#CAA4F7', '#9B6DD7', '#38bdf8']}
      borderRadius={0}
      glowRadius={30}
      glowIntensity={0.8}
      glowColor="280 60 85"
      fillOpacity={0.2}
      className="h-full w-full no-panel-scroll"
    >
      <div className={`flex flex-col min-h-0 h-full w-full ${panelBg} relative overflow-hidden`}>
        <div className="absolute inset-0 z-0 opacity-70">
          <DotField
            dotRadius={2}
            dotSpacing={16}
            bulgeStrength={70}
            glowRadius={160}
            sparkle={true}
            waveAmplitude={0}
            gradientFrom={isDark ? 'rgba(202, 164, 247, 0.40)' : 'rgba(136, 57, 239, 0.30)'}
            gradientTo={isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(168, 85, 247, 0.20)'}
            glowColor={isDark ? '#1E1E2A' : '#F0F2F6'}
          />
        </div>

        <div className={`flex items-center justify-between px-4 py-3 border-b ${borderColor} shrink-0 relative z-10`}>
          <div className="flex items-center gap-2">
            <Radio size={15} className="text-[#CAA4F7]" />
            <h2 className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Voice Lobby</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className={`p-1.5 rounded-md ${textMuted} hover:text-red-500 hover:bg-red-500/10 transition-colors`}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden relative z-10">
          <div className="h-full overflow-y-auto scrollbar-hide p-3 space-y-3">
            <div className={`rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700/60 bg-[#232340]/70' : 'border-slate-300 bg-white/80'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users size={14} className={textMuted} />
                  <span className={`text-[12px] font-semibold ${textPrimary}`}>Connected: {voiceMembers.length}</span>
                </div>
                {!localInVoice ? (
                  <button
                    disabled={!canUseVoice || isJoining}
                    onClick={handleJoinVoice}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                      !canUseVoice || isJoining
                        ? 'opacity-50 cursor-not-allowed bg-slate-500/20 text-slate-400'
                        : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                    }`}
                  >
                    {isJoining ? 'Joining...' : 'Join Voice'}
                  </button>
                ) : (
                  <button
                    onClick={handleLeaveVoice}
                    className="px-3 py-1.5 rounded-md text-[11px] font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                  >
                    Leave
                  </button>
                )}
              </div>
              {!canUseVoice && (
                <p className={`text-[10px] mt-1.5 ${textMuted}`}>Voice is available only after the room is connected.</p>
              )}
              {error && <p className="text-[10px] mt-1.5 text-red-300">{error}</p>}
            </div>

            {localInVoice && (
              <div className={`rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700/60 bg-[#232340]/70' : 'border-slate-300 bg-white/80'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-semibold ${textMuted}`}>Your Controls</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleMute}
                      className={`p-2 rounded-md transition-colors ${
                        localMuted ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                      title={localMuted ? 'Unmute' : 'Mute'}
                    >
                      {localMuted ? <MicOff size={14} /> : <Mic size={14} />}
                    </button>
                    <button
                      onClick={handleToggleDeafen}
                      className={`p-2 rounded-md transition-colors ${
                        localDeafened ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
                      }`}
                      title={localDeafened ? 'Undeafen' : 'Deafen'}
                    >
                      {localDeafened ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                    <button
                      onClick={handleLeaveVoice}
                      className="p-2 rounded-md bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                      title="Leave voice"
                    >
                      <PhoneOff size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className={`rounded-lg border ${isDark ? 'border-slate-700/60 bg-[#232340]/70' : 'border-slate-300 bg-white/80'}`}>
              <div className={`px-3 py-2 border-b ${borderColor}`}>
                <span className={`text-[11px] font-semibold ${textMuted}`}>Lobby Members</span>
              </div>
              <div className="p-2 space-y-2">
                {voiceMembers.length === 0 && (
                  <div className={`px-2 py-3 text-[11px] ${textMuted}`}>
                    No one is in voice yet.
                  </div>
                )}
                {voiceMembers.map((member) => {
                  const voice = member.voice || {
                    inVoice: false,
                    muted: false,
                    deafened: false,
                    speaking: false,
                  };
                  const isSelf = member.peerId === selfPeerId;

                  return (
                    <div
                      key={member.peerId}
                      className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 ${
                        voice.speaking ? 'bg-emerald-500/10 ring-1 ring-emerald-400/30' : 'bg-black/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-[12px] font-semibold truncate ${textPrimary}`}>
                            {member.displayName}{isSelf ? ' (You)' : ''}
                          </div>
                          <div className={`text-[10px] ${voice.speaking ? 'text-emerald-300' : textMuted}`}>
                            {voice.speaking ? 'Speaking' : 'Listening'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {voice.muted ? <MicOff size={13} className="text-red-300" /> : <Mic size={13} className="text-emerald-300" />}
                        {voice.deafened ? <VolumeX size={13} className="text-amber-300" /> : <Volume2 size={13} className="text-blue-300" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </BorderGlow>
  );
};

export default VoiceLobbyPanel;
