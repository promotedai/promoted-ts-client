// package: delivery
// file: proto/delivery/delivery.proto

import * as proto_common_common_pb from './common';

export interface DeliveryLog {
  request?: Request;
  response?: Response;
  execution?: DeliveryExecution;
}

export interface Request {
  platformId?: number;
  userInfo?: proto_common_common_pb.UserInfo;
  timing?: proto_common_common_pb.Timing;
  device?: proto_common_common_pb.Device;
  requestId?: string;
  viewId?: string;
  sessionId?: string;
  useCase?: UseCaseMap[keyof UseCaseMap] | UseCaseString;
  searchQuery?: string;
  insertion?: Array<Insertion>;
  deliveryConfig?: DeliveryConfig;
  properties?: proto_common_common_pb.Properties;
  paging?: Paging;
  clientInfo?: proto_common_common_pb.ClientInfo;
  clientRequestId?: string;
}

export interface Paging {
  pagingId?: string;
  size?: number;
  cursor?: string;
  offset?: number;
}

export interface PagingInfo {
  pagingId?: string;
  cursor?: string;
}

export interface Response {
  insertion?: Array<Insertion>;
  pagingInfo?: PagingInfo;
}

export interface DeliveryExecution {
  executionServer?: ExecutionServerMap[keyof ExecutionServerMap] | ExecutionServerString;
}

export interface ExecutionServerMap {
  UNKNOWN_EXECUTION_SERVER: 0;
  API: 1;
  SDK: 2;
  SIMPLE_API: 3;
}

export type ExecutionServerString = 'UNKNOWN_EXECUTION_SERVER' | 'API' | 'SDK' | 'SIMPLE_API';

export const ExecutionServer: ExecutionServerMap;

export interface BlenderRule {
  ruleType?: BlenderRuleTypeMap[keyof BlenderRuleTypeMap] | BlenderRuleTypeString;
  priority?: number;
  properties?: proto_common_common_pb.Properties;
}

export interface DeliveryConfig {
  blenderRule?: Array<BlenderRule>;
}

export interface Insertion {
  platformId?: number;
  userInfo?: proto_common_common_pb.UserInfo;
  timing?: proto_common_common_pb.Timing;
  insertionId?: string;
  requestId?: string;
  viewId?: string;
  sessionId?: string;
  contentId?: string;
  position?: number;
  retrievalRank?: number;
  retrievalScore?: number;
  properties?: proto_common_common_pb.Properties;
}

export interface UseCaseMap {
  UNKNOWN_USE_CASE: 0;
  CUSTOM: 1;
  SEARCH: 2;
  SEARCH_SUGGESTIONS: 3;
  FEED: 4;
  RELATED_CONTENT: 5;
  CLOSE_UP: 6;
  CATEGORY_CONTENT: 7;
  MY_CONTENT: 8;
  MY_SAVED_CONTENT: 9;
  SELLER_CONTENT: 10;
}

export type UseCaseString =
  | 'UNKNOWN_USE_CASE'
  | 'CUSTOM'
  | 'SEARCH'
  | 'SEARCH_SUGGESTIONS'
  | 'FEED'
  | 'RELATED_CONTENT'
  | 'CLOSE_UP'
  | 'CATEGORY_CONTENT'
  | 'MY_CONTENT'
  | 'MY_SAVED_CONTENT'
  | 'SELLER_CONTENT';

export const UseCase: UseCaseMap;

export interface BlenderRuleTypeMap {
  UNKNOWN_RULE_TYPE: 0;
  POSITIVE: 1;
  INSERT: 2;
  NEGATIVE: 3;
  DIVERSITY: 4;
}

export type BlenderRuleTypeString = 'UNKNOWN_RULE_TYPE' | 'POSITIVE' | 'INSERT' | 'NEGATIVE' | 'DIVERSITY';

export const BlenderRuleType: BlenderRuleTypeMap;
