import React, { createContext, useContext, useState, useCallback } from 'react';

interface TabBarContextType {
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  handleScroll: (scrollY: number) => void;
}

const TabBarContext = createContext<TabBarContextType | undefined>(undefined);

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const handleScroll = useCallback((scrollY: number) => {
    // 在顶部时始终显示
    if (scrollY <= 10) {
      setIsVisible(true);
      setLastScrollY(scrollY);
      return;
    }

    // 向下滚动超过阈值时隐藏
    if (scrollY > lastScrollY + 10) {
      setIsVisible(false);
    }
    // 向上滚动时显示
    else if (scrollY < lastScrollY - 10) {
      setIsVisible(true);
    }

    setLastScrollY(scrollY);
  }, [lastScrollY]);

  return (
    <TabBarContext.Provider value={{ isVisible, setIsVisible, handleScroll }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  const context = useContext(TabBarContext);
  if (!context) {
    throw new Error('useTabBar must be used within TabBarProvider');
  }
  return context;
}
