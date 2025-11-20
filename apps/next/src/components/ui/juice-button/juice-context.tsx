"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { JuiceContextValue } from "./types";
import { audioManager } from "./interactions/audio";

const JuiceContext = createContext<JuiceContextValue | undefined>(undefined);

export function JuiceProvider({ children }: { children: React.ReactNode }) {
  const [globalMute, setGlobalMute] = useState(false);
  const [volume, setVolumeState] = useState(0.7);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedMute = localStorage.getItem("juice-global-mute");
    const savedVolume = localStorage.getItem("juice-volume");

    if (savedMute !== null) {
      setGlobalMute(savedMute === "true");
    }

    if (savedVolume !== null) {
      const vol = parseFloat(savedVolume);
      setVolumeState(vol);
      audioManager.setGlobalVolume(vol);
    }
  }, []);

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem("juice-global-mute", String(globalMute));
  }, [globalMute]);

  useEffect(() => {
    localStorage.setItem("juice-volume", String(volume));
    audioManager.setGlobalVolume(volume);
  }, [volume]);

  const setVolume = (vol: number) => {
    setVolumeState(vol);
    audioManager.setGlobalVolume(vol);
  };

  const toggleMute = () => {
    setGlobalMute((prev) => !prev);
  };

  return (
    <JuiceContext.Provider
      value={{
        globalMute,
        toggleMute,
        setGlobalMute,
        volume,
        setVolume,
      }}
    >
      {children}
    </JuiceContext.Provider>
  );
}

export function useJuice(): JuiceContextValue {
  const context = useContext(JuiceContext);
  if (context === undefined) {
    // Return default values if provider is not found
    return {
      globalMute: false,
      toggleMute: () => {},
      setGlobalMute: () => {},
      volume: 0.7,
      setVolume: () => {},
    };
  }
  return context;
}
