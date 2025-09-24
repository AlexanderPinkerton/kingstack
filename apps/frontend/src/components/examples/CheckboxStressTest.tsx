"use client";

import React, { useCallback, useState } from "react";
import { observer } from "mobx-react-lite";
import { useStreamingCheckboxes } from "@/hooks/useStreamingCheckboxes";
import { StreamingCheckboxGrid } from "./StreamingCheckboxGrid";
import { useRootStore } from "@/hooks/useRootStore";

export const CheckboxStressTest = observer(() => {
  const rootStore = useRootStore();
  const [isInitializing, setIsInitializing] = useState(false);
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  // Detect screen size for responsive layout
  React.useEffect(() => {
    const updateScreenSize = () => {
      if (window.innerWidth < 640) {
        setScreenSize('mobile');
      } else if (window.innerWidth < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };
    
    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);
  
  const config = {
    totalItems: 5000,
    chunkSize: 1000, // Stream 1000 at a time
  };
  
  // Responsive layout settings
  const layoutConfig = {
    mobile: { itemsPerRow: 12, itemHeight: 28, containerHeight: 400 },
    tablet: { itemsPerRow: 24, itemHeight: 24, containerHeight: 450 },
    desktop: { itemsPerRow: 35, itemHeight: 24, containerHeight: 500 },
  };
  
  const currentLayout = layoutConfig[screenSize];
  
  const {
    checkboxes,
    count,
    totalItems,
    isStreaming,
    streamProgress,
    isStreamComplete,
    handleCheckboxChange,
    getCheckbox,
    isLoading,
    isError,
    error,
  } = useStreamingCheckboxes(config);

  // Handle checkbox changes
  const handleItemChange = useCallback((index: number, checked: boolean) => {
    handleCheckboxChange(index, checked);
  }, [handleCheckboxChange]);

  // Get item data
  const getItem = useCallback((index: number) => {
    return getCheckbox(index);
  }, [getCheckbox]);

  // Initialize stress test data
  const initializeStressTest = useCallback(async () => {
    if (isInitializing) return;
    
    setIsInitializing(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_NEST_BACKEND_URL || "http://localhost:3000"}/checkboxes/initialize-stress`,
        { method: "POST" }
      );
      
      if (!response.ok) throw new Error("Failed to initialize stress test");
      const result = await response.json();
      
      console.log("Stress test initialized:", result);
      // Refresh the page to reload data
      window.location.reload();
    } catch (error) {
      console.error("Failed to initialize stress test:", error);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading stress test...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center p-8">
        <div className="text-red-400 text-xl mb-4">Error loading checkboxes</div>
        <p className="text-slate-300">{error?.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-full text-red-400 text-sm font-medium mb-4">
          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse mr-2" />
          Stress Test
        </div>
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
          5,000 Checkbox Stress Test
        </h1>
        <p className="text-slate-300 text-lg max-w-3xl mx-auto leading-relaxed mb-6">
          Hybrid streaming + virtualization system handling 5,000 checkboxes with real-time updates.
          Only visible checkboxes are rendered in the DOM for optimal performance.
        </p>
        
        {/* Initialize Button */}
        {count === 0 && (
          <div className="text-center">
            <button
              onClick={initializeStressTest}
              disabled={isInitializing}
              className={`
                px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105
                ${isInitializing 
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25'
                }
              `}
            >
              {isInitializing ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Initializing 5,000 checkboxes...</span>
                </div>
              ) : (
                'Initialize Stress Test Data'
              )}
            </button>
            <p className="text-slate-400 text-sm mt-2">
              This will create 5,000 checkboxes in the database for testing
            </p>
          </div>
        )}
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="text-2xl font-bold text-white">{count.toLocaleString()}</div>
          <div className="text-slate-400 text-sm">Loaded in Memory</div>
        </div>
        
        <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="text-2xl font-bold text-emerald-400">{totalItems.toLocaleString()}</div>
          <div className="text-slate-400 text-sm">Total Checkboxes</div>
        </div>
        
        <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="text-2xl font-bold text-blue-400">
            {isStreaming ? 'Streaming' : isStreamComplete ? 'Complete' : 'Loading'}
          </div>
          <div className="text-slate-400 text-sm">Data Status</div>
        </div>
        
        <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="text-2xl font-bold text-purple-400">
            {rootStore.socket?.connected ? 'Connected' : 'Disconnected'}
          </div>
          <div className="text-slate-400 text-sm">Realtime Status</div>
        </div>
        
        <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="text-2xl font-bold text-cyan-400 capitalize">{screenSize}</div>
          <div className="text-slate-400 text-sm">
            {currentLayout.itemsPerRow} × {Math.ceil(5000 / currentLayout.itemsPerRow)} grid
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isStreaming && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">Loading Progress</span>
            <span className="text-sm text-slate-400">{Math.round(streamProgress)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${streamProgress}%` }}
            />
          </div>
        </div>
      )}


      {/* Virtualized Checkbox Grid */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-600 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Virtualized Checkbox Grid</h3>
          <div className="flex items-center space-x-2 text-sm text-slate-400">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span>Live</span>
          </div>
        </div>
        
        <p className="text-slate-400 mb-6">
          Scroll to explore all 5,000 checkboxes in a {currentLayout.itemsPerRow}×{Math.ceil(5000 / currentLayout.itemsPerRow)} grid. 
          Only visible checkboxes are rendered for optimal performance. Changes sync in real-time across all users.
        </p>
        
        <StreamingCheckboxGrid
          totalItems={totalItems}
          itemHeight={currentLayout.itemHeight}
          containerHeight={currentLayout.containerHeight}
          itemsPerRow={currentLayout.itemsPerRow}
          getItem={getItem}
          onItemChange={handleItemChange}
        />
      </div>

      {/* Technical Details */}
      <div className="mt-8 p-6 bg-gradient-to-r from-slate-700/30 to-slate-800/30 rounded-xl border border-slate-600">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-white mb-2">Hybrid System Architecture</h3>
          <p className="text-slate-300 mb-4">
            This stress test demonstrates a hybrid approach combining streaming data loading, 
            virtual scrolling, and smart caching to handle large datasets efficiently.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-emerald-400 font-semibold">Streaming Data</div>
              <div className="text-slate-400">Load data in chunks as needed</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-semibold">Virtual Scrolling</div>
              <div className="text-slate-400">Only render visible elements</div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 font-semibold">Smart Caching</div>
              <div className="text-slate-400">Intelligent memory management</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
