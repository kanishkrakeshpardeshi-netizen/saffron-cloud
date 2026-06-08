export interface WeatherData {
  temp: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  external_lux: number;
  location: string;
}

export interface CropProfile {
  name: string;
  temp_min: number;
  temp_max: number;
  hum_min: number;
  hum_max: number;
  lux_min: number;
  lux_max: number;
  wind: string;
  photoperiod: string;
}

export interface CropListItem {
  id: string;
  name: string;
}

export interface Telemetry {
  sunlight: number;
  humidity_local: number;
  indoor_temp: number;
  ac_status: string;
  humidifier_status: string;
  exhaust_status: string;
  uv_light_status: string;
  connected_to_pi: boolean;
}

export interface DashboardProps {
  API: string;
  weather: WeatherData | null;
  error: string;
  lastUpdated: string | null;
  isRefreshing: boolean;
  location: string;
  setLocation: (v: string) => void;
  fetchWeather: (loc?: string) => void;
  cropList: CropListItem[];
  selectedCropId: string;
  handleCropSelect: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  activeCrop: CropProfile | null;
  wsConnected: boolean;
  telemetry: Telemetry;
  threshold: number;
  setThreshold: (v: number) => void;
  humThreshold: number;
  setHumThreshold: (v: number) => void;
  luxThreshold: number;
  setLuxThreshold: (v: number) => void;
  isAdmin?: boolean;
  selectedUserId?: string;
  setSelectedUserId?: (v: string) => void;
  targetNode?: any;
}
