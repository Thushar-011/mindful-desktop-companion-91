
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";

interface TimerSettings {
  pomodoroDuration: number;
  pomodoroBreakDuration: number;
  eyeCareWorkDuration: number;
  eyeCareRestDuration: number;
}

interface TimerContextState {
  // Pomodoro Timer state
  pomodoroMinutes: number;
  pomodoroSeconds: number;
  isPomodoroActive: boolean;
  isPomodoroBreak: boolean;
  pomodoroDuration: number;
  pomodoroBreakDuration: number;
  pomodoroProgress: number;
  
  // Eye Care Timer state
  eyeCareTimeElapsed: number;
  isEyeCareActive: boolean;
  isEyeCareResting: boolean;
  eyeCareRestProgress: number;
  eyeCareWorkDuration: number;
  eyeCareRestDuration: number;
  
  // Functions
  startPomodoroTimer: () => void;
  pausePomodoroTimer: () => void;
  resetPomodoroTimer: (isBreakTime?: boolean) => void;
  
  startEyeCareTimer: () => void;
  pauseEyeCareTimer: () => void;
  resetEyeCareTimer: () => void;
  
  // Settings functions
  updateTimerSettings: (settings: TimerSettings) => void;
}

const TimerContext = createContext<TimerContextState | undefined>(undefined);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  
  // Ref to track if settings are being updated programmatically
  const isUpdatingSettingsRef = useRef(false);
  
  // Pomodoro Timer state
  const [pomodoroMinutes, setPomodoroMinutes] = useState(() => {
    const saved = localStorage.getItem("pomodoroMinutes");
    return saved ? parseInt(saved) : 25;
  });
  const [pomodoroSeconds, setPomodoroSeconds] = useState(() => {
    const saved = localStorage.getItem("pomodoroSeconds");
    return saved ? parseInt(saved) : 0;
  });
  const [isPomodoroActive, setIsPomodoroActive] = useState(() => {
    const saved = localStorage.getItem("isPomodoroActive");
    return saved ? saved === "true" : false;
  });
  const [isPomodoroBreak, setIsPomodoroBreak] = useState(() => {
    const saved = localStorage.getItem("isPomodoroBreak");
    return saved ? saved === "true" : false;
  });
  const [pomodoroProgress, setPomodoroProgress] = useState(() => {
    const saved = localStorage.getItem("pomodoroProgress");
    return saved ? parseFloat(saved) : 100;
  });
  const [pomodoroDuration, setPomodoroDuration] = useState(() => {
    const saved = localStorage.getItem("pomodoroDuration");
    return saved ? parseInt(saved) : 25;
  });
  const [pomodoroBreakDuration, setPomodoroBreakDuration] = useState(() => {
    const saved = localStorage.getItem("pomodoroBreakDuration");
    return saved ? parseInt(saved) : 5;
  });
  
  // Eye Care Timer state
  const [eyeCareTimeElapsed, setEyeCareTimeElapsed] = useState(() => {
    const saved = localStorage.getItem("eyeCareTimeElapsed");
    return saved ? parseInt(saved) : 0;
  });
  const [isEyeCareActive, setIsEyeCareActive] = useState(() => {
    const saved = localStorage.getItem("isEyeCareActive");
    return saved ? saved === "true" : false;
  });
  const [isEyeCareResting, setIsEyeCareResting] = useState(() => {
    const saved = localStorage.getItem("isEyeCareResting");
    return saved ? saved === "true" : false;
  });
  const [eyeCareRestProgress, setEyeCareRestProgress] = useState(() => {
    const saved = localStorage.getItem("eyeCareRestProgress");
    return saved ? parseFloat(saved) : 0;
  });
  const [eyeCareWorkDuration, setEyeCareWorkDuration] = useState(() => {
    const saved = localStorage.getItem("eyeCareWorkDuration");
    return saved ? parseInt(saved) : 20 * 60; // Default: 20 minutes
  });
  const [eyeCareRestDuration, setEyeCareRestDuration] = useState(() => {
    const saved = localStorage.getItem("eyeCareRestDuration");
    return saved ? parseInt(saved) : 20; // Default: 20 seconds
  });

  // Auto-start timers when app loads
  useEffect(() => {
    const startTimersTimeout = setTimeout(() => {
      setIsPomodoroActive(true);
      setIsEyeCareActive(true);
      console.log("Auto-started Pomodoro and Eye Care timers");
    }, 1500);

    return () => {
      clearTimeout(startTimersTimeout);
    };
  }, []);

  // Save Pomodoro state to localStorage (without triggering notifications)
  useEffect(() => {
    if (!isUpdatingSettingsRef.current) {
      localStorage.setItem("pomodoroMinutes", pomodoroMinutes.toString());
      localStorage.setItem("pomodoroSeconds", pomodoroSeconds.toString());
      localStorage.setItem("isPomodoroActive", isPomodoroActive.toString());
      localStorage.setItem("isPomodoroBreak", isPomodoroBreak.toString());
      localStorage.setItem("pomodoroProgress", pomodoroProgress.toString());
      localStorage.setItem("pomodoroDuration", pomodoroDuration.toString());
      localStorage.setItem("pomodoroBreakDuration", pomodoroBreakDuration.toString());
    }
  }, [pomodoroMinutes, pomodoroSeconds, isPomodoroActive, isPomodoroBreak, pomodoroProgress, pomodoroDuration, pomodoroBreakDuration]);

  // Save Eye Care state to localStorage (without triggering notifications)
  useEffect(() => {
    if (!isUpdatingSettingsRef.current) {
      localStorage.setItem("eyeCareTimeElapsed", eyeCareTimeElapsed.toString());
      localStorage.setItem("isEyeCareActive", isEyeCareActive.toString());
      localStorage.setItem("isEyeCareResting", isEyeCareResting.toString());
      localStorage.setItem("eyeCareRestProgress", eyeCareRestProgress.toString());
      localStorage.setItem("eyeCareWorkDuration", eyeCareWorkDuration.toString());
      localStorage.setItem("eyeCareRestDuration", eyeCareRestDuration.toString());
    }
  }, [eyeCareTimeElapsed, isEyeCareActive, isEyeCareResting, eyeCareRestProgress, eyeCareWorkDuration, eyeCareRestDuration]);

  // Function to update timer settings (with proper notification control)
  const updateTimerSettings = (settings: TimerSettings) => {
    // Set flag to prevent localStorage notifications
    isUpdatingSettingsRef.current = true;
    
    // Check if settings actually changed
    const hasChanges = (
      settings.pomodoroDuration !== pomodoroDuration ||
      settings.pomodoroBreakDuration !== pomodoroBreakDuration ||
      settings.eyeCareWorkDuration !== eyeCareWorkDuration ||
      settings.eyeCareRestDuration !== eyeCareRestDuration
    );
    
    if (!hasChanges) {
      isUpdatingSettingsRef.current = false;
      return; // No changes, don't show notification
    }
    
    // Update settings
    setPomodoroDuration(settings.pomodoroDuration);
    setPomodoroBreakDuration(settings.pomodoroBreakDuration);
    setEyeCareWorkDuration(settings.eyeCareWorkDuration);
    setEyeCareRestDuration(settings.eyeCareRestDuration);
    
    // Save settings to localStorage
    localStorage.setItem("pomodoroDuration", settings.pomodoroDuration.toString());
    localStorage.setItem("pomodoroBreakDuration", settings.pomodoroBreakDuration.toString());
    localStorage.setItem("eyeCareWorkDuration", settings.eyeCareWorkDuration.toString());
    localStorage.setItem("eyeCareRestDuration", settings.eyeCareRestDuration.toString());
    
    // Reset timers with new durations
    if (!isPomodoroActive) {
      resetPomodoroTimer(isPomodoroBreak);
    }
    
    if (!isEyeCareActive) {
      resetEyeCareTimer();
    }

    // Show success toast only once when there are actual changes
    sonnerToast.success("Timer settings updated successfully!", {
      duration: 2500,
    });
    
    // Reset flag after a delay
    setTimeout(() => {
      isUpdatingSettingsRef.current = false;
    }, 100);
  };

  // Pomodoro Timer Logic
  useEffect(() => {
    const totalSeconds = isPomodoroBreak 
      ? pomodoroBreakDuration * 60 
      : pomodoroDuration * 60;
      
    let interval: NodeJS.Timeout | null = null;

    if (isPomodoroActive) {
      interval = setInterval(() => {
        if (pomodoroSeconds === 0) {
          if (pomodoroMinutes === 0) {
            clearInterval(interval as NodeJS.Timeout);
            if (isPomodoroBreak) {
              toast({
                title: "Break time is over!",
                description: "Time to get back to work!",
              });
              resetPomodoroTimer(false);
            } else {
              toast({
                title: "Great job! Time for a break",
                description: "Take a moment to rest your eyes and stretch.",
              });
              resetPomodoroTimer(true);
            }
            return;
          }
          setPomodoroMinutes(pomodoroMinutes - 1);
          setPomodoroSeconds(59);
        } else {
          setPomodoroSeconds(pomodoroSeconds - 1);
        }

        const currentTotalSeconds = pomodoroMinutes * 60 + pomodoroSeconds;
        const newProgress = (currentTotalSeconds / totalSeconds) * 100;
        setPomodoroProgress(newProgress);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPomodoroActive, pomodoroMinutes, pomodoroSeconds, isPomodoroBreak, 
      pomodoroDuration, pomodoroBreakDuration, toast]);

  // Eye Care Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isEyeCareActive) {
      interval = setInterval(() => {
        if (isEyeCareResting) {
          const newRestProgress = ((eyeCareRestDuration - eyeCareTimeElapsed) / eyeCareRestDuration) * 100;
          setEyeCareRestProgress(newRestProgress);
          
          if (eyeCareTimeElapsed >= eyeCareRestDuration) {
            toast({
              title: "Rest completed!",
              description: "Your eyes should feel refreshed now.",
            });
            resetEyeCareTimer();
          } else {
            setEyeCareTimeElapsed(eyeCareTimeElapsed + 1);
          }
        } else {
          if (eyeCareTimeElapsed >= eyeCareWorkDuration) {
            toast({
              title: "Time for an eye break!",
              description: "Look at something 20 feet away for 20 seconds.",
            });
            setEyeCareTimeElapsed(0);
            setIsEyeCareResting(true);
            setEyeCareRestProgress(100);
          } else {
            setEyeCareTimeElapsed(eyeCareTimeElapsed + 1);
          }
        }
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isEyeCareActive, eyeCareTimeElapsed, isEyeCareResting, eyeCareRestDuration, 
      eyeCareWorkDuration, toast]);

  // Timer functions
  const startPomodoroTimer = () => setIsPomodoroActive(true);
  const pausePomodoroTimer = () => setIsPomodoroActive(false);
  
  const resetPomodoroTimer = (isBreakTime: boolean = false) => {
    setIsPomodoroActive(false);
    if (isBreakTime) {
      setPomodoroMinutes(pomodoroBreakDuration);
      setIsPomodoroBreak(true);
    } else {
      setPomodoroMinutes(pomodoroDuration);
      setIsPomodoroBreak(false);
    }
    setPomodoroSeconds(0);
    setPomodoroProgress(100);
  };
  
  const startEyeCareTimer = () => setIsEyeCareActive(true);
  const pauseEyeCareTimer = () => setIsEyeCareActive(false);
  
  const resetEyeCareTimer = () => {
    setEyeCareTimeElapsed(0);
    setIsEyeCareResting(false);
    setEyeCareRestProgress(0);
  };

  return (
    <TimerContext.Provider value={{
      // Pomodoro Timer state
      pomodoroMinutes,
      pomodoroSeconds,
      isPomodoroActive,
      isPomodoroBreak,
      pomodoroDuration,
      pomodoroBreakDuration,
      pomodoroProgress,
      
      // Eye Care Timer state
      eyeCareTimeElapsed,
      isEyeCareActive,
      isEyeCareResting,
      eyeCareRestProgress,
      eyeCareWorkDuration,
      eyeCareRestDuration,
      
      // Functions
      startPomodoroTimer,
      pausePomodoroTimer,
      resetPomodoroTimer,
      
      startEyeCareTimer,
      pauseEyeCareTimer,
      resetEyeCareTimer,
      
      // Settings functions
      updateTimerSettings
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
}
