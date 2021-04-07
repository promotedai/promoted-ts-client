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
