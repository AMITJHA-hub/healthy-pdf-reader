
export const AGE_GROUPS = {
  CHILD: { min: 0, max: 12 },
  ADULT: { min: 13, max: 50 },
  SENIOR: { min: 51, max: 150 },
} as const;

export interface HealthRecommendation {
  breakInterval: number; // in minutes
  maxSessionDuration: number; // in minutes
  waterReminderInterval: number; // in minutes
  tips: string[];
}

export function getHealthRecommendations(age: number): HealthRecommendation {
  if (age <= AGE_GROUPS.CHILD.max) {
    return {
      breakInterval: 20,
      maxSessionDuration: 40,
      waterReminderInterval: 60,
      tips: [
        "Sit straight!",
        "Don't hold the screen too close.",
        "Take a break and play outside!",
      ],
    };
  } else if (age <= AGE_GROUPS.ADULT.max) {
    return {
      breakInterval: 20, // 20-20-20 rule
      maxSessionDuration: 60,
      waterReminderInterval: 60,
      tips: [
        "Follow the 20-20-20 rule.",
        "Take breaks often.",
        "Adjust screen brightness to match the room.",
      ],
    };
  } else {
    // Senior
    return {
      breakInterval: 15,
      maxSessionDuration: 45,
      waterReminderInterval: 30, // More frequent hydration
      tips: [
        "Ensure the room is well lit.",
        "Increase font size if needed.",
        "Look away from screen periodically.",
      ],
    };
  }
}

// 20-20-20 Rule Helper
export const RULES = {
  TWENTY_TWENTY_TWENTY: {
    workDuration: 20 * 60, // 20 minutes in seconds
    breakDuration: 20, // 20 seconds
    distance: 20, // 20 feet
  }
}
