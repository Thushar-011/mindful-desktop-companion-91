
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import SystemTrayService from "@/services/SystemTrayService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, XCircle } from "lucide-react";

interface AppUsageItem {
  name: string;
  time: number;
  type: "productive" | "distraction" | "communication";
  lastActiveTime?: number;
}

interface AppUsageListProps {
  className?: string;
}

export function AppUsageList({ className }: AppUsageListProps) {
  const [appUsageData, setAppUsageData] = useState<AppUsageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { isFocusMode, whitelist, currentActiveApp, isCurrentAppWhitelisted } = useFocusMode();
  
  useEffect(() => {
    const systemTray = SystemTrayService.getInstance();
    const userId = user?.id || 'guest';
    
    // Ensure user is set for proper data isolation
    systemTray.setCurrentUser(userId);
    
    // Subscribe to app usage updates
    const handleAppUsageUpdate = (appUsage: Array<{name: string, time: number, type: string, lastActiveTime?: number}>) => {
      console.log(`Received app usage update for user: ${userId}`, appUsage);
      
      // Convert to formatted app usage items
      const formattedAppUsage: AppUsageItem[] = appUsage.map(app => ({
        name: app.name,
        time: app.time,
        type: app.type as "productive" | "distraction" | "communication",
        lastActiveTime: app.lastActiveTime
      }));
      
      // Sort by most recent activity first, then by time spent
      const sortedAppUsage = formattedAppUsage.sort((a, b) => {
        if (a.lastActiveTime && b.lastActiveTime) {
          return b.lastActiveTime - a.lastActiveTime;
        } else if (a.lastActiveTime) {
          return -1;
        } else if (b.lastActiveTime) {
          return 1;
        }
        return b.time - a.time;
      });
      
      setAppUsageData(sortedAppUsage);
      setIsLoading(false);
    };
    
    // Request user-specific app usage data
    if (window.electron) {
      window.electron.send('get-user-app-usage', { userId });
    }
    
    systemTray.addAppUsageListener(handleAppUsageUpdate);
    
    // Set loading state to false after a delay if no data arrives
    const timeout = setTimeout(() => {
      if (isLoading && appUsageData.length === 0) {
        console.log("No app usage data received, showing empty state");
        setIsLoading(false);
      }
    }, 2000);
    
    return () => {
      systemTray.removeAppUsageListener(handleAppUsageUpdate);
      clearTimeout(timeout);
    };
  }, [user]);
  
  // Format milliseconds to time string
  const formatTime = (ms: number): string => {
    if (ms < 1000) return "1s";
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  const isAppWhitelisted = (appName: string): boolean => {
    return whitelist.some(item => 
      appName.toLowerCase().includes(item.toLowerCase()) || 
      item.toLowerCase().includes(appName.toLowerCase())
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>App Usage Today</CardTitle>
        {isFocusMode && (
          <Badge className="bg-attention-blue-400 text-white">
            <Shield className="h-3 w-3 mr-1" />
            Focus Mode
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {/* Live whitelist match preview - only show when focus mode is on */}
        {isFocusMode && (
          <div className={cn(
            "mb-4 p-3 rounded-lg border",
            isCurrentAppWhitelisted ? "bg-green-100/10 border-green-500/30" : "bg-red-100/10 border-red-500/30"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium mb-1">Current Active App</div>
                <div className="font-medium">{currentActiveApp || "No active window"}</div>
              </div>
              <div>
                {isCurrentAppWhitelisted ? (
                  <Badge className="bg-green-500 text-white flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Allowed
                  </Badge>
                ) : (
                  <Badge className="bg-red-500 text-white flex items-center">
                    <XCircle className="h-3 w-3 mr-1" />
                    Blocked
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex animate-pulse items-center justify-between rounded-lg border p-3">
                <div className="h-4 w-32 rounded bg-muted"></div>
                <div className="h-4 w-10 rounded bg-muted"></div>
              </div>
            ))}
          </div>
        ) : appUsageData.length > 0 ? (
          <ScrollArea className="h-[250px] pr-4">
            <div className="space-y-3">
              {appUsageData.map((app) => (
                <div
                  key={app.name}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3",
                    isFocusMode && !isAppWhitelisted(app.name) && "bg-secondary/20 border-dashed"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={cn(
                        "h-3 w-3 rounded-full",
                        app.type === "productive" && "bg-attention-green-400",
                        app.type === "distraction" && "bg-attention-warm-400",
                        app.type === "communication" && "bg-attention-blue-400"
                      )}
                    ></div>
                    <div className="flex items-center">
                      <span>{app.name}</span>
                      {isFocusMode && isAppWhitelisted(app.name) && (
                        <Badge variant="outline" className="ml-2 text-xs border-green-500 text-green-500">
                          Allowed
                        </Badge>
                      )}
                      {isFocusMode && !isAppWhitelisted(app.name) && (
                        <Badge variant="outline" className="ml-2 text-xs border-red-500 text-red-500">
                          Blocked
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-medium">{formatTime(app.time)}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">No app usage data available</p>
            <p className="text-xs text-muted-foreground mt-2">
              Data will appear when you switch between applications
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              (Note: This requires desktop app mode to track real applications)
            </p>
          </div>
        )}
        
        <div className="mt-4 flex items-center justify-center space-x-6">
          <div className="flex items-center">
            <div className="mr-2 h-3 w-3 rounded-full bg-attention-green-400"></div>
            <span className="text-sm text-muted-foreground">Productive</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 h-3 w-3 rounded-full bg-attention-warm-400"></div>
            <span className="text-sm text-muted-foreground">Distraction</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 h-3 w-3 rounded-full bg-attention-blue-400"></div>
            <span className="text-sm text-muted-foreground">Communication</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
