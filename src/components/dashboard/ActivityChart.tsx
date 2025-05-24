import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Real activity data structure
interface ActivityData {
  time: string;
  productivity: number;
  screenTime: number;
}

interface ActivityChartProps {
  title?: string;
  className?: string;
  emptyState?: boolean;
}

export function ActivityChart({ title = "Daily Activity", className, emptyState = true }: ActivityChartProps) {
  const { user } = useAuth();
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [hasRealData, setHasRealData] = useState(false);
  
  useEffect(() => {
    const userId = user?.id || 'guest';
    
    // Check if user has any real activity data
    const userActivityKey = `activityData_${userId}`;
    const savedActivity = localStorage.getItem(userActivityKey);
    
    if (savedActivity) {
      try {
        const parsedData = JSON.parse(savedActivity);
        const timestamp = parsedData.timestamp || 0;
        const now = Date.now();
        
        // Only use data if it's from today (within the last 24h)
        if (now - timestamp < 24 * 60 * 60 * 1000 && parsedData.data && parsedData.data.length > 0) {
          setActivityData(parsedData.data);
          setHasRealData(true);
        }
      } catch (error) {
        console.error("Failed to load activity data:", error);
      }
    }
    
    // Set up interval to generate activity data points every 30 minutes
    const activityInterval = setInterval(() => {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Generate realistic activity data based on time of day
      const hour = now.getHours();
      let productivity = 70; // Base productivity
      let screenTime = 30; // Base screen time
      
      // Adjust for time of day
      if (hour >= 9 && hour <= 11) {
        productivity = Math.random() * 20 + 80; // Morning peak
        screenTime = Math.random() * 20 + 40;
      } else if (hour >= 14 && hour <= 16) {
        productivity = Math.random() * 15 + 75; // Afternoon focus
        screenTime = Math.random() * 15 + 45;
      } else if (hour >= 12 && hour <= 13) {
        productivity = Math.random() * 20 + 50; // Lunch break
        screenTime = Math.random() * 15 + 25;
      } else {
        productivity = Math.random() * 25 + 60; // Regular hours
        screenTime = Math.random() * 20 + 35;
      }
      
      const newDataPoint: ActivityData = {
        time: timeString,
        productivity: Math.round(productivity),
        screenTime: Math.round(screenTime)
      };
      
      setActivityData(prev => {
        const updated = [...prev, newDataPoint];
        // Keep only last 16 data points (8 hours worth)
        const limited = updated.slice(-16);
        
        // Save to localStorage
        const dataToSave = {
          data: limited,
          timestamp: Date.now()
        };
        localStorage.setItem(userActivityKey, JSON.stringify(dataToSave));
        
        return limited;
      });
      
      setHasRealData(true);
    }, 30 * 60 * 1000); // Every 30 minutes
    
    return () => {
      clearInterval(activityInterval);
    };
  }, [user]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {emptyState && !hasRealData ? (
            <div className="flex h-full flex-col items-center justify-center">
              <p className="text-muted-foreground">No activity data yet</p>
              <p className="text-xs text-muted-foreground mt-2">
                Data will appear as you use the application throughout the day
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={activityData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorProductivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="colorScreenTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="productivity"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorProductivity)"
                />
                <Area
                  type="monotone"
                  dataKey="screenTime"
                  stroke="hsl(var(--secondary))"
                  fillOpacity={1}
                  fill="url(#colorScreenTime)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-4 flex items-center justify-center space-x-8">
          <div className="flex items-center">
            <div className="mr-2 h-3 w-3 rounded-full bg-primary"></div>
            <span className="text-sm text-muted-foreground">Productivity</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 h-3 w-3 rounded-full bg-secondary"></div>
            <span className="text-sm text-muted-foreground">Screen Time</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
