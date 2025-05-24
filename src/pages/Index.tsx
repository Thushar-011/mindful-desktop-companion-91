import { useState, useEffect } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { PomodoroTimer } from "@/components/timers/PomodoroTimer";
import { EyeCareReminder } from "@/components/eyecare/EyeCareReminder";
import { AppUsageList } from "@/components/dashboard/AppUsageList";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Clock, Eye, Activity, Zap, Settings, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import SystemTrayService from "@/services/SystemTrayService";
import { RichMediaPopup } from "@/components/customRules/RichMediaPopup";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { user } = useAuth();
  
  // Real-time tracked data
  const [screenTime, setScreenTime] = useState<string | null>(null);
  const [focusScore, setFocusScore] = useState<number | null>(null);
  const [distractionCount, setDistractionCount] = useState<number>(0);
  const [eyeBreaks, setEyeBreaks] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Subscribe to real-time data updates
  useEffect(() => {
    const systemTray = SystemTrayService.getInstance();
    const userId = user?.id || 'guest';
    
    // Get initial screen time
    const initialScreenTime = systemTray.getFormattedScreenTime();
    if (initialScreenTime !== "0h 0m") {
      setScreenTime(initialScreenTime);
    }
    
    // Listen for screen time updates
    const handleScreenTimeUpdate = (screenTimeMs: number) => {
      if (screenTimeMs > 0) {
        setScreenTime(systemTray.formatScreenTime(screenTimeMs));
      } else {
        setScreenTime(null);
      }
      setIsLoading(false);
    };
    
    // Listen for focus score updates
    const handleFocusScoreUpdate = (score: number, distractions: number) => {
      setFocusScore(score);
      setDistractionCount(distractions);
      setIsLoading(false);
    };
    
    // Listen for eye break updates - track completed eye breaks
    const handleEyeBreakUpdate = (event: CustomEvent<{completed: boolean}>) => {
      if (event.detail.completed) {
        console.log("Eye break completed, updating counter");
        setEyeBreaks(prev => prev + 1);
      }
    };
    
    // Add listeners
    systemTray.addScreenTimeListener(handleScreenTimeUpdate);
    systemTray.addFocusScoreListener(handleFocusScoreUpdate);
    window.addEventListener('eye-break-completed', handleEyeBreakUpdate as EventListener);
    
    // Load initial eye breaks count
    const savedEyeBreaks = localStorage.getItem(`eyeBreaksCount-${userId}`);
    if (savedEyeBreaks) {
      try {
        const count = parseInt(savedEyeBreaks);
        if (!isNaN(count)) {
          setEyeBreaks(count);
        }
      } catch (e) {
        console.error("Failed to parse eye breaks count:", e);
      }
    }
    
    // Send request for user-specific data
    if (window.electron) {
      window.electron.send('get-user-data', { userId });
    }
    
    // Set loading state false after a delay even if no data
    const loadingTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    
    // Save eye breaks count when it changes
    return () => {
      systemTray.removeScreenTimeListener(handleScreenTimeUpdate);
      systemTray.removeFocusScoreListener(handleFocusScoreUpdate);
      window.removeEventListener('eye-break-completed', handleEyeBreakUpdate as EventListener);
      clearTimeout(loadingTimeout);
      
      // Save eye breaks count
      if (eyeBreaks > 0) {
        localStorage.setItem(`eyeBreaksCount-${userId}`, eyeBreaks.toString());
      }
    };
  }, [user, eyeBreaks]);
  
  // Format focus score for display
  const formatFocusScore = (score: number | null): string | null => {
    if (score === null) return null;
    return `${score}%`;
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="container mx-auto py-6">
        <Tabs
          defaultValue="dashboard"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="mb-6 grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="focus" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Focus & Eye Care</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="animate-fade-in">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Focus Score"
                value={formatFocusScore(focusScore)}
                icon={<Activity />}
                description="How focused you've been today"
                loading={isLoading}
                trend={focusScore !== null && focusScore < 70 ? "down" : undefined}
                trendValue={focusScore !== null && focusScore < 70 ? `${distractionCount} distractions detected` : undefined}
              />
              <StatCard
                title="Screen Time"
                value={screenTime}
                icon={<Clock />}
                description="Total screen time today"
                loading={isLoading}
              />
              <StatCard
                title="Eye Breaks"
                value={eyeBreaks > 0 ? eyeBreaks : 0}
                icon={<Eye />}
                description="Eye care breaks taken today"
              />
              <StatCard
                title="Distractions"
                value={distractionCount}
                icon={<Zap />}
                description="Times you got distracted"
                loading={isLoading}
              />
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <ActivityChart emptyState={false} />
              <AppUsageList />
            </div>
          </TabsContent>

          <TabsContent value="focus" className="animate-fade-in">
            <div className="grid gap-6 md:grid-cols-2">
              <PomodoroTimer />
              <EyeCareReminder />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="animate-fade-in">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
      
      <RichMediaPopup />
    </div>
  );
};

export default Index;
