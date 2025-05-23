class SystemTrayService {
  private static instance: SystemTrayService;
  private lastActiveWindow: string | null = null;
  private windowSwitches: number = 0;
  private switchThreshold: number = 3;
  private switchTimeframe: number = 30000;
  private switchTimer: NodeJS.Timeout | null = null;
  private listeners: Array<(message: string, isFocusAlert: boolean) => void> = [];
  private isDesktopApp: boolean = false;
  private apiBaseUrl: string = 'http://localhost:5000/api';
  private trayIconState: 'default' | 'active' | 'rest' = 'default';
  private lastNotificationTime: number = 0;
  private notificationCooldown: number = 180000;
  private notificationThrottleMap: Map<string, number> = new Map();
  private notificationThrottleTime: number = 500; // Reduced throttle time
  
  // Screen time tracking variables
  private screenTimeStart: number = 0;
  private screenTimeToday: number = 0;
  private lastScreenTimeUpdate: number = 0;
  private idleThreshold: number = 60000;
  private lastActivityTime: number = 0;
  private screenTimeListeners: Array<(screenTime: number) => void> = [];
  private focusScoreListeners: Array<(score: number) => void> = [];
  private appUsageListeners: Array<(appUsage: Array<{name: string, time: number, type: string, lastActiveTime?: number}>) => void> = [];
  private appUsageData: Map<string, {time: number, type: string, lastActiveTime: number}> = new Map();
  
  private userIdleTime: number = 0;
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private focusScore: number = 100;
  private distractionCount: number = 0;
  private focusScoreUpdateListeners: Array<(score: number, distractions: number) => void> = [];
  
  // Focus mode properties
  private isFocusMode: boolean = false;
  private focusModeWhitelist: string[] = [];
  private dimInsteadOfBlock: boolean = true;
  private focusModeListeners: Array<(isActive: boolean) => void> = [];
  
  // Recent window switch tracking for custom rules
  private recentSwitches: number = 0;
  private recentSwitchesTimer: NodeJS.Timeout | null = null;
  private lastWindowSwitchTime: number = 0;
  
  // Default whitelist apps that should never trigger focus alerts
  private readonly DEFAULT_WHITELIST_APPS = ['Electron', 'electron', 'Mindful Desktop Companion', 'chrome-devtools'];
  
  private persistedData: {
    screenTimeToday: number,
    focusScore: number,
    distractionCount: number,
    appUsageData: Array<{name: string, time: number, type: string, lastActiveTime: number}>,
    focusModeWhitelist?: string[],
    isFocusMode?: boolean,
    dimInsteadOfBlock?: boolean
  } | null = null;

  private constructor() {
    console.log("System tray service initialized");
    this.isDesktopApp = this.checkIsDesktopApp();
    this.loadPersistedData();
    this.initializeScreenTimeTracking();
    
    if (this.isDesktopApp) {
      this.initializeDesktopMonitoring();
    }
    
    this.initRecentSwitchesTracking();
  }

  private initRecentSwitchesTracking(): void {
    setInterval(() => {
      console.log(`Resetting recent switches count. Previous: ${this.recentSwitches}`);
      this.recentSwitches = 0;
    }, 300000);
  }

  private persistData(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const dataToSave = {
        screenTimeToday: this.screenTimeToday,
        focusScore: this.focusScore,
        distractionCount: this.distractionCount,
        appUsageData: Array.from(this.appUsageData.entries()).map(([name, data]) => ({
          name,
          time: data.time,
          type: data.type,
          lastActiveTime: data.lastActiveTime
        })),
        focusModeWhitelist: this.focusModeWhitelist,
        isFocusMode: this.isFocusMode,
        dimInsteadOfBlock: this.dimInsteadOfBlock,
        timestamp: Date.now()
      };
      
      localStorage.setItem('systemTrayData', JSON.stringify(dataToSave));
      console.log("Persisted data to localStorage:", dataToSave);
    } catch (error) {
      console.error("Failed to persist data:", error);
    }
  }
  
  private loadPersistedData(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const savedData = localStorage.getItem('systemTrayData');
      if (!savedData) return;
      
      const parsedData = JSON.parse(savedData);
      const timestamp = parsedData.timestamp || 0;
      const now = Date.now();
      
      if (now - timestamp < 24 * 60 * 60 * 1000) {
        this.screenTimeToday = parsedData.screenTimeToday || 0;
        this.focusScore = parsedData.focusScore || 100;
        this.distractionCount = parsedData.distractionCount || 0;
        
        if (parsedData.focusModeWhitelist) {
          const mergedWhitelist = [...new Set([
            ...parsedData.focusModeWhitelist, 
            ...this.DEFAULT_WHITELIST_APPS
          ])];
          this.focusModeWhitelist = mergedWhitelist;
        } else {
          this.focusModeWhitelist = [...this.DEFAULT_WHITELIST_APPS];
        }
        
        if (parsedData.isFocusMode !== undefined) {
          this.isFocusMode = parsedData.isFocusMode;
        }
        
        if (parsedData.dimInsteadOfBlock !== undefined) {
          this.dimInsteadOfBlock = parsedData.dimInsteadOfBlock;
        }
        
        if (parsedData.appUsageData && Array.isArray(parsedData.appUsageData)) {
          parsedData.appUsageData.forEach((app: any) => {
            if (app.name && app.time != null && app.type) {
              this.appUsageData.set(app.name, {
                time: app.time,
                type: app.type,
                lastActiveTime: app.lastActiveTime || now
              });
            }
          });
        }
        
        console.log("Loaded persisted data from localStorage:", parsedData);
      } else {
        console.log("Saved data is too old, starting fresh");
        localStorage.removeItem('systemTrayData');
      }
    } catch (error) {
      console.error("Failed to load persisted data:", error);
    }
  }

  private initializeScreenTimeTracking(): void {
    const now = Date.now();
    this.screenTimeStart = now;
    this.lastActivityTime = now;
    this.lastScreenTimeUpdate = now;
    
    setInterval(() => {
      this.updateScreenTime();
    }, 60000);
    
    this.idleCheckInterval = setInterval(() => {
      const currentTime = Date.now();
      const timeSinceLastActivity = currentTime - this.lastActivityTime;
      
      if (timeSinceLastActivity > this.idleThreshold) {
        this.userIdleTime = timeSinceLastActivity;
      } else {
        this.userIdleTime = 0;
      }
    }, 10000);
    
    this.setupDailyReset();
    
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.persistData());
      window.addEventListener('blur', () => this.persistData());
      
      setInterval(() => this.persistData(), 60000);
    }
  }
  
  private setupDailyReset(): void {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    
    const timeToMidnight = midnight.getTime() - now.getTime();
    
    setTimeout(() => {
      console.log("Resetting daily stats");
      this.resetDailyStats();
      this.setupDailyReset();
    }, timeToMidnight);
  }
  
  private resetDailyStats(): void {
    this.screenTimeToday = 0;
    this.distractionCount = 0;
    this.focusScore = 100;
    this.appUsageData.clear();
    
    this.notifyScreenTimeListeners();
    this.notifyFocusScoreListeners();
    this.notifyAppUsageListeners();
  }
  
  private updateScreenTime(): void {
    const now = Date.now();
    
    if (this.userIdleTime < this.idleThreshold) {
      const timeElapsed = now - this.lastScreenTimeUpdate;
      this.screenTimeToday += timeElapsed;
      
      this.notifyScreenTimeListeners();
    }
    
    this.lastScreenTimeUpdate = now;
  }
  
  public formatScreenTime(milliseconds: number): string {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  }

  private checkIsDesktopApp(): boolean {
    const hasElectron = typeof window !== 'undefined' && 
                        window.electron !== undefined && 
                        typeof window.electron.send === 'function';
    console.log("Is electron environment:", hasElectron);
    return hasElectron;
  }

  public isDesktopEnvironment(): boolean {
    return this.isDesktopApp;
  }

  private initializeDesktopMonitoring(): void {
    console.log("Initializing real desktop monitoring");
    
    if (this.isDesktopApp && window.electron) {
      const unsubscribeActiveWindow = window.electron.receive('active-window-changed', (windowInfo: any) => {
        this.handleRealWindowSwitch(windowInfo.title);
        this.trackAppUsage(windowInfo.title, windowInfo.owner || "Unknown");
        this.lastActivityTime = Date.now();
      });
      
      const unsubscribeBlink = window.electron.receive('blink-detected', () => {
        this.notifyEyeCare();
      });
      
      const unsubscribeEyeCare = window.electron.receive('eye-care-reminder', () => {
        this.notifyEyeCareBreak();
      });
      
      window.addEventListener('notification-dismissed', (e: Event) => {
        const notificationId = (e as CustomEvent<string>).detail;
        if (notificationId) {
          this.processedNotifications.add(notificationId);
        }
      });

      setTimeout(() => {
        console.log("Sending test notification");
        this.notifyTest();
      }, 3000);
      
      if (import.meta.env.DEV) {
        let testAppIndex = 0;
        const testApps = ["Chrome", "VSCode", "Slack", "YouTube", "Twitter"];
        
        setInterval(() => {
          const app = testApps[testAppIndex % testApps.length];
          console.log(`Simulating switch to: ${app}`);
          
          const event = new CustomEvent('active-window-changed', {
            detail: app
          });
          window.dispatchEvent(event);
          
          testAppIndex++;
        }, 15000);
      }
    }
  }

  private trackAppUsage(appTitle: string, appOwner: string): void {
    const appName = appOwner !== "Unknown" ? appOwner : appTitle;
    const now = Date.now();
    
    const coreAppName = this.extractAppName(appName);
    
    let appType = this.determineAppType(coreAppName);
    
    if (!this.appUsageData.has(coreAppName)) {
      this.appUsageData.set(coreAppName, { time: 0, type: appType, lastActiveTime: now });
    }
    
    if (this.userIdleTime < this.idleThreshold && this.lastActiveWindow === coreAppName) {
      const timeElapsed = now - this.lastActivityTime;
      const appData = this.appUsageData.get(coreAppName);
      if (appData) {
        appData.time += timeElapsed;
        appData.lastActiveTime = now;
        this.appUsageData.set(coreAppName, appData);
      }
    } else {
      const appData = this.appUsageData.get(coreAppName);
      if (appData) {
        appData.lastActiveTime = now;
        this.appUsageData.set(coreAppName, appData);
      }
    }
    
    const isSystemApp = this.DEFAULT_WHITELIST_APPS.some(defaultApp => 
      coreAppName.toLowerCase().includes(defaultApp.toLowerCase()) || 
      defaultApp.toLowerCase().includes(coreAppName.toLowerCase())
    );
    
    if (this.isFocusMode && 
        !isSystemApp && 
        !this.isAppInWhitelist(coreAppName, this.focusModeWhitelist)) {
      this.notifyFocusModeViolation(coreAppName);
    }
    
    this.notifyAppUsageListeners();
  }
  
  private extractAppName(windowTitle: string): string {
    if (!windowTitle) return '';
    
    const appNameMatches = windowTitle.match(/^(.*?)(?:\s[-–—]\s|\s\|\s|\s:|\s\d|$)/);
    return appNameMatches?.[1]?.trim() || windowTitle.trim();
  }
  
  private isAppInWhitelist(appName: string, whitelist: string[]): boolean {
    if (!appName) return false;
    
    if (this.DEFAULT_WHITELIST_APPS.some(defaultApp => 
      appName.toLowerCase().includes(defaultApp.toLowerCase()) || 
      defaultApp.toLowerCase().includes(appName.toLowerCase()))) {
      return true;
    }
    
    const normalizedAppName = appName.toLowerCase();
    
    return whitelist.some(whitelistedApp => {
      const normalizedWhitelistedApp = whitelistedApp.toLowerCase();
      return normalizedAppName.includes(normalizedWhitelistedApp) || 
             normalizedWhitelistedApp.includes(normalizedAppName);
    });
  }
  
  private determineAppType(appName: string): "productive" | "distraction" | "communication" {
    const appNameLower = appName.toLowerCase();
    
    if (
      appNameLower.includes("code") || 
      appNameLower.includes("word") || 
      appNameLower.includes("excel") || 
      appNameLower.includes("powerpoint") || 
      appNameLower.includes("outlook") ||
      appNameLower.includes("terminal") ||
      appNameLower.includes("studio") ||
      appNameLower.includes("notepad") ||
      appNameLower.includes("editor")
    ) {
      return "productive";
    }
    
    if (
      appNameLower.includes("teams") || 
      appNameLower.includes("slack") || 
      appNameLower.includes("zoom") || 
      appNameLower.includes("meet") || 
      appNameLower.includes("mail") ||
      appNameLower.includes("outlook") ||
      appNameLower.includes("gmail")
    ) {
      return "communication";
    }
    
    if (
      appNameLower.includes("youtube") || 
      appNameLower.includes("netflix") || 
      appNameLower.includes("facebook") || 
      appNameLower.includes("instagram") || 
      appNameLower.includes("twitter") ||
      appNameLower.includes("game") ||
      appNameLower.includes("reddit") ||
      appNameLower.includes("tiktok")
    ) {
      return "distraction";
    }
    
    return "productive";
  }
  
  public addScreenTimeListener(callback: (screenTime: number) => void): void {
    this.screenTimeListeners.push(callback);
    callback(this.screenTimeToday);
  }
  
  public removeScreenTimeListener(callback: (screenTime: number) => void): void {
    const index = this.screenTimeListeners.indexOf(callback);
    if (index > -1) {
      this.screenTimeListeners.splice(index, 1);
    }
  }
  
  private notifyScreenTimeListeners(): void {
    this.screenTimeListeners.forEach(listener => {
      listener(this.screenTimeToday);
    });
  }
  
  public addFocusScoreListener(callback: (score: number, distractions: number) => void): void {
    this.focusScoreUpdateListeners.push(callback);
    callback(this.focusScore, this.distractionCount);
  }
  
  public removeFocusScoreListener(callback: (score: number, distractions: number) => void): void {
    const index = this.focusScoreUpdateListeners.indexOf(callback);
    if (index > -1) {
      this.focusScoreUpdateListeners.splice(index, 1);
    }
  }
  
  private notifyFocusScoreListeners(): void {
    this.focusScoreUpdateListeners.forEach(listener => {
      listener(this.focusScore, this.distractionCount);
    });
  }
  
  public addAppUsageListener(callback: (appUsage: Array<{name: string, time: number, type: string, lastActiveTime?: number}>) => void): void {
    this.appUsageListeners.push(callback);
    const appUsageArray = Array.from(this.appUsageData.entries()).map(([name, data]) => ({
      name,
      time: data.time,
      type: data.type,
      lastActiveTime: data.lastActiveTime
    }));
    
    callback(appUsageArray);
  }
  
  public removeAppUsageListener(callback: (appUsage: Array<{name: string, time: number, type: string, lastActiveTime?: number}>) => void): void {
    const index = this.appUsageListeners.indexOf(callback);
    if (index > -1) {
      this.appUsageListeners.splice(index, 1);
    }
  }
  
  private notifyAppUsageListeners(): void {
    const appUsageArray = Array.from(this.appUsageData.entries())
      .map(([name, data]) => ({
        name,
        time: data.time,
        type: data.type as "productive" | "distraction" | "communication",
        lastActiveTime: data.lastActiveTime
      }));
    
    this.appUsageListeners.forEach(listener => {
      listener(appUsageArray);
    });
  }

  public static getInstance(): SystemTrayService {
    if (!SystemTrayService.instance) {
      SystemTrayService.instance = new SystemTrayService();
    }
    return SystemTrayService.instance;
  }

  private handleRealWindowSwitch(windowTitle: string): void {
    console.log(`Real active window changed to: ${windowTitle}`);
    
    const now = Date.now();
    if (now - this.lastWindowSwitchTime > 2000) {
      this.recentSwitches++;
      this.lastWindowSwitchTime = now;
      
      const event = new CustomEvent('active-window-changed', {
        detail: windowTitle
      });
      window.dispatchEvent(event);
      
      console.log(`Incremented recent switches to: ${this.recentSwitches}`);
    }
    
    this.handleWindowSwitch(windowTitle);
  }

  private handleWindowSwitch(newWindow: string): void {
    console.log(`Active window changed to: ${newWindow}`);
    
    if (this.lastActiveWindow === newWindow) return;
    
    this.lastActiveWindow = newWindow;
    this.windowSwitches++;
    
    if (this.switchTimer) {
      clearTimeout(this.switchTimer);
    }
    
    this.switchTimer = setTimeout(() => {
      this.windowSwitches = 0;
    }, this.switchTimeframe);
    
    if (this.windowSwitches >= this.switchThreshold) {
      const now = Date.now();
      if (now - this.lastNotificationTime > this.notificationCooldown) {
        this.notifyFocusNeeded();
        this.lastNotificationTime = now;
        
        this.distractionCount++;
        this.focusScore = Math.max(0, 100 - (this.distractionCount * 5));
        
        this.notifyFocusScoreListeners();
      }
      this.windowSwitches = 0;
    }
  }

  private notifyTest(): void {
    const message = "System tray notification test - if you see this, notifications are working!";
    
    if (this.isDesktopApp && window.electron) {
      console.log("Sending test notification via IPC");
      try {
        window.electron.send('show-native-notification', {
          title: "Notification Test", 
          body: message
        });
        console.log("Test notification sent successfully");
      } catch (error) {
        console.error("Error sending test notification:", error);
      }
    }
    
    this.listeners.forEach(listener => listener(message, true));
  }

  private notifyFocusNeeded(): void {
    const message = "You seem distracted. Try focusing on one task at a time.";
    
    if (this.isDesktopApp && window.electron) {
      console.log("Sending focus notification via IPC");
      window.electron.send('show-native-notification', {
        title: "Focus Reminder", 
        body: message
      });
    }
    
    this.listeners.forEach(listener => listener(message, true));
  }

  private notifyFocusModeViolation(appName: string): void {
    const isSystemApp = this.DEFAULT_WHITELIST_APPS.some(defaultApp => 
      appName.toLowerCase().includes(defaultApp.toLowerCase()) || 
      defaultApp.toLowerCase().includes(appName.toLowerCase())
    );
    
    if (isSystemApp) {
      return;
    }
    
    const now = Date.now();
    const lastNotified = this.notificationThrottleMap.get(appName) || 0;
    
    if (now - lastNotified < this.notificationThrottleTime) {
      console.log(`Throttling notification for ${appName}, too recent`);
      return;
    }
    
    this.notificationThrottleMap.set(appName, now);
    
    const message = `You're outside your focus zone. ${appName} is not in your whitelist.`;
    
    if (this.isDesktopApp && window.electron) {
      console.log("Sending focus mode violation notification via IPC");
      window.electron.send('show-native-notification', {
        title: "Focus Mode Alert", 
        body: message,
        notificationId: `focus-mode-violation-${appName}-${now}` // Include timestamp for uniqueness
      });
    }
    
    if (this.dimInsteadOfBlock) {
      console.log("Applying dimming effect to screen");
    } else {
      console.log("Blocking non-whitelisted app:", appName);
    }
    
    this.listeners.forEach(listener => listener(message, true));
  }

  private notifyEyeCare(): void {
    const message = "Remember to blink regularly to reduce eye strain.";
    
    if (this.isDesktopApp && window.electron) {
      console.log("Sending eye care notification via IPC");
      window.electron.send('show-native-notification', {
        title: "Blink Reminder", 
        body: message
      });
    }
    
    this.listeners.forEach(listener => listener(message, true));
  }
  
  private notifyEyeCareBreak(): void {
    const message = "Time to rest your eyes! Look 20ft away for 20 seconds.";
    
    if (this.isDesktopApp && window.electron) {
      console.log("Sending eye care break notification via IPC");
      window.electron.send('show-native-notification', {
        title: "Eye Care Break", 
        body: message
      });
    }
    
    this.setTrayIcon('rest');
    this.listeners.forEach(listener => listener(message, true));
  }

  public addNotificationListener(callback: (message: string, isFocusAlert: boolean) => void): void {
    this.listeners.push(callback);
  }

  public removeNotificationListener(callback: (message: string, isFocusAlert: boolean) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  public async savePreferences(userId: string, preferences: any): Promise<boolean> {
    if (!userId) return false;
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/preferences/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences)
      });
      
      return response.ok;
    } catch (error) {
      console.error('Failed to save preferences:', error);
      return false;
    }
  }
  
  public async loadPreferences(userId: string): Promise<any> {
    if (!userId) return null;
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/preferences/${userId}`);
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Failed to load preferences:', error);
      return null;
    }
  }

  public showTrayIcon(): void {
    if (this.isDesktopApp && window.electron) {
      console.log("Showing system tray icon via IPC");
      try {
        window.electron.send('show-tray');
        console.log("Show tray command sent successfully");
      } catch (error) {
        console.error("Error showing tray:", error);
      }
    }
    console.log("System tray icon shown");
  }

  public hideTrayIcon(): void {
    if (this.isDesktopApp && window.electron) {
      console.log("Hiding system tray icon via IPC");
      window.electron.send('hide-tray');
    }
    console.log("System tray icon hidden");
  }

  public setTrayTooltip(tooltip: string): void {
    if (this.isDesktopApp && window.electron) {
      console.log(`Setting tray tooltip to: ${tooltip}`);
      window.electron.send('set-tray-tooltip', tooltip);
    }
    console.log(`Set tray tooltip to: ${tooltip}`);
  }
  
  public setTrayIcon(state: 'default' | 'active' | 'rest'): void {
    if (this.trayIconState === state) return;
    
    this.trayIconState = state;
    console.log(`Setting tray icon state to: ${state}`);
    
    if (this.isDesktopApp && window.electron) {
      window.electron.send('set-tray-icon', state);
    }
  }
  
  public getScreenTime(): number {
    this.updateScreenTime();
    return this.screenTimeToday;
  }
  
  public getFormattedScreenTime(): string {
    return this.formatScreenTime(this.getScreenTime());
  }
  
  public getFocusScore(): number {
    return this.focusScore;
  }
  
  public getDistractionCount(): number {
    return this.distractionCount;
  }
  
  public getLastActiveWindow(): string | null {
    return this.lastActiveWindow;
  }
  
  public getRecentSwitchCount(): number {
    console.log(`Current recent switch count: ${this.recentSwitches}`);
    return this.recentSwitches;
  }
  
  public getAppUsageData(): Array<{name: string, time: number, type: string}> {
    return Array.from(this.appUsageData.entries()).map(([name, data]) => ({
      name,
      time: data.time,
      type: data.type
    }));
  }
  
  public setFocusMode(active: boolean): void {
    this.isFocusMode = active;
    
    if (active) {
      this.notificationThrottleMap.clear();
    }
    
    this.notifyFocusModeListeners();
    this.persistData();
    
    console.log(`Focus Mode ${active ? 'activated' : 'deactivated'}`);
    
    if (this.isDesktopApp && window.electron) {
      window.electron.send('set-tray-tooltip', 
        `Mindful Desktop Companion ${active ? '(Focus Mode)' : ''}`
      );
    }
  }
  
  public getFocusMode(): boolean {
    return this.isFocusMode;
  }
  
  public setFocusModeWhitelist(whitelist: string[]): void {
    const mergedWhitelist = [...new Set([...whitelist, ...this.DEFAULT_WHITELIST_APPS])];
    this.focusModeWhitelist = mergedWhitelist;
    
    this.notificationThrottleMap.clear();
    
    this.persistData();
  }
  
  public getFocusModeWhitelist(): string[] {
    return this.focusModeWhitelist;
  }
  
  public setDimOption(dimInsteadOfBlock: boolean): void {
    this.dimInsteadOfBlock = dimInsteadOfBlock;
    this.persistData();
  }
  
  public getDimOption(): boolean {
    return this.dimInsteadOfBlock;
  }
  
  public addFocusModeListener(callback: (isActive: boolean) => void): void {
    this.focusModeListeners.push(callback);
    callback(this.isFocusMode);
  }
  
  public removeFocusModeListener(callback: (isActive: boolean) => void): void {
    const index = this.focusModeListeners.indexOf(callback);
    if (index > -1) {
      this.focusModeListeners.splice(index, 1);
    }
  }
  
  private notifyFocusModeListeners(): void {
    this.focusModeListeners.forEach(listener => {
      listener(this.isFocusMode);
    });
  }
  
  public resetNotifications(): void {
    this.notificationThrottleMap.clear();
  }
}

export default SystemTrayService;
