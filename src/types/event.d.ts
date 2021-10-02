// package: event
// file: proto/event/event.proto

import * as proto_common_common_pb from './common';
import * as proto_delivery_delivery_pb from './delivery';

export interface CohortMembership {
  platformId?: number;
  userInfo?: proto_common_common_pb.UserInfo;
  timing?: proto_common_common_pb.Timing;
  membershipId?: string;
  cohortId?: string;
  arm?: CohortArmMap[keyof CohortArmMap] | CohortArmString;
  properties?: proto_common_common_pb.Properties;
}

export interface LogRequest {
  platformId?: number;
  userInfo?: proto_common_common_pb.UserInfo;
  timing?: proto_common_common_pb.Timing;
  clientInfo?: proto_common_common_pb.ClientInfo;
  cohortMembership?: Array<CohortMembership>;
  deliveryLog?: Array<proto_delivery_delivery_pb.DeliveryLog>;
  request?: Array<proto_delivery_delivery_pb.Request>;
  insertion?: Array<proto_delivery_delivery_pb.Insertion>;
}

export type LogResponse = {};

export interface CohortArmMap {
  UNKNOWN_GROUP: 0;
  CONTROL: 1;
  TREATMENT: 2;
  TREATMENT1: 3;
  TREATMENT2: 4;
  TREATMENT3: 5;
}

export const CohortArm: CohortArmMap;

export type CohortArmString = 'UNKNOWN_GROUP' | 'CONTROL' | 'TREATMENT' | 'TREATMENT1' | 'TREATMENT2' | 'TREATMENT3';
