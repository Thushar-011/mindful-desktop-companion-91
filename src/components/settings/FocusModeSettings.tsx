import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { X, Plus, Upload, Image, CheckCircle, XCircle, AlertCircle, Eye } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export function FocusModeSettings() {
  const { 
    isFocusMode, 
    toggleFocusMode, 
    whitelist, 
    addToWhitelist, 
    removeFromWhitelist,
    dimInsteadOfBlock,
    toggleDimOption,
    currentActiveApp,
    isCurrentAppWhitelisted,
    customImage,
    customText,
    updateCustomText,
    updateCustomImage,
    testFocusModePopup
  } = useFocusMode();
  
  const { user } = useAuth();
  const userId = user?.id || 'guest';
  
  const [newApp, setNewApp] = useState("");
  
  // Custom alert settings
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [editingText, setEditingText] = useState(customText || "");
  const [previewText, setPreviewText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Update editing text when customText changes
  useEffect(() => {
    if (customText) {
      setEditingText(customText);
    }
  }, [customText]);

  // Format the text for preview/saving to include both parts
  const formatFullText = (text: string): string => {
    // Make sure we always have the default system message
    const systemMessage = "You're outside your focus zone. {app} is not in your whitelist.";
    
    // If the provided text already contains the system message, return as is
    if (text.includes(systemMessage)) {
      return text;
    }
    
    // Otherwise append the motivational text to the system message
    return `${systemMessage} ${text}`;
  };
  
  const handleAddToWhitelist = () => {
    if (newApp.trim()) {
      addToWhitelist(newApp.trim());
      setNewApp("");
    } else if (currentActiveApp) {
      addToWhitelist(currentActiveApp);
    }
  };
  
  const handleAddCurrentApp = () => {
    if (currentActiveApp) {
      addToWhitelist(currentActiveApp);
      toast.success(`Added ${currentActiveApp} to whitelist`);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file is an image
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file (PNG, JPG, WebP)');
        return;
      }
      
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image is too large (max 5MB)');
        return;
      }
      
      // Create URL for the uploaded file
      const imageUrl = URL.createObjectURL(file);
      updateCustomImage(imageUrl);
      
      setShowImageDialog(false);
      toast.success('Image updated successfully');
      
      // Show preview after a short delay
      setTimeout(() => {
        testFocusModePopup();
      }, 500);
    }
  };
  
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const clearCustomImage = () => {
    updateCustomImage(null);
    toast.info('Image removed');
  };
  
  const handleUpdateCustomText = () => {
    if (editingText) {
      // Format the text to include the system message
      const fullText = formatFullText(editingText);
      updateCustomText(fullText);
      
      toast.success('Message updated');
      
      // Show preview after updating text
      setTimeout(() => {
        testFocusModePopup();
      }, 500);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Focus Mode</CardTitle>
        <CardDescription>
          Control which applications and websites you can access during focus sessions
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Main Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="focus-mode">Enable Focus Mode</Label>
              <p className="text-sm text-muted-foreground">
                Block or dim non-whitelisted apps and websites
              </p>
            </div>
            <Switch 
              id="focus-mode" 
              checked={isFocusMode} 
              onCheckedChange={toggleFocusMode}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="dim-mode">Dim instead of block</Label>
              <p className="text-sm text-muted-foreground">
                Dim screen when using non-whitelisted apps instead of blocking them
              </p>
            </div>
            <Switch 
              id="dim-mode" 
              checked={dimInsteadOfBlock} 
              onCheckedChange={toggleDimOption}
            />
          </div>
        </div>
        
        <Separator />
        
        {/* Custom Focus Mode Alert Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Focus Mode Alert</h3>
          <p className="text-sm text-muted-foreground">
            Customize the popup that appears when you use non-whitelisted apps
          </p>
          
          {/* Custom notification image */}
          <div className="space-y-2">
            <Label>Custom Image</Label>
            
            <div className="flex flex-col space-y-3">
              {customImage ? (
                <div className="relative border rounded-lg overflow-hidden">
                  <img 
                    src={customImage} 
                    alt="Custom focus mode image" 
                    className="w-full h-40 object-contain bg-black/5"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 rounded-full"
                    onClick={clearCustomImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 flex flex-col items-center justify-center space-y-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setShowImageDialog(true)}
                >
                  <Image className="h-10 w-10 text-muted-foreground/60" />
                  <p className="text-sm text-center text-muted-foreground">
                    No image selected<br />
                    Click to upload an image
                  </p>
                </div>
              )}
              
              <div className="flex space-x-2">
                <Button 
                  onClick={() => setShowImageDialog(true)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {customImage ? 'Change Image' : 'Upload Image'}
                </Button>
                
                <Button
                  onClick={testFocusModePopup}
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Alert
                </Button>
              </div>
            </div>
          </div>
          
          {/* Custom notification text */}
          <div className="space-y-2">
            <Label htmlFor="custom-text">Motivational Message (Optional)</Label>
            <Textarea
              id="custom-text"
              placeholder="Stay focused! You can do this."
              value={editingText.replace("You're outside your focus zone. {app} is not in your whitelist.", "").trim()}
              onChange={(e) => setEditingText(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This message will appear below the standard alert text
            </p>
            <Button 
              onClick={handleUpdateCustomText} 
              variant="secondary" 
              size="sm"
            >
              Save Message
            </Button>
          </div>
        </div>
        
        <Separator />
        
        {/* Live Whitelist Match Preview */}
        <div className="space-y-2">
          <Label>Current App Status</Label>
          <div className={cn(
            "p-3 rounded-lg border flex items-center justify-between",
            currentActiveApp ? 
              isCurrentAppWhitelisted ? 
                "bg-green-100/10 border-green-500/30" : 
                "bg-red-100/10 border-red-500/30" :
              "bg-gray-100/10 border-gray-500/30"
          )}>
            <div>
              <p className="text-sm font-medium">
                {currentActiveApp || "No active window detected"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {currentActiveApp ? 
                  isCurrentAppWhitelisted ? 
                    "This app is allowed in Focus Mode" : 
                    "This app is blocked in Focus Mode" :
                  "Waiting for app detection"}
              </p>
            </div>
            <div>
              {currentActiveApp ? (
                isCurrentAppWhitelisted ? (
                  <Badge className="bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Allowed
                  </Badge>
                ) : (
                  <div className="flex flex-col items-end space-y-2">
                    <Badge className="bg-red-500 text-white">
                      <XCircle className="h-3 w-3 mr-1" />
                      Blocked
                    </Badge>
                    {!isCurrentAppWhitelisted && (
                      <Button 
                        onClick={handleAddCurrentApp}
                        variant="outline"
                        size="sm"
                        className="border-green-500 text-green-500 hover:bg-green-500/10"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Whitelist
                      </Button>
                    )}
                  </div>
                )
              ) : (
                <Badge variant="outline">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not detected
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {/* Whitelist Management */}
        <div className="space-y-4">
          <Label>Manage Whitelist</Label>
          
          <div className="flex space-x-2">
            <Input 
              placeholder="Add application or website name" 
              value={newApp}
              onChange={(e) => setNewApp(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddToWhitelist();
                }
              }}
            />
            <Button onClick={handleAddToWhitelist}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
            {whitelist.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">
                No apps in whitelist. Add apps that you want to allow during Focus Mode.
              </p>
            ) : (
              whitelist.map((app) => (
                <div 
                  key={app} 
                  className={cn(
                    "flex items-center justify-between rounded p-2",
                    currentActiveApp && currentActiveApp.toLowerCase().includes(app.toLowerCase()) ? 
                      "bg-green-100/10 border border-green-500/30" : 
                      "bg-secondary/50"
                  )}
                >
                  <span className="text-sm">{app}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeFromWhitelist(app)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Hidden file input for image upload */}
        <input 
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        
        <AlertDialog open={showImageDialog} onOpenChange={setShowImageDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Upload Custom Image</AlertDialogTitle>
              <AlertDialogDescription>
                Choose an image to show on focus mode notifications.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="flex items-center justify-center p-6 border-2 border-dashed border-muted-foreground/20 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                 onClick={triggerFileInput}>
              <div className="text-center space-y-2">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to select an image, or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WebP up to 5MB
                </p>
              </div>
            </div>
            
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
