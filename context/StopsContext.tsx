import React, { createContext, useContext, useState, ReactNode } from "react";
import { Stop, DriverStats } from "../types/navigation";

interface StopsContextType {
  stops: Stop[];
  stats: DriverStats;
  addStop: (stop: Omit<Stop, "id">) => void;
  updateStop: (id: string, stop: Partial<Stop>) => void;
  deleteStop: (id: string) => void;
  reorderStops: (stops: Stop[]) => void;
  clearStops: () => void;
  markStopDelivered: (id: string) => void;
}

const StopsContext = createContext<StopsContextType | undefined>(undefined);

export function StopsProvider({ children }: { children: ReactNode }) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [stats, setStats] = useState<DriverStats>({
    kmDriven: 0,
    stopsDone: 0,
    timeSpent: 0,
    averageTimePerStop: 0,
  });

  const addStop = (stop: Omit<Stop, "id">) => {
    const newStop: Stop = {
      ...stop,
      id: `stop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setStops((prev) => [...prev, newStop]);
  };

  const updateStop = (id: string, updatedFields: Partial<Stop>) => {
    setStops((prev) =>
      prev.map((stop) =>
        stop.id === id ? { ...stop, ...updatedFields } : stop
      )
    );
  };

  const deleteStop = (id: string) => {
    setStops((prev) => prev.filter((stop) => stop.id !== id));
  };

  const reorderStops = (newStops: Stop[]) => {
    setStops(newStops);
  };

  const clearStops = () => {
    setStops([]);
  };

  const markStopDelivered = (id: string) => {
    updateStop(id, { deliveredAt: new Date() });
    setStats((prev) => ({
      ...prev,
      stopsDone: prev.stopsDone + 1,
    }));
  };

  return (
    <StopsContext.Provider
      value={{
        stops,
        stats,
        addStop,
        updateStop,
        deleteStop,
        reorderStops,
        clearStops,
        markStopDelivered,
      }}
    >
      {children}
    </StopsContext.Provider>
  );
}

export function useStops() {
  const context = useContext(StopsContext);
  if (context === undefined) {
    throw new Error("useStops must be used within a StopsProvider");
  }
  return context;
}
