
import { toast } from "sonner";

// Custom hook to manage toast notifications with consistent durations
export const useToastDuration = () => {
  const showSuccess = (message: string, duration: number = 2500) => {
    toast.success(message, { duration });
  };

  const showError = (message: string, duration: number = 3000) => {
    toast.error(message, { duration });
  };

  const showInfo = (message: string, duration: number = 2500) => {
    toast.info(message, { duration });
  };

  const showWarning = (message: string, duration: number = 2500) => {
    toast.warning(message, { duration });
  };

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning
  };
};
