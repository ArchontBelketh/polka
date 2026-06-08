export const TECH_COLOR_CLASSES: Record<string, string> = {
  blue:   "bg-blue-500/10 text-blue-400 border-blue-500/30",
  green:  "bg-green-500/10 text-green-400 border-green-500/30",
  yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  orange: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  red:    "bg-red-500/10 text-red-400 border-red-500/30",
  cyan:   "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  gray:   "bg-gray-500/10 text-gray-400 border-gray-500/30",
}

export type TechColor = keyof typeof TECH_COLOR_CLASSES

export interface TechTag {
  label: string
  color: TechColor
}

export const TECH_GROUPS: { group: string; tags: TechTag[] }[] = [
  {
    group: "Языки",
    tags: [
      { label: "Python",     color: "blue"   },
      { label: "JavaScript", color: "yellow" },
      { label: "TypeScript", color: "blue"   },
      { label: "PHP",        color: "purple" },
      { label: "C#",         color: "purple" },
      { label: "VBA",        color: "green"  },
      { label: "1С",         color: "orange" },
      { label: "Go",         color: "cyan"   },
      { label: "Java",       color: "orange" },
      { label: "Kotlin",     color: "purple" },
      { label: "Rust",       color: "orange" },
      { label: "Basic",      color: "gray"   },
      { label: "Lua",        color: "blue"   },
      { label: "Ruby",       color: "red"    },
      { label: "Bash",       color: "gray"   },
      { label: "PowerShell", color: "blue"   },
    ],
  },
  {
    group: "Фреймворки и библиотеки",
    tags: [
      { label: "aiogram",             color: "blue"   },
      { label: "Telethon",            color: "blue"   },
      { label: "python-telegram-bot", color: "blue"   },
      { label: "Node.js",             color: "green"  },
      { label: "Express",             color: "gray"   },
      { label: "React",               color: "cyan"   },
      { label: "Vue",                 color: "green"  },
      { label: "Next.js",             color: "gray"   },
      { label: "FastAPI",             color: "green"  },
      { label: "Django",              color: "green"  },
      { label: "Flask",               color: "gray"   },
      { label: "Laravel",             color: "red"    },
      { label: "Selenium",            color: "green"  },
      { label: "Playwright",          color: "green"  },
      { label: "BeautifulSoup",       color: "orange" },
      { label: "Scrapy",              color: "green"  },
      { label: "pandas",              color: "blue"   },
      { label: "openpyxl",            color: "green"  },
    ],
  },
  {
    group: "Базы данных",
    tags: [
      { label: "PostgreSQL", color: "blue"  },
      { label: "MySQL",      color: "blue"  },
      { label: "SQLite",     color: "gray"  },
      { label: "MongoDB",    color: "green" },
      { label: "Redis",      color: "red"   },
    ],
  },
  {
    group: "API и сервисы",
    tags: [
      { label: "Telegram API",  color: "blue"  },
      { label: "OpenAI API",    color: "green" },
      { label: "Google Sheets", color: "green" },
      { label: "VK API",        color: "blue"  },
      { label: "Docker",        color: "blue"  },
    ],
  },
]

const TAG_COLOR_MAP: Record<string, TechColor> = Object.fromEntries(
  TECH_GROUPS.flatMap(g => g.tags.map(t => [t.label, t.color])),
)

export function getTechTagColor(label: string): TechColor {
  return TAG_COLOR_MAP[label] ?? "gray"
}
