/**
 * VirtualizedFileList — High-performance virtualized list for large file collections.
 * Only renders visible items for optimal performance with 1000+ files.
 */

import React, { useRef, useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface VirtualizedFileListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function VirtualizedFileList<T>({
  items,
  itemHeight,
  renderItem,
  className = '',
}: VirtualizedFileListProps<T>) {
  const listRef = useRef<List>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Smooth scroll behavior
  const scrollToItem = (index: number) => {
    listRef.current?.scrollToItem(index, 'smart');
  };

  return (
    <div className={`${className} h-full`}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            ref={listRef}
            height={height}
            itemCount={items.length}
            itemSize={itemHeight}
            width={width}
            onScroll={({ scrollOffset }) => setScrollOffset(scrollOffset)}
            overscanCount={5} // Render 5 extra items for smooth scrolling
          >
            {({ index, style }) => (
              <div style={style}>
                {renderItem(items[index], index)}
              </div>
            )}
          </List>
        )}
      </AutoSizer>
    </div>
  );
}
