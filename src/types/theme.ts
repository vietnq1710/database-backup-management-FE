export interface Theme {
  name: string;
  color1: string; // primary (saturated)
  color2: string; // pale / light
  color3: string; // white
  label: string;
  // Panel / UI palette — kept in the theme so panels re-color with the visual
  panelDark: string;  // very dark bg / active button bg
  panelMid: string;   // borders / hover bg / dividers
  panelLight: string; // labels / body text accents
  textMuted: string;  // de-saturated shade for line-through / completed text
}

export const THEMES: Theme[] = [
  {
    name: 'blue',
    label: 'BL',
    color1: '#3A7CA5',
    color2: '#7FB0CF',
    color3: '#FFFFFF',
    panelDark: '#0F2535',
    panelMid: '#1F4A65',
    panelLight: '#A7C9DE',
    textMuted: '#6B87A0',
  },
  {
    name: 'green',
    label: 'GR',
    color1: '#718355',
    color2: '#A5B38A',
    color3: '#FFFFFF',
    panelDark: '#1D2310',
    panelMid: '#3D4A24',
    panelLight: '#C2CEA8',
    textMuted: '#8A9875',
  },
  {
    name: 'red',
    label: 'RD',
    color1: '#6A040F',
    color2: '#B54150',
    color3: '#FFFFFF',
    panelDark: '#22010A',
    panelMid: '#420610',
    panelLight: '#E9A9B0',
    textMuted: '#9C646B',
  },
  {
    name: 'yellow',
    label: 'YL',
    color1: '#E6AF2E',
    color2: '#F0CD75',
    color3: '#FFFFFF',
    panelDark: '#3A2B07',
    panelMid: '#6D5212',
    panelLight: '#F6DFA8',
    textMuted: '#B8945E',
  },
];

export type ThemeName = 'blue' | 'green' | 'red' | 'yellow';
