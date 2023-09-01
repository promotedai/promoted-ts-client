// package: common
// file: proto/common/common.proto

export interface UserInfo {
  userId?: string;
  anonUserId?: string;
  isInternalUser?: boolean;
}

export interface Timing {
  clientLogTimestamp?: number;
  eventApiTimestamp?: number;
}

export interface Properties {
  structBytes?: Uint8Array | string;
  // TODO - support a type for struct.
  struct?: any;
}

export type TrafficType = 0 | 1 | 2 | 4 | 5 | 'UNKNOWN_TRAFFIC_TYPE' | 'PRODUCTION' | 'REPLAY' | 'SHADOW' | 'LOAD_TEST';
export type ClientType = 0 | 1 | 2 | 'UNKNOWN_REQUEST_CLIENT' | 'PLATFORM_SERVER' | 'PLATFORM_CLIENT';

export interface ClientInfo {
  trafficType?: TrafficType;
  clientType?: ClientType;
}

export interface Size {
  width?: number;
  height?: number;
}

export interface ClientBrandHint {
  brand?: string;
  version?: string;
}
export interface ClientHints {
  isMobile?: boolean;
  brand?: ClientBrandHint[];
  architcture?: string;
  model?: string;
  platform?: string;
  platformVersion?: string;
  uaFullVersion?: string;
}

export interface Location {
  latitude?: number;
  longitude?: number;
  accuracyInMeters?: number;
}

export interface Browser {
  userAgent?: string;
  viewportSize?: Size;
  clientHints?: ClientHints;
  referrer?: string;
}

export enum DeviceType {
  UNKNOWN_DEVICE_TYPE,
  DESKTOP,
  MOBILE,
  TABLET,
}

export interface Screen {
  size?: Size;
  scale?: number;
}

export interface Device {
  deviceType?: Device;
  brand?: string;
  manufacturer?: string;
  identifier?: string;
  screen?: Screen;
  ipAddress?: string;
  location?: Location;
  browser?: Browser;
}
