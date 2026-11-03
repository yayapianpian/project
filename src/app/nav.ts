import {
  BarChart3, BookOpen, Bot, Briefcase, Building2, ClipboardCheck, Code2, Database, FolderKanban,
  LayoutDashboard, Map, Radar, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '首頁與學習總覽', icon: LayoutDashboard },
  { path: '/roadmap', label: '180 天學習路線', icon: Map },
  { path: '/lessons', label: '課程教學中心', icon: BookOpen },
  { path: '/sql', label: 'SQL 練習室', icon: Database },
  { path: '/python', label: 'Python 練習室', icon: Code2 },
  { path: '/powerbi', label: 'Power BI 實戰中心', icon: BarChart3 },
  { path: '/quiz', label: '測驗中心', icon: ClipboardCheck },
  { path: '/projects', label: '產業模擬專案', icon: Building2 },
  { path: '/tutor', label: 'AI 導師', icon: Bot },
  { path: '/portfolio', label: '個人作品集', icon: FolderKanban },
  { path: '/interview', label: '求職面試中心', icon: Briefcase },
  { path: '/abilities', label: '個人能力分析', icon: Radar },
];
