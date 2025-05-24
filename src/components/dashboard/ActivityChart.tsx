
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Sample data - this will only be used when we have actual data to show
const sampleData = [
  { time: '8 AM', productivity: 95, screenTime: 30 },
  { time: '9 AM', productivity: 80, screenTime: 45 },
  { time: '10 AM', productivity: 90, screenTime: 50 },
  { time: '11 AM', productivity: 85, screenTime: 55 },
  { time: '12 PM', productivity: 70, screenTime: 40 },
  { time: '1 PM', productivity: 65, screenTime: 35 },
  { time: '2 PM', productivity: 85, screenTime: 50 },
  { time: '3 PM', productivity: 75, screenTime: 60 },
  { time: '4 PM', productivity: 80, screenTime: 65 },
  { time: '5 PM', productivity: 90, screenTime: 40 },
];

interface ActivityChartProps {
  title?: string;
  className?: string;
  emptyState?: boolean;
}

export function ActivityChart({ title = "Daily Activity", className, emptyState = true }: ActivityChartProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {emptyState ? (
            <div className="flex h-full flex-col items-center justify-center">
              <p className="text-muted-foreground">No activity data yet</p>
              <p className="text-xs text-muted-foreground mt-2">
                Data will appear as you use the application
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sampleData}
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
