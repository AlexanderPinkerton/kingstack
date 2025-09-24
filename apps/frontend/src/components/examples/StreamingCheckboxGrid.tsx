"use client";

import React, { useRef, useState, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { VirtualizedCheckbox } from "./VirtualizedCheckbox";

interface StreamingCheckboxGridProps {
  totalItems: number;
  itemsPerRow: number;
  itemHeight: number;
  containerHeight: number;
  getItem: (index: number) => { checked: boolean } | undefined;
  onItemChange: (index: number, checked: boolean) => void;
}

export const StreamingCheckboxGrid = observer(({
  totalItems,
  itemsPerRow,
  itemHeight,
  containerHeight,
  getItem,
  onItemChange
}: StreamingCheckboxGridProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  // Calculate visible range with buffer for smoother scrolling
  const rowHeight = itemHeight + 8; // Include vertical spacing
  const rowsPerView = Math.ceil(containerHeight / rowHeight);
  const bufferRows = 2; // Add buffer rows for smoother scrolling
  const totalRows = Math.ceil(totalItems / itemsPerRow);
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
  const endRow = Math.min(startRow + rowsPerView + bufferRows * 2, totalRows);
  
  const startIndex = startRow * itemsPerRow;
  const endIndex = Math.min(endRow * itemsPerRow, totalItems);
  
  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
  }, []);
  
  // Render visible items
  const visibleItems = [];
  for (let i = startIndex; i < endIndex; i++) {
    const item = getItem(i);
    const row = Math.floor(i / itemsPerRow);
    const col = i % itemsPerRow;
    
    visibleItems.push(
      <VirtualizedCheckbox
        key={i}
        index={i}
        checked={item?.checked || false}
        onChange={onItemChange}
        style={{
          position: 'absolute',
          top: row * (itemHeight + 8), // 8px vertical spacing
          left: col * (itemHeight + 8), // 8px horizontal spacing
          width: itemHeight,
          height: itemHeight,
        }}
      />
    );
  }
  
  // Calculate container width
  const containerWidth = itemsPerRow * (itemHeight + 8) - 8;
  
  return (
    <div
      ref={scrollRef}
      className="overflow-auto bg-slate-900/30 rounded-lg border border-slate-600 mx-auto p-2.5"
      style={{ 
        height: containerHeight,
        width: containerWidth + 20, // Add padding
        maxWidth: '100%'
      }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalRows * (itemHeight + 8) - 8,
          width: containerWidth,
          position: 'relative',
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
});
