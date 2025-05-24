
import { useState, useEffect } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { PomodoroTimer } from "@/components/timers/PomodoroTimer";
import { EyeCareReminder } from "@/components/eyecare/EyeCareReminder";
import { AppUsageList } from "@/components/dashboard/AppUsageList";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Clock, Activity, Zap, Settings, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import SystemTrayService from "@/services/SystemTrayService";
import { RichMediaPopup } from "@/components/customRules/RichMediaPopup";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { user } = useAuth();
  
  // Real-time tracked data
  const [screenTime, setScreenTime] = useState<string | null>(null);
  const [distractionCount, setDistractionCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Subscribe to real-time data updates
  useEffect(() => {
    const systemTray = SystemTrayService.getInstance();
    const userId = user?.id || 'guest';
    
    // Set current user for data isolation
    systemTray.setCurrentUser(userId);
    
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
    
    // Add listeners
    systemTray.addScreenTimeListener(handleScreenTimeUpdate);
    
    // Send request for user-specific data
    if (window.electron) {
      window.electron.send('get-user-data', { userId });
    }
    
    // Set loading state false after a delay even if no data
    const loadingTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    
    return () => {
      systemTray.removeScreenTimeListener(handleScreenTimeUpdate);
      clearTimeout(loadingTimeout);
    };
  }, [user]);

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
            {/* Main Stats Row */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Screen Time Today"
                value={screenTime}
                icon={<Clock />}
                description="Total active screen time"
                loading={isLoading}
              />
              <StatCard
                title="Active Sessions"
                value={distractionCount > 0 ? distractionCount : 0}
                icon={<Activity />}
                description="App switching sessions today"
              />
              <StatCard
                title="Productivity Score"
                value={screenTime ? "Good" : "No data"}
                icon={<Zap />}
                description="Based on app usage patterns"
                loading={isLoading}
              />
            </div>

            {/* Charts and Usage Row */}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <ActivityChart 
                title="Daily Activity Overview"
                emptyState={!screenTime || screenTime === "0h 0m"}
              />
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
