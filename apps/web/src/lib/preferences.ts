import { create } from "zustand";

export type Language = "en" | "hi";
export type Theme = "light" | "dark";

interface PreferencesState {
  language: Language;
  theme: Theme;
  setLanguage: (lang: Language) => void;
  toggleTheme: () => void;
}

export const usePreferences = create<PreferencesState>((set, get) => ({
  language: (localStorage.getItem("mailpilot_lang") as Language) || "en",
  theme: (localStorage.getItem("mailpilot_theme") as Theme) || "light",
  setLanguage: (lang: Language) => {
    localStorage.setItem("mailpilot_lang", lang);
    set({ language: lang });
  },
  toggleTheme: () => {
    const nextTheme: Theme = get().theme === "light" ? "dark" : "light";
    localStorage.setItem("mailpilot_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    set({ theme: nextTheme });
  },
}));

// Quick translations dictionary for key UI labels
export const translations = {
  en: {
    dashboard: "Dashboard",
    campaignStudio: "Campaign Studio",
    reports: "Reports",
    contacts: "Contacts",
    schedule: "Schedule",
    automations: "Automations",
    settings: "Settings",
    createCampaign: "Create Campaign",
    importContacts: "Import Contacts",
    welcomeBack: "Welcome back",
    searchPlaceholder: "Search campaigns, contacts...",
    quickLaunch: "Quick Launch",
    sent: "Sent",
    opened: "Opened",
    clicked: "Clicked",
    unsubscribed: "Unsubscribed",
  },
  hi: {
    dashboard: "डैशबोर्ड",
    campaignStudio: "अभियान स्टूडियो",
    reports: "रिपोर्ट्स",
    contacts: "संपर्क",
    schedule: "शेड्यूल",
    automations: "स्वचालन",
    settings: "सेटिंग्स",
    createCampaign: "अभियान बनाएं",
    importContacts: "संपर्क जोड़ें",
    welcomeBack: "वापसी पर स्वागत है",
    searchPlaceholder: "खोजें...",
    quickLaunch: "त्वरित कार्य",
    sent: "भेजे गए",
    opened: "खोले गए",
    clicked: "क्लिक किए",
    unsubscribed: "सदस्यता समाप्त",
  },
};

