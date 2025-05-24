
// This service handles system tray functionality and active window monitoring

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
  private processedNotifications: Set<string> = new Set();

  // Screen time tracking variables
  private screenTimeStart: number = 0;
  private screenTimeToday: number = 0;
  private lastScreenTimeUpdate: number = 0;
  private idleThreshold: number = 60000;
  private lastActivityTime: number = 0;
  private screenTimeListeners: Array<(screenTime: number) => void> = [];
  private appUsageListeners: Array<(appUsage: Array<{name: string, time: number, type: string, lastActiveTime?: number}>) => void> = [];
  private appUsageData: Map<string, {time: number, type: string, lastActiveTime: number, sessionStart: number}> = new Map();
  
  private userIdleTime: number = 0;
  private idleCheckInterval: NodeJS.Timeout | null = null;
  
  // Focus mode properties
  private isFocusMode: boolean = false;
  private focusModeWhitelist: string[] = [];
  private dimInsteadOfBlock: boolean = true;
  private focusModeListeners: Array<(isActive: boolean) => void> = [];
  
  // Recent window switch tracking for custom rules
  private recentSwitches: number = 0;
  private recentSwitchesTimer: NodeJS.Timeout | null = null;
  private lastWindowSwitchTime: number = 0;
  
  // Throttle for notification display
  private notificationThrottleMap: Map<string, number> = new Map();
  private notificationThrottleTime: number = 2000; // 2 seconds throttle
  
  // Default whitelist apps that should never trigger focus alerts
  private readonly DEFAULT_WHITELIST_APPS = ['Electron', 'electron', 'Mindful Desktop Companion', 'chrome-devtools'];
  
  private persistedData: {
    screenTimeToday: number,
    appUsageData: Array<{name: string, time: number, type: string, lastActiveTime: number}>,
    focusModeWhitelist?: string[],
    isFocusMode?: boolean,
    dimInsteadOfBlock?: boolean
  } | null = null;

  // User isolation
  private currentUserId: string | null = null;

  private constructor() {
    console.log("System tray service initialized");
    
    // Check if running in Electron or similar desktop environment
    this.isDesktopApp = this.checkIsDesktopApp();
    
    // Initialize screen time tracking
    this.initializeScreenTimeTracking();
    
    if (this.isDesktopApp) {
      this.initializeDesktopMonitoring();
    }
    
    // Initialize recent switches tracking for custom rules
    this.initRecentSwitchesTracking();
  }

  // Set current user for data isolation
  public setCurrentUser(userId: string): void {
    if (this.currentUserId !== userId) {
      console.log(`Switching to user: ${userId}`);
      this.currentUserId = userId;
      
      // Clear current data
      this.resetUserData();
      
      // Load user-specific data
      this.loadUserData(userId);
    }
  }

  // Reset all user-specific data
  private resetUserData(): void {
    this.screenTimeToday = 0;
    this.appUsageData.clear();
    this.processedNotifications.clear();
    this.notificationThrottleMap.clear();
    
    // Reset focus mode settings to defaults
    this.focusModeWhitelist = [...this.DEFAULT_WHITELIST_APPS];
    this.isFocusMode = false;
    this.dimInsteadOfBlock = true;
    
    // Notify listeners of reset
    this.notifyScreenTimeListeners();
    this.notifyAppUsageListeners();
    this.notifyFocusModeListeners();
  }

  // Load user-specific data
  private loadUserData(userId: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const userDataKey = `systemTrayData_${userId}`;
      const savedData = localStorage.getItem(userDataKey);
      if (!savedData) return;
      
      const parsedData = JSON.parse(savedData);
      const timestamp = parsedData.timestamp || 0;
      const now = Date.now();
      
      // Only load data if it's from today (within the last 24h)
      if (now - timestamp < 24 * 60 * 60 * 1000) {
        this.screenTimeToday = parsedData.screenTimeToday || 0;
        
        // Load focus mode settings
        if (parsedData.focusModeWhitelist) {
          const mergedWhitelist = [...new Set([
            ...parsedData.focusModeWhitelist, 
            ...this.DEFAULT_WHITELIST_APPS
          ])];
          this.focusModeWhitelist = mergedWhitelist;
        }
        
        if (parsedData.isFocusMode !== undefined) {
          this.isFocusMode = parsedData.isFocusMode;
        }
        
        if (parsedData.dimInsteadOfBlock !== undefined) {
          this.dimInsteadOfBlock = parsedData.dimInsteadOfBlock;
        }
        
        // Restore app usage data with session tracking
        if (parsedData.appUsageData && Array.isArray(parsedData.appUsageData)) {
          parsedData.appUsageData.forEach((app: any) => {
            if (app.name && app.time != null && app.type) {
              this.appUsageData.set(app.name, {
                time: app.time,
                type: app.type,
                lastActiveTime: app.lastActiveTime || now,
                sessionStart: now
              });
            }
          });
        }
        
        console.log(`Loaded user data for ${userId}:`, parsedData);
      }
    } catch (error) {
      console.error("Failed to load user data:", error);
    }
  }

  // Initialize recent switches tracking for custom rules
  private initRecentSwitchesTracking(): void {
    setInterval(() => {
      this.recentSwitches = 0;
    }, 300000);
  }

  // Persist user-specific data to localStorage
  private persistUserData(): void {
    if (typeof window === 'undefined' || !this.currentUserId) return;
    
    try {
      const userDataKey = `systemTrayData_${this.currentUserId}`;
      const dataToSave = {
        screenTimeToday: this.screenTimeToday,
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
      
      localStorage.setItem(userDataKey, JSON.stringify(dataToSave));
      console.log(`Persisted data for user ${this.currentUserId}:`, dataToSave);
    } catch (error) {
      console.error("Failed to persist user data:", error);
    }
  }

  // Initialize screen time tracking
  private initializeScreenTimeTracking(): void {
    this.screenTimeStart = Date.now();
    this.lastActivityTime = Date.now();
    this.lastScreenTimeUpdate = Date.now();
    
    // Update screen time every minute
    setInterval(() => {
      this.updateScreenTime();
    }, 60000);
    
    // Check for user idle every 10 seconds
    this.idleCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - this.lastActivityTime;
      
      if (timeSinceLastActivity > this.idleThreshold) {
        this.userIdleTime = timeSinceLastActivity;
      } else {
        this.userIdleTime = 0;
      }
    }, 10000);
    
    // Setup daily reset at midnight
    this.setupDailyReset();
    
    // Add event listener to persist data before unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.persistUserData());
      window.addEventListener('blur', () => this.persistUserData());
      
      // Persist data periodically
      setInterval(() => this.persistUserData(), 60000);
    }
  }
  
  // Setup daily reset at midnight
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
  
  // Reset daily statistics
  private resetDailyStats(): void {
    this.screenTimeToday = 0;
    this.appUsageData.clear();
    
    this.notifyScreenTimeListeners();
    this.notifyAppUsageListeners();
  }
  
  // Update screen time calculation
  private updateScreenTime(): void {
    const now = Date.now();
    
    // Don't count time if user is idle
    if (this.userIdleTime < this.idleThreshold) {
      const timeElapsed = now - this.lastScreenTimeUpdate;
      this.screenTimeToday += timeElapsed;
      
      // Update current app usage if there's an active window
      if (this.lastActiveWindow) {
        this.updateAppUsageTime(this.lastActiveWindow, timeElapsed);
      }
      
      this.notifyScreenTimeListeners();
      this.notifyAppUsageListeners();
    }
    
    this.lastScreenTimeUpdate = now;
  }

  // Update app usage time for the current session
  private updateAppUsageTime(appName: string, timeElapsed: number): void {
    const appData = this.appUsageData.get(appName);
    if (appData) {
      appData.time += timeElapsed;
      appData.lastActiveTime = Date.now();
      this.appUsageData.set(appName, appData);
    }
  }
  
  // Format screen time as hours:minutes
  public formatScreenTime(milliseconds: number): string {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  }

  // Detect if we're running in a desktop environment
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

  // Initialize real monitoring for desktop environments
  private initializeDesktopMonitoring(): void {
    console.log("Initializing real desktop monitoring");
    
    if (this.isDesktopApp && window.electron) {
      const unsubscribeActiveWindow = window.electron.receive('active-window-changed', (windowInfo: any) => {
        this.handleRealWindowSwitch(windowInfo.title);
        this.trackAppUsage(windowInfo.title, windowInfo.owner || "Unknown");
        this.lastActivityTime = Date.now();
      });
      
      // For testing - simulate window switches in dev mode
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

  // Track app usage for a specific application
  private trackAppUsage(appTitle: string, appOwner: string): void {
    const appName = appOwner !== "Unknown" ? appOwner : appTitle;
    const now = Date.now();
    
    const coreAppName = this.extractAppName(appName);
    let appType = this.determineAppType(coreAppName);
    
    // Get or create app usage data with session tracking
    if (!this.appUsageData.has(coreAppName)) {
      this.appUsageData.set(coreAppName, { 
        time: 0, 
        type: appType, 
        lastActiveTime: now,
        sessionStart: now
      });
    } else {
      // Update last active time and ensure session continuity
      const appData = this.appUsageData.get(coreAppName)!;
      appData.lastActiveTime = now;
      this.appUsageData.set(coreAppName, appData);
    }
    
    // Check if this is a system app
    const isSystemApp = this.DEFAULT_WHITELIST_APPS.some(defaultApp => 
      coreAppName.toLowerCase().includes(defaultApp.toLowerCase()) || 
      defaultApp.toLowerCase().includes(coreAppName.toLowerCase())
    );
    
    // Check focus mode - clear processed notifications for new sessions
    if (this.isFocusMode && 
        !isSystemApp && 
        !this.isAppInWhitelist(coreAppName, this.focusModeWhitelist)) {
      this.notifyFocusModeViolation(coreAppName);
    }
    
    this.notifyAppUsageListeners();
  }
  
  // Extract the core app name from window title
  private extractAppName(windowTitle: string): string {
    if (!windowTitle) return '';
    
    const appNameMatches = windowTitle.match(/^(.*?)(?:\s[-–—]\s|\s\|\s|\s:|\s\d|$)/);
    return appNameMatches?.[1]?.trim() || windowTitle.trim();
  }
  
  // Check if app is in whitelist with flexible matching
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
  
  // Determine app type based on name
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
  
  // Screen time listener methods
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
  
  // App usage listener methods
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

  // Handle real window switch data from desktop APIs
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

  // Handle window switch 
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
  }

  // Throttled notification method to prevent spam
  private notifyFocusModeViolation(appName: string): void {
    if (this.DEFAULT_WHITELIST_APPS.some(defaultApp => 
        appName.toLowerCase().includes(defaultApp.toLowerCase()) || 
        defaultApp.toLowerCase().includes(appName.toLowerCase()))) {
      return;
    }
    
    const notificationId = `focus-mode-violation-${appName}`;
    
    // Reset processed notifications when switching back to whitelisted app
    if (this.isAppInWhitelist(appName, this.focusModeWhitelist)) {
      this.processedNotifications.clear();
      return;
    }
    
    if (this.processedNotifications.has(notificationId)) {
      return;
    }
    
    const now = Date.now();
    const lastNotified = this.notificationThrottleMap.get(appName) || 0;
    
    if (now - lastNotified < this.notificationThrottleTime) {
      console.log(`Throttling notification for ${appName}, too recent`);
      return;
    }
    
    this.notificationThrottleMap.set(appName, now);
    this.processedNotifications.add(notificationId);
    
    const message = `You're outside your focus zone. ${appName} is not in your whitelist.`;
    
    if (this.isDesktopApp && window.electron) {
      console.log("Sending focus mode violation notification via IPC");
      window.electron.send('show-native-notification', {
        title: "Focus Mode Alert", 
        body: message,
        notificationId: notificationId
      });
    }
    
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

  // Tray methods
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
  
  // Public getter methods
  public getScreenTime(): number {
    this.updateScreenTime();
    return this.screenTimeToday;
  }
  
  public getFormattedScreenTime(): string {
    return this.formatScreenTime(this.getScreenTime());
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
  
  // Focus Mode methods
  public setFocusMode(active: boolean): void {
    this.isFocusMode = active;
    
    if (active) {
      this.processedNotifications.clear();
      this.notificationThrottleMap.clear();
    }
    
    this.notifyFocusModeListeners();
    this.persistUserData();
    
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
    
    this.processedNotifications.clear();
    this.notificationThrottleMap.clear();
    
    this.persistUserData();
  }
  
  public getFocusModeWhitelist(): string[] {
    return this.focusModeWhitelist;
  }
  
  public setDimOption(dimInsteadOfBlock: boolean): void {
    this.dimInsteadOfBlock = dimInsteadOfBlock;
    this.persistUserData();
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
    this.processedNotifications.clear();
    this.notificationThrottleMap.clear();
  }
}

export default SystemTrayService;
