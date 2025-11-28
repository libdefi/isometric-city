'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  PlayIcon,
  PauseIcon,
  FastForwardIcon,
  HappyIcon,
  HealthIcon,
  EducationIcon,
  SafetyIcon,
  EnvironmentIcon,
} from '@/components/ui/Icons';

import { WeatherType, Season } from '@/types/game';

// ============================================================================
// WEATHER ICON
// ============================================================================

interface WeatherIconProps {
  weather: WeatherType;
  className?: string;
}

export const WeatherIcon = ({ weather, className = "w-4 h-4" }: WeatherIconProps) => {
  switch (weather) {
    case 'clear':
      return (
        <svg className={`${className} text-yellow-400`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
        </svg>
      );
    case 'cloudy':
      return (
        <svg className={`${className} text-gray-400`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.5 9.75a6.75 6.75 0 0113.276-1.604 5.25 5.25 0 01.724 10.354H5.25a4.5 4.5 0 01-.75-8.75z" />
        </svg>
      );
    case 'rain':
    case 'heavy_rain':
      return (
        <svg className={`${className} text-blue-400`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.5 9.75a6.75 6.75 0 0113.276-1.604 5.25 5.25 0 01.724 10.354H5.25a4.5 4.5 0 01-.75-8.75z" />
          <path d="M8 19l-1 3M12 19l-1 3M16 19l-1 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'thunderstorm':
      return (
        <svg className={`${className} text-purple-400`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.5 9.75a6.75 6.75 0 0113.276-1.604 5.25 5.25 0 01.724 10.354H5.25a4.5 4.5 0 01-.75-8.75z" />
          <path d="M13 14l-2 4h3l-2 4" stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case 'snow':
    case 'heavy_snow':
    case 'blizzard':
      return (
        <svg className={`${className} text-blue-200`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.5 9.75a6.75 6.75 0 0113.276-1.604 5.25 5.25 0 01.724 10.354H5.25a4.5 4.5 0 01-.75-8.75z" />
          <circle cx="8" cy="19" r="1" fill="white" />
          <circle cx="12" cy="20" r="1" fill="white" />
          <circle cx="16" cy="19" r="1" fill="white" />
        </svg>
      );
    case 'heat_wave':
      return (
        <svg className={`${className} text-orange-500`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
          <path d="M5 17c1-2 3-3 4-1s2 3 4 1 3-3 4-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'fog':
      return (
        <svg className={`${className} text-gray-300`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 8h18M3 12h14M3 16h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      );
    default:
      return (
        <svg className={`${className} text-gray-400`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.5 9.75a6.75 6.75 0 0113.276-1.604 5.25 5.25 0 01.724 10.354H5.25a4.5 4.5 0 01-.75-8.75z" />
        </svg>
      );
  }
};

// Season display helpers
const SEASON_EMOJI: Record<Season, string> = {
  spring: '🌸',
  summer: '☀️',
  fall: '🍂',
  winter: '❄️',
};

const SEASON_NAMES: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

const WEATHER_NAMES: Record<WeatherType, string> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  rain: 'Rain',
  heavy_rain: 'Heavy Rain',
  thunderstorm: 'Thunderstorm',
  snow: 'Snow',
  heavy_snow: 'Heavy Snow',
  blizzard: 'Blizzard',
  heat_wave: 'Heat Wave',
  fog: 'Fog',
};

// ============================================================================
// TIME OF DAY ICON
// ============================================================================

interface TimeOfDayIconProps {
  hour: number;
}

export const TimeOfDayIcon = ({ hour }: TimeOfDayIconProps) => {
  const isNight = hour < 6 || hour >= 20;
  const isDawn = hour >= 6 && hour < 8;
  const isDusk = hour >= 18 && hour < 20;
  
  if (isNight) {
    // Moon icon
    return (
      <svg className="w-4 h-4 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    );
  } else if (isDawn || isDusk) {
    // Sunrise/sunset icon
    return (
      <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    );
  } else {
    // Sun icon
    return (
      <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    );
  }
};

// ============================================================================
// STAT BADGE
// ============================================================================

interface StatBadgeProps {
  value: string;
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

export function StatBadge({ value, label, variant = 'default' }: StatBadgeProps) {
  const colorClass = variant === 'success' ? 'text-green-500' : 
                     variant === 'warning' ? 'text-amber-500' : 
                     variant === 'destructive' ? 'text-red-500' : 'text-foreground';
  
  return (
    <div className="flex flex-col items-start min-w-[70px]">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">{label}</div>
      <div className={`text-sm font-mono tabular-nums font-semibold ${colorClass}`}>{value}</div>
    </div>
  );
}

// ============================================================================
// DEMAND INDICATOR
// ============================================================================

interface DemandIndicatorProps {
  label: string;
  demand: number;
  color: string;
}

export function DemandIndicator({ label, demand, color }: DemandIndicatorProps) {
  const height = Math.abs(demand) / 2;
  const isPositive = demand >= 0;
  
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[10px] font-bold ${color}`}>{label}</span>
      <div className="w-3 h-8 bg-secondary relative rounded-sm overflow-hidden">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
        <div
          className={`absolute left-0 right-0 ${color.replace('text-', 'bg-')}`}
          style={{
            height: `${height}%`,
            top: isPositive ? `${50 - height}%` : '50%',
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MINI STAT (for StatsPanel)
// ============================================================================

interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

export function MiniStat({ icon, label, value }: MiniStatProps) {
  const color = value >= 70 ? 'text-green-500' : value >= 40 ? 'text-amber-500' : 'text-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${color}`}>{Math.round(value)}%</span>
    </div>
  );
}

// ============================================================================
// STATS PANEL
// ============================================================================

export const StatsPanel = React.memo(function StatsPanel() {
  const { state } = useGame();
  const { stats } = state;
  
  return (
    <div className="h-8 bg-secondary/50 border-b border-border flex items-center justify-center gap-8 text-xs">
      <MiniStat icon={<HappyIcon size={12} />} label="Happiness" value={stats.happiness} />
      <MiniStat icon={<HealthIcon size={12} />} label="Health" value={stats.health} />
      <MiniStat icon={<EducationIcon size={12} />} label="Education" value={stats.education} />
      <MiniStat icon={<SafetyIcon size={12} />} label="Safety" value={stats.safety} />
      <MiniStat icon={<EnvironmentIcon size={12} />} label="Environment" value={stats.environment} />
    </div>
  );
});

// ============================================================================
// TOP BAR
// ============================================================================

export const TopBar = React.memo(function TopBar() {
  const { state, setSpeed, setTaxRate, isSaving } = useGame();
  const { stats, year, month, day, hour, speed, taxRate, cityName, weather } = state;
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${year}`;
  
  return (
    <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-foreground font-semibold text-sm">{cityName}</h1>
            {isSaving && (
              <span className="text-muted-foreground text-xs italic animate-pulse">Saving...</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono tabular-nums">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{monthNames[month - 1]} {year}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formattedDate}</p>
              </TooltipContent>
            </Tooltip>
            <TimeOfDayIcon hour={hour} />
          </div>
        </div>
        
        {/* Weather Display */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-md">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 cursor-default">
                <span className="text-sm">{SEASON_EMOJI[weather.season]}</span>
                <WeatherIcon weather={weather.current} className="w-4 h-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">{SEASON_NAMES[weather.season]} • {WEATHER_NAMES[weather.current]}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(weather.temperature)}°C / {Math.round(weather.temperature * 9/5 + 32)}°F
                </p>
                {weather.windSpeed > 0.3 && (
                  <p className="text-xs text-muted-foreground">
                    Wind: {Math.round(weather.windSpeed * 50)} km/h
                  </p>
                )}
                {weather.snowAccumulation > 0.1 && (
                  <p className="text-xs text-muted-foreground">
                    Snow: {Math.round(weather.snowAccumulation * 100)}% coverage
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.round(weather.temperature)}°
          </span>
        </div>
        
        <div className="flex items-center gap-1 bg-secondary rounded-md p-1">
          {[0, 1, 2, 3].map(s => (
            <Button
              key={s}
              onClick={() => setSpeed(s as 0 | 1 | 2 | 3)}
              variant={speed === s ? 'default' : 'ghost'}
              size="icon-sm"
              className="h-7 w-7"
              title={s === 0 ? 'Pause' : s === 1 ? 'Normal' : s === 2 ? 'Fast' : 'Very Fast'}
            >
              {s === 0 ? <PauseIcon size={14} /> : 
               s === 1 ? <PlayIcon size={14} /> : 
               s === 2 ? <FastForwardIcon size={14} /> :
               <div className="flex items-center -space-x-1">
                 <PlayIcon size={10} />
                 <PlayIcon size={10} />
                 <PlayIcon size={10} />
               </div>}
            </Button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-8">
        <StatBadge value={stats.population.toLocaleString()} label="Population" />
        <StatBadge value={stats.jobs.toLocaleString()} label="Jobs" />
        <StatBadge 
          value={`$${stats.money.toLocaleString()}`} 
          label="Funds"
          variant={stats.money < 0 ? 'destructive' : stats.money < 1000 ? 'warning' : 'success'}
        />
        <Separator orientation="vertical" className="h-8" />
        <StatBadge 
          value={`$${(stats.income - stats.expenses).toLocaleString()}`} 
          label="Monthly"
          variant={stats.income - stats.expenses >= 0 ? 'success' : 'destructive'}
        />
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <DemandIndicator label="R" demand={stats.demand.residential} color="text-green-500" />
          <DemandIndicator label="C" demand={stats.demand.commercial} color="text-blue-500" />
          <DemandIndicator label="I" demand={stats.demand.industrial} color="text-amber-500" />
        </div>
        
        <Separator orientation="vertical" className="h-8" />
        
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Tax</span>
          <Slider
            value={[taxRate]}
            onValueChange={(value) => setTaxRate(value[0])}
            min={0}
            max={100}
            step={1}
            className="w-16"
          />
          <span className="text-foreground text-xs font-mono tabular-nums w-8">{taxRate}%</span>
        </div>
      </div>
    </div>
  );
});
