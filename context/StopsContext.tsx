import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Stop, DriverStats } from "../types/navigation";
import { useUser } from "@clerk/clerk-expo";
import {
  getTodayStats,
  saveTodayStats,
  incrementStats,
  initDatabase,
} from "../utils/database";

interface StopsContextType {
  stops: Stop[];
  stats: DriverStats;
  addStop: (stop: Omit<Stop, "id">) => void;
  updateStop: (id: string, stop: Partial<Stop>) => void;
  deleteStop: (id: string) => void;
  reorderStops: (stops: Stop[]) => void;
  clearStops: () => void;
  markStopDelivered: (id: string) => void;
  markStopNotHandled: (id: string) => void;
  updateKmDriven: (km: number) => void;
  updateTimeSpent: (minutes: number) => void;
}

const StopsContext = createContext<StopsContextType | undefined>(undefined);

export function StopsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [stops, setStops] = useState<Stop[]>([]);
  const [stats, setStats] = useState<DriverStats>({
    kmDriven: 0,
    stopsDone: 0,
    stopsDelivered: 0,
    stopsNotHandled: 0,
    timeSpent: 0,
    averageTimePerStop: 0,
  });

  // Initialize database and load today's stats when user is available
  useEffect(() => {
    if (!user?.id) return;

    const loadStats = async () => {
      try {
        await initDatabase();
        const todayStats = await getTodayStats(user.id);

        if (todayStats) {
          setStats({
            kmDriven: todayStats.km_driven,
            stopsDone: todayStats.stops_done,
            stopsDelivered: todayStats.stops_delivered,
            stopsNotHandled: todayStats.stops_not_handled,
            timeSpent: todayStats.time_spent,
            averageTimePerStop:
              todayStats.stops_done > 0
                ? todayStats.time_spent / todayStats.stops_done
                : 0,
          });
          console.log("✅ Loaded stats from database for user:", user.id);
        }
      } catch (error) {
        console.error("Failed to load stats from database:", error);
      }
    };

    loadStats();
  }, [user?.id]);

  // Save stats to database whenever they change
  useEffect(() => {
    if (!user?.id) return;

    const saveStats = async () => {
      try {
        await saveTodayStats(user.id, {
          km_driven: stats.kmDriven,
          stops_done: stats.stopsDone,
          stops_delivered: stats.stopsDelivered,
          stops_not_handled: stats.stopsNotHandled,
          time_spent: stats.timeSpent,
        });
      } catch (error) {
        console.error("Failed to save stats to database:", error);
      }
    };

    saveStats();
  }, [stats, user?.id]);

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
    updateStop(id, {
      deliveredAt: new Date(),
      deliveryStatus: "delivered",
    });
    setStats((prev) => {
      const newStats = {
        ...prev,
        stopsDone: prev.stopsDone + 1,
        stopsDelivered: prev.stopsDelivered + 1,
      };
      newStats.averageTimePerStop =
        newStats.stopsDone > 0 ? newStats.timeSpent / newStats.stopsDone : 0;
      return newStats;
    });

    // Increment in database
    if (user?.id) {
      incrementStats(user.id, {
        stops_done: 1,
        stops_delivered: 1,
      }).catch(console.error);
    }
  };

  const markStopNotHandled = (id: string) => {
    updateStop(id, {
      deliveryStatus: "not-handled",
    });
    setStats((prev) => {
      const newStats = {
        ...prev,
        stopsDone: prev.stopsDone + 1,
        stopsNotHandled: prev.stopsNotHandled + 1,
      };
      newStats.averageTimePerStop =
        newStats.stopsDone > 0 ? newStats.timeSpent / newStats.stopsDone : 0;
      return newStats;
    });

    // Increment in database
    if (user?.id) {
      incrementStats(user.id, {
        stops_done: 1,
        stops_not_handled: 1,
      }).catch(console.error);
    }
  };

  const updateKmDriven = (km: number) => {
    setStats((prev) => ({
      ...prev,
      kmDriven: prev.kmDriven + km,
    }));

    if (user?.id) {
      incrementStats(user.id, { km_driven: km }).catch(console.error);
    }
  };

  const updateTimeSpent = (minutes: number) => {
    setStats((prev) => {
      const newStats = {
        ...prev,
        timeSpent: prev.timeSpent + minutes,
      };
      newStats.averageTimePerStop =
        newStats.stopsDone > 0 ? newStats.timeSpent / newStats.stopsDone : 0;
      return newStats;
    });

    if (user?.id) {
      incrementStats(user.id, { time_spent: minutes }).catch(console.error);
    }
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
        markStopNotHandled,
        updateKmDriven,
        updateTimeSpent,
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
