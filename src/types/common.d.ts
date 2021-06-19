// package: common
// file: proto/common/common.proto

export interface UserInfo {
  userId?: string;
  logUserId?: string;
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

export type TrafficType = 0 | 1 | 2 | 4;
export type ClientType = 0 | 1 | 2;

export interface ClientInfo {
  trafficType?: TrafficType;
  clientType?: ClientType;
}
