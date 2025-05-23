
import React, { useEffect } from 'react';
import { useFocusMode } from '@/contexts/FocusModeContext';

// This component now serves as an adapter to trigger focus mode popups correctly

interface FocusModeAlertProps {
  appName: string;
  onDismiss: () => void;
  imageUrl?: string;
}

export function FocusModeAlert({ 
  appName,
  onDismiss
}: FocusModeAlertProps) {
  const { customText, customImage } = useFocusMode();

  useEffect(() => {
    // Creates a unique notification ID with timestamp
    const notificationId = `focus-mode-${appName}-${Date.now()}`;
    
    // Use the custom text from focus mode settings or a default
    const alertText = customText || `You're outside your focus zone. ${appName} is not in your whitelist.`;
    
    console.log("FocusModeAlert - Dispatching with custom image:", customImage);
    console.log("FocusModeAlert - Custom text:", alertText);
    
    // Create and dispatch the focus popup event with better media handling
    const focusPopupEvent = new CustomEvent('show-focus-popup', { 
      detail: {
        title: "Focus Mode Alert",
        body: alertText.replace('{app}', appName),
        notificationId: notificationId,
        appName: appName,
        mediaType: customImage ? 'image' : undefined,
        mediaContent: customImage,
        // Add explicit image handling
        hasCustomImage: !!customImage,
        imageUrl: customImage
      }
    });
    
    // Dispatch the event to trigger the RichMediaPopup
    console.log(`Dispatching focus popup event for app: ${appName} with image: ${customImage ? 'YES' : 'NO'}`);
    window.dispatchEvent(focusPopupEvent);
    
    // Also notify electron process about the focus popup with improved image handling
    if (window.electron) {
      console.log("Sending focus popup to Electron with image:", customImage);
      window.electron.send('show-focus-popup', {
        title: "Focus Mode Alert",
        body: alertText.replace('{app}', appName),
        notificationId: notificationId,
        mediaType: customImage ? 'image' : undefined,
        mediaContent: customImage,
        appName: appName,
        hasCustomImage: !!customImage,
        imageUrl: customImage
      });
    }
    
    // Set up a listener for when the popup is displayed
    const handlePopupDisplayed = (event: CustomEvent<{notificationId: string}>) => {
      if (event.detail.notificationId === notificationId) {
        console.log("Focus popup displayed successfully");
        // Call onDismiss to let parent components know popup was shown
        onDismiss();
      }
    };
    
    window.addEventListener('focus-popup-displayed', handlePopupDisplayed as EventListener);
    
    // Clean up the event listener
    return () => {
      window.removeEventListener('focus-popup-displayed', handlePopupDisplayed as EventListener);
    };
  }, [appName, onDismiss, customText, customImage]);
  
  // This component doesn't render anything - it just triggers the popup
  return null;
}
